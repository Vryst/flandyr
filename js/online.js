// Online: sambungan ke Firebase Realtime Database.
//
//   Login anonim -> tiap browser punya uid sendiri (dipakai sebagai kunci data pemain).
//
//   Data di database:
//     players/{uid}/save        progress pribadi: posisi, lokasi (dunia / lantai menara), tas + isinya
//     presence/{uid}            posisi realtime (dihapus otomatis kalau koneksi putus)
//     world/items/{uid}         barang lepas di tanah (dunia bersama)
//     world/bags/{uid}          tas di tanah + isinya (isi = items/{uid item})
//     world/meta/epoch          detik nol jam game (semua pemain memakai jam yang sama)
//     world/meta/seeded         penanda isi awal dunia (CONFIG.worldItems / worldBags) sudah ditulis
//
//   Semua uid item / tas unik antar pemain (lihat Uid di inventory.js), jadi uid bisa langsung jadi kunci di database.
//
//   Cara kerja sinkron dunia: game tetap memakai GroundItems.list / .bags seperti biasa. Setiap Inventory.emit()
//   `flush()` membandingkan keadaan lokal dengan keadaan terakhir yang diketahui di server (`snap`), lalu menulis selisihnya.
//     - barang / tas diambil     -> transaksi hapus. Kalau sudah diambil orang lain, hasil ambil dibatalkan (revoke)
//     - isi tas di tanah berubah -> transaksi gabung (cek barang masih ada & slot masih kosong), kalau gagal dibatalkan
//   Tanpa koneksi / SDK gagal dimuat, game jalan offline seperti sebelumnya (data lokal saja).
const Online = {
  enabled: false,          // true setelah login + sinkron awal berhasil
  ready: false,
  uid: null,
  name: '',
  db: null,
  offset: 0,               // selisih jam server - jam perangkat (ms)
  epoch: Date.now(),       // jam game dimulai (ms, waktu server)
  connected: false,
  others: new Map(),       // uid -> { x, y, loc, a, n, t, rx, ry, hue }
  snap: { items: new Map(), bags: new Map() },   // keadaan terakhir di server (uid -> data)
  inflight: new Set(),     // uid tas yang sedang ditulis (transaksi berjalan)
  gone: new Map(),         // uid -> waktu: barang yang baru kita ambil (abaikan event lama dari server)
  applying: false,
  _flushT: 0, _saveT: 0, _ui: 0, _presAcc: 0, _heartAcc: 0, _saveAcc: 0,
  _lastPres: '', _lastSave: '', _clockText: '', _netText: '', _toastT: 0,

  cfg() { return CONFIG.online || {}; },

  // ============ mulai ============
  // Dipanggil sekali sebelum game jalan. Return true kalau online; false = main offline.
  async init() {
    const c = this.cfg();
    this.bindHud();
    if (!c.enabled || typeof firebase === 'undefined' || !window.FIREBASE_CONFIG) {
      console.info('Online: nonaktif / SDK Firebase tidak termuat, main offline');
      this.setNet(false);
      return false;
    }
    const T = c.connectTimeoutMs || 8000;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      this.db = firebase.database();
      const cred = await withTimeout(firebase.auth().signInAnonymously(), T);
      this.uid = cred.user.uid;
      this.name = 'Pemain-' + this.uid.slice(-4).toUpperCase();

      this.db.ref('.info/serverTimeOffset').on('value', (s) => { this.offset = s.val() || 0; });
      this.db.ref('.info/connected').on('value', (s) => {
        this.connected = !!s.val();
        if (this.connected && this.ready) this.armPresence();
        this.setNet(this.connected);
      });

      // jam game: epoch ditulis sekali oleh pemain pertama
      const ep = await withTimeout(this.db.ref('world/meta/epoch').transaction((cur) => cur || (Date.now() + this.offset)), T);
      this.epoch = ep.snapshot.val() || this.epoch;

      // progress pribadi
      const save = (await withTimeout(this.db.ref(`players/${this.uid}/save`).once('value'), T)).val();
      if (save) this.applySave(save);

      await this.startWorld(T);
      if (save) this.dedupe();
      this.startPresence();

      Inventory.onChange(() => { if (!this.applying) { this.schedule(); this.scheduleSave(); } });
      const leave = () => { this.saveNow(); if (this.presRef) this.presRef.remove(); };
      window.addEventListener('pagehide', leave);
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveNow(); });

      this.ready = this.enabled = true;
      Inventory.emit();
      this.setNet(this.connected);
      return true;
    } catch (e) {
      console.warn('Online: gagal tersambung, main offline —', e && e.message ? e.message : e);
      this.ready = this.enabled = false;
      if (!GroundItems.list.length && !GroundItems.bags.length) GroundItems.init();   // dunia lokal kalau gagal di tengah jalan
      this.setNet(false);
      return false;
    }
  },

  // ============ progress pribadi ============
  buildSave() {
    const s = { mode: Interior.active ? 'tower' : 'world', x: Math.round(Player.x), y: Math.round(Player.y),
                t: firebase.database.ServerValue.TIMESTAMP };
    if (Interior.active) s.floor = Interior.floorId;
    if (Inventory.bagId) {
      s.bagId = Inventory.bagId;
      const o = toObj(Inventory.grid.items);
      if (Object.keys(o).length) s.items = o;
    }
    return s;
  },

  applySave(s) {
    // tas + isinya
    Inventory.unequip();
    if (s.bagId && CONFIG.inventory.bags[s.bagId]) {
      const g = this.gridFrom(s.bagId, s.items);
      Inventory.equip(s.bagId, g);
    }
    // posisi
    const tower = CONFIG.objects.find((o) => o.interior);
    if (s.mode === 'tower' && tower && Interior.floors[s.floor]) {
      Interior.tower = tower; Interior.active = true; Interior.floorId = s.floor;
      Player.x = s.x; Player.y = s.y; Player.target = null; Interior.path = [];
      if (!Interior.canStand(Player.x, Player.y)) { Interior.active = false; Interior.tower = null; this.placeInWorld(tower, s); }
    } else {
      this.placeInWorld(tower, s);
    }
    Inventory.emit();
  },

  placeInWorld(tower, s) {
    if (s.mode === 'world' && Terrain.info(s.x, s.y).walkable) { Player.x = s.x; Player.y = s.y; }
    else if (tower && s.mode === 'tower') { Player.x = tower.x; Player.y = tower.y + tower.radius + 25; }   // simpan di menara tapi posisinya sudah tidak valid
    Player.target = null;
  },

  // barang yang sudah ada di dunia (mis. dijatuhkan lalu browser ditutup sebelum tersimpan) dihapus dari tas hasil muat
  dedupe() {
    const taken = new Set([...this.snap.items.keys()]);
    for (const s of this.snap.bags.values()) for (const k of Object.keys(s.items)) taken.add(Number(k));
    if (!Inventory.grid) return;
    let hit = false;
    for (const it of [...Inventory.grid.items]) if (taken.has(it.uid)) { Inventory.grid.take(it.uid); hit = true; }
    if (hit) Inventory.emit();
  },

  scheduleSave() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => this.saveNow(), this.cfg().saveDelayMs || 400);
  },

  saveNow() {
    if (!this.ready) return;
    clearTimeout(this._saveT);
    this._lastSave = `${Interior.active}|${Interior.floorId}|${Math.round(Player.x)}|${Math.round(Player.y)}`;
    this.db.ref(`players/${this.uid}/save`).set(this.buildSave()).catch((e) => this.fail('simpan progress', e));
  },

  // ============ dunia bersama ============
  async startWorld(T) {
    const db = this.db;
    const seeds = { items: GroundItems.list.slice(), bags: GroundItems.bags.slice() };

    // pemain pertama menulis isi awal dunia (dari CONFIG.worldItems / worldBags)
    const seed = await withTimeout(db.ref('world/meta/seeded').transaction((cur) => (cur ? undefined : true)), T);
    if (seed.committed) {
      const up = {};
      for (const it of seeds.items) up[`items/${it.uid}`] = this.itemData(it);
      for (const b of seeds.bags) up[`bags/${b.uid}`] = this.bagData(b);
      if (Object.keys(up).length) await withTimeout(db.ref('world').update(up), T);
    }

    const ir = db.ref('world/items'), br = db.ref('world/bags');
    const [is, bs] = await withTimeout(Promise.all([ir.once('value'), br.once('value')]), T);
    GroundItems.list = []; GroundItems.bags = [];
    this.snap.items.clear(); this.snap.bags.clear();
    is.forEach((c) => { this.onItem(c, true); });
    bs.forEach((c) => { this.onBag(c, true); });

    ir.on('child_added', (s) => this.onItem(s));
    ir.on('child_changed', (s) => this.onItem(s));
    ir.on('child_removed', (s) => this.onItemGone(s));
    br.on('child_added', (s) => this.onBag(s));
    br.on('child_changed', (s) => this.onBag(s));
    br.on('child_removed', (s) => this.onBagGone(s));
  },

  itemData(it) { return { id: it.id, x: r1(it.x), y: r1(it.y), loc: it.loc }; },
  bagData(b) {
    const d = { bagId: b.bagId, x: r1(b.x), y: r1(b.y), loc: b.loc }, o = toObj(b.grid.items);
    if (Object.keys(o).length) d.items = o;
    return d;
  },

  gridFrom(bagId, items) {
    const bag = CONFIG.inventory.bags[bagId], g = new Grid(bag.cols, bag.rows);
    for (const [u, v] of Object.entries(items || {})) {
      const it = { uid: Number(u), id: v.id, x: v.x, y: v.y, rotated: !!v.r };
      if (itemDef(v.id) && g.fits(g.sizeOf(it), it.x, it.y)) g.items.push(it);
    }
    return g;
  },

  // hanya untuk tas (uid tas baru tiap dijatuhkan): cegah event telat dari server menghidupkan lagi tas yang baru kita pungut
  markGone(uid) {
    this.gone.set(uid, performance.now());
    for (const [k, t] of this.gone) if (performance.now() - t > 3000) this.gone.delete(k);
  },
  wasGone(uid) { return this.gone.has(uid) && performance.now() - this.gone.get(uid) < 3000; },

  // ---- server -> lokal ----
  onItem(s, initial) {
    const uid = Number(s.key), v = s.val();
    if (!v || !isFinite(uid)) return;
    let it = GroundItems.list.find((i) => i.uid === uid);
    if (!it) { it = { uid, id: v.id, x: v.x, y: v.y, loc: v.loc }; GroundItems.list.push(it); }
    else { it.id = v.id; it.x = v.x; it.y = v.y; it.loc = v.loc; }
    this.snap.items.set(uid, { id: v.id, x: v.x, y: v.y, loc: v.loc });
    if (!initial) this.refreshUI();
  },

  onItemGone(s) {
    const uid = Number(s.key);
    this.snap.items.delete(uid);
    const i = GroundItems.list.findIndex((it) => it.uid === uid);
    if (i >= 0) { GroundItems.list.splice(i, 1); this.refreshUI(); }
  },

  onBag(s, initial) {
    const uid = Number(s.key), v = s.val();
    if (!v || !isFinite(uid) || !CONFIG.inventory.bags[v.bagId] || this.wasGone(uid)) return;
    const items = v.items || {}, rs = sig(items);
    let b = GroundItems.bags.find((x) => x.uid === uid);
    if (!b) {
      b = { uid, bagId: v.bagId, x: v.x, y: v.y, loc: v.loc, grid: this.gridFrom(v.bagId, items) };
      GroundItems.bags.push(b);
      this.snap.bags.set(uid, { grid: b.grid, items: copy(items), sig: rs });
    } else if (!this.inflight.has(uid)) {
      const sn = this.snap.bags.get(uid);
      // isi di server berubah (ulah pemain lain) dan lokal belum berubah sejak terakhir sinkron -> ikuti server
      if (sn && sn.sig !== rs && sig(toObj(b.grid.items)) === sn.sig) {
        b.grid.items = this.gridFrom(v.bagId, items).items;
        sn.items = copy(items); sn.sig = rs;
      }
    }
    if (!initial) this.refreshUI();
  },

  onBagGone(s) {
    const uid = Number(s.key);
    if (this.inflight.has(uid)) return;   // ditangani hasil transaksi
    this.snap.bags.delete(uid);
    const i = GroundItems.bags.findIndex((b) => b.uid === uid);
    if (i >= 0) { GroundItems.bags.splice(i, 1); this.refreshUI(); }
  },

  // render ulang UI inventory (digabung per frame). `applying` supaya tidak dianggap perubahan lokal.
  refreshUI() {
    if (this._ui) return;
    this._ui = requestAnimationFrame(() => {
      this._ui = 0;
      this.applying = true;
      try { Inventory.emit(); } finally { this.applying = false; }
    });
  },

  // ---- lokal -> server ----
  schedule() {
    if (this._flushT) return;
    this._flushT = setTimeout(() => { this._flushT = 0; this.flush(); }, 0);
  },

  flush() {
    if (!this.ready) return;
    // barang lepas
    const seen = new Set();
    for (const it of GroundItems.list) {
      seen.add(it.uid);
      if (!this.snap.items.has(it.uid)) this.pushItem(it);
    }
    for (const uid of [...this.snap.items.keys()]) if (!seen.has(uid)) this.claimItem(uid);

    // tas
    const seenB = new Set();
    for (const b of [...GroundItems.bags]) {
      seenB.add(b.uid);
      const sn = this.snap.bags.get(b.uid);
      if (!sn) this.pushBag(b);
      else if (!this.inflight.has(b.uid) && sig(toObj(b.grid.items)) !== sn.sig) this.commitBag(b, sn);
    }
    for (const [uid, sn] of [...this.snap.bags]) if (!seenB.has(uid)) this.claimBag(uid, sn);
  },

  pushItem(it) {
    this.gone.delete(it.uid);
    this.snap.items.set(it.uid, { id: it.id, x: it.x, y: it.y, loc: it.loc });
    this.db.ref('world/items/' + it.uid).set(this.itemData(it)).catch((e) => this.fail('jatuhkan barang', e));
  },

  pushBag(b) {
    this.gone.delete(b.uid);
    const items = toObj(b.grid.items);
    this.snap.bags.set(b.uid, { grid: b.grid, items, sig: sig(items) });
    this.db.ref('world/bags/' + b.uid).set(this.bagData(b)).catch((e) => this.fail('jatuhkan tas', e));
  },

  // ambil barang lepas: hanya berhasil kalau masih ada di server
  claimItem(uid) {
    this.snap.items.delete(uid);
    const msg = 'Barang itu sudah diambil pemain lain';
    this.db.ref('world/items/' + uid)
      .transaction((cur) => (cur === null ? undefined : null))
      .then((r) => { if (!r.committed) this.revoke(uid, msg); },
            (e) => { this.fail('ambil barang', e); this.revoke(uid, msg); });
  },

  // ambil tas dari tanah (beserta isinya)
  claimBag(uid, sn) {
    this.snap.bags.delete(uid);
    this.markGone(uid);
    let last = null;
    this.db.ref('world/bags/' + uid)
      .transaction((cur) => { last = cur; return cur === null ? undefined : null; })
      .then((r) => {
        if (!r.committed) { this.revokeBag(sn.grid, 'Tas itu sudah diambil pemain lain'); return; }
        // pemain lain sempat menaruh barang ke tas ini sebelum kita ambil -> ikut masuk ke tas kita
        const items = (last && last.items) || {};
        if (sig(items) !== sn.sig && sig(toObj(sn.grid.items)) === sn.sig) {
          sn.grid.items = this.gridFrom(last.bagId, items).items;
          this.refreshUI();
        }
      }, (e) => { this.fail('ambil tas', e); this.revokeBag(sn.grid, 'Tas itu sudah diambil pemain lain'); });
  },

  // isi tas di tanah berubah: gabungkan ke server lewat transaksi
  commitBag(b, sn) {
    const uid = b.uid, prev = sn.items, now = toObj(b.grid.items), nowSig = sig(now);
    const adds = [], removes = [], moves = [];
    for (const k of Object.keys(now)) { if (!prev[k]) adds.push(k); else if (differs(prev[k], now[k])) moves.push(k); }
    for (const k of Object.keys(prev)) if (!now[k]) removes.push(k);
    sn.items = now; sn.sig = nowSig;
    this.inflight.add(uid);
    const def = CONFIG.inventory.bags[b.bagId];

    this.db.ref('world/bags/' + uid).transaction((cur) => {
      if (!cur) return undefined;                               // tas sudah tidak ada
      const items = Object.assign({}, cur.items || {});
      for (const k of removes.concat(moves)) {
        if (!items[k] || items[k].id !== prev[k].id) return undefined;   // barang sudah diambil / dipindah orang lain
        delete items[k];
      }
      for (const k of adds) if (items[k]) return undefined;
      const g = new Grid(def.cols, def.rows);
      for (const [k, v] of Object.entries(items)) g.items.push({ uid: Number(k), id: v.id, x: v.x, y: v.y, rotated: !!v.r });
      for (const k of moves.concat(adds)) {
        const v = now[k];
        if (!g.put({ uid: Number(k), id: v.id, x: v.x, y: v.y, rotated: !!v.r }, v.x, v.y)) return undefined;   // slot sudah terisi
        items[k] = v;
      }
      const out = Object.assign({}, cur);
      if (Object.keys(items).length) out.items = items; else delete out.items;
      return out;
    }).then((r) => {
      this.inflight.delete(uid);
      if (r.committed) {
        if (sig(toObj(b.grid.items)) !== nowSig) { this.schedule(); return; }      // ada perubahan baru lagi: kirim lagi
        const rem = (r.snapshot.val() || {}).items || {};
        if (sig(rem) !== nowSig) this.adopt(b, sn, rem);                          // hasil gabungan dengan pemain lain
      } else {
        this.conflict(b, sn, adds, removes);
      }
    }, (e) => { this.inflight.delete(uid); this.fail('ubah isi tas', e); this.conflict(b, sn, adds, removes); });
  },

  adopt(b, sn, items) {
    b.grid.items = this.gridFrom(b.bagId, items).items;
    sn.items = copy(items); sn.sig = sig(items);
    this.refreshUI();
  },

  // transaksi isi tas ditolak: barang yang kita taruh jatuh ke tanah, barang yang kita ambil dibatalkan, isi tas ikut server
  async conflict(b, sn, adds, removes) {
    let rv = null;
    try { rv = (await this.db.ref('world/bags/' + b.uid).once('value')).val(); } catch (e) { /* offline: anggap tas masih ada */ }
    for (const k of adds) GroundItems.dropFromGrid(b.grid, Number(k));
    for (const k of removes) this.revoke(Number(k), 'Barang itu sudah diambil pemain lain');
    if (rv === null && this.connected) {
      this.snap.bags.delete(b.uid);
      const i = GroundItems.bags.indexOf(b);
      if (i >= 0) GroundItems.bags.splice(i, 1);
      this.refreshUI();
    } else if (rv) {
      this.adopt(b, sn, rv.items || {});
    }
    this.toast('Isi tas berubah: ada pemain lain yang mengambil / menaruh barang');
  },

  // batalkan barang yang ternyata sudah diambil orang lain (hapus dari tas kita)
  revoke(uid, msg) {
    let hit = false;
    const strip = (g) => { if (g && g.take(uid)) hit = true; };
    strip(Inventory.grid);
    for (const b of GroundItems.bags) strip(b.grid);
    const i = GroundItems.list.findIndex((it) => it.uid === uid);
    if (i >= 0) { GroundItems.list.splice(i, 1); this.snap.items.delete(uid); hit = true; }
    if (hit) { this.toast(msg); this.refreshUI(); }
  },

  revokeBag(grid, msg) {
    let hit = false;
    if (Inventory.grid === grid) { Inventory.unequip(); hit = true; }
    const i = GroundItems.bags.findIndex((b) => b.grid === grid);
    if (i >= 0) { this.snap.bags.delete(GroundItems.bags[i].uid); GroundItems.bags.splice(i, 1); hit = true; }
    if (hit) { this.toast(msg); this.refreshUI(); }
  },

  // ============ pemain lain (presence) ============
  startPresence() {
    this.presRef = this.db.ref('presence/' + this.uid);
    const all = this.db.ref('presence');
    const put = (s) => {
      if (s.key === this.uid) return;
      const v = s.val(); if (!v) return;
      const o = this.others.get(s.key);
      if (o) Object.assign(o, v);
      else this.others.set(s.key, Object.assign({ rx: v.x, ry: v.y, hue: hueOf(s.key) }, v));
    };
    all.on('child_added', put);
    all.on('child_changed', put);
    all.on('child_removed', (s) => { this.others.delete(s.key); });
    this.armPresence();
  },

  armPresence() {
    this.presRef.onDisconnect().remove();
    this.sendPresence(true);
  },

  sendPresence(force) {
    if (!this.presRef) return;
    const loc = GroundItems.loc(), x = Math.round(Player.x), y = Math.round(Player.y);
    const key = `${loc}|${x}|${y}`;
    if (!force && key === this._lastPres) return;
    this._lastPres = key;
    this.presRef.set({ x, y, loc, a: r1(Player.angle), n: this.name, t: firebase.database.ServerValue.TIMESTAMP })
      .catch((e) => this.fail('kirim posisi', e));
  },

  // dipanggil tiap frame
  update(dt) {
    this.clockHud();
    for (const o of this.others.values()) {          // gerak halus menuju posisi terbaru
      const k = Math.min(1, dt * 10);
      if (Math.hypot(o.x - o.rx, o.y - o.ry) > 600) { o.rx = o.x; o.ry = o.y; }
      else { o.rx += (o.x - o.rx) * k; o.ry += (o.y - o.ry) * k; }
    }
    if (!this.ready) return;
    const c = this.cfg();
    this._presAcc += dt * 1000; this._heartAcc += dt * 1000; this._saveAcc += dt * 1000;
    if (this._presAcc >= (c.presenceMs || 200)) { this._presAcc = 0; this.sendPresence(false); }
    if (this._heartAcc >= 20000) { this._heartAcc = 0; this.sendPresence(true); }   // tanda masih hidup
    if (this._saveAcc >= (c.positionSaveMs || 3000)) {
      this._saveAcc = 0;
      const k = `${Interior.active}|${Interior.floorId}|${Math.round(Player.x)}|${Math.round(Player.y)}`;
      if (k !== this._lastSave) this.saveNow();
    }
  },

  fresh(o) { return Date.now() + this.offset - (o.t || 0) < (this.cfg().presenceStaleMs || 60000); },

  // pemain lain di lokasi yang sama (loc: 'world' atau 'tower:<id>:<lantai>')
  drawOthers(ctx, loc, radius) {
    if (!this.ready) return;
    const world = loc === 'world';
    const vw = window.innerWidth / Camera.zoom, vh = window.innerHeight / Camera.zoom;
    for (const o of this.others.values()) {
      if (o.loc !== loc || !this.fresh(o)) continue;
      if (world && (o.rx < Camera.x - 60 || o.rx > Camera.x + vw + 60 || o.ry < Camera.y - 60 || o.ry > Camera.y + vh + 60)) continue;
      Player.drawOther(ctx, o, radius);
    }
  },

  onlineCount() { let n = 1; for (const o of this.others.values()) if (this.fresh(o)) n++; return n; },

  // ============ jam game (sama untuk semua pemain) ============
  // 1 detik nyata = SCALE.timeScale detik game; mulai pukul 06:00 hari ke-1
  clock() {
    const t = (Date.now() + this.offset - this.epoch) / 1000 * SCALE.timeScale + 6 * 3600;
    return { day: Math.floor(t / 86400) + 1, h: Math.floor(t % 86400 / 3600), m: Math.floor(t % 3600 / 60) };
  },

  // ============ HUD kecil: jam + status koneksi + pesan ============
  bindHud() {
    this.clockEl = document.getElementById('clock');
    this.netEl = document.getElementById('net');
    this.toastEl = document.getElementById('toast');
  },

  clockHud() {
    if (!this.clockEl) return;
    const c = this.clock(), txt = `Hari ${c.day} · ${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}`;
    if (txt !== this._clockText) { this._clockText = txt; this.clockEl.textContent = txt; }
    if (this.ready) this.setNet(this.connected);
  },

  setNet(on) {
    if (!this.netEl) return;
    const txt = !this.enabled && !this.ready ? 'offline' : on ? `online · ${this.onlineCount()}` : 'terputus';
    if (txt === this._netText) return;
    this._netText = txt;
    this.netEl.textContent = '● ' + txt;
    this.netEl.className = on && this.ready ? 'on' : 'off';
  },

  toast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.remove('show'), 3200);
  },

  fail(what, e) {
    console.warn(`Online: gagal ${what} —`, e && e.message ? e.message : e);
  },
};

// ---- util ----
const r1 = (n) => Math.round(n * 10) / 10;
const copy = (o) => JSON.parse(JSON.stringify(o));
function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}
// isi grid -> { uid: { id, x, y, r } }
function toObj(items) {
  const o = {};
  for (const it of items) o[it.uid] = { id: it.id, x: it.x, y: it.y, r: it.rotated ? 1 : 0 };
  return o;
}
// tanda pengenal isi tas (urutan tidak berpengaruh)
function sig(o) {
  return Object.keys(o).sort().map((k) => `${k}:${o[k].id}:${o[k].x}:${o[k].y}:${o[k].r ? 1 : 0}`).join('|');
}
function differs(a, b) { return a.id !== b.id || a.x !== b.x || a.y !== b.y || !!a.r !== !!b.r; }
function hueOf(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
