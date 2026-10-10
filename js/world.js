// Menggambar map. Kosong dulu; nanti bisa pakai gambar via CONFIG.world.backgroundImage.
const World = {
  draw(ctx) {
    const { width, height, color, gridSize } = CONFIG.world;
    const bg = Assets.get('map');

    if (bg) {
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
