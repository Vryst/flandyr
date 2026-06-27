package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	"backend/ws"

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