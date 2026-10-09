// Fog of war: lingkaran penglihatan di sekitar player, sisanya gelap.
// Radius dihitung dalam satuan dunia, jadi ikut membesar/mengecil saat zoom.
const Fog = {
  draw(ctx) {
    const f = CONFIG.fog;
    if (!f.enabled) return;

    // posisi player di layar
    const sx = (Player.x - Camera.x) * Camera.zoom;
    const sy = (Player.y - Camera.y) * Camera.zoom;
    const r = f.radius * Camera.zoom;

    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, `rgba(${f.color},0)`);
    g.addColorStop(Math.max(0, 1 - f.softness), `rgba(${f.color},0)`);
    g.addColorStop(1, `rgba(${f.color},${f.opacity})`);

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  },
};
