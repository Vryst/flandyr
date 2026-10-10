// Terrain: baca jenis medan di koordinat dunia (px).
// Warna map -> jenis medan (sudah di-bake ke terrain-data.js lewat tools/gen_terrain.py):
//   biru  = air    (WATER)
//   ijo   = hutan  (FOREST)
//   krem  = darat  (LAND)
const Terrain = {
  LAND: 0, WATER: 1, FOREST: 2,
  grid: null, cols: 0, rows: 0,

  init() {
    const { cols, rows, data } = TERRAIN_DATA;
    const bin = atob(data);
    const g = new Uint8Array(cols * rows);
    for (let i = 0; i < g.length; i++) g[i] = (bin.charCodeAt(i >> 2) >> ((i & 3) * 2)) & 3;
    this.grid = g; this.cols = cols; this.rows = rows;
  },

  // id medan di (x, y) dunia; di luar map dianggap air
  at(x, y) {
    const cx = Math.floor(x / CONFIG.world.width * this.cols);
    const cy = Math.floor(y / CONFIG.world.height * this.rows);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return this.WATER;
    return this.grid[cy * this.cols + cx];
  },

  // properti (nama, bisa dilewati, pengali kecepatan) dari CONFIG.terrain
  info(x, y) { return CONFIG.terrain[this.at(x, y)]; },
};
