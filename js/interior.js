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
    for (const f of CONFIG.interior.floors) if (f.image) out['floor' + f.id] = f.image;   // lantai dengan imageFrom memakai gambar lantai lain
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
        blockedPolys: (f.blockedPolys || []).map((p) => p.map(([x, y]) => ({ x: x * S, y: y * S }))),
        imageKey: 'floor' + (f.imageFrom !== undefined ? f.imageFrom : f.id),
        label: f.label || ('Lantai ' + f.id),
        zoom: f.zoom || 1,
        stairs: f.stairs.map((s) => ({ ...rect([s.x, s.y, s.w, s.h]), dir: s.dir, to: s.to,
                                       arrive: { x: s.arrive.x * S, y: s.arrive.y * S } })),
        // exit tanpa `to` = keluar ke peta dunia; dengan `to` + `arrive` = pindah ke lantai lain (mis. Halaman)
        exit: f.exit ? { ...rect([f.exit.x, f.exit.y, f.exit.w, f.exit.h]), to: f.exit.to,
                         arrive: f.exit.arrive ? { x: f.exit.arrive.x * S, y: f.exit.arrive.y * S } : null } : null,
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
    this.floorId = CONFIG.interior.startFloor || 0;
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
  inPoly(x, y, p = this.floor.poly) {
    let inside = false;
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
    for (const poly of this.floor.blockedPolys) {      // poligon yang tidak bisa diinjak (menara, kolam, semak)
      for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
        if (this.inPoly(x + dx, y + dy, poly)) return false;
      }
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
    const push = (item) => {                       // min-heap berdasarkan nilai f
      let i = open.push(item) - 1;
      while (i > 0) { const q = (i - 1) >> 1; if (open[q][0] <= item[0]) break; open[i] = open[q]; i = q; }
      open[i] = item;
    };
    const pop = () => {
      const top = open[0], last = open.pop();
      if (open.length) {
        let i = 0;
        for (;;) {
          let c = 2 * i + 1; if (c >= open.length) break;
          if (c + 1 < open.length && open[c + 1][0] < open[c][0]) c++;
          if (open[c][0] >= last[0]) break;
          open[i] = open[c]; i = c;
        }
        open[i] = last;
      }
      return top;
    };
    gs[si] = 0; push([h(si), si]);
    while (open.length) {
      const [, cur] = pop();
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
        if (ng < gs[ni]) { gs[ni] = ng; from[ni] = cur; push([ng + h(ni), ni]); }
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

  // semua zona interaksi di lantai ini: tangga + pintu keluar
  zones() {
    const fl = this.floor, out = [];
    fl.stairs.forEach((st, i) => out.push({
      key: 'stair' + i, rect: st,
      run: () => this.goTo(st.to, st.arrive),
    }));
    if (fl.exit) out.push({ key: 'exit', rect: fl.exit,
      run: () => (fl.exit.to !== undefined ? this.goTo(fl.exit.to, fl.exit.arrive) : this.exit()) });
    return out;
  },

  // zona yang bisa dipakai dari posisi player sekarang (atau null)
  action() {
    return this.zones().find((z) => this.near(z.rect)) || null;
  },

  // hitung ukuran & posisi lantai di layar (dipakai draw, klik, dan transisi)
  layout() {
    const W = window.innerWidth, H = window.innerHeight, fl = this.floor;
    const f = Math.min(W / fl.w, H / fl.h) * 0.94 * fl.zoom;
    // zoom 1 = seluruh lantai di tengah layar; zoom > 1 = kamera ikut player (tidak keluar dari tepi gambar)
    const axis = (size, view, p) => (size * f <= view ? (view - size * f) / 2
                                                         : Math.min(0, Math.max(view - size * f, view / 2 - p * f)));
    this.view = { f, ox: axis(fl.w, W, Player.x), oy: axis(fl.h, H, Player.y) };
    return this.view;
  },

  // posisi player di layar
  screenPos() {
    const { f, ox, oy } = this.layout();
    return { x: ox + Player.x * f, y: oy + Player.y * f };
  },

  // posisi layar -> koordinat lantai
  toLocal(clientX, clientY) {
    const { f, ox, oy } = this.view;
    return { x: (clientX - ox) / f, y: (clientY - oy) / f };
  },

  // zona yang ada di titik lantai (x, y), dipakai untuk double-click
  zoneAt(x, y) {
    const pad = 10 * this.S;
    return this.zones().find(({ rect: r }) =>
      x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) || null;
  },

  // ---- gambar ----
  draw(ctx) {
    const W = window.innerWidth, H = window.innerHeight, fl = this.floor;
    ctx.fillStyle = '#0c0b09';
    ctx.fillRect(0, 0, W, H);

    const { f, ox, oy } = this.layout();

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(f, f);
    const img = Assets.get(fl.imageKey);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = fl.zoom > 1 ? 'low' : 'high';   // gambar besar + zoom: kualitas 'high' bikin lag
    if (img) {
      // hanya gambar bagian yang kelihatan di layar (gambar halaman 2400 x 1792 terlalu berat kalau digambar utuh tiap frame)
      const x0 = Math.max(0, -ox / f), y0 = Math.max(0, -oy / f);
      const x1 = Math.min(fl.w, (W - ox) / f), y1 = Math.min(fl.h, (H - oy) / f);
      const kx = img.naturalWidth / fl.w, ky = img.naturalHeight / fl.h;
      if (x1 > x0 && y1 > y0) ctx.drawImage(img, x0 * kx, y0 * ky, (x1 - x0) * kx, (y1 - y0) * ky, x0, y0, x1 - x0, y1 - y0);
    }

    GroundItems.draw(ctx, GroundItems.loc(), 22);   // barang yang dijatuhkan di lantai ini
    Online.drawOthers(ctx, GroundItems.loc(), CONFIG.interior.playerRadius);   // pemain lain di lantai ini
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
    for (const poly of fl.blockedPolys) {
      ctx.beginPath();
      poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // zona interaksi (tangga / pintu) hanya tampil di mode debug
    const m = CONFIG.interior.margin * this.S;
    ctx.strokeStyle = 'rgba(80,170,255,.9)';
    for (const z of [...fl.stairs, ...(fl.exit ? [fl.exit] : [])]) ctx.strokeRect(z.x - m, z.y - m, z.w + m * 2, z.h + m * 2);
  },
};
