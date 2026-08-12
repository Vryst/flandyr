```
___________.__                     .___
\_   _____/|  | _____    ____    __| _/__.__._______
 |    __)  |  | \__  \  /    \  / __ <   |  |\_  __ \
 |     \   |  |__/ __ \|   |  \/ /_/ |\___  | |  | \/
 \___  /   |____(____  /___|  /\____ |/ ____| |__|
     \/              \/     \/      \/\/

           r e a l - t i m e   m u l t i p l a y e r   a r e n a
```

<p align="center">
  <img alt="status" src="https://img.shields.io/badge/status-prototype-orange">
  <img alt="backend" src="https://img.shields.io/badge/backend-Go-00ADD8">
  <img alt="frontend" src="https://img.shields.io/badge/frontend-Next.js-black">
  <img alt="protocol" src="https://img.shields.io/badge/protocol-WebSocket-blueviolet">
</p>

Flandyr adalah arena multiplayer real-time: pemain bergerak di dunia yang sama,
diserbu monster yang dikontrol AI server-side, saling adu skill, dan bisa
custom avatar sendiri. Semua state disinkronkan lewat WebSocket, gak ada
polling receh.

```
                         ┌──────────────────────────┐
        ┌────────┐       │            HUB            │       ┌────────┐
        │ Player │◄──WS──┤  • broadcastPlayers()     ├──WS──►│ Player │
        │   #1   │       │  • broadcastMonsters()    │       │   #2   │
        └────────┘       │  • monsterAI()            │       └────────┘
             ▲            │  • respawnCheck()          │            ▲
             │             └────────────┬─────────────┘            │
             │                          │                          │
             │                     ┌────▼────┐                     │
             └─────────HTTP────────┤ Monster ├──────────HTTP───────┘
                    /upload-avatar └─────────┘  /avatars/*.png
```

## ✦ Fitur

```
  [x] Player realtime via WebSocket (posisi, HP, skill)
  [x] Monster AI server-side dengan skill & cooldown
  [x] Respawn check otomatis buat player & monster yang mati
  [x] Upload avatar custom (jpg/jpeg/png/gif/webp, maks 300KB)
  [x] Broadcast state ke semua client yang konek
  [ ] Loot system                         <- work in progress
```

## ✦ Tumpukan Teknologi

```
   ┌───────────────┐        ┌───────────────┐
   │   frontend/    │        │   backend/     │
   │───────────────│        │───────────────│
   │ Next.js 16     │  WS +  │ Go 1.26        │
   │ React 19       │  HTTP  │ gorilla/websocket
   │ TailwindCSS 4  │◄──────►│ google/uuid    │
   │ TypeScript     │        │ net/http       │
   └───────────────┘        └───────────────┘
```

## ✦ Cara Jalanin

**Backend**

```bash
$ cd backend
$ go run main.go
  server jalan di :8080
```

**Frontend**

```bash
$ cd frontend
$ npm install
$ npm run dev
  ▲ Next.js 16 - ready on http://localhost:3000
```

Set `PORT` di env kalau mau ganti port backend, defaultnya `8080`.

## ✦ Endpoint

```
  GET/WS   /ws                connect ke arena, realtime state sync
  POST     /upload-avatar     upload gambar avatar (multipart/form-data)
  GET      /avatars/:file     serve file avatar yang udah diupload
```

## ✦ Struktur Proyek

```
flandyr/
├── backend/
│   ├── main.go            entrypoint, HTTP routes, graceful shutdown
│   ├── avatars/           hasil upload avatar player
│   └── ws/
│       ├── hub.go         broadcast loop, monster AI, respawn check
│       ├── client.go      koneksi websocket per player
│       ├── player.go      model Player
│       └── monster.go     model Monster
└── frontend/
    └── src/
        ├── app/           halaman Next.js (App Router)
        ├── hooks/         useSocket.ts - koneksi ke hub
        └── types/         tipe shared (Player, dll)
```

```
                    ╔═══════════════════════════════╗
                    ║   have fun, jangan afk lama²   ║
                    ╚═══════════════════════════════╝
```
