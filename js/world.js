// Menggambar map. Kosong dulu; nanti bisa pakai gambar via CONFIG.world.backgroundImage.
const World = {
  // ---- map berpetak: muat petak yang kelihatan saja, simpan beberapa petak terakhir ----
  tiles: new Map(),      // 'x_y' -> { img, ready, used }
  maxTiles: 8,
  frame: 0,

  tile(tx, ty) {
    const key = tx + '_' + ty;
    let t = this.tiles.get(key);
    if (!t) {
      t = { img: new Image(), ready: false, used: 0 };
      t.img.onload = () => { t.ready = true; };
      t.img.onerror = () => console.warn('Gagal load petak map:', key);
      t.img.src = `${CONFIG.world.mapTiles.dir}/${key}.png`;
      this.tiles.set(key, t);
      if (this.tiles.size > this.maxTiles) {      // buang petak yang paling lama tidak dipakai
        let oldest = null;
        for (const [k, v] of this.tiles) if (k !== key && (!oldest || v.used < oldest[1].used)) oldest = [k, v];
        if (oldest) { oldest[1].img.onload = oldest[1].img.onerror = null; oldest[1].img.src = ''; this.tiles.delete(oldest[0]); }
      }
    }
    t.used = this.frame;
    return t;
  },

  drawTiles(ctx) {
    const { width, height, color, mapTiles: m } = CONFIG.world;
    const k = m.width / width;            // px gambar per px dunia
    const span = m.size / k;              // ukuran 1 petak di dunia
    const vw = window.innerWidth / Camera.zoom, vh = window.innerHeight / Camera.zoom;
    this.frame++;

    ctx.fillStyle = color;                // warna dasar selagi petak belum termuat
    ctx.fillRect(Math.max(0, Camera.x), Math.max(0, Camera.y),
                 Math.min(width, vw + Camera.x) - Math.max(0, Camera.x), Math.min(height, vh + Camera.y) - Math.max(0, Camera.y));

    const tx0 = Math.max(0, Math.floor(Camera.x / span)), ty0 = Math.max(0, Math.floor(Camera.y / span));
    const tx1 = Math.min(m.cols - 1, Math.floor((Camera.x + vw) / span)), ty1 = Math.min(m.rows - 1, Math.floor((Camera.y + vh) / span));
    const pad = 1 / Camera.zoom;          // tumpang tindih 1 px layar supaya tidak ada garis di sambungan petak
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.tile(tx, ty);
        if (!t.ready) continue;
        const w = t.img.naturalWidth / k, h = t.img.naturalHeight / k;   // petak tepi lebih kecil
        ctx.drawImage(t.img, tx * span, ty * span, w + pad, h + pad);
      }
    }
  },

  draw(ctx) {
    const { width, height, color, gridSize } = CONFIG.world;
    const bg = Assets.get('map');

    if (CONFIG.world.mapTiles) {
      this.drawTiles(ctx);
    } else if (bg) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // gambar hanya potongan map yang kelihatan di layar (map-nya raksasa, 9208 x 7424)
      const k = bg.width / width;
      const x0 = Math.max(0, Math.floor(Camera.x * k)) , y0 = Math.max(0, Math.floor(Camera.y * k));
      const x1 = Math.min(bg.width,  Math.ceil((Camera.x + window.innerWidth  / Camera.zoom) * k));
      const y1 = Math.min(bg.height, Math.ceil((Camera.y + window.innerHeight / Camera.zoom) * k));
      if (x1 > x0 && y1 > y0) ctx.drawImage(bg, x0, y0, x1 - x0, y1 - y0, x0 / k, y0 / k, (x1 - x0) / k, (y1 - y0) / k);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);

      if (gridSize > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= width; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = 0; y <= height; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();
      }
    }

    // batas map
    ctx.strokeStyle = 'rgba(255,80,80,.6)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, width, height);
  },
};
