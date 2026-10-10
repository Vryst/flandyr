// Semua pengaturan game ada di sini.

// ===== SKALA DUNIA =====
// pxPerKm   : 300 px = 1 km (dulu 100; map & player dibesarkan 3x, ukuran dunia tetap 80 km)
// timeScale : 1 detik nyata = berapa detik waktu game (360 = 1 detik nyata = 6 menit game, alias 1:360)
const SCALE = {
  pxPerKm: 300,
  timeScale: 360,
};

const CONFIG = {
  world: {
    // Gambar map (9208 x 7424, hasil upscale 4x dari 2302 x 1856) ditarik ke ukuran dunia ini, rasio tetap.
    // Dengan 300 px = 1 km: dunia = 80 km x 64,5 km
    width: 24000,             // px
    height: 19350,            // px (24000 * 1856 / 2302)
    spawn: { x: 17724, y: 16680 }, // posisi awal player (di darat; tengah map = danau)
    color: '#2a3326',
    gridSize: 100,            // grid sementara, set 0 untuk matikan
    backgroundImage: 'assets/images/map/map.png',
    // Map dipecah jadi petak (hasil tools/gen_map_tiles.py) supaya HP tidak perlu memuat 1 gambar raksasa.
    // Set ke null untuk kembali memakai backgroundImage utuh.
    mapTiles: { dir: 'assets/images/map/tiles', size: 2048, cols: 5, rows: 4, width: 9208, height: 7424 },
  },

  player: {
    radius: 12,               // ukuran lingkaran/sprite (px). Skala 300 px = 1 km, jadi ini hanya ikon simbolis
    speedKmh: 2,              // kecepatan jalan (km/jam, waktu game)
    speed: 0,                 // px per detik nyata, dihitung otomatis di bawah
    color: '#e8ecdf',
    sprite: 'assets/images/player/player.png',   // potret karakter (sudah bulat)
    rotateSprite: false,      // false = potret tetap tegak (true = ikut memutar sesuai arah jalan)
  },

  // Jenis medan (id sesuai Terrain: 0 darat, 1 air, 2 hutan).
  // speed = pengali kecepatan jalan, walkable = false berarti player tidak bisa masuk.
  terrain: {
    0: { name: 'Darat', walkable: true,  speed: 1.0 },
    1: { name: 'Air',   walkable: false, speed: 0 },
    2: { name: 'Hutan', walkable: true,  speed: 0.6 },
  },

  // Objek di dunia (bulat, bisa diinteraksi nanti).
  //   x, y           : posisi tengah (px dunia)
  //   radius         : radius lingkaran yang digambar (px)
  //   interactRadius : jarak player boleh berinteraksi (px, dari tengah objek)
  objects: [
    {
      id: 'tower',
      name: 'Tower of Mabel',
      x: 18000,
      y: 18000,
      radius: 90,
      interactRadius: 90,           // = radius: tombol Masuk muncul begitu player ada di dalam lingkaran
      interior: true,               // punya bagian dalam (lihat CONFIG.interior)
      sprite: 'assets/images/objects/tower.png',
    },
  ],

  // Bagian dalam Tower of Mabel: 3 lantai. Semua koordinat dalam px GAMBAR LANTAI (503 x ~495), dikali `scale` saat dipakai.
  //   walls   : poligon area yang bisa diinjak (segi delapan di dalam tembok)
  //   blocked : [x, y, w, h] furnitur / benda yang tidak bisa ditembus
  //   stairs  : tangga. dir 'up' / 'down', `to` = lantai tujuan, `arrive` = posisi player setelah sampai di lantai itu
  //   exit    : pintu keluar menara (hanya lantai 1)
  //   spawn   : posisi player waktu masuk dari luar (hanya lantai 1)
  //   Lantai 0 = Halaman (di luar menara, sebelum masuk). Lantai 3 memakai gambar yang SAMA dengan halaman (imageFrom: 0), tapi collision-nya beda.
  //   Opsional per lantai: label (nama di pojok kanan atas), zoom (>1 = kamera ikut player), blockedPolys (poligon yang tidak bisa diinjak).
  interior: {
    scale: 2,                 // gambar lantai diperbesar 2x
    startFloor: 0,            // masuk dari peta dunia -> mulai di Halaman
    speed: 260,               // px per detik (px lantai yang sudah di-scale)
    playerRadius: 26,         // ukuran karakter di dalam menara (px lantai ter-scale)
    margin: 26,               // jarak (px lantai) dari tangga / pintu supaya tombol muncul
    pickupRadius: 50,         // jarak (px lantai ter-scale) barang masih muncul di panel Pencarian di dalam menara
    floors: [
      {
        id: 0, image: 'assets/images/tower/yard.jpg', w: 1200, h: 896, label: 'Halaman', zoom: 1.8,
        walls: [[10,10],[1190,10],[1190,886],[10,886]],     // seluruh gambar bebas dijelajahi (tepi gambar = batas)
        blocked: [],
        blockedPolys: [
          [[626,226],[797,226],[897,322],[897,534],[803,630],[627,630],[522,534],[522,322]],     // hanya menara yang collision
        ],
        stairs: [{ x: 740, y: 606, w: 56, h: 26, dir: 'in', to: 1, arrive: { x: 251, y: 78 } }],    // pintu di tembok bawah menara (di atas jalan berbatu) -> lantai 1
        exit: { x: 690, y: 862, w: 110, h: 34 },                                                    // jalan di bawah -> peta dunia
        spawn: { x: 740, y: 835 },
      },
      {
        id: 1, image: 'assets/images/tower/floor1.png', w: 503, h: 495,
        walls: 'oct',
        blocked: [[41,290,213,90],[131,240,48,52],[252,293,44,44],[363,253,96,110],[381,373,36,35],[366,103,93,142],[119,388,90,70],[274,423,109,32]],
        stairs: [{ x: 36, y: 133, w: 87, h: 135, dir: 'up', to: 2, arrive: { x: 140, y: 240 } }],
        exit: { x: 214, y: 38, w: 74, h: 36, to: 0, arrive: { x: 768, y: 650 } },     // pintu di tembok atas -> keluar ke Halaman (depan pintu menara)
        spawn: { x: 251, y: 78 },
      },
      {
        id: 2, image: 'assets/images/tower/floor2.png', w: 503, h: 495,
        walls: 'oct',
        blocked: [[219,46,74,166],[296,41,80,36],[96,66,75,95],[36,128,45,43],[437,139,28,28],[63,356,85,75],[203,381,160,70]],
        stairs: [
          { x: 33, y: 181, w: 88, h: 115, dir: 'down', to: 1, arrive: { x: 140, y: 200 } },
          { x: 381, y: 179, w: 87, h: 147, dir: 'up',   to: 3, arrive: { x: 775, y: 460 } },
        ],
      },
      {
        // Atap menara: gambar SAMA dengan Halaman (imageFrom: 0), koordinat di ruang gambar yang sama; hanya atapnya yang bisa diinjak.
        id: 3, imageFrom: 0, w: 1200, h: 896, zoom: 2.4,
        walls: [[615,250],[800,250],[866,320],[866,542],[800,601],[615,601],[552,542],[552,320]],
        blocked: [[566,520,66,64]],
        stairs: [{ x: 797, y: 397, w: 69, h: 125, dir: 'down', to: 2, arrive: { x: 362, y: 240 } }],
      },
    ],
  },

  // Inventory berbasis slot (grid) ala Resident Evil / Delta Force.
  // Ukuran grid ditentukan oleh tas yang dipakai (bag): cols x rows slot.
  inventory: {
    bag: 'backpack',          // id tas yang sedang dipakai (kunci di `bags`)
    character: null,          // gambar karakter, mis. 'assets/images/player/char.png' (null = siluet bawaan)
    // Slot perlengkapan di sekitar karakter (area karakter 360 x 300 px).
    //   side: 'left' / 'right' / 'center', top: jarak dari atas (px), w / h: ukuran slot (px, default 64 x 64).
    // Slot 'bag' menentukan ukuran grid; slot lain masih kosong (menunggu item).
    slots: [
      { id: 'bag',   label: 'Tas',          side: 'left',  top: 14  },   // samping kepala (ada tombol Jatuhkan)
      { id: 'armor', label: 'Baju / Armor', side: 'left',  top: 134 },   // di bawah tas
      { id: 'hand',  label: 'Tangan',       side: 'right', top: 134 },   // samping badan
    ],
    cellSize: 52,             // ukuran maksimal 1 slot (px). Otomatis mengecil supaya tas besar tetap muat di layar
    minCellSize: 26,          // batas terkecil; kalau tas lebih besar lagi, layar bisa di-scroll
    pickupRadius: 50,         // jarak (px dunia) barang masih muncul di panel Pencarian (50 px ≈ 167 m)
    start: [],                // isi tas waktu mulai game (id item, kosongkan [] kalau tidak mau)
    bags: {
      backpack: { name: 'Ransel', cols: 3, rows: 3, image: 'assets/images/items/backpack.png' },
      // tas lain nanti tinggal tambah di sini, mis. { name: 'Tas Besar', cols: 5, rows: 4, image: '...' }
    },
  },

  // Definisi item. Format:
  //   id: { name: 'Pisau', w: 1, h: 2, icon: 'assets/images/items/pisau.png', color: '#4a4a52' }
  // w x h = jumlah slot yang dipakai item di grid. icon boleh dikosongkan (tampil nama + warna `color`).
  // Tas juga bisa jadi item (lihat CONFIG.inventory.bags), jadi tidak perlu didaftarkan di sini.
  items: {
    pisau: { name: 'Pisau', w: 1, h: 2, icon: 'assets/images/items/pisau.png' },
  },

  // Barang tergeletak di dunia (di luar tas): { id: 'pisau', x: 17800, y: 17400 }
  worldItems: [
    { id: 'pisau', x: 17780, y: 16700 },
  ],

  // Tas tergeletak di dunia, lengkap dengan isinya: { bag: 'backpack', x, y, items: ['pisau'] }
  worldBags: [
    { bag: 'backpack', x: 17690, y: 16650, items: [] },
  ],

  camera: {
    zoom: 1,                  // zoom awal
    minZoom: 0.5,             // zoom out maksimal
    maxZoom: 3,               // zoom in maksimal
    zoomStep: 1.1,            // kelipatan per scroll / tombol
  },

  // Fog of war: area di luar jarak pandang gelap.
  fog: {
    enabled: false,
    radiusKm: 5,              // jarak pandang (km), mata manusia normal ~4-5 km
    radius: 0,                // px, dihitung otomatis di bawah
    softness: 0.35,           // 0 = tepi tegas, 1 = pudar dari tengah
    color: '8,10,8',          // warna kabut (RGB)
    opacity: 1,               // 1 = di luar jarak pandang gelap total
  },

  marker: {
    color: '255,255,255',
  },

  // Sambungan Firebase Realtime Database (lihat js/online.js + js/firebase-config.js)
  online: {
    enabled: true,            // false = main offline murni (tanpa Firebase)
    connectTimeoutMs: 8000,   // lebih lama dari ini waktu mulai -> main offline
    presenceMs: 200,          // interval kirim posisi ke pemain lain (ms)
    presenceStaleMs: 60000,   // pemain tanpa kabar selama ini disembunyikan
    saveDelayMs: 400,         // jeda simpan progress setelah inventory berubah
    positionSaveMs: 3000,     // simpan posisi tiap sekian ms (kalau berubah)
  },
};

// ===== NILAI TURUNAN (jangan diedit, ubah angka di atas) =====
// px/detik = km/jam * px/km / 3600 detik * timeScale
CONFIG.player.speed = CONFIG.player.speedKmh * SCALE.pxPerKm / 3600 * SCALE.timeScale;
CONFIG.fog.radius = CONFIG.fog.radiusKm * SCALE.pxPerKm;
