// Semua pengaturan game ada di sini.

// ===== SKALA DUNIA =====
// pxPerKm   : 100 px = 1 km
// timeScale : 1 detik nyata = berapa detik waktu game (360 = 1 detik nyata = 6 menit game, alias 1:360)
const SCALE = {
  pxPerKm: 100,
  timeScale: 360,
};

const CONFIG = {
  world: {
    width: 736,               // = lebar gambar map (px)
    height: 1308,             // = tinggi gambar map (px)
    color: '#2a3326',
    gridSize: 100,            // grid sementara, set 0 untuk matikan
    backgroundImage: 'assets/images/map/map.png',
  },

  player: {
    radius: 12,               // ukuran lingkaran (px). Skala 100 px = 1 km, jadi ini hanya ikon simbolis
    speedKmh: 5,              // kecepatan jalan manusia (km/jam, waktu game)
    speed: 0,                 // px per detik nyata, dihitung otomatis di bawah
    color: '#e8ecdf',
    sprite: null,             // contoh: 'assets/images/player/player.png'
    rotateSprite: true,       // sprite ikut menghadap arah jalan
  },

  camera: {
    zoom: 1,                  // zoom awal
    minZoom: 0.5,             // zoom out maksimal
    maxZoom: 3,               // zoom in maksimal
    zoomStep: 1.1,            // kelipatan per scroll / tombol
  },

  // Fog of war: area di luar jarak pandang gelap.
  fog: {
    enabled: true,
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
