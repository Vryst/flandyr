package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
	"backend/ws"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// TODO: ganti ini pas production! batasi ke origin spesifik, contoh:
	// return r.Header.Get("Origin") == "https://yourdomain.com"
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func serveWs(hub *ws.Hub, w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("upgrade error dari %s: %v", r.RemoteAddr, err)
        return
    }
    ws.NewClient(hub, conn)
}

// uploadAvatar menerima file gambar via multipart form, simpan ke disk,
// dan kembalikan URL publiknya. Ukuran dibatasi 300KB.
func uploadAvatar(hub *ws.Hub, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// CORS header supaya Next.js bisa akses
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	const maxSize = 300 * 1024 // 300KB
	r.Body = http.MaxBytesReader(w, r.Body, maxSize)
	if err := r.ParseMultipartForm(maxSize); err != nil {
		http.Error(w, "file terlalu besar (maks 300KB)", http.StatusRequestEntityTooLarge)
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		http.Error(w, "field 'avatar' tidak ditemukan", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// validasi ekstensi
	ext := filepath.Ext(header.Filename)
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	if !allowed[ext] {
		http.Error(w, "tipe file tidak didukung", http.StatusBadRequest)
		return
	}

	// simpan dengan nama unik supaya tidak collision
	filename := uuid.NewString() + ext
	savePath := filepath.Join("avatars", filename)

	if err := os.MkdirAll("avatars", 0755); err != nil {
		http.Error(w, "gagal buat folder", http.StatusInternalServerError)
		return
	}

	dst, err := os.Create(savePath)
	if err != nil {
		http.Error(w, "gagal simpan file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "gagal tulis file", http.StatusInternalServerError)
		return
	}

	// kirim URL balik ke frontend
	scheme := "http"
	host := r.Host
	avatarURL := fmt.Sprintf("%s://%s/avatars/%s", scheme, host, filename)

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"url":%q}`, avatarURL)
	log.Printf("avatar uploaded: %s", avatarURL)
}

func main() {
	// port dari env, fallback ke 8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	hub := ws.NewHub()
	go hub.Run()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})
	// endpoint upload avatar via HTTP (bukan WS lagi)
	mux.HandleFunc("/upload-avatar", func(w http.ResponseWriter, r *http.Request) {
		// handle preflight CORS
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		uploadAvatar(hub, w, r)
	})
	// serve file avatar yang sudah di-upload
	mux.Handle("/avatars/", http.StripPrefix("/avatars/", http.FileServer(http.Dir("avatars"))))

	// pakai http.Server eksplisit buat bisa set timeout & graceful shutdown
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// jalankan server di goroutine sendiri biar main bisa dengerin signal
	go func() {
		log.Printf("server jalan di :%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("ListenAndServe error: %v", err)
		}
	}()

	// dengerin SIGINT (Ctrl+C) dan SIGTERM (dari docker/k8s stop)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down server...")

	// kasih waktu 10 detik buat koneksi aktif selesai dulu sebelum paksa tutup
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("server shutdown gagal: %v", err)
	}

	log.Println("server berhenti dengan bersih")
}