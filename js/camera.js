// Kamera mengikuti player dan dibatasi oleh ukuran dunia.
const Camera = {
  x: 0,
  y: 0,

  update(target) {
    const { width: ww, height: wh } = CONFIG.world;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    this.x = ww <= vw ? -(vw - ww) / 2 : Math.max(0, Math.min(ww - vw, target.x - vw / 2));
    this.y = wh <= vh ? -(vh - wh) / 2 : Math.max(0, Math.min(wh - vh, target.y - vh / 2));
  },

  // posisi layar -> posisi dunia
  toWorld(screenX, screenY) {
    return { x: screenX + this.x, y: screenY + this.y };
  },
};
