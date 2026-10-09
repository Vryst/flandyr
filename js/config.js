// Semua pengaturan game ada di sini.
const CONFIG = {
  world: {
    width: 3000,
    height: 3000,
    color: '#2a3326',
    gridSize: 100,            // grid sementara, set 0 untuk matikan
    backgroundImage: null,    // contoh: 'assets/images/map/map.png'
  },

  player: {
    radius: 40,               // ukuran lingkaran (px)
    speed: 300,               // px per detik
    color: '#e8ecdf',
    sprite: null,             // contoh: 'assets/images/player/player.png'
    rotateSprite: true,       // sprite ikut menghadap arah jalan
  },

  marker: {
    color: '255,255,255',
  },
};
