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
│   ├── inventory.js    # logika inventory slot (grid)
│   ├── inventory-ui.js # tampilan inventory + drag & drop
│   └── main.js     # game loop
└── assets/images/
    ├── player/     # taruh sprite karakter di sini
    └── map/        # taruh gambar map di sini
```

## Pasang asset
Edit `js/config.js`:
- `player.sprite: 'assets/images/player/player.png'`
- `world.backgroundImage: 'assets/images/map/map.png'`

## Inventory
Tekan `I` / `Tab` atau klik tombol tas (kiri bawah). Ukuran grid ikut tas di `CONFIG.inventory.bags` (Ransel = 3x3). Item didefinisikan di `CONFIG.items` (sekarang hanya pisau).

### Jatuhkan tas & panel Pencarian
- Seret tas dari slot Tas ke panel Pencarian = tas dijatuhkan ke tanah **beserta isinya**. Setelah itu player tanpa tas (tidak bisa membawa barang).
- Panel **Pencarian** menampilkan yang ada di sekitar player: tiap tas yang tergeletak jadi panel sendiri + grid isinya (seret header tas ke slot Tas untuk memakainya, isi ikut; kalau slot terisi, tasnya ditukar), dan bagian **Di luar tas** untuk barang yang tergeletak tanpa tas.
- Drag item antar grid (tas player <-> tas di tanah). Lepas di panel Pencarian (di luar grid) = item jatuh ke tanah, jadi barang di luar tas. Ketuk item di "Di luar tas" = ambil ke tas. `R` / klik kanan saat drag = putar.
- Tas **kosong** bisa disimpan sebagai item 1x1 di tas lain: seret tas (dari slot Tas atau header tas di tanah) ke grid mana pun. Seret item tas itu ke slot Tas untuk memakainya, atau ke luar grid / ketuk 2x untuk menjatuhkannya lagi. Ukurannya diatur `itemW` / `itemH` di `CONFIG.inventory.bags`.
- Barang yang dijatuhkan di dalam menara tetap di lantai itu.
- Isi awal: `CONFIG.inventory.start`, barang di dunia: `CONFIG.worldItems`, tas di dunia + isinya: `CONFIG.worldBags`.
- Kode: `inventory.js` (Grid + tas player), `ground-items.js` (barang & tas di tanah), `inventory-ui.js` (tampilan + drag & drop).

## Map berpetak
Map (9208 x 7424) dipecah jadi petak 2048 px di `assets/images/map/tiles/` supaya HP tidak perlu memuat 1 gambar raksasa. Kalau `map.png` diganti, jalankan `python3 tools/gen_map_tiles.py`. Set `CONFIG.world.mapTiles` ke `null` untuk kembali ke gambar utuh.
