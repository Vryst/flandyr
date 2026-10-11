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

## Vitals (darah, energi, kenyang, minum)
Kode: `js/vitals.js`, laju di `CONFIG.vitals`. Tampil sebagai 4 bar di bawah karakter pada layar inventory (bar < 25% menyala merah). Semua 0..100 dan ikut tersimpan online (`players/{uid}/save/v`).
- Kenyang & minum turun terus (lebih cepat saat bergerak). Energi turun saat jalan, pulih saat diam; energi rendah (< 20) memperlambat jalan sampai 50%.
- Darah pulih pelan kalau kenyang & minum >= 30; berkurang kalau salah satunya habis. Darah 0 = tulisan "Sekarat" (belum ada mati / respawn).
- Game ter-pause saat inventory terbuka, jadi vitals tidak turun. Offline / tab tertutup juga tidak turun.
- Untuk makan / minum / obat nanti: `Vitals.add('hunger', 30)`, `Vitals.add('thirst', 40)`, `Vitals.add('health', -20)`.

## Map berpetak
Map (9208 x 7424) dipecah jadi petak 2048 px di `assets/images/map/tiles/` supaya HP tidak perlu memuat 1 gambar raksasa. Kalau `map.png` diganti, jalankan `python3 tools/gen_map_tiles.py`. Set `CONFIG.world.mapTiles` ke `null` untuk kembali ke gambar utuh.

## Firebase (Realtime Database)
Backend memakai project `flandyr-1`. Kode: `js/online.js` (logika), `js/firebase-config.js` (kunci web, memang publik), SDK compat dimuat dari CDN di `index.html`. Matikan dengan `CONFIG.online.enabled = false` (game jalan offline seperti dulu; offline juga otomatis kalau SDK / koneksi gagal).

### Yang disinkron
| Data | Lokasi di database | Catatan |
|---|---|---|
| Progress pemain | `players/{uid}/save` | posisi, dunia / lantai menara, tas + isinya. Pribadi (hanya pemilik) |
| Posisi pemain lain | `presence/{loc}/{area}/{uid}` | string `"x,y,vx,vy,a"`. Per area 2400 px; klien hanya mendengarkan area sendiri + 8 tetangga. Hilang otomatis saat putus / tab disembunyikan |
| Barang & tas di tanah | `world/items`, `world/bags` | dunia bersama; ambil barang/tas lewat transaksi (tidak bisa dobel) |
| Jam game | `world/meta/epoch` | semua pemain jam yang sama (mulai 06:00 hari ke-1), tampil di HUD |

### Setup sekali (di Firebase console)
1. **Authentication > Sign-in method > Anonymous > Enable.**
2. **Realtime Database > Rules**: tempel isi `database.rules.json` lalu Publish (atau `firebase deploy --only database`; `firebase.json` + `.firebaserc` sudah disiapkan).
3. Buka game lewat http(s), jangan double-click file: `python3 -m http.server` lalu buka `http://localhost:8000` (`localhost` sudah termasuk domain yang diizinkan Auth). Kalau di-host, tambahkan domainnya di **Authentication > Settings > Authorized domains**.

### Catatan
- Pemain pertama yang masuk menulis isi awal dunia dari `CONFIG.worldItems` / `worldBags` (penanda `world/meta/seeded`). Mengubah config itu setelahnya tidak otomatis muncul: hapus node `world` di console untuk mengisi ulang.
- Validasi di sisi client + Security Rules (format data, batas angka, progress hanya milik sendiri). Pemain yang memodifikasi client masih bisa curang (mis. menghapus semua barang dunia). Untuk anti-cheat sungguhan, aksi ambil/pindah barang perlu dipindah ke Cloud Functions.
- Hemat download: (1) presence dibagi per area, hanya pemain di sekitar yang didownload; (2) dead reckoning, posisi dikirim hanya saat mulai / belok / ganti kecepatan / berhenti / melenceng >4 px (jalan lurus 3 menit ≈ 3 tulisan); (3) payload satu string kecil, tanpa nama / timestamp; (4) tab di latar belakang berhenti mendengarkan; (5) data dunia tidak lagi terdownload dua kali saat start. Setelah update, hapus node `presence` lama di console (formatnya berubah). Angka "online · N" sekarang = pemain di sekitar, bukan total.

