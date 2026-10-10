// Bagian dalam Tower of Mabel: 3 lantai, jalan klik seperti di luar, tangga naik/turun, pintu keluar.
// Koordinat Player saat di dalam = px lantai yang sudah di-scale (lihat CONFIG.interior.scale).
const Interior = {
  active: false,
  floorId: 1,
  tower: null,        // objek menara yang sedang dimasuki
  floors: {},
  debug: false,       // tekan B untuk lihat tembok / furnitur / zona tangga
  S: CONFIG.interior.scale,
  R: Math.round(CONFIG.interior.playerRadius * 0.75),   // radius tabrakan player (px ter-scale)
  view: { f: 1, ox: 0, oy: 0 },

  assetList() {
    const out = {};
    for (const f of CONFIG.interior.floors) out['floor' + f.id] = f.image;
    return out;
  },

  init() {
    const S = this.S;
    const rect = (r) => ({ x: r[0] * S, y: r[1] * S, w: r[2] * S, h: r[3] * S });
    for (const f of CONFIG.interior.floors) {
      const m = 38, c = 80, W = f.w, H = f.h;       // segi delapan: tembok setebal m, sudut terpotong c
      const oct = [[m + c, m], [W - m - c, m], [W - m, m + c], [W - m, H - m - c],
                   [W - m - c, H - m], [m + c, H - m], [m, H - m - c], [m, m + c]];
      this.floors[f.id] = {
        id: f.id, w: f.w * S, h: f.h * S,
        poly: (f.walls === 'oct' ? oct : f.walls).map(([x, y]) => ({ x: x * S, y: y * S })),
        blocked: f.blocked.map(rect),
        stairs: f.stairs.map((s) => ({ ...rect([s.x, s.y, s.w, s.h]), dir: s.dir, to: s.to,
                                       arrive: { x: s.arrive.x * S, y: s.arrive.y * S } })),
        exit: f.exit ? rect([f.exit.x, f.exit.y, f.exit.w, f.exit.h]) : null,
        spawn: f.spawn ? { x: f.spawn.x * S, y: f.spawn.y * S } : null,
      };
    }
    window.addEventListener('keydown', (e) => { if (e.key === 'b' || e.key === 'B') this.debug = !this.debug; });
  },

  get floor() { return this.floors[this.floorId]; },

  // ---- masuk / keluar / pindah lantai ----
  enter(tower) {
    this.tower = tower;
    this.active = true;
    this.floorId = 1;
    const sp = this.floor.spawn;
    Player.x = sp.x; Player.y = sp.y; Player.target = null; this.path = [];
  },

  exit() {
    const t = this.tower;
    this.active = false;
    // keluar di sisi bawah lingkaran menara, tepat di luar zona "Masuk"
    Player.x = t.x; Player.y = t.y + t.radius + 25; Player.target = null;
    this.tower = null;
  },

  goTo(floorId, arrive) {
    this.floorId = floorId;
    Player.x = arrive.x; Player.y = arrive.y; Player.target = null; this.path = [];
  },

  // ---- gerak ----
  inPoly(x, y) {
    const p = this.floor.poly; let inside = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      if ((p[i].y > y) !== (p[j].y > y) &&
          x < (p[j].x - p[i].x) * (y - p[i].y) / (p[j].y - p[i].y) + p[i].x) inside = !inside;
    }
    return inside;
  },

  canStand(x, y) {
    const r = this.R;
    for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
      if (!this.inPoly(x + dx, y + dy)) return false;
    }
    for (const b of this.floor.blocked) {
      if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return false;
    }
    return true;
  },

  // ---- pencarian jalan (A*) supaya klik tidak nyangkut di furnitur ----
  CELL: 10,
  path: [],
  grids: {},

  grid() {
    const id = this.floorId;
    if (!this.grids[id]) {
      const fl = this.floor, G = this.CELL;
      const cols = Math.ceil(fl.w / G), rows = Math.ceil(fl.h / G);
      const ok = new Uint8Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        ok[r * cols + c] = this.canStand((c + 0.5) * G, (r + 0.5) * G) ? 1 : 0;
      }
      this.grids[id] = { cols, rows, ok };
    }
    return this.grids[id];
  },

  clearLine(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4);
    for (let i = 1; i <= n; i++) {
      if (!this.canStand(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
    }
    return true;
  },

  // cell walkable terdekat dari titik (px) -> {c, r} atau null
  nearestCell(x, y, g) {
    const G = this.CELL;
    const c0 = Math.max(0, Math.min(g.cols - 1, Math.floor(x / G)));
    const r0 = Math.max(0, Math.min(g.rows - 1, Math.floor(y / G)));
    for (let d = 0; d < 60; d++) {
      let best = null, bd = Infinity;
      for (let r = r0 - d; r <= r0 + d; r++) for (let c = c0 - d; c <= c0 + d; c++) {
        if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== d) continue;
        if (c < 0 || r < 0 || c >= g.cols || r >= g.rows || !g.ok[r * g.cols + c]) continue;
        const dd = Math.hypot(c - c0, r - r0);
        if (dd < bd) { bd = dd; best = { c, r }; }
      }
      if (best) return best;
    }
    return null;
  },

  findPath(sx, sy, gx, gy) {
    const g = this.grid(), G = this.CELL, { cols, rows, ok } = g;
    const s = this.nearestCell(sx, sy, g), e = this.nearestCell(gx, gy, g);
    if (!s || !e) return [];
    const goal = { x: (e.c + 0.5) * G, y: (e.r + 0.5) * G };
    if (this.clearLine(sx, sy, goal.x, goal.y)) return [goal];

    const N = cols * rows, gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N), open = [];
    const si = s.r * cols + s.c, ei = e.r * cols + e.c;
    const h = (i) => Math.hypot((i % cols) - e.c, Math.floor(i / cols) - e.r);
    gs[si] = 0; open.push([h(si), si]);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0];
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === ei) break;
      const cc = cur % cols, cr = Math.floor(cur / cols);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = cc + dc, nr = cr + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const ni = nr * cols + nc;
        if (!ok[ni] || closed[ni]) continue;
        if (dc && dr && (!ok[cr * cols + nc] || !ok[nr * cols + cc])) continue;   // jangan potong sudut
        const ng = gs[cur] + (dc && dr ? 1.414 : 1);
        if (ng < gs[ni]) { gs[ni] = ng; from[ni] = cur; open.push([ng + h(ni), ni]); }
      }
    }
    if (from[ei] === -1 && ei !== si) return [];
    const pts = [];
    for (let i = ei; i !== -1; i = from[i]) pts.push({ x: ((i % cols) + 0.5) * G, y: (Math.floor(i / cols) + 0.5) * G });
    pts.reverse();
    // rapikan: lompat ke titik terjauh yang masih kelihatan langsung
    const out = []; let cx = sx, cy = sy, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.clearLine(cx, cy, pts[j].x, pts[j].y)) j--;
      out.push(pts[j]); cx = pts[j].x; cy = pts[j].y; i = j + 1;
    }
    return out;
  },

  tap(clientX, clientY) {
    const { f, ox, oy } = this.view;
    const gx = (clientX - ox) / f, gy = (clientY - oy) / f;
    this.path = this.findPath(Player.x, Player.y, gx, gy);
    if (!this.path.length) { Player.target = null; return; }
    Player.target = this.path[this.path.length - 1];   // untuk penanda tujuan
    Player.markerTime = 0;
  },

  update(dt) {
    Player.markerTime += dt;
    if (!this.path.length) { Player.target = null; return; }
    const t = this.path[0];
    const dx = t.x - Player.x, dy = t.y - Player.y, dist = Math.hypot(dx, dy);
    const step = CONFIG.interior.speed * dt;
    if (dist > 0.5) Player.angle = Math.atan2(dy, dx);
    const k = dist <= step ? 1 : step / dist;
    const nx = Player.x + dx * k, ny = Player.y + dy * k;
    if (this.canStand(nx, ny)) { Player.x = nx; Player.y = ny; }
    else if (this.canStand(nx, Player.y)) Player.x = nx;       // geser menyusuri tembok
    else if (this.canStand(Player.x, ny)) Player.y = ny;
    else { this.path = []; Player.target = null; return; }
    if (dist <= step) this.path.shift();
    if (!this.path.length) Player.target = null;
  },

  // ---- aksi yang tersedia di posisi player (tombol) ----
  near(z) {
    const m = CONFIG.interior.margin * this.S, x = Player.x, y = Player.y;
    return x > z.x - m && x < z.x + z.w + m && y > z.y - m && y < z.y + z.h + m;
  },

  action() {
    const fl = this.floor;
    for (const s of fl.stairs) {
      if (this.near(s)) {
        return { label: s.dir === 'up' ? `Naik ke Lantai ${s.to}` : `Turun ke Lantai ${s.to}`,
                 run: () => this.goTo(s.to, s.arrive) };
      }
    }
    if (fl.exit && this.near(fl.exit)) return { label: 'Keluar', run: () => this.exit() };
    return null;
  },

  // ---- gambar ----
  draw(ctx) {
    const W = window.innerWidth, H = window.innerHeight, fl = this.floor;
    ctx.fillStyle = '#0c0b09';
    ctx.fillRect(0, 0, W, H);

    const f = Math.min(W / fl.w, H / fl.h) * 0.94;
    const ox = (W - fl.w * f) / 2, oy = (H - fl.h * f) / 2;
    this.view = { f, ox, oy };

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(f, f);
    const img = Assets.get('floor' + fl.id);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (img) ctx.drawImage(img, 0, 0, fl.w, fl.h);

    Player.drawMarker(ctx);
    Player.draw(ctx, CONFIG.interior.playerRadius);

    if (this.debug) this.drawDebug(ctx, fl);   // tekan B: lihat tembok, furnitur, dan zona interaksi
    ctx.restore();
  },

  drawDebug(ctx, fl) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,255,120,.9)';
    ctx.beginPath();
    fl.poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,0,0,.28)';
    ctx.strokeStyle = 'rgba(255,0,0,.9)';
    for (const b of fl.blocked) { ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x, b.y, b.w, b.h); }
    // zona interaksi (tangga / pintu) hanya tampil di mode debug
    const m = CONFIG.interior.margin * this.S;
    ctx.strokeStyle = 'rgba(80,170,255,.9)';
    for (const z of [...fl.stairs, ...(fl.exit ? [fl.exit] : [])]) ctx.strokeRect(z.x - m, z.y - m, z.w + m * 2, z.h + m * 2);
  },
};
