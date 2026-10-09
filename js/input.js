// Input: klik/tap untuk jalan, scroll / pinch / tombol +/- untuk zoom.
const Input = {
  pointers: new Map(),   // pointer yang sedang menyentuh layar
  pinchDist: 0,
  pinched: false,        // true kalau gesture ini adalah pinch (bukan tap)
  down: null,            // posisi awal tap

  init(canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.down = { x: e.clientX, y: e.clientY };
        this.pinched = false;
      } else if (this.pointers.size === 2) {
        this.pinched = true;
        this.pinchDist = this.getPinchDist();
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const d = this.getPinchDist();
        if (this.pinchDist > 0) Camera.zoomBy(d / this.pinchDist);
        this.pinchDist = d;
      }
    });

    const end = (e) => {
      const wasTap = this.pointers.size === 1 && !this.pinched && this.down &&
        Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 10;
      this.pointers.delete(e.pointerId);
      if (e.type === 'pointerup' && wasTap) {
        const p = Camera.toWorld(e.clientX, e.clientY);
        Player.moveTo(p.x, p.y);
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    // scroll mouse
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = CONFIG.camera.zoomStep;
      Camera.zoomBy(e.deltaY < 0 ? f : 1 / f);
    }, { passive: false });

    // keyboard: + / - / 0 (reset)
    window.addEventListener('keydown', (e) => {
      const f = CONFIG.camera.zoomStep;
      if (e.key === '+' || e.key === '=') Camera.zoomBy(f);
      else if (e.key === '-' || e.key === '_') Camera.zoomBy(1 / f);
      else if (e.key === '0') Camera.setZoom(CONFIG.camera.zoom);
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  getPinchDist() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  },
};