## Battle
Kode: `battle-arena.js` (arena), `battle.js` (aturan, unit di map gede, AI monster), `battle-net.js` (Firebase), `battle-ui.js` (joystick & tombol). Semua angka di `CONFIG.battle`.
- **Unit monster di map gede** (`CONFIG.battle.units`): lingkaran seperti player yang berkelana jauh dari kemahnya (`roam` px; rute antar titik acak yang jalurnya tidak lewat air / menara, tiap blok rute mulai & kembali ke kemah / pintu menara) (`home`: mis. `'tower'` = ngecamp di Tower of Mabel, atau `{x, y}`). Posisinya dihitung dari jam server, jadi semua pemain melihat posisi yang sama tanpa trafik jaringan. Isi lingkaran = `pack`: 1 atau banyak monster, jenis campur boleh.
- **Menabrak unit** = masuk battle. Map battle ditentukan dari TEMPAT bentrok: dalam `fixedMargin` (50 px) dari tepi Tower of Mabel -> battle di **Halaman Mabel** (arena tetap, satu instance per unit); selebihnya -> **arena acak** sesuai medan (hutan; nanti kota / desa). Paksa dengan `arena: 'fixed' | 'random'` di unit. Rincian arena acak: Arena = `CONFIG.battle.arenas.forest.templates` (sekarang 1 gambar `assets/images/battle/forest1.jpg` + poligon area injak + rintangan; tambah template = map acak bertambah, dipilih dari seed room).
- **Menang** = semua monster mati -> unit hilang `respawnSec` detik untuk semua pemain (`battle_state/{id}` di database), lalu muncul lagi di kemah. **Kabur** = keluar arena (unit tetap ada).
- **Siapa lawan**: monster dikendalikan **host** = perangkat pertama di room (satu room per unit). Host keluar -> pemain lain mengambil alih acak dari snapshot terakhir. Pemain lain yang menabrak unit yang sama masuk room yang sama (kerja sama / friendly fire).
- **Raid & kabur di Tower of Mabel**: battle berlangsung di SELURUH menara (Halaman, lantai 1, 2, Atap), bukan cuma Halaman. Selama battle player tetap bisa pakai tombol aksi (Masuk / Naik / Turun / Keluar). Monster yang sedang mengejar (atau pernah dilukai player) ikut naik-turun tangga ke lantai player (`followFloors`); monster tidak keluar menara. Serangan & posisi punya nomor lantai, jadi yang beda lantai tidak saling kena / kelihatan. **Kabur** = player keluar dari Halaman ke peta dunia (pintu "Keluar" di Halaman); pindah lantai di dalam menara bukan kabur. Tombol "Kabur" instan di raid menara disembunyikan (`fixedFleeButton: true` untuk memunculkannya lagi). Kode: `battle.js` (`pursueOtherFloor`, `transit`, `arenaFor`).
- **Monster terus hidup di menara**: pemain terakhir keluar / tumbang -> monster yang masih hidup tidak hilang & tidak spawn ulang (snapshot lantai, posisi, darah di `battle/{room}/mon` + `battle_state/hold:{room}`; unitnya disembunyikan dari peta dunia lewat `battle_state/in:{unit}`). Tanpa batas waktu: sampai dikalahkan semua. Server tidak menjalankan AI, jadi saat ada pemain masuk lagi gerak mereka selama ditinggal dihitung ulang (`Battle.catchUp`, maks `CONFIG.battle.raidCatchUpSec` = 600 dtk terakhir): jalan-jalan bebas, kadang naik / turun tangga (`wanderStairsChance`) ke Halaman / lantai 1 / 2 / Atap. Yang sudah mati tetap mati. **Publish ulang `database.rules.json`** (ada `m/units` + aturan `mon` baru).
- **Unit keluar-masuk menara**: unit `cycle` tinggal di menara `CONFIG.battle.leaveStaySec` (acak 90-300 dtk) lalu, kalau tidak sedang bertarung, semua monsternya jalan ke pintu Keluar Halaman (turun tangga dulu kalau di lantai lain). Begitu semua sampai, unit keluar dari raid dan muncul lagi di peta gede (`battle_state/out:{unit}` mencegah langsung masuk lagi), darah pulih penuh. Pemain menyerang / dikejar saat mereka menuju pintu = batal, tetap di menara. Sebaliknya, unit lain yang jadwal `cycle`-nya masuk menara saat raid berjalan ditambahkan host ke room yang sama (monster muncul di pinggir Halaman, ikut raid; id baru, ditandai `u` di snapshot).
- **Halaman <-> Atap satu pandangan**: monster & pemain (di battle) di lantai 0 kelihatan dari lantai 3 dan sebaliknya (`CONFIG.interior.linkedFloors`). Hanya terlihat: serangan & bidikan tetap per lantai.
- **Siaga / Santai hanya ada di map battle** (di dalam menara; di peta dunia tombolnya tidak ada). Siaga = masuk mode battle walau tidak ada monster: bisa menyerang, dan serangan pemain lain bisa mengenai kita (`friendlyFire`, 0.5 = setengah damage). Kalau nanti ada unit yang masuk menara, host memunculkan raid di room yang sama. Santai (keluar mode battle) hanya bisa kalau tidak ada monster hidup.
- **Tumbang** = keluar battle / menara, darah jadi `koHealth`, muncul lagi di `CONFIG.battle.respawn` (18000, 17800: di atas Tower of Mabel, peta dunia).
- **Siaga / Santai** hanya menampilkan / menyembunyikan kontrol battle. HP: joystick kiri jalan, kanan kipas = **tebas**, segi tajam = **tusuk** (ketuk = bidik otomatis, tahan + geser = bidik sendiri). PC: WASD, klik kiri tebas, klik kanan tusuk (atau J / K). Saat Siaga di map gede, ketuk-2x dimatikan, diganti tombol aksi di tengah bawah (Masuk / Naik / Turun / Keluar). Di dalam battle kontrol selalu tampil.
- **Tangan kosong**: hanya SATU serangan, kotak 20 px di depan badan (tombol kipas / klik kiri / J; tombol tusuk hilang). Tebas + tusuk khusus pisau. Senjata yang tidak punya `slash` / `thrust` di config otomatis menyembunyikan tombolnya.
- **Spawn di Mabel** (Halaman): selalu di PINGGIR dan sesuai arah masuk: player yang datang dari atas menara muncul di atas, dari kiri di kiri, dst. Monster yang masuk menara muncul dari arah mereka datang (`enterAngle`). Monster yang masuk saat player sudah di dalam menara juga memulai raid saat itu juga.
- **AI monster**: melihat player dalam `aggro` -> langsung kejar (teman satu kawanan <= 450 px ikut, melepas target di 1,8x aggro). Kalau player jauh, monster jalan-jalan di map battle: berkumpul ke satu titik atau mencar ke titik masing-masing (acak per battle) sampai ada yang dekat / melukai mereka.
- **Senjata** di `CONFIG.battle.weapons` (item punya `weapon: 'id'`); tanpa pisau = tangan kosong. Friendly fire: `friendlyFire` (0 = mati).
- **Monster besar** (troll): gerak lambat dengan batas putar (`turn`), serangan ada peringatan merah yang bisa dihindari, jalan lewat medan alir (BFS) sesuai ukuran badan.
- **Unit masuk menara** (`cycle: {out, in, offset}`): unit yang berkemah di Tower of Mabel berkeliaran, jalan ke pintu, masuk, menunggu di dalam, lalu keluar lagi (semua dari jam server, sama untuk semua pemain). Pemain yang masuk menara saat ada unit di dalam langsung menghadapi mereka di Halaman (arena tetap, raid otomatis); menang = unit-unit itu hilang sampai respawn. Hapus `battle: {}` di lantai Halaman (`CONFIG.interior`) = menara aman.
- **Kejar**: player lebih dekat dari `aggro` (default 170 px) -> unit mengejar dengan `chaseSpeed` (52 px/detik; player ~60 di darat, ~36 di hutan). Terlihat hanya di perangkat player yang dikejar (tidak disinkron); lolos / menjauh -> unit balik ke jalur bawaan. `chase: false` per unit = tidak mengejar.
- Darah = `Vitals.health`; tumbang -> keluar arena dengan darah `koHealth`.
- **Wajib**: publish ulang `database.rules.json` (node `battle` dan `battle_state` baru).

