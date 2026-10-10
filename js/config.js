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
  },

  player: {
    radius: 12,               // ukuran lingkaran/sprite (px). Skala 300 px = 1 km, jadi ini hanya ikon simbolis
    speedKmh: 15,             // kecepatan jalan (km/jam, waktu game); sebelumnya 5
    speed: 0,                 // px per detik nyata, dihitung otomatis di bawah
    color: '#e8ecdf',
    sprite: null,             // contoh: 'assets/images/player/player.png'
    rotateSprite: true,       // sprite ikut menghadap arah jalan
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
  interior: {
    scale: 2,                 // gambar lantai diperbesar 2x
    speed: 260,               // px per detik (px lantai yang sudah di-scale)
    playerRadius: 26,         // ukuran karakter di dalam menara (px lantai ter-scale)
    margin: 26,               // jarak (px lantai) dari tangga / pintu supaya tombol muncul
    floors: [
      {
        id: 1, image: 'assets/images/tower/floor1.png', w: 503, h: 495,
        walls: 'oct',
        blocked: [[41,290,213,90],[131,240,48,52],[252,293,44,44],[363,253,96,110],[381,373,36,35],[366,103,93,142],[119,388,90,70],[274,423,109,32]],
        stairs: [{ x: 36, y: 133, w: 87, h: 135, dir: 'up', to: 2, arrive: { x: 140, y: 240 } }],
        exit: { x: 214, y: 38, w: 74, h: 36 },     // pintu di tembok atas
        spawn: { x: 251, y: 78 },
      },
      {
        id: 2, image: 'assets/images/tower/floor2.png', w: 503, h: 495,
        walls: 'oct',
        blocked: [[219,46,74,166],[296,41,80,36],[96,66,75,95],[36,128,45,43],[437,139,28,28],[63,356,85,75],[203,381,160,70]],
        stairs: [
          { x: 33, y: 181, w: 88, h: 115, dir: 'down', to: 1, arrive: { x: 140, y: 200 } },
          { x: 381, y: 179, w: 87, h: 147, dir: 'up',   to: 3, arrive: { x: 362, y: 260 } },
        ],
      },
      {
        id: 3, image: 'assets/images/tower/floor3.png', w: 503, h: 497,
        walls: 'oct',
        blocked: [[49,335,90,95]],
        stairs: [{ x: 383, y: 208, w: 85, h: 130, dir: 'down', to: 2, arrive: { x: 362, y: 240 } }],
      },
    ],
  },

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
};

// ===== NILAI TURUNAN (jangan diedit, ubah angka di atas) =====
// px/detik = km/jam * px/km / 3600 detik * timeScale
CONFIG.player.speed = CONFIG.player.speedKmh * SCALE.pxPerKm / 3600 * SCALE.timeScale;
CONFIG.fog.radius = CONFIG.fog.radiusKm * SCALE.pxPerKm;
