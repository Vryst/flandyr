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

## Firebase (Realtime Database)
Backend memakai project `flandyr-1`. Kode: `js/online.js` (logika), `js/firebase-config.js` (kunci web, memang publik), SDK compat dimuat dari CDN di `index.html`. Matikan dengan `CONFIG.online.enabled = false` (game jalan offline seperti dulu; offline juga otomatis kalau SDK / koneksi gagal).

### Yang disinkron
| Data | Lokasi di database | Catatan |
|---|---|---|
| Progress pemain | `players/{uid}/save` | posisi, dunia / lantai menara, tas + isinya. Pribadi (hanya pemilik) |
| Posisi pemain lain | `presence/{uid}` | tampil di map, halaman, dan lantai menara yang sama; hilang otomatis saat putus |
| Barang & tas di tanah | `world/items`, `world/bags` | dunia bersama; ambil barang/tas lewat transaksi (tidak bisa dobel) |
| Jam game | `world/meta/epoch` | semua pemain jam yang sama (mulai 06:00 hari ke-1), tampil di HUD |

### Setup sekali (di Firebase console)
1. **Authentication > Sign-in method > Anonymous > Enable.**
2. **Realtime Database > Rules**: tempel isi `database.rules.json` lalu Publish (atau `firebase deploy --only database`; `firebase.json` + `.firebaserc` sudah disiapkan).
3. Buka game lewat http(s), jangan double-click file: `python3 -m http.server` lalu buka `http://localhost:8000` (`localhost` sudah termasuk domain yang diizinkan Auth). Kalau di-host, tambahkan domainnya di **Authentication > Settings > Authorized domains**.

### Catatan
- Pemain pertama yang masuk menulis isi awal dunia dari `CONFIG.worldItems` / `worldBags` (penanda `world/meta/seeded`). Mengubah config itu setelahnya tidak otomatis muncul: hapus node `world` di console untuk mengisi ulang.
- Validasi di sisi client + Security Rules (format data, batas angka, progress hanya milik sendiri). Pemain yang memodifikasi client masih bisa curang (mis. menghapus semua barang dunia). Untuk anti-cheat sungguhan, aksi ambil/pindah barang perlu dipindah ke Cloud Functions.
- Presence mengirim posisi ~5x per detik per pemain yang bergerak dan semua pemain membaca semuanya. Untuk pemain banyak, nanti dibatasi per area.
