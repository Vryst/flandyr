// Player: bergerak ke titik tujuan yang diklik.
const Player = {
  x: CONFIG.world.width / 2,
  y: CONFIG.world.height / 2,
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
    const step = CONFIG.player.speed * dt;

    this.angle = Math.atan2(dy, dx);

    if (dist <= step) {
      this.x = this.target.x;
      this.y = this.target.y;
      this.target = null;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
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

  draw(ctx) {
    const r = CONFIG.player.radius;
    const sprite = Assets.get('player');

    // bayangan
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + r * 0.8, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    if (sprite) {
      ctx.save();
      ctx.translate(this.x, this.y);
      if (CONFIG.player.rotateSprite) ctx.rotate(this.angle);
      ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
      ctx.restore();
      return;
    }

    // placeholder lingkaran
    ctx.fillStyle = CONFIG.player.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();

    // penunjuk arah hadap
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(this.x + Math.cos(this.angle) * r * 0.55,
            this.y + Math.sin(this.angle) * r * 0.55, Math.max(2, r * 0.16), 0, Math.PI * 2);
    ctx.fill();
  },
};
