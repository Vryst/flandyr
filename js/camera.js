// Kamera mengikuti player, dibatasi ukuran dunia, dan mendukung zoom.
// Zoom hanya mengubah cara dunia ditampilkan; ukuran player & map di data tetap sama.
const Camera = {
  x: 0,
  y: 0,
  zoom: CONFIG.camera.zoom,

  setZoom(z) {
    const { minZoom, maxZoom } = CONFIG.camera;
    this.zoom = Math.max(minZoom, Math.min(maxZoom, z));
  },

  zoomBy(factor) {
    this.setZoom(this.zoom * factor);
  },

  update(target) {
    const { width: ww, height: wh } = CONFIG.world;
    // ukuran area dunia yang kelihatan di layar
    const vw = window.innerWidth / this.zoom;
    const vh = window.innerHeight / this.zoom;

    this.x = ww <= vw ? -(vw - ww) / 2 : Math.max(0, Math.min(ww - vw, target.x - vw / 2));
    this.y = wh <= vh ? -(vh - wh) / 2 : Math.max(0, Math.min(wh - vh, target.y - vh / 2));
  },

  // posisi layar -> posisi dunia
  toWorld(screenX, screenY) {
    return { x: screenX / this.zoom + this.x, y: screenY / this.zoom + this.y };
  },
};
