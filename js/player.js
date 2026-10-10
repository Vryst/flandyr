// Player: bergerak ke titik tujuan yang diklik.
const Player = {
  x: CONFIG.world.spawn.x,
  y: CONFIG.world.spawn.y,
  angle: 0,
  target: null,
  markerTime: 0,

  moveTo(x, y) {
    const r = CONFIG.player.radius;
    this.target = {
      x: Math.max(r, Math.min(CONFIG.world.width - r, x)),
      y: Math.max(r, Math.min(CONFIG.world.height - r, y)),
    };
    this.markerTime = 0;
  },

  update(dt) {
    this.markerTime += dt;
    if (!this.target) return;

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    // kecepatan tergantung medan tempat player berdiri (hutan lebih lambat)
    const step = CONFIG.player.speed * Terrain.info(this.x, this.y).speed * dt;

    this.angle = Math.atan2(dy, dx);

    const nx = dist <= step ? this.target.x : this.x + (dx / dist) * step;
    const ny = dist <= step ? this.target.y : this.y + (dy / dist) * step;

    // air = tidak bisa dilewati: berhenti di tepi
    if (!Terrain.info(nx, ny).walkable) { this.target = null; return; }

    this.x = nx;
    this.y = ny;
    if (dist <= step) this.target = null;
  },

  drawMarker(ctx) {
    if (!this.target) return;
    const pulse = (Math.sin(this.markerTime * 8) + 1) / 2;
    const c = CONFIG.marker.color;

    ctx.strokeStyle = `rgba(${c},${0.9 - pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.target.x, this.target.y, 7 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(${c},.9)`;
    ctx.beginPath();
    ctx.arc(this.target.x, this.target.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  },

  draw(ctx, radius) {
    this.render(ctx, this.x, this.y, this.angle, radius || CONFIG.player.radius);
  },

  // pemain lain (online.js): potret yang sama, garis tepi berwarna sesuai pemain + nama di atas kepala
  drawOther(ctx, o, radius) {
    const r = radius || CONFIG.player.radius;
    this.render(ctx, o.rx, o.ry, o.a || 0, r, { border: `hsl(${o.hue} 75% 58%)`, label: o.n });
  },

  render(ctx, x, y, angle, r, opt = {}) {
    const sprite = Assets.get('player');
    const border = opt.border || '#111';

    // bayangan
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.8, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    if (sprite) {
      ctx.save();
      ctx.translate(x, y);
      if (CONFIG.player.rotateSprite) ctx.rotate(angle);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.save();
      ctx.clip();                                   // pastikan selalu bulat
      ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
      ctx.restore();
      ctx.strokeStyle = border;                     // garis tepi lingkaran
      ctx.lineWidth = Math.max(1.5, r * 0.12);
      ctx.stroke();
      ctx.restore();
    } else {
      // placeholder lingkaran
      ctx.fillStyle = CONFIG.player.color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.stroke();

      // penunjuk arah hadap
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * r * 0.55, y + Math.sin(angle) * r * 0.55, Math.max(2, r * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }

    if (opt.label) {
      const fs = Math.max(9, r * 0.8);
      ctx.font = `600 ${fs}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = Math.max(2, fs * 0.25);
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(opt.label, x, y - r - 3);
      ctx.fillStyle = '#f2efe4';
      ctx.fillText(opt.label, x, y - r - 3);
    }
  },
};
