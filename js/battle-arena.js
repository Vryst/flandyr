// Arena battle. Dua jenis:
//   fixed  : memakai lantai Interior (mis. Halaman Tower of Mabel). Gambar & tabrakan dari Interior.
//   random : dibangun dari seed (CONFIG.battle.arenas[biome]); semua pemain di battle yang sama dapat arena yang SAMA karena seed-nya dibagi.
// Antarmuka arena: w, h, canStand(x, y, r), navFor(r), spot(rng, r), layout(), toLocal(cx, cy), drawBack(ctx), drawFront(ctx)

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// grid navigasi per ukuran monster (cell 40 px): 1 = bisa diinjak oleh badan berjari-jari r
function buildNav(arena, r) {
  const G = 40, cols = Math.ceil(arena.w / G), rows = Math.ceil(arena.h / G);
  const ok = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) ok[j * cols + i] = arena.canStand((i + .5) * G, (j + .5) * G, r) ? 1 : 0;
  return { G, cols, rows, ok };
}

const ArenaBase = {
  navs: null,
  navFor(r) {
    const k = r <= 26 ? 26 : Math.ceil(r / 10) * 10;      // bucket ukuran supaya cache kecil
    this.navs = this.navs || {};
    return this.navs[k] || (this.navs[k] = buildNav(this, k));
  },
  // titik acak yang bisa diinjak. near = {x,y,min,max} untuk membatasi jarak dari titik tertentu
  spot(rng, r, near) {
    for (let i = 0; i < 80; i++) {
      const x = r + rng() * (this.w - 2 * r), y = r + rng() * (this.h - 2 * r);
      if (near) { const d = Math.hypot(x - near.x, y - near.y); if (d < near.min || d > near.max) continue; }
      if (this.canStand(x, y, r)) return { x, y };
    }
    return { x: this.w / 2, y: this.h / 2 };
  },
  clearLine(x0, y0, x1, y1, r) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 16);
    for (let i = 1; i <= n; i++) if (!this.canStand(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, r)) return false;
    return true;
  },
  // titik terdekat dari (x, y) yang bisa diinjak badan berjari-jari r (cincin makin lebar). Dipakai monster yang pindah lantai / menuju tangga.
  nearestStand(x, y, r) {
    if (this.canStand(x, y, r)) return { x, y };
    for (let d = 10; d <= 500; d += 10) {
      let best = null, bd = 1e9;
      for (let k = 0; k < 24; k++) {
        const px = x + Math.cos(k * Math.PI / 12) * d, py = y + Math.sin(k * Math.PI / 12) * d;
        if (this.canStand(px, py, r)) { const dd = Math.hypot(px - x, py - y); if (dd < bd) { bd = dd; best = { x: px, y: py }; } }
      }
      if (best) return best;
    }
    return { x, y };
  },
};