### Sinkron kejar + lingkaran battle di map gede
- **Kejaran disinkron**: pemain yang didekati unit (dalam `aggro`) mengklaim kejaran lewat transaksi `chase/{unitId}` = `"uid,x,y,vx,vy,a,t"`, lalu mengirim posisi unit tiap 400 ms (juga jadi heartbeat). Pemain lain memperkirakan posisi dari kecepatan + haluskan, jadi serigala terlihat di koordinat yang sama di semua layar. Tidak ada yang bisa mengklaim kejaran ganda; pemilik putus -> `onDisconnect` menghapusnya (kiriman > 3 dtk dianggap basi). Kejaran lepas -> unit berjalan balik ke jalur bawaan (juga terlihat semua pemain).
- **Lingkaran battle**: unit menabrak player (arena acak) -> unit berhenti di titik bentrok dan muncul lingkaran merah berdenyut di map gede (`encounter/{unitId}` = `"x,y,t"`, heartbeat host tiap 20 dtk, > 60 dtk tanpa heartbeat = basi). Pemain lain yang masuk lingkaran (`radius unit + CONFIG.battle.ringPad`, default 40 px) otomatis bergabung ke room yang sama (`enc:{unitId}`). Pemain terakhir keluar / unit kalah -> lingkaran hilang (unit yang tidak kalah berjalan balik ke jalurnya).
- **Auto-join teman**: pemain yang berdiri <= `CONFIG.battle.joinNearPx` (30 px) dari korban saat bentrok (dalam `joinWindowSec` = 3 dtk) otomatis ikut masuk battle. Yang lebih jauh cuma melihat lingkaran dan bisa bergabung dengan berjalan masuk.
- Bentrok di dekat Tower of Mabel tetap masuk raid menara seperti biasa (tanpa lingkaran).
- **Wajib**: publish ulang `database.rules.json` (node `chase` dan `encounter` baru).

