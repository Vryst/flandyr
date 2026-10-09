// Menggambar map. Kosong dulu; nanti bisa pakai gambar via CONFIG.world.backgroundImage.
const World = {
  draw(ctx) {
    const { width, height, color, gridSize } = CONFIG.world;
    const bg = Assets.get('map');

    if (bg) {
      ctx.drawImage(bg, 0, 0, width, height);
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