const BattleArena = {
  // ---- arena tetap (lantai menara) ----
  fixed(floorId) {
    const fl = Interior.floors[floorId];
    const a = Object.create(ArenaBase);
    Object.assign(a, {
      kind: 'fixed', floorId, w: fl.w, h: fl.h, name: fl.label,
      canStand(x, y, r) {      // selalu memeriksa lantai arena ini (bukan lantai tempat player berdiri), supaya monster di lantai lain tidak salah
        if (!Interior.canStand(x, y, fl)) return false;
        const d = r - Interior.R;
        if (d <= 2) return true;
        for (let k = 0; k < 8; k++) if (!Interior.canStand(x + Math.cos(k * Math.PI / 4) * d, y + Math.sin(k * Math.PI / 4) * d, fl)) return false;
        return true;
      },
      layout() { return Interior.layout(); },
      toLocal(cx, cy) { return Interior.toLocal(cx, cy); },
      drawBack() {}, drawFront() {},
      // titik di PINGGIR arena pada arah `ang` (rad) dari pusat (titik tengah poligon terblokir pertama, mis. menara): jalan dari pusat ke luar sampai
      // titik terjauh yang masih bisa diinjak lalu mundur `margin`. Dipakai supaya yang masuk dari atas muncul di atas, dari kiri di kiri, dst.
      // `avoid` = { x, y, min } (opsional, hanya dipakai lantai dengan `fixedSpawn`): titik yang dipilih tidak boleh lebih dekat dari `min` ke (x, y) (mis. tempat muncul pemain);
      // kalau arah asal terlalu dekat, arah diputar sampai ketemu pinggir yang cukup jauh.
      edge(ang, r, margin = 90, avoid = null) {
        const bp = fl.blockedPolys[0], c = bp ? { x: bp.reduce((q, p) => q + p.x, 0) / bp.length, y: bp.reduce((q, p) => q + p.y, 0) / bp.length } : { x: this.w / 2, y: this.h / 2 };
        const one = (A) => {
          for (const dA of [0, .12, -.12, .25, -.25, .4, -.4, .6, -.6, .9, -.9]) {
            const a = A + dA, cx = Math.cos(a), cy = Math.sin(a);
            let far = -1;
            for (let d = 0; d < 4000; d += 15) { const x = c.x + cx * d, y = c.y + cy * d; if (x < 0 || y < 0 || x > this.w || y > this.h) break; if (this.canStand(x, y, r)) far = d; }
            if (far > margin) { const d = far - margin; return { x: c.x + cx * d, y: c.y + cy * d }; }
          }
          return null;
        };
        const far = (p) => (avoid ? Math.hypot(p.x - avoid.x, p.y - avoid.y) : 1e9);
        let best = one(ang);
        if (avoid && fl.fixedSpawn && (!best || far(best) < avoid.min)) {
          let bd = best ? far(best) : -1;
          for (let k = 1; k <= 12; k++) {
            const p = one(ang + k * Math.PI / 6 * (k % 2 ? 1 : -1));
            if (!p) continue;
            const d = far(p);
            if (d > bd) { bd = d; best = p; }
            if (d >= avoid.min) break;
          }
        }
        return best || { x: this.w / 2, y: this.h * .9 };
      },
    });
    return a;
  },

  // ---- arena bergambar (template dengan image / poly / blocked di CONFIG.battle.arenas) ----
  fromImage(a, biomeKey, tpl) {
    const k = tpl.scale, W = tpl.iw * k, H = tpl.ih * k, zoom = CONFIG.battle.arena.zoom;
    const poly = tpl.poly.map(([x, y]) => ({ x: x * k, y: y * k }));
    const blocked = (tpl.blocked || []).map(([x, y, r]) => ({ x: x * k, y: y * k, r: r * k }));
    const inPoly = (x, y) => Interior.inPoly(x, y, poly);
    Object.assign(a, {
      kind: 'random', biome: biomeKey, w: W, h: H, name: tpl.name, tpl,
      monsterNear: { x: tpl.mspawn[0] * k, y: tpl.mspawn[1] * k, min: 0, max: 360 * k / 3 * 1.0 },
      canStand(x, y, r) {
        if (!inPoly(x, y) || !inPoly(x + r, y) || !inPoly(x - r, y) || !inPoly(x, y + r) || !inPoly(x, y - r)) return false;
        for (const o of blocked) { const dx = x - o.x, dy = y - o.y, m = o.r + r; if (dx * dx + dy * dy < m * m) return false; }
        return true;
      },
      spawnPoint() { return { x: tpl.spawn[0] * k, y: tpl.spawn[1] * k }; },
      layout() {
        const w = window.innerWidth, h = window.innerHeight;
        const f = Math.min(w / W, h / H) * 0.94 * zoom;
        const px = Battle.self.x, py = Battle.self.y;
        const axis = (size, view, p) => (size * f <= view ? (view - size * f) / 2 : Math.min(0, Math.max(view - size * f, view / 2 - p * f)));
        this.view = { f, ox: axis(W, w, px), oy: axis(H, h, py) };
        return this.view;
      },
      toLocal(cx, cy) { const { f, ox, oy } = this.view || this.layout(); return { x: (cx - ox) / f, y: (cy - oy) / f }; },
      drawBack(ctx) {
        const img = Assets.get('arena:' + tpl.id);
        ctx.imageSmoothingEnabled = true;
        if (img) ctx.drawImage(img, 0, 0, W, H); else { ctx.fillStyle = '#26331e'; ctx.fillRect(0, 0, W, H); }
      },
      drawFront() {},
    });
    return a;
  },

  // path gambar template untuk loader
  assetList() {
    const out = {};
    for (const set of Object.values(CONFIG.battle.arenas)) for (const t of set.templates) if (t.image) out['arena:' + t.id] = t.image;
    return out;
  },

  // ---- arena acak dari seed ----
  // pintu masuk arena acak. Medan dengan `noCollision: true` (CONFIG.battle.arenas[biome]) = gerak bebas: poly area, lingkaran blocked & rintangan diabaikan,
  // pemain & monster hanya dibatasi tepi arena (gambar). Hapus flag itu untuk mengembalikan collision.
  random(biomeKey, seed) {
    const a = this.build(biomeKey, seed);
    a.exit = this.exitFor(a);
    if (CONFIG.battle.arenas[biomeKey].noCollision) { const W = a.w, H = a.h; a.canStand = (x, y, r) => x >= r && y >= r && x <= W - r && y <= H - r; }
    return a;
  },
  // pintu kabur: titik `exit: [x, y]` di template (px gambar), kalau tidak ada = titik bisa-diinjak yang paling JAUH dari spawn pemain
  exitFor(a) {
    const r = CONFIG.battle.exitR || 48, tpl = a.tpl;
    if (tpl && tpl.exit && tpl.scale) return { x: tpl.exit[0] * tpl.scale, y: tpl.exit[1] * tpl.scale, r };
    const sp = a.spawnPoint(); let best = null, bd = -1;
    for (let y = r; y < a.h - r; y += 40) for (let x = r; x < a.w - r; x += 40) {
      if (!a.canStand(x, y, r)) continue;
      const d = Math.hypot(x - sp.x, y - sp.y); if (d > bd) { bd = d; best = { x, y, r }; }
    }
    return best || { x: a.w / 2, y: r + 80, r };
  },
  build(biomeKey, seed) {
    const B = CONFIG.battle, set = B.arenas[biomeKey], cfg = B.arena;
    const rng = mulberry(seed);
    const tpl = set.templates[Math.floor(rng() * set.templates.length)];
    const a = Object.create(ArenaBase);
    if (tpl.image) return this.fromImage(a, biomeKey, tpl);
    const W = cfg.w, H = cfg.h, rim = 70;
    const obs = [];                                          // lingkaran rintangan { x, y, r (tabrakan), vr (gambar), t, v }
    const keep = [{ x: W / 2, y: H * 0.86, r: 260 }, { x: W / 2, y: H * 0.35, r: 200 }];   // area spawn pemain & monster dibiarkan lapang
    for (const [t, n, rmin, rmax] of tpl.obstacles) {
      for (let i = 0, tries = 0; i < n && tries < n * 40; tries++) {
        const r = rmin + rng() * (rmax - rmin), x = rim + r + rng() * (W - 2 * (rim + r)), y = rim + r + rng() * (H - 2 * (rim + r));
        if (keep.some((k) => Math.hypot(x - k.x, y - k.y) < k.r + r)) continue;
        if (obs.some((o) => Math.hypot(x - o.x, y - o.y) < o.r + r + 70)) continue;   // sisakan celah >= 70 px
        obs.push({ x, y, r: t === 'tree' ? r * 0.55 : r, vr: r, t, v: rng() });
        i++;
      }
    }
    const ground = set.ground, blobs = [];
    for (let i = 0; i < 260; i++) blobs.push({ x: rng() * W, y: rng() * H, r: 40 + rng() * 140, c: ground[Math.floor(rng() * ground.length)] });
    const tufts = [];
    for (let i = 0; i < 380; i++) tufts.push({ x: rng() * W, y: rng() * H, s: 5 + rng() * 9 });

    Object.assign(a, {
      kind: 'random', biome: biomeKey, w: W, h: H, name: tpl.name, tpl, obs, cache: null,
      canStand(x, y, r) {
        if (x < rim + r - 30 || y < rim + r - 30 || x > W - rim - r + 30 || y > H - rim - r + 30) return false;
        for (const o of obs) { const dx = x - o.x, dy = y - o.y, m = o.r + r; if (dx * dx + dy * dy < m * m) return false; }
        return true;
      },
      spawnPoint() { return { x: W / 2, y: H * 0.86 }; },
      layout() {
        const w = window.innerWidth, h = window.innerHeight, z = cfg.zoom;
        const f = Math.min(w / W, h / H) * 0.94 * z;
        const px = Battle.self.x, py = Battle.self.y;
        const axis = (size, view, p) => (size * f <= view ? (view - size * f) / 2 : Math.min(0, Math.max(view - size * f, view / 2 - p * f)));
        this.view = { f, ox: axis(W, w, px), oy: axis(H, h, py) };
        return this.view;
      },
      toLocal(cx, cy) { const { f, ox, oy } = this.view || this.layout(); return { x: (cx - ox) / f, y: (cy - oy) / f }; },
      // tanah (di-cache sekali dalam setengah resolusi supaya ringan di HP)
      drawBack(ctx) {
        if (!this.cache) {
          const c = document.createElement('canvas'), k = 0.5;
          c.width = W * k; c.height = H * k;
          const g = c.getContext('2d');
          g.scale(k, k);
          g.fillStyle = ground[0]; g.fillRect(0, 0, W, H);
          for (const b of blobs) {
            const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
            gr.addColorStop(0, b.c); gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.3); g.fill();
          }
          g.strokeStyle = 'rgba(160,200,110,.35)'; g.lineWidth = 2;
          for (const t of tufts) { g.beginPath(); g.moveTo(t.x, t.y); g.lineTo(t.x - t.s * .4, t.y - t.s); g.moveTo(t.x, t.y); g.lineTo(t.x + t.s * .4, t.y - t.s * .9); g.stroke(); }
          this.cache = c;
        }
        ctx.drawImage(this.cache, 0, 0, W, H);
        // tepi arena: pohon rapat sebagai dinding
        ctx.fillStyle = 'rgba(8,14,6,.85)';
        ctx.fillRect(-400, -400, W + 800, 400 + rim); ctx.fillRect(-400, H - rim, W + 800, 400 + rim);
        ctx.fillRect(-400, 0, 400 + rim, H); ctx.fillRect(W - rim, 0, 400 + rim, H);
        // batu / pilar / bayangan pohon (di bawah pemain & monster)
        for (const o of obs) {
          if (o.t === 'tree') {
            ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(o.x + 8, o.y + o.vr * .6, o.vr * .95, o.vr * .5, 0, 0, 6.3); ctx.fill();
            ctx.fillStyle = '#4a3322'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * .55, 0, 6.3); ctx.fill();
          } else if (o.t === 'rock') {
            ctx.fillStyle = '#6d7076'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.3); ctx.fill();
            ctx.fillStyle = '#868a91'; ctx.beginPath(); ctx.arc(o.x - o.r * .2, o.y - o.r * .25, o.r * .6, 0, 6.3); ctx.fill();
          } else {   // pilar reruntuhan
            ctx.fillStyle = '#5e5b55'; ctx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
            ctx.fillStyle = '#8a867d'; ctx.fillRect(o.x - o.r * .8, o.y - o.r * .8, o.r * 1.6, o.r * 1.6);
          }
        }
      },
      // tajuk pohon (di atas pemain & monster supaya terasa ada kedalaman)
      drawFront(ctx) {
        for (const o of obs) {
          if (o.t !== 'tree') continue;
          const r = o.vr, hue = 105 + o.v * 25;
          ctx.fillStyle = `hsla(${hue},40%,18%,.82)`; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, 6.3); ctx.fill();
          ctx.fillStyle = `hsla(${hue},42%,26%,.8)`; ctx.beginPath(); ctx.arc(o.x - r * .22, o.y - r * .22, r * .68, 0, 6.3); ctx.fill();
        }
      },
    });
    return a;
  },
};
