// Tampilan inventory: tombol tas (kiri bawah) + layar inventory sendiri (full-screen, game di-pause).
// Buka/tutup: klik tombol tas, tekan I / Tab, tutup juga dengan Esc atau tombol ×.
//
// Kiri   : tas yang dipakai (grid). Seret tas dari slot Tas ke panel Pencarian = jatuhkan (isi ikut).
// Kanan  : panel Pencarian = isi sekitar player:
//            - tas yang tergeletak -> panel sendiri + grid isinya (seret headernya ke slot Tas untuk memakainya)
//            - "Di luar tas"       -> barang yang tergeletak tanpa tas
// Item bisa di-drag antar grid (tas player <-> tas di tanah). Lepas di panel Pencarian (di luar grid) =
// jatuhkan ke tanah (jadi item di luar tas). Ketuk 2x item di panel Pencarian = langsung masuk ke tas; ketuk 2x item di tasmu = keluar ke tanah. R / klik kanan saat drag = putar.
const InventoryUI = {
  open: false,
  btn: null, root: null,
  cell: 52,
  noteTimer: null,
  onToggle: null,   // dipanggil (open) tiap inventory dibuka / ditutup (diisi main.js)
  views: [],        // grid yang sedang tampil: { key, grid, el, layer, preview, cell }
  drag: null,
  bagDrag: null,
  lastTap: null,   // ketukan terakhir pada item (untuk deteksi ketuk 2x)
  L: { k: 1, searchW: 260, findH: 0, cell: 52 },

  init() {
    // tombol tas
    this.btn = document.createElement('button');
    this.btn.id = 'bag-btn';
    this.btn.title = 'Inventory (I)';
    this.btn.innerHTML = '<img alt="Tas"><span>I</span>';
    this.btn.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.btn);

    // panel
    this.root = document.createElement('div');
    this.root.id = 'inv';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="inv-top">
        <span class="inv-label">INVENTORY</span>
        <button class="inv-close" aria-label="Tutup">&times;</button>
      </div>
      <div class="inv-body">
        <section class="inv-left">
          <div class="inv-bag">
            <img class="inv-icon" alt="">
            <div class="inv-title"><b></b><small></small></div>
          </div>
          <div class="inv-mygrid"></div>
          <p class="inv-nobag" hidden>Tidak membawa tas.<br>Ambil tas dari panel Pencarian untuk membawa barang.</p>
          <div class="inv-foot inv-used">Slot terpakai <b></b></div>
        </section>
        <aside class="inv-char">
          <div class="inv-figure"></div>
        </aside>
        <section class="inv-search">
          <div class="inv-title"><b>Pencarian</b><small></small></div>
          <div class="inv-find"></div>
          <div class="inv-foot inv-find-note"></div>
        </section>
      </div>`;
    document.body.appendChild(this.root);

    const q = (s) => this.root.querySelector(s);
    this.titleEl = q('.inv-bag .inv-title b');
    this.sizeEl = q('.inv-bag .inv-title small');
    this.usedEl = q('.inv-used b');
    this.usedRow = q('.inv-used');
    this.iconEl = q('.inv-icon');
    this.myGrid = q('.inv-mygrid');
    this.noBagEl = q('.inv-nobag');
    this.charEl = q('.inv-char');
    this.searchEl = q('.inv-search');
    this.findEl = q('.inv-find');
    this.findNote = q('.inv-find-note');
    this.findCount = q('.inv-search .inv-title small');
    this.figureEl = q('.inv-figure');
    this.buildFigure();

    q('.inv-close').addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'i' || e.key === 'I' || e.key === 'Tab') { e.preventDefault(); this.toggle(); }
      else if (e.key === 'Escape' && this.open) this.close();
      else if ((e.key === 'r' || e.key === 'R') && this.drag) this.rotateDrag();
    });
    window.addEventListener('resize', () => { if (this.open) this.render(); });
    this.root.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.drag) this.rotateDrag(); });

    Inventory.onChange(() => this.render());
    this.render();
  },

  toggle() { this.open ? this.close() : this.show(); },
  show() { this.open = true; this.root.hidden = false; this.render(); if (this.onToggle) this.onToggle(true); },
  close() {
    if (!this.open) return;
    this.cancelDrag(); this.open = false; this.root.hidden = true;
    if (this.onToggle) this.onToggle(false);
  },

  // gambar ulang seluruh isi panel dari data Inventory + GroundItems
  render() {
    if (this.drag) this.cancelDrag(true);
    this.stopBagDrag(); this.clearGhosts();
    const bag = Inventory.bag();
    const cols = Inventory.cols, rows = Inventory.rows;
    const L = this.layout(cols, rows);
    this.cell = L.cell;
    this.L = L;
    this.root.classList.toggle('row', L.row);
    this.root.classList.toggle('compact', L.compact);
    this.root.style.setProperty('--search-w', L.searchW + 'px');
    this.root.style.setProperty('--find-h', L.findH + 'px');
    this.charEl.style.setProperty('--k', L.k);
    this.charEl.style.width = 360 * L.k + 'px';
    this.charEl.style.height = 300 * L.k + 'px';

    this.views = [];
    this.btn.firstChild.src = bag ? bag.image : this.anyBagImage();
    this.btn.classList.toggle('empty', !bag);
    this.iconEl.src = bag ? bag.image : this.anyBagImage();
    this.iconEl.classList.toggle('empty', !bag);
    this.titleEl.textContent = bag ? bag.name : 'Tanpa tas';
    this.sizeEl.textContent = bag ? `${cols} × ${rows} slot` : '';
    this.usedEl.textContent = `${Inventory.usedCells()} / ${cols * rows}`;
    this.usedRow.hidden = !bag;
    this.noBagEl.hidden = !!bag;

    this.myGrid.textContent = '';
    if (bag) this.myGrid.appendChild(this.buildGrid('player', Inventory.grid, this.cell));

    this.renderSlots();
    this.renderSearch();
  },

  // Hitung susunan layar. row = karakter + tas + pencarian sebaris (layar landscape / lebar), tanpa scroll.
  // compact = layar pendek / HP: semuanya dipepetkan supaya muat satu layar penuh.
  layout(cols, rows) {
    const cfg = CONFIG.inventory, vw = window.innerWidth, vh = window.innerHeight;
    const row = vw >= 640 && vw > vh * 1.1;
    const compact = vh < 560 || vw < 1000;
    if (!row) {   // HP portrait: bertumpuk, boleh di-scroll
      const cell = cols ? Math.max(cfg.minCellSize, Math.min(cfg.cellSize, Math.floor((vw - 48) / cols))) : cfg.cellSize;
      return { row, compact, cell, k: Math.min(1, (vw - 32) / 360), searchW: Math.min(260, vw - 32), findH: 0 };
    }
    const pad = compact ? 8 : 16, gap = compact ? 10 : 40;
    const top = compact ? 38 : 62;
    const searchW = compact ? 196 : 260;
    const headH = compact ? 46 : 90, footH = 24;
    const availH = vh - top - pad * 2;
    const gridH = availH - headH - footH;
    const minChar = compact ? 150 : 300;
    const availGridW = vw - pad * 2 - gap * 2 - searchW - minChar;
    const cell = cols ? Math.max(cfg.minCellSize, Math.min(cfg.cellSize, Math.floor(availGridW / cols), Math.floor(gridH / rows))) : cfg.cellSize;
    const charAvail = vw - pad * 2 - gap * 2 - searchW - cols * cell - 6;
    const k = Math.max(0.4, Math.min(1, charAvail / 360, availH / 300));
    return { row, compact, cell, k, searchW, findH: availH - (compact ? 66 : 84) };
  },

  anyBagImage() {
    const b = Object.values(CONFIG.inventory.bags)[0];
    return b ? b.image : '';
  },

  // ===== grid =====
  // Bangun satu grid (latar slot + item) dan daftarkan sebagai target drag & drop.
  buildGrid(key, grid, cell) {
    const el = document.createElement('div');
    el.className = 'inv-grid';
    el.style.setProperty('--cell', cell + 'px');
    el.style.setProperty('--cols', grid.cols);
    el.style.setProperty('--rows', grid.rows);
    for (let i = 0; i < grid.cols * grid.rows; i++) {
      const c = document.createElement('div');
      c.className = 'inv-cell';
      el.appendChild(c);
    }
    const layer = document.createElement('div'); layer.className = 'inv-items';
    const preview = document.createElement('div'); preview.className = 'inv-preview'; preview.hidden = true;
    el.append(layer, preview);

    const view = { key, grid, el, layer, preview, cell };
    for (const it of grid.items) layer.appendChild(this.makeItemEl(view, it));
    this.views.push(view);
    return el;
  },

  // isi visual item (gambar atau nama), dipakai item di grid, item lepas, dan ghost saat drag
  fillItem(el, d, rotated) {
    if (d.color) el.style.setProperty('--item', d.color);
    if (d.icon) {
      const img = document.createElement('img');
      img.src = d.icon; img.alt = d.name; img.draggable = false;
      el.appendChild(img);
    } else {
      const s = document.createElement('span');
      s.textContent = d.name;
      if (rotated) s.style.transform = 'rotate(90deg)';
      el.appendChild(s);
    }
  },

  // gambar item yang diputar: dibuat seukuran kotak yang sudah tertukar (w x h), baru diputar 90 derajat
  rotImg(img, rotated, boxW, boxH) {
    if (!img) return;
    if (!rotated) { img.style.cssText = ''; return; }
    img.style.cssText = `inset:auto;left:50%;top:50%;width:${boxH - 6}px;height:${boxW - 6}px;transform:translate(-50%,-50%) rotate(90deg)`;
  },

  makeItemEl(view, it) {
    const d = Inventory.def(it.id);
    const s = view.grid.sizeOf(it);
    const el = document.createElement('div');
    el.className = 'inv-item';
    el.dataset.uid = it.uid;
    el.title = d.name;
    this.placeEl(el, view.cell, it.x, it.y, s.w, s.h);
    this.fillItem(el, d, it.rotated);
    this.rotImg(el.querySelector('img'), it.rotated, s.w * view.cell, s.h * view.cell);
    el.addEventListener('pointerdown', (e) => this.startDrag(e, { view, it, el }));
    return el;
  },

  placeEl(el, c, x, y, w, h) {
    el.style.left = x * c + 'px';
    el.style.top = y * c + 'px';
    el.style.width = w * c + 'px';
    el.style.height = h * c + 'px';
  },

  // ===== panel Pencarian =====
  renderSearch() {
    const bags = GroundItems.nearBags();
    const loose = GroundItems.near();
    this.findEl.textContent = '';
    this.findCount.textContent = (bags.length || loose.length)
      ? [bags.length ? `${bags.length} tas` : '', loose.length ? `${loose.length} item` : ''].filter(Boolean).join(' · ') : '';

    // lebar isi panel Pencarian: grid tas di tanah dikecilkan kalau terlalu lebar
    const inner = this.L.searchW - 36;

    for (const b of bags) {
      const def = CONFIG.inventory.bags[b.bagId];
      const panel = document.createElement('div');
      panel.className = 'inv-gbag';
      panel.dataset.uid = b.uid;

      const head = document.createElement('div');
      head.className = 'inv-gbag-head';
      head.innerHTML = '<img alt=""><div class="inv-title"><b></b><small></small></div>';
      head.querySelector('img').src = def.image;
      head.querySelector('b').textContent = def.name;
      head.querySelector('small').textContent = `${b.grid.items.length ? b.grid.items.length + ' item' : 'kosong'} · ${b.grid.cols} × ${b.grid.rows}`;
      head.classList.add('draggable');
      head.title = Inventory.hasBag() ? 'Seret ke slot Tas untuk menukar dengan tas yang dipakai' : 'Seret ke slot Tas untuk memakai';
      head.addEventListener('pointerdown', (e) => this.startBagDrag(e, { from: 'ground', uid: b.uid, bagId: b.bagId, el: head }));

      const fitH = this.L.findH ? Math.floor((this.L.findH - 70) / b.grid.rows) : 999;   // satu tas muat tanpa scroll
      const cell = Math.max(CONFIG.inventory.minCellSize, Math.min(this.cell, Math.floor(inner / b.grid.cols), fitH));
      panel.append(head, this.buildGrid('bag:' + b.uid, b.grid, cell));
      this.findEl.appendChild(panel);
    }

    if (loose.length) {
      const lab = document.createElement('div');
      lab.className = 'inv-loose-label';
      lab.textContent = 'Di luar tas';
      const wrap = document.createElement('div');
      wrap.className = 'inv-loose';
      const cell = Math.min(this.cell, 52, Math.floor((this.L.searchW - 20) / 2));
      for (const g of loose) {
        const d = Inventory.def(g.id);
        const el = document.createElement('div');
        el.className = 'inv-find-item';
        el.style.width = d.w * cell + 'px';
        el.style.height = d.h * cell + 'px';
        el.title = d.name;
        this.fillItem(el, d, false);
        el.addEventListener('pointerdown', (e) => this.startDrag(e, { loose: g, el, cell }));
        wrap.appendChild(el);
      }
      this.findEl.append(lab, wrap);
    }

    if (!bags.length && !loose.length) {
      const e = document.createElement('p');
      e.className = 'inv-find-empty';
      e.textContent = 'Tidak ada item di sekitar.';
      this.findEl.appendChild(e);
    }
    if (!this.noteTimer) this.findNote.textContent = loose.length ? 'Ketuk 2x item untuk mengambil' : (Inventory.hasBag() ? 'Seret tas ke sini untuk menjatuhkan' : '');
  },

  note(text) {
    this.findNote.textContent = text;
    this.findNote.classList.add('warn');
    clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => { this.noteTimer = null; this.findNote.classList.remove('warn'); this.renderSearch(); }, 1500);
  },

  // item dari tas di tanah -> tas player
  takeFromBag(grid, uid) {
    const it = grid.get(uid);
    const spot = it && Inventory.grid && (Inventory.grid.findSpot(grid.sizeOf(it)) || null);
    const rotSpot = it && !spot && Inventory.grid ? Inventory.grid.findSpot(grid.sizeOf(it, !it.rotated)) : null;
    if (spot) Inventory.transfer(grid, uid, Inventory.grid, spot.x, spot.y, it.rotated);
    else if (rotSpot) Inventory.transfer(grid, uid, Inventory.grid, rotSpot.x, rotSpot.y, !it.rotated);
    else this.note(Inventory.hasBag() ? 'Tas penuh' : 'Tidak membawa tas');
  },

  take(uid) {
    if (GroundItems.take(uid)) return;      // berhasil: Inventory.emit -> render
    this.note(Inventory.hasBag() ? 'Tas penuh' : 'Tidak membawa tas');
  },

  // karakter: gambar dari config, atau siluet bawaan kalau belum ada
  buildFigure() {
    const src = CONFIG.inventory.character;
    this.figureEl.innerHTML = src ? `<img src="${src}" alt="Karakter">` :
      `<svg viewBox="0 0 120 260" aria-label="Karakter">
        <circle cx="60" cy="32" r="22"/>
        <path d="M30 70 Q60 58 90 70 L98 150 L84 152 L80 108 L76 252 L62 252 L60 168 L58 252 L44 252 L40 108 L36 152 L22 150 Z"/>
      </svg>`;
  },

  // slot perlengkapan di sekitar karakter (tas di samping kepala, tangan di samping badan, armor menutupi badan)
  renderSlots() {
    this.charEl.querySelectorAll('.inv-slot').forEach((n) => n.remove());
    for (const sl of CONFIG.inventory.slots) {
      const id = Inventory.equipment[sl.id];
      const def = sl.id === 'bag' ? Inventory.bag() : Inventory.def(id);
      const el = document.createElement('div');
      el.className = 'inv-slot';
      el.dataset.slot = sl.id;
      el.style.top = sl.top * this.L.k + 'px';
      if (sl.side === 'center') { el.style.left = '50%'; el.classList.add('center'); }
      else el.style[sl.side] = '0';
      if (sl.w) el.style.setProperty('--w', sl.w * this.L.k + 'px');
      if (sl.h) el.style.setProperty('--h', sl.h * this.L.k + 'px');
      const box = document.createElement('div');
      box.className = 'inv-slot-box' + (id ? ' filled' : '');
      if (id && def) {
        if (def.image || def.icon) {
          const img = document.createElement('img');
          img.src = def.image || def.icon; img.alt = def.name; img.draggable = false;
          box.appendChild(img);
        } else box.textContent = def.name;
      }
      const lab = document.createElement('small');
      lab.textContent = sl.label;
      el.append(box, lab);
      if (sl.id === 'bag' && id) {
        box.classList.add('draggable');
        box.title = 'Seret ke panel Pencarian untuk menjatuhkan tas';
        box.addEventListener('pointerdown', (e) => this.startBagDrag(e, { from: 'equipped', bagId: id, el: box }));
      }
      this.charEl.appendChild(el);
    }
  },

  // ===== drag & drop =====
  // src: { view, it, el }  item dari sebuah grid   |   { loose, el, cell }  item lepas di tanah
  startDrag(e, src) {
    if (e.button === 2) return;
    e.preventDefault();
    if (this.drag) this.cancelDrag(true);
    this.clearGhosts();
    const loose = !!src.loose;
    const it = loose ? src.loose : src.it;
    const d = Inventory.def(it.id);
    const cell = loose ? src.cell : src.view.cell;
    const r = src.el.getBoundingClientRect();

    const ghost = document.createElement('div');
    ghost.className = (loose ? 'inv-find-item' : 'inv-item') + ' inv-ghost';
    this.fillItem(ghost, d, !loose && it.rotated);
    document.body.appendChild(ghost);

    this.drag = {
      src, loose, it, id: it.id, el: src.el, ghost, cell,
      fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height,   // titik pegang (0..1 dari ukuran item)
      rotated: loose ? false : it.rotated,
      sx: e.clientX, sy: e.clientY, moved: false,
      target: null,
    };
    src.el.classList.add('lifted');
    src.el.setPointerCapture(e.pointerId);
    src.el.addEventListener('pointermove', this.onMove);
    src.el.addEventListener('pointerup', this.onUp);
    src.el.addEventListener('pointercancel', this.onCancel);
    src.el.addEventListener('lostpointercapture', this.onCancel);
    this.updateDrag(e.clientX, e.clientY);
  },

  onMove: (e) => InventoryUI.updateDrag(e.clientX, e.clientY),
  onUp: (e) => InventoryUI.endDrag(e.clientX, e.clientY),
  onCancel: () => InventoryUI.cancelDrag(),

  inRect(r, x, y) { return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; },

  updateDrag(cx, cy) {
    const d = this.drag; if (!d) return;
    if (Math.hypot(cx - d.sx, cy - d.sy) > 6) d.moved = true;
    d.px = cx; d.py = cy;

    const base = Inventory.def(d.id);
    const s = d.rotated ? { w: base.h, h: base.w } : { w: base.w, h: base.h };

    // grid di bawah pointer (kalau ada) menentukan ukuran slot & posisi tujuan
    const view = this.views.find((v) => this.inRect(v.el.getBoundingClientRect(), cx, cy)) || null;
    const cellG = view ? view.cell : d.cell;

    const g = d.ghost.style;                       // ghost mengikuti jari / kursor
    g.width = s.w * cellG + 'px'; g.height = s.h * cellG + 'px';
    this.rotImg(d.ghost.querySelector('img'), d.rotated, s.w * cellG, s.h * cellG);
    g.left = cx - d.fx * s.w * cellG + 'px';
    g.top = cy - d.fy * s.h * cellG + 'px';

    for (const v of this.views) v.preview.hidden = true;
    this.searchEl.classList.remove('drop', 'nodrop');
    const slotBox = this.bagSlotBox();
    if (slotBox) slotBox.classList.remove('drop', 'nodrop');

    if (!view && base.isBag && slotBox && this.inRect(slotBox.getBoundingClientRect(), cx, cy)) {
      d.target = { slot: true, ok: true };      // tas kosong dari dalam tas -> slot Tas = dipakai
      slotBox.classList.add('drop');
    } else if (view) {
      const gr = view.el.getBoundingClientRect();
      const x = Math.round((cx - d.fx * s.w * cellG - gr.left) / cellG);
      const y = Math.round((cy - d.fy * s.h * cellG - gr.top) / cellG);
      const same = !d.loose && d.src.view === view;
      const ok = view.grid.fits(s, x, y, same ? d.it.uid : null);
      d.target = { view, x, y, ok };
      view.preview.hidden = false;
      view.preview.className = 'inv-preview ' + (ok ? 'ok' : 'bad');
      this.placeEl(view.preview, view.cell, x, y, s.w, s.h);
    } else if (this.inRect(this.searchEl.getBoundingClientRect(), cx, cy)) {
      // lepas di panel Pencarian (di luar grid) = jatuhkan ke tanah (hanya berarti untuk item dari tas)
      const ok = !d.loose;
      d.target = { ground: true, ok };
      this.searchEl.classList.add(ok ? 'drop' : 'nodrop');
    } else {
      d.target = null;
    }
  },

  rotateDrag() {
    const d = this.drag; if (!d || d.loose) return;
    d.rotated = !d.rotated;
    d.fx = d.fy = 0.5;
    const rot = d.ghost.querySelector('span');
    if (rot) rot.style.transform = d.rotated ? 'rotate(90deg)' : '';
    this.updateDrag(d.px, d.py);
  },

  endDrag(cx, cy) {
    const d = this.drag; if (!d) return;
    this.updateDrag(cx, cy);
    const t = d.target, moved = d.moved;
    this.stopDrag();

    // ketuk (tanpa geser) item lepas = ambil ke tas
    if (!moved) {                                   // ketuk tanpa geser: 2x ketuk = pindah cepat (tanah -> tas, tas -> tanah)
      const now = performance.now(), lt = this.lastTap;
      this.lastTap = { uid: d.it.uid, t: now };
      if (lt && lt.uid === d.it.uid && now - lt.t < 400) {
        this.lastTap = null;
        if (d.loose) this.take(d.it.uid);
        else if (d.src.view.key !== 'player') this.takeFromBag(d.src.view.grid, d.it.uid);
        else { GroundItems.dropFromGrid(d.src.view.grid, d.it.uid); return; }   // item di tas 2x ketuk = keluar ke tanah
      }
      this.render();
      return;
    }

    if (t && t.ok) {
      if (t.slot) { GroundItems.equipFromItem(d.src.view.grid, d.it.uid); return; }
      if (t.ground) {
        GroundItems.dropFromGrid(d.src.view.grid, d.it.uid);           // emit -> render
        return;
      }
      if (d.loose) { if (GroundItems.takeTo(d.it.uid, t.view.grid, t.x, t.y, d.rotated)) return; }
      else if (Inventory.transfer(d.src.view.grid, d.it.uid, t.view.grid, t.x, t.y, d.rotated)) return;
    } else if (t && t.view) {
      this.note('Tidak muat di sini');
    }
    this.render();                                                    // kembali ke posisi awal
  },

  // quiet = dipanggil dari render() sendiri (jangan render ulang lagi)
  cancelDrag(quiet) {
    if (!this.drag) return;
    this.stopDrag();
    if (!quiet) this.render();
  },

  stopDrag() {
    const d = this.drag; this.drag = null;
    d.el.removeEventListener('pointermove', this.onMove);
    d.el.removeEventListener('pointerup', this.onUp);
    d.el.removeEventListener('pointercancel', this.onCancel);
    d.el.removeEventListener('lostpointercapture', this.onCancel);
    d.el.classList.remove('lifted');
    d.ghost.remove();
    for (const v of this.views) v.preview.hidden = true;
    this.searchEl.classList.remove('drop', 'nodrop');
    const sb = this.bagSlotBox(); if (sb) sb.classList.remove('drop', 'nodrop');
  },

  // buang semua ghost yang mungkin tertinggal (mis. pointerup tidak sampai)
  clearGhosts() { document.querySelectorAll('.inv-ghost, .inv-bag-ghost').forEach((n) => n.remove()); },

  // ===== drag tas =====
  // Tas yang dipakai diseret ke panel Pencarian = dijatuhkan (isi ikut).
  // Tas di tanah (header panelnya) diseret ke slot Tas = dipakai (isi ikut).
  startBagDrag(e, src) {
    if (e.button === 2) return;
    e.preventDefault();
    this.stopBagDrag(); this.clearGhosts();
    const def = CONFIG.inventory.bags[src.bagId];
    const ghost = document.createElement('div');
    ghost.className = 'inv-bag-ghost';
    ghost.innerHTML = '<img alt="">';
    ghost.firstChild.src = def.image;
    document.body.appendChild(ghost);
    this.bagDrag = { src, ghost, ok: false };
    src.el.classList.add('lifted');
    src.el.setPointerCapture(e.pointerId);
    src.el.addEventListener('pointermove', this.onBagMove);
    src.el.addEventListener('pointerup', this.onBagUp);
    src.el.addEventListener('pointercancel', this.onBagCancel);
    src.el.addEventListener('lostpointercapture', this.onBagCancel);
    this.updateBagDrag(e.clientX, e.clientY);
  },

  onBagMove: (e) => InventoryUI.updateBagDrag(e.clientX, e.clientY),
  onBagUp: (e) => InventoryUI.endBagDrag(e.clientX, e.clientY),
  onBagCancel: () => InventoryUI.stopBagDrag(),

  bagSlotBox() { return this.charEl.querySelector('.inv-slot[data-slot="bag"] .inv-slot-box'); },

  // Tujuan drag tas: tas dipakai -> panel Pencarian (jatuh) atau panel tas di tanah (tukar);
  //                  tas di tanah -> slot Tas (pakai, atau tukar kalau slot terisi)
  updateBagDrag(cx, cy) {
    const d = this.bagDrag; if (!d) return;
    d.ghost.style.left = cx + 'px'; d.ghost.style.top = cy + 'px';
    const slot = this.bagSlotBox();
    this.searchEl.classList.remove('drop', 'nodrop');
    slot.classList.remove('drop', 'nodrop');
    this.root.querySelectorAll('.inv-gbag.swap').forEach((n) => n.classList.remove('swap'));
    d.target = null;
    for (const v of this.views) v.preview.hidden = true;
    // tas KOSONG bisa disimpan ke grid mana pun (jadi item 1x1)
    const own = d.src.from === 'equipped' ? Inventory.grid : (GroundItems.bags.find((b) => b.uid === d.src.uid) || {}).grid;
    const view = own && !own.items.length ? this.views.find((v) => v.grid !== own && this.inRect(v.el.getBoundingClientRect(), cx, cy)) : null;
    if (view) {
      const gr = view.el.getBoundingClientRect();
      const x = Math.floor((cx - gr.left) / view.cell), y = Math.floor((cy - gr.top) / view.cell);
      const ok = view.grid.fits({ w: 1, h: 1 }, x, y);
      d.target = { stow: true, view, x, y, ok };
      view.preview.hidden = false;
      view.preview.className = 'inv-preview ' + (ok ? 'ok' : 'bad');
      this.placeEl(view.preview, view.cell, x, y, 1, 1);
      return;
    }
    if (d.src.from === 'equipped') {
      const panel = [...this.root.querySelectorAll('.inv-gbag')].find((n) => this.inRect(n.getBoundingClientRect(), cx, cy));
      if (panel) { d.target = { uid: +panel.dataset.uid }; panel.classList.add('swap'); }
      else if (this.inRect(this.searchEl.getBoundingClientRect(), cx, cy)) { d.target = { drop: true }; this.searchEl.classList.add('drop'); }
    } else if (this.inRect(slot.getBoundingClientRect(), cx, cy)) {
      d.target = { slot: true };
      slot.classList.add('drop');
    }
  },

  endBagDrag(cx, cy) {
    const d = this.bagDrag; if (!d) return;
    this.updateBagDrag(cx, cy);
    const { target: t, src } = d;
    this.stopBagDrag();
    if (!t) return;
    if (t.stow) { if (t.ok) GroundItems.stowBag(src, t.view.grid, t.x, t.y); else this.note('Tidak muat di sini'); return; }
    if (src.from === 'equipped') { t.drop ? GroundItems.dropBag() : GroundItems.pickBag(t.uid); }
    else GroundItems.pickBag(src.uid);
  },

  stopBagDrag() {
    const d = this.bagDrag; if (!d) return;
    this.bagDrag = null;
    const el = d.src.el;
    el.removeEventListener('pointermove', this.onBagMove);
    el.removeEventListener('pointerup', this.onBagUp);
    el.removeEventListener('pointercancel', this.onBagCancel);
    el.removeEventListener('lostpointercapture', this.onBagCancel);
    el.classList.remove('lifted');
    d.ghost.remove();
    this.searchEl.classList.remove('drop', 'nodrop');
    this.root.querySelectorAll('.inv-gbag.swap').forEach((n) => n.classList.remove('swap'));
    const slot = this.bagSlotBox(); if (slot) slot.classList.remove('drop', 'nodrop');
  },
};
