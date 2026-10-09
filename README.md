# Survival Game

Buka `index.html` di browser (double-click juga bisa).

## Struktur
```
survival-game/
├── index.html
├── css/style.css
├── js/
│   ├── config.js   # semua pengaturan (ukuran player, map, path asset)
│   ├── assets.js   # loader gambar
│   ├── camera.js   # kamera ikut player
│   ├── world.js    # gambar map
│   ├── player.js   # gerak & gambar player
│   ├── input.js    # klik / tap
│   └── main.js     # game loop
└── assets/images/
    ├── player/     # taruh sprite karakter di sini
    └── map/        # taruh gambar map di sini
```

## Pasang asset
Edit `js/config.js`:
- `player.sprite: 'assets/images/player/player.png'`
- `world.backgroundImage: 'assets/images/map/map.png'`