### Sinkron gerak & serangan di battle
- **Dead reckoning di battle** (sama seperti map gede): posisi pemain dikirim `x,y,a,hp,dn,fl,vx,vy` dan snapshot monster punya `vx,vy` di belakang. Dikirim hanya kalau penerima akan salah memperkirakan (melenceng > 3-4 px, belok, ganti kecepatan, mulai / berhenti, ganti state) + heartbeat 1 dtk saat bergerak. Penerima memperkirakan posisi dari kecepatan (maks 1,5 dtk) lalu menghaluskan. Jeda minimum kiriman: `CONFIG.battle.sendMinMs` (50).
- **Serangan sinkron waktu**: event serangan (monster & pemain) membawa waktu server. Perangkat yang menerimanya terlambat memajukan jam serangan sebesar keterlambatan (monster maks 60% windup, serangan pemain penuh maks 0,5 dtk), jadi peringatan merah & momen kena jatuh di detik yang sama di semua layar (`Battle.lagFor`).

- **Arena hutan tanpa collision (sementara)**: `CONFIG.battle.arenas.forest.noCollision = true`. Pemain & monster bebas bergerak, hanya dibatasi tepi gambar arena. Hapus / `false` untuk mengaktifkan collision lagi.
- **Pintu kabur di arena acak**: pintu TAK TERLIHAT (tidak digambar, pemain harus meraba sendiri; hanya cincin progres yang muncul saat berdiri di dalamnya) jauh dari spawn pemain (`exit: [x, y]` di template, px gambar; tanpa `exit` = titik terjauh dari spawn). Berdiri di dalamnya `CONFIG.battle.exitHoldSec` (1 dtk, ada lingkaran progres) = keluar arena (tombol Kabur tetap ada). Ukuran: `CONFIG.battle.exitR`.

### Map battle tetap lain (Padang & Reruntuhan Batu Runik)
Dua map bergambar yang BUKAN arena acak. Konsepnya sama dengan Tower of Mabel: objek di peta dunia (`CONFIG.objects`: `runeglade` di 17300,17300 dan `runeruins` di 18700,17300) -> "Masuk" -> arena tetap + raid + Siaga.
- **Tanpa collision (sementara)**: lantainya (`CONFIG.interior.floors` id 10 & 11) `walls` = seluruh gambar, `blocked` / `blockedPolys` kosong, jadi pemain & monster bebas ke mana saja (hanya dibatasi tepi gambar). Mau pasang collision nanti: isi `blocked` (`[x, y, w, h]`) / `blockedPolys` (poligon) seperti Halaman. Koordinat lantai = px gambar / 2 (`CONFIG.interior.scale`). Tekan `B` di dalam map untuk lihat tembok / zona keluar.
- Gambar: `assets/images/tower/runeglade.jpg` (1792 x 2400) dan `runeruins.jpg` (2048 x 2048), 1:1 dengan arena. Ikon di peta dunia: `assets/images/objects/runeglade.png`, `runeruins.png`.
- Pemain muncul di `spawn` lantai (`fixedSpawn: true`), keluar lewat zona `exit` (ujung jalan di tepi gambar). Monster muncul di pinggir arena, dijauhkan dari tempat muncul pemain.
- Tiap objek punya room & raid sendiri: kunci room `tower:{startFloor objek}` (Mabel tetap `tower:0`, ini `tower:10` / `tower:11`). Unit `cycle` hanya masuk ke objek tempat dia berkemah (`home`): `serigala3` -> Padang, `bayangan2` -> Reruntuhan. Hapus unitnya di `CONFIG.battle.units` = map itu tanpa raid (Siaga tetap jalan).
- Objek baru = tambah entri `CONFIG.objects` (`interior: true`, `startFloor`), lantai dengan `tower: '<id objek>'`, dan (opsional) unit `home: '<id objek>'`.
- **Publish ulang `database.rules.json`**: progress sekarang menyimpan `obj` (objek yang sedang dimasuki) dan `floor` boleh sampai 99.
