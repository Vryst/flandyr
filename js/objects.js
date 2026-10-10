// Objek dunia berbentuk lingkaran (menara, dll). Daftar ada di CONFIG.objects.
// Sudah disiapkan untuk fitur interaksi: Objects.hitTest() (klik kena objek?) dan Objects.nearby() (player cukup dekat?).
const Objects = {
  list: CONFIG.objects,

  // path sprite untuk loader: { 'obj:tower': 'assets/...' }
  assetList() {
    const out = {};
    for (const o of this.list) if (o.sprite) out['obj:' + o.id] = o.sprite;
    return out;
  },

  draw(ctx) {
    for (const o of this.list) {
      const img = Assets.get('obj:' + o.id);
      ctx.save();
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      ctx.clip();                                   // pastikan selalu bulat
      if (img) ctx.drawImage(img, o.x - o.radius, o.y - o.radius, o.radius * 2, o.radius * 2);
      else { ctx.fillStyle = '#8a7a5a'; ctx.fill(); }
      ctx.restore();

      ctx.strokeStyle = 'rgba(40,30,15,.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // objek yang kena titik dunia (x, y), atau null
  hitTest(x, y) {
    for (const o of this.list) if (Math.hypot(x - o.x, y - o.y) <= o.radius) return o;
    return null;
  },

  // objek yang cukup dekat dengan (x, y) untuk diinteraksi, atau null
  nearby(x, y) {
    for (const o of this.list) if (Math.hypot(x - o.x, y - o.y) <= o.interactRadius) return o;
    return null;
  },
};
