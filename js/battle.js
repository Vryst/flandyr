// Battle realtime aksi. Alur singkat:
//   Siaga (Battle.enter) -> ikut room (BattleNet) -> arena tetap (lantai menara) atau arena acak (seed dari room).
//   Pemain pertama di room = HOST: dia yang menjalankan AI semua monster dan mengirim snapshot ke yang lain.
//   Kalau host keluar, pemain lain mengambil alih (BattleNet) dan melanjutkan dari snapshot terakhir.
//   Serangan = event kecil ("tebas / tusuk dari titik X arah A"). Tiap perangkat menghitung sendiri apakah DIRINYA kena
//   (jadi menghindar terasa adil), sedangkan kena-tidaknya MONSTER dihitung host.
// Satuan: px lantai / arena (sama dengan Interior). Darah pemain = Vitals.v.health.

// bentuk area serangan: cone (kipas), circle, line (garis tebal)
const Shape = {
  hit(s, px, py, pr) {
    const dx = px - s.x, dy = py - s.y;
    if (s.t === 'circle') return Math.hypot(dx, dy) <= s.r + pr;
    if (s.t === 'cone') {
      const d = Math.hypot(dx, dy);
      if (d > s.r + pr) return false;
      if (d <= pr) return true;
      let da = Math.atan2(dy, dx) - s.a;
      da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
      return da <= s.arc / 2 + Math.asin(Math.min(1, pr / d));
    }
    const c = Math.cos(s.a), n = Math.sin(s.a);           // line
    const t = dx * c + dy * n, o = -dx * n + dy * c;
    return t >= -pr && t <= s.r + pr && Math.abs(o) <= s.w / 2 + pr;
  },
};

const ST = { IDLE: 0, CHASE: 1, WINDUP: 2, ACTIVE: 3, RECOVER: 4, DEAD: 5 };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turnTo = (a, want, step) => { const d = wrapA(want - a); return Math.abs(d) <= step ? want : a + Math.sign(d) * step; };

const Battle = {
  active: false, busy: false,
  siaga: false,              // mode Siaga (pemain siap tempur). Raid / musuh baru mulai saat masuk map battle (Tower of Mabel)
  cool: 0, bumpCool: 0, enc: null,
  sc: {},                    // kejaran unit yang disinkron: unitId -> { uid, x, y, vx, vy, a, t, rx, ry }  (ditulis pemilik kejaran, dibaca semua pemain)
  eng: {},                   // lingkaran battle di map gede: unitId -> { x, y, t }  (ada selama masih ada pemain bertarung melawan unit itu)
  arena: null, kind: null, room: null, biome: null, floorId: 0, seed: 1,
  self: null, kv: { x: 0, y: 0 }, input: { mx: 0, my: 0 },
  atkT: 0, down: false, koT: 0, speedNow: 0,
  isHost: true, mons: [], others: new Map(), swings: [], floaters: [],
  arenas: {}, gatherPts: {},   // arena tetap per lantai menara (satu battle bisa menjangkau Halaman sampai Atap) + titik kumpul monster per lantai
  aim: null, now: 0, shake: 0, respawnT: 0, flows: {}, rng: Math.random, _sendT: 0, _lastSelf: '', _lastMons: '', _ls: null, _vx: 0, _vy: 0, _monAt: 0,
  _spawns: [],

  cfg() { return CONFIG.battle; },
  uid() { return (typeof Online !== 'undefined' && Online.uid) || 'me'; },
  selfR() { return this.arena.kind === 'fixed' ? Interior.R : this.cfg().arena.playerRadius; },
  // ---- lantai ----
  // Raid menara (kind 'fixed') berlangsung di SELURUH menara: Halaman, lantai 1, 2, Atap. Tiap monster / pemain / serangan punya nomor lantai (`fl`);
  // yang beda lantai tidak saling kena & tidak saling kelihatan. Arena acak (hutan) tidak punya lantai: semuanya -1.
  myFl() { return Interior.active ? Interior.floorId : -1; },
  arenaFor(fl) {
    if (this.kind !== 'fixed' || fl < 0) return this.arena;
    return this.arenas[fl] || (this.arenas[fl] = BattleArena.fixed(fl));
  },
  visR() { return CONFIG.interior.playerRadius; },

  // ---------- alur ----------
  // Monster = lingkaran di map gede (CONFIG.battle.encounters) seperti Tower of Mabel. Masuk lingkaran (Interact "Serang")
  // = battle di arena acak berisi monster lingkaran itu. Masuk Halaman Tower of Mabel = raid arena tetap, otomatis.
  // Siaga / Santai HANYA menampilkan / menyembunyikan kontrol battle (joystick + tombol serang; PC: WASD + klik). Saat battle, kontrol selalu tampil.
  controls() { return this.siaga || this.active; },
  me() { return this.active ? this.self : Player; },

  // Siaga / Santai hanya ada di map battle (di dalam menara). Siaga = masuk mode battle (bisa menyerang, bisa kena serangan pemain lain) walau tidak ada monster.
  // Santai = keluar dari mode itu; hanya bisa kalau tidak ada monster hidup (kalau ada, kabur dulu lewat pintu Halaman).
  setSiaga(on) {
    if (this.busy) return;
    if (this.active) { if (!on && this.kind === 'fixed' && this.relaxOk()) this.leave(); return; }
    if (on && (!Interior.active || !this.cfg().enabled)) return;
    this.siaga = false; this.input.mx = this.input.my = 0;
    if (on) { this.enter(this.available() || { type: 'fixed', key: this.raidKey(), floorId: Interior.floorId, spawns: [], units: [], angles: [] }); return; }
    BattleUI.refresh();
  },
  relaxOk() { return !this.mons.some((m) => m.st !== ST.DEAD); },
  raidKey() { return `tower:${CONFIG.interior.startFloor || 0}`; },
  toggle() { this.setSiaga(!this.siaga); },

  // raid arena tetap (Halaman menara): isinya = unit yang sedang berada DI DALAM menara (lihat `cycle` di CONFIG.battle.units) dan belum dikalahkan
  available() {
    const c = this.cfg();
    if (!c || !c.enabled || !Interior.active) return null;
    if (!CONFIG.interior.floors.some((f) => f.battle)) return null;      // menara punya raid: berlaku di SEMUA lantai (pemain di lantai mana pun ikut raid begitu ada musuh)
    const r = this.raidSpawns();
    if (!r && !this.raidHeld()) return null;      // tidak ada unit di dalam menara & tidak ada raid yang tertinggal / sedang berjalan
    return { type: 'fixed', key: this.raidKey(), floorId: Interior.floorId, spawns: r ? r.spawns : [], units: r ? r.ids : [], angles: r ? r.angles : [], owners: r ? r.owners : [] };
  },
  // raid yang masih ada di menara (sedang berjalan, atau ditinggalkan pemain terakhir dengan monster hidup): pemain yang masuk melanjutkannya
  raidHeld() { return BattleNet.isHeld(this.raidKey()); },
  // unit yang monsternya sedang hidup di dalam menara (raid tersimpan / berjalan): tidak muncul di peta dunia & tidak membuat raid kedua
  // ---- unit keluar menara tanpa pemain di dalam ----
  // Server tidak menjalankan AI, jadi raid yang ditinggal kosong tidak "bergerak". Supaya unit tetap KELUAR dari pintu menara tepat waktunya (kelihatan oleh pemain di peta gede,
  // bukan baru dihitung pas ada yang masuk), waktu keluarnya dihitung dari penanda `hold` (terakhir host hidup) + lama tinggal acak (seed unit + hold, sama di semua klien)
  // + waktu jalan ke pintu (CONFIG.battle.exitWalkSec, default 45 dtk). Setelah itu unit muncul DI PINTU dan rutenya mulai dari situ (lihat unitClock).
  holdT() { return BattleNet.online() ? (this.cleared['hold:' + this.raidKey()] || 0) : ((BattleNet._held[this.raidKey()] || {}).t || 0); },
  stayFor(u, holdT) { this.campOf(u); const r = this.cfg().leaveStaySec || [90, 300]; return r[0] + mulberry((u._seed ^ (holdT % 2147483647)) >>> 0)() * (r[1] - r[0]); },
  lazyOutAt(u, holdT) { return Math.round(holdT + (this.stayFor(u, holdT) + (this.cfg().exitWalkSec || 45)) * 1000); },
  // unit tercatat di dalam menara: `in` lebih baru dari `out`, DAN `in` ikut di-refresh bersama `hold` (host menulis `in` semua unit raid tiap 30 dtk). `in` yang jauh lebih tua dari
  // `hold` = unit itu sudah keluar dari raid yang dulu (jangan dihidupkan lagi cuma karena ada raid LAIN yang me-refresh `hold`).
  markedIn(u) {
    const i = this.cleared['in:' + u.id] || 0;
    if (!(i > 0) || (this.cleared['out:' + u.id] || 0) >= i) return false;
    const h = this.holdT();
    return h > 0 ? h - i <= 90000 : this.active;
  },
  // tiap ~2 dtk: unit yang menurut jadwal sudah keluar dari raid yang ditinggal dicatat permanen (`out` = waktu keluarnya, nilai sama di semua klien), supaya tidak ada yang
  // bergantung pada `hold` lagi (raid baru yang me-refresh `hold` tidak bisa "memasukkan" mereka lagi, dan posisi mereka di peta tidak loncat).
  settleExits(dt) {
    this._stT = (this._stT || 0) - dt; if (this._stT > 0) return;
    this._stT = 2;
    if (this.active || this.busy) return;
    const h = this.holdT(); if (!(h > 0)) return;
    const now = BattleNet.now();
    for (const u of this.cfg().units || []) {
      if (!this.markedIn(u)) continue;
      const at = this.lazyOutAt(u, h);
      if (now < at) continue;
      this.cleared['out:' + u.id] = at;
      if (BattleNet.online()) Online.db.ref('battle_state/out:' + u.id).set(at).catch(() => {});
    }
  },
  lazyOut(u) {         // ms: waktu unit (ditinggal kosong) sudah keluar dari pintu; 0 = belum / tidak berlaku
    if (this.active || !this.markedIn(u)) return 0;
    const h = this.holdT(); if (!(h > 0)) return 0;
    const at = this.lazyOutAt(u, h);
    return BattleNet.now() >= at ? at : 0;
  },
  heldAlive() {        // masih ada unit yang (menurut jadwal) belum keluar dari raid yang ditinggal
    if (this.active) return true;
    const h = this.holdT(); if (!(h > 0)) return false;
    const now = BattleNet.now();
    return (this.cfg().units || []).some((u) => this.markedIn(u) && now < this.lazyOutAt(u, h));
  },
  inTower(u) { return this.markedIn(u) && (this.active || (this.raidHeld() && !this.lazyOut(u))); },     // penanda basi (raid sudah tidak ada / unit sudah keluar menurut jadwal) diabaikan
  // ms terakhir unit "mulai dari titik awal": keluar dari pintu menara, atau respawn setelah dikalahkan (muncul di kemah / pintu, bukan di tengah rute jadwal). 0 = belum pernah
  outAt(u) {
    const o = this.markedIn(u) ? this.lazyOut(u) : (this.cleared['out:' + u.id] || 0), e = this.cleared['enc:' + u.id] || 0;
    return Math.max(o, e > 0 ? e + this.respawnMs('enc:' + u.id) : 0);
  },
  setIn(ids, on) {
    for (const id of ids) {
      this.cleared['in:' + id] = on ? BattleNet.now() : 0;
      if (BattleNet.online()) Online.db.ref('battle_state/in:' + id).set(this.cleared['in:' + id]).catch(() => {});
    }
  },
  touchHold() {      // host menandai raid masih hidup (pemain yang baru masuk ikut bergabung; saat room kosong waktu ini = kapan monster terakhir "dilihat")
    if (this.kind !== 'fixed' || !this.isHost || !this.mons.some((m) => m.st !== ST.DEAD)) return;
    this.setIn(this._unitIds || [], true);
    if (BattleNet.online()) Online.db.ref('battle_state/hold:' + this.room).set(BattleNet.now()).catch(() => {});
  },
  // snapshot monster hidup untuk disimpan saat pemain terakhir keluar / tumbang: lantai, posisi, darah. Yang sedang menyerang dianggap mengejar.
  persistSnap() {
    if (this.kind !== 'fixed' || !this.mons.some((m) => m.st !== ST.DEAD)) return null;
    const mons = this.mons.map((m) => {
      const st = m.st > ST.CHASE && m.st < ST.DEAD ? ST.CHASE : m.st;
      return [m.id, m.type, Math.round(m.rx), Math.round(m.ry), m.ra.toFixed(2), Math.ceil(m.hp), st, m.fl, m.u || ''].join('~');
    }).join(';');
    return { mons, units: (this._unitIds || []).join(','), seed: this.seed };
  },
  // pandangan: Halaman & Atap (linkedFloors) satu ruang pandang, jadi monster / pemain di salah satunya kelihatan dari yang lain (hanya terlihat, tidak saling kena)
  sameView(a, b) {
    if (a === b) return true;
    const L = CONFIG.interior.linkedFloors || [];
    return L.includes(a) && L.includes(b);
  },
  // monster yang sedang menunggu di dalam menara (belum dikalahkan)
  raidSpawns() {
    const c = this.cfg();
    if (!c || !c.enabled) return null;
    const spawns = [], ids = [], angles = [], owners = [], list = [], t = BattleNet.now() / 1000;
    for (const u of c.units || []) {
      if (!u.cycle || !this.unitDet(u, t).inside || this.isCleared('enc:' + u.id) || this.inTower(u)) continue;
      const o = this.cleared['out:' + u.id];      // baru saja keluar menara lagi: jangan langsung masuk raid lagi selama sisa jendela "di dalam"
      if (o > 0 && BattleNet.now() - o < ((u.cycle.in || 60) + 30) * 1000) continue;
      spawns.push(...u.pack); ids.push(u.id);
      const ang = this.enterAngle(u, t); for (const _ of u.pack) { angles.push(ang); owners.push(u.id); }
      list.push({ id: u.id, pack: u.pack, ang });
    }
    return spawns.length ? { spawns, ids, angles, owners, list } : null;
  },

  // ---- status "sudah dibersihkan" (dibagi lewat battle_state/{key}, sama untuk semua pemain) ----
  cleared: {}, _watching: false,
  respawnMs(key) {
    const c = this.cfg();
    if (key.startsWith('enc:')) { const u = (c.units || []).find((q) => 'enc:' + q.id === key); return ((u && u.respawnSec) || 180) * 1000; }
    const fl = CONFIG.interior.floors.find((f) => 'tower:' + f.id === key);
    return (((fl && fl.battle && fl.battle.respawnSec) || 300)) * 1000;
  },
  isCleared(key) { const t = this.cleared[key]; return !!t && BattleNet.now() - t < this.respawnMs(key); },
  markCleared(key) {
    this.cleared[key] = BattleNet.now();
    if (BattleNet.online()) Online.db.ref('battle_state/' + key).set(this.cleared[key]).catch(() => {});
  },
  watchState() {
    if (this._watching || !BattleNet.online()) return;
    this._watching = true;
    const ref = Online.db.ref('battle_state'), fn = (s) => { this.cleared[s.key] = s.val(); };
    ref.on('child_added', fn); ref.on('child_changed', fn);
    // kejaran unit (posisi dibagikan supaya semua pemain melihat serigala di koordinat yang sama)
    const cr = Online.db.ref('chase'), cf = (s) => { this.setChase(s.key, s.val()); };
    cr.on('child_added', cf); cr.on('child_changed', cf); cr.on('child_removed', (s) => this.setChase(s.key, null));
    // lingkaran battle di map gede
    const er = Online.db.ref('encounter'), ef = (s) => { this.setEng(s.key, s.val()); };
    er.on('child_added', ef); er.on('child_changed', ef); er.on('child_removed', (s) => this.setEng(s.key, null));
  },

  // ---- kejaran & lingkaran battle yang disinkron ----
  setChase(id, str) {
    if (!str) { delete this.sc[id]; return; }
    const [uid, x, y, vx, vy, a, t] = String(str).split(',');
    const r = { uid, x: +x, y: +y, vx: +vx, vy: +vy, a: +a, t: +t }, old = this.sc[id];
    r.rx = old ? old.rx : r.x; r.ry = old ? old.ry : r.y;
    this.sc[id] = r;
  },
  setEng(id, str) {
    if (!str) {
      const old = this.eng[id], u = (this.cfg().units || []).find((q) => q.id === id);
      delete this.eng[id];
      if (old && u && !this.isCleared('enc:' + id)) u._ret = { x: old.x, y: old.y, a: 0, t: 0 };   // tidak ada yang bertarung lagi: unit berjalan balik ke jalur bawaan
      return;
    }
    const [x, y, t, px, py, t0] = String(str).split(',').map(Number);
    this.eng[id] = { x, y, t, px, py, t0: t0 || t };
  },
  // lingkaran battle yang masih berlaku (heartbeat host tiap 20 dtk; > 60 dtk tanpa heartbeat = basi)
  engOf(u) {
    const e = this.eng[u.id];
    if (!e || BattleNet.now() - e.t > 60000 || this.isCleared('enc:' + u.id)) return null;
    return e;
  },
  engR(u) { return u.radius + (this.cfg().ringPad || 40); },
  engStr(e) { return [Math.round(e.x), Math.round(e.y), e.t, Math.round(e.px), Math.round(e.py), e.t0].join(','); },
  engStart(id, at) {
    const u = (this.cfg().units || []).find((q) => q.id === id);
    if (!u || !at || this.engOf(u)) return;          // sudah ada lingkaran (kita ikut bergabung): pakai posisinya
    const t = BattleNet.now();     // px,py = posisi korban (pemain yang ditabrak) di map gede; t0 = waktu bentrok (untuk auto-join teman yang dekat)
    const e = this.eng[id] = { x: at.x, y: at.y, t, px: Player.x, py: Player.y, t0: t };
    if (BattleNet.online()) Online.db.ref('encounter/' + id).set(this.engStr(e)).catch(() => {});
  },
  engBeat() {
    if (!this.active || this.kind !== 'random' || !this.enc || !this.isHost) return;
    const e = this.eng[this.enc.id]; if (!e) return;
    e.t = BattleNet.now();
    if (BattleNet.online()) Online.db.ref('encounter/' + this.enc.id).set(this.engStr(e)).catch(() => {});
  },
  // pemilik kejaran
  endChase(u) {
    u._o = null;
    if (u._own) { u._own = false; BattleNet.releaseChase(u.id); }
  },

  tick(dt) {
    this.cool = Math.max(0, this.cool - dt);
    this.bumpCool = Math.max(0, this.bumpCool - dt);
    this.watchState();
    this.settleExits(dt);
    if (!this.active && !this.busy && !this.cool) this.checkBump();
    if (!this.active && !this.busy && !this.cool && !this.bumpCool) { const d = this.available(); if (d) this.enter(d); }   // masuk Halaman menara -> musuh yang menunggu di dalam langsung menyerang
    // mode battle tanpa monster (Siaga biasa) + ada unit yang masuk menara: host memunculkan raid di room yang sama
    // raid menara berjalan + ada unit lain yang masuk menara (jadwal `cycle`): host menambahkan monsternya ke room yang sama (ikut raid)
    if (this.active && this.kind === 'fixed' && this.isHost) {
      const r = this.raidSpawns();
      if (r) { const had = this.mons.length; this.addUnits(r.list); Online.toast && Online.toast(had ? 'Musuh lain masuk menara' : 'Raid dimulai'); }
    }
    this._engT = (this._engT || 0) + dt; if (this._engT > 20) { this._engT = 0; this.engBeat(); }
    this.stepUnits(dt);
  },

  // ---- unit monster di map gede: berkeliaran di sekitar kemah, posisi dihitung dari jam server (sama untuk semua pemain) ----
  campOf(u) {
    if (!u._camp) {
      const h = u.home, o = typeof h === 'string' ? CONFIG.objects.find((q) => q.id === h) : h;
      u._camp = o ? { x: o.x, y: o.y, r: o.radius || 0 } : { x: 0, y: 0, r: 0 };
      u._obj = typeof h === 'string' ? o : null;      // objek kemah (menara) kalau ada
      let seed = 7; for (const ch of u.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const rn = mulberry(seed);
      u._ph = [rn() * 6.3, rn() * 6.3, rn() * 6.3, rn() * 6.3]; u._seed = seed;
    }
    return u._camp;
  },
  // ---- rute unit: blok `every` leg. Tiap blok mulai & berakhir di titik jangkar (pintu menara bila `cycle`, kalau tidak titik kemah) dan di antaranya
  // berjalan ke titik-titik acak (<= `roam` dari kemah) yang jalurnya sudah dicek (tidak lewat air / menara), jadi rute selalu valid dan mulus. Semua dihitung dari
  // seed + jam server -> semua pemain melihat posisi yang sama. Berhenti sebentar di tiap titik; di jangkar pintu menara unit masuk & menunggu `cycle.in` detik.
  anchorOf(u) {
    const c = this.campOf(u);
    return u.cycle ? { x: c.x, y: c.y + c.r + u.radius * .5, home: true } : { x: c.x, y: c.y, home: false };
  },
  nearSolid(x, y, m) {
    for (const o of CONFIG.objects) if (o.radius && Math.hypot(x - o.x, y - o.y) < o.radius + m) return true;
    return false;
  },
  legOk(u, a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 60));
    for (let i = 0; i <= n; i++) {
      const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
      if (!Terrain.info(x, y).walkable) return false;
      const nearEnd = (a.home && Math.hypot(x - a.x, y - a.y) < 140) || (b.home && Math.hypot(x - b.x, y - b.y) < 140);
      if (!nearEnd && this.nearSolid(x, y, u.radius + 10)) return false;
    }
    return true;
  },
  block(u, m) {
    u._blk = u._blk || {};
    if (u._blk[m]) return u._blk[m];
    const c = this.campOf(u), N = this.legsPerBlock(u), anc = this.anchorOf(u), rn = mulberry(u._seed ^ Math.imul(m + 7919, 2654435761));
    const pts = [anc];
    for (let j = 1; j < N; j++) {
      const prev = pts[j - 1];
      let pick = prev;
      for (let i = 0; i < 40; i++) {
        const ang = rn() * 6.283, d = Math.sqrt(rn()) * u.roam, cand = { x: c.x + Math.cos(ang) * d, y: c.y + Math.sin(ang) * d };
        if (this.legOk(u, prev, cand) && (j < N - 1 || this.legOk(u, cand, anc))) { pick = cand; break; }
      }
      pts.push(pick);
    }
    pts.push(anc);
    const keys = Object.keys(u._blk); if (keys.length > 3) delete u._blk[keys[0]];
    return (u._blk[m] = pts);
  },
  // arah unit datang ke menara (rad, dari pusat menara): dari titik rute terakhir sebelum pintu pada blok perjalanan saat ini
  enterAngle(u, t) {
    if (this.syncOn(u)) { const c0 = this.campOf(u), S = this.syncStart(u); return Math.atan2(S.y - c0.y, S.x - c0.x); }
    const c = this.campOf(u), N = this.legsPerBlock(u), roam = u.roam || 1500, L = u.legSec || Math.max(60, 2.5 * roam / u.speed);
    const m = Math.floor(this.unitClock(u, t) / L / N), pts = this.block(u, m), p = pts[N - 1];
    return Math.atan2(p.y - c.y, p.x - c.x);
  },
  legsPerBlock(u) { return (u.cycle && u.cycle.every) || u.returnEvery || 5; },
  // jam rute unit (detik). Setelah unit keluar dari pintu menara (outAt) rutenya MULAI LAGI dari pintu pada saat itu (awal blok baru), jadi unit muncul di pintu dan
  // berjalan keluar, bukan loncat ke posisi jadwal lama. Sebelum pernah keluar = jadwal asli.
  unitClock(u, t) {
    this.campOf(u);
    const roam = u.roam || 1500, N = this.legsPerBlock(u), L = u.legSec || Math.max(60, 2.5 * roam / u.speed), sh = (u._seed % 997) * 7, oT = this.outAt(u);
    if (oT > 0 && t * 1000 >= oT) return Math.floor((oT / 1000 + sh) / (L * N)) * L * N + (t - oT / 1000);
    return t + sh;
  },
  // posisi bawaan unit pada waktu t (detik server)
  // ---- MODE TES (CONFIG.battle.testSync): semua unit `cycle` mengitari menara dekat-dekat dan masuk pintu BARENGAN tiap `period` detik (jam server),
  // supaya raid / unit-ikut-raid / pandangan lantai mudah dites. Matikan: testSync: null. Lihat sisa waktu: Battle.testInfo() di console.
  syncOn(u) { return !!(this.cfg().testSync && u.cycle); },
  syncStart(u) {       // titik awal di sekeliling menara (jalur lurus ke pintu harus bisa dilewati)
    if (u._syncS) return u._syncS;
    const ts = this.cfg().testSync, us = (this.cfg().units || []).filter((q) => q.cycle), idx = Math.max(0, us.indexOf(u)), c = this.campOf(u), anc = this.anchorOf(u);
    const base = idx * 6.2832 / Math.max(1, us.length) + .6;
    for (const d of [ts.ring || 420, 320, 240, 160]) for (let k = 0; k < 12; k++) {
      const ang = base + k * .52 * (k % 2 ? 1 : -1), S = { x: c.x + Math.cos(ang) * d, y: c.y + Math.sin(ang) * d };
      if (Terrain.info(S.x, S.y).walkable && this.legOk(u, S, anc)) return (u._syncS = S);
    }
    return (u._syncS = { x: anc.x, y: anc.y + 160 });
  },
  syncDet(u, t) {
    const ts = this.cfg().testSync, P = ts.period || 240, A = ts.approach || 45, inW = u.cycle.in || 60;
    const us = (this.cfg().units || []).filter((q) => q.cycle), idx = Math.max(0, us.indexOf(u));
    const S = this.syncStart(u), anc = this.anchorOf(u), ph = (((t - idx * (ts.stagger || 0)) % P) + P) % P;
    const lerp = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    let p, a = Math.atan2(anc.y - S.y, anc.x - S.x);
    if (ph < A) p = lerp(S, anc, ph / A);
    else if (ph < A + inW) p = anc;
    else if (ph < 2 * A + inW) { p = lerp(anc, S, (ph - A - inW) / A); a += Math.PI; }
    else { p = S; a += Math.PI; }
    return { x: p.x, y: p.y, a, inside: ph >= A && ph < A + inW, ph, until: ph < A ? A - ph : P - ph + A };
  },
  testInfo() {         // console: Battle.testInfo()
    const t = BattleNet.now() / 1000, out = {};
    for (const u of this.cfg().units || []) if (this.syncOn(u)) {
      const d = this.syncDet(u, t);
      out[u.id] = this.inTower(u) ? 'SUDAH di raid menara (monsternya hidup di dalam, tidak akan "masuk" lagi sampai keluar / mati)'
        : this.isCleared('enc:' + u.id) ? 'sudah dikalahkan (menunggu respawn)'
        : d.inside ? 'jendela DI DALAM sedang terbuka' : `jadwal masuk pintu ${Math.round(d.until)} dtk lagi`;
    }
    console.table(out); return out;
  },
  // console: Battle.testReset() -> semua unit kembali ke luar menara (peta gede) mengikuti jadwal; raid tersimpan dihapus
  testReset() {
    const run = () => {
      const ids = (this.cfg().units || []).map((u) => u.id), db = BattleNet.online() ? Online.db : null;
      this.setIn(ids, false);
      for (const id of ids) for (const k of ['out:', 'enc:']) { this.cleared[k + id] = 0; if (db) db.ref('battle_state/' + k + id).set(0).catch(() => {}); }
      this.cleared['hold:' + this.raidKey()] = 0; if (db) db.ref('battle_state/hold:' + this.raidKey()).set(0).catch(() => {});
      BattleNet._held = {};
      console.log('testReset selesai: semua unit di luar menara, ikut jadwal.');
    };
    if (this.active) { this.leave('Reset tes'); setTimeout(run, 1500); } else run();
  },
  unitDet(u, t) {
    this.campOf(u);
    if (this.syncOn(u)) return this.syncDet(u, t);
    const roam = u.roam || 1500, cy = u.cycle, N = this.legsPerBlock(u);
    const L = u.legSec || Math.max(60, 2.5 * roam / u.speed);
    const tt = this.unitClock(u, t);
    const k = Math.floor(tt / L), ct = tt - k * L, m = Math.floor(k / N), j = k - m * N;
    const pts = this.block(u, m), A = pts[j], B = pts[j + 1];
    const end = j + 1 === N && cy;                                    // leg terakhir blok = menuju pintu menara
    const pause = end ? (cy.in || 60) : 6, mv = Math.max(10, L - pause), f = Math.min(1, ct / mv);
    const a0 = Math.atan2(B.y - A.y, B.x - A.x);
    return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f, a: a0, inside: !!end && ct >= mv };
  },
  // posisi unit yang dilihat SEMUA pemain: lingkaran battle (diam) > kejaran milik sendiri > kejaran pemain lain (disinkron) > berjalan balik > jalur bawaan
  scLive(u) { const r = this.sc[u.id]; return r && r.uid !== this.uid() && BattleNet.now() - r.t < 3000 ? r : null; },
  unitNow(u) {
    const e = this.engOf(u); if (e) return { x: e.x, y: e.y, a: u._ea || 0 };
    if (u._o) return u._o;
    const r = this.scLive(u); if (r) return { x: r.rx, y: r.ry, a: r.a };
    if (u._ret) return u._ret;
    return this.unitDet(u, BattleNet.now() / 1000);
  },

  unitVisible(u) { return !this.isCleared('enc:' + u.id) && !this.inTower(u) && !this.unitDet(u, BattleNet.now() / 1000).inside; },

  // Kejar: bila player (di map gede, tidak sedang battle) sudah sangat dekat, unit mengejar. Posisi kejaran dikirim ke database (chase/{unit}, dead reckoning)
  // oleh pemain yang mengejar-nya, jadi semua pemain melihat unit di koordinat yang sama. Hanya SATU pemain yang jadi pemilik kejaran (klaim lewat transaksi).
  // Kalau player menjauh / lolos, unit berjalan balik ke jalur bawaan (juga terlihat semua pemain), lalu kejaran dilepas.
  stepUnits(dt) {
    const c = this.cfg(), units = c.units || [], now = BattleNet.now();
    for (const u of units) {
      const det = this.unitDet(u, now / 1000), vis = !det.inside && !this.isCleared('enc:' + u.id) && !this.inTower(u);
      // pemain lain yang mengejar: haluskan posisi (perkiraan = kiriman terakhir + kecepatan x lama sejak kiriman)
      const sc = this.scLive(u);
      if (sc) {
        const age = (now - sc.t) / 1000, tx = sc.x + sc.vx * age, ty = sc.y + sc.vy * age;
        if (Math.hypot(tx - sc.rx, ty - sc.ry) > 400) { sc.rx = tx; sc.ry = ty; }
        else { const k = 1 - Math.exp(-dt * 10); sc.rx += (tx - sc.rx) * k; sc.ry += (ty - sc.ry) * k; }
      }
      // unit berjalan balik setelah lingkaran battle bubar
      if (u._ret) {
        const dx = det.x - u._ret.x, dy = det.y - u._ret.y, d = Math.hypot(dx, dy), sp = u.speed * 2 * dt;
        u._ret.t += dt;
        if (d < 10 || u._ret.t > 25) u._ret = null;
        else { u._ret.x += dx / d * Math.min(sp, d); u._ret.y += dy / d * Math.min(sp, d); u._ret.a = Math.atan2(dy, dx); }
      }
      if (!vis || this.active || Interior.active || this.engOf(u)) { this.endChase(u); continue; }
      const aggro = u.aggro || c.aggroRange || 170;
      const dp = Math.hypot(Player.x - (u._o ? u._o.x : det.x), Player.y - (u._o ? u._o.y : det.y));
      if (!u._o) {
        if (sc || u._ret) continue;                                    // pemain lain sudah mengejar unit ini / unit sedang balik
        if (dp < aggro && !this.bumpCool && u.chase !== false) {
          u._o = { x: det.x, y: det.y, a: det.a }; u._own = true; u._sendT = 0; u._sent = null;
          BattleNet.claimChase(u.id, this.chaseStr(u, 0, 0)).then((won) => { if (!won && u._o) { u._own = false; u._o = null; } });
        } else continue;
      }
      const o = u._o, far = Math.hypot(o.x - det.x, o.y - det.y) > (u.chaseLeash || 700);
      const giving = dp > aggro * 2.2 || far || this.bumpCool > 0;
      const tx = giving ? det.x : Player.x, ty = giving ? det.y : Player.y;
      const sp = (giving ? u.speed * 2 : (u.chaseSpeed || c.chaseSpeed || 52)) * dt;
      const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
      if (giving && d < 10) { this.endChase(u); continue; }
      let vx = 0, vy = 0;
      if (d > 1) {
        o.a = Math.atan2(dy, dx);
        const nx = o.x + dx / d * Math.min(sp, d), ny = o.y + dy / d * Math.min(sp, d);
        if (Terrain.info(nx, ny).walkable) { vx = (nx - o.x) / dt; vy = (ny - o.y) / dt; o.x = nx; o.y = ny; }
      }
      this.pushChase(u, vx, vy, dt);
    }
  },
  chaseStr(u, vx, vy) {
    const o = u._o; return [this.uid(), Math.round(o.x), Math.round(o.y), vx.toFixed(1), vy.toFixed(1), o.a.toFixed(2), BattleNet.now()].join(',');
  },
  // kirim posisi kejaran: tiap 400 ms (heartbeat; juga membuktikan pemilik masih hidup)
  pushChase(u, vx, vy, dt) {
    if (!u._own) return;
    u._sendT = (u._sendT || 0) + dt;
    if (u._sendT < .4) return;
    u._sendT = 0;
    BattleNet.sendChase(u.id, this.chaseStr(u, vx, vy));
  },

  // tiap frame: Player menabrak unit -> battle di arena acak berisi isi lingkaran itu
  checkBump() {
    if (Interior.active || this.bumpCool > 0) return;
    for (const u of this.cfg().units || []) {
      if (!this.unitVisible(u)) continue;
      const p = this.unitNow(u), e = this.engOf(u);
      // ada lingkaran battle: masuk lingkarannya = bergabung ke battle yang sedang berjalan
      if (Math.hypot(p.x - Player.x, p.y - Player.y) < (e ? this.engR(u) : u.radius) + CONFIG.player.radius) { this.startUnit(u); return; }
      // teman yang berdiri dekat korban (<= joinNearPx) saat bentrok ikut masuk battle otomatis; yang lebih jauh cuma melihat lingkaran
      if (e && e.px != null && BattleNet.now() - e.t0 < (this.cfg().joinWindowSec || 3) * 1000 && Math.hypot(e.px - Player.x, e.py - Player.y) <= (this.cfg().joinNearPx || 30)) { this.startUnit(u); return; }
    }
  },

  // map battle untuk unit u: kalau unit berada di tempat yang sendirinya map battle (kemah di Tower of Mabel) -> di map itu (Halaman menara);
  // kalau di map biasa (hutan, kota, desa) -> arena acak sesuai biome. Bisa dipaksa dengan `arena: 'fixed' | 'random'` di unit.
  fixedFloorFor(u) {
    const c = this.cfg();
    if (u.arena === 'random') return null;
    let obj = null;
    for (const o of CONFIG.objects) {
      if (!o.interior) continue;
      if (u.arena === 'fixed' || Math.hypot(Player.x - o.x, Player.y - o.y) <= o.radius + (c.fixedMargin || 50)) { obj = o; break; }
    }
    if (!obj) return null;
    const floors = CONFIG.interior.floors, st = floors.find((f) => f.id === CONFIG.interior.startFloor);
    const fl = (st && st.battle ? st : floors.find((f) => f.battle)) || null;
    if (fl) fl._obj = obj;
    return fl;
  },

  startUnit(u) {
    const c = this.cfg();
    if (this.active || this.busy || !this.unitVisible(u)) return;
    this.enc = u;
    const at = this.engOf(u) || (({ x, y }) => ({ x, y }))(this.unitNow(u));     // titik bentrokan = lingkaran battle (kalau sudah ada)
    u._ea = this.unitNow(u).a;
    const fl = this.fixedFloorFor(u);
    if (fl) {                                   // arena tetap: pemain "masuk" menara ke Halaman, satu instance battle per unit
      Interior.enter(fl._obj);
      const up = this.unitNow(u), ang = Math.atan2(up.y - fl._obj.y, up.x - fl._obj.x);
      this.enter({ type: 'fixed', key: this.raidKey(), floorId: fl.id, spawns: u.pack, units: [u.id], angles: u.pack.map(() => ang), owners: u.pack.map(() => u.id) });
      return;
    }
    const info = Terrain.info(Player.x, Player.y), biome = u.biome || (info && info.battle) || 'forest';
    if (!c.arenas[biome]) { this.enc = null; return; }
    this.enter({ type: 'random', key: 'enc:' + u.id, biome, spawns: u.pack, units: [u.id], at });
  },

  // kabur: lingkaran monster -> balik ke map gede di depan lingkaran; menara -> keluar menara
  flee() {
    if (!this.active) return;
    if (this.kind === 'fixed') { const t = Interior.tower; this.leave(); if (t && Interior.active) Interior.exit(); }
    else this.leave();
  },

  // gerak & kontrol saat Siaga tapi belum di arena (map gede / di dalam menara)
  idleUpdate(dt) {
    if (this.active || !this.siaga) return;
    this.now += dt;
    const v = this.input, mag = Math.min(1, Math.hypot(v.mx, v.my)), px = Player.x, py = Player.y;
    Player.target = null; if (Interior.active) Interior.path = [];
    if (mag > .08) {
      const L = Math.hypot(v.mx, v.my), ux = v.mx / L, uy = v.my / L;
      Player.angle = Math.atan2(uy, ux);
      if (Interior.active) {
        const st = CONFIG.interior.speed * Vitals.speedMul() * mag * dt;
        if (Interior.canStand(Player.x + ux * st, Player.y + uy * st)) { Player.x += ux * st; Player.y += uy * st; }
        else if (Interior.canStand(Player.x + ux * st, Player.y)) Player.x += ux * st;
        else if (Interior.canStand(Player.x, Player.y + uy * st)) Player.y += uy * st;
      } else {
        const st = CONFIG.player.speed * Terrain.info(Player.x, Player.y).speed * Vitals.speedMul() * mag * dt, W = CONFIG.world, r = CONFIG.player.radius;
        const ok = (x, y) => x > r && y > r && x < W.width - r && y < W.height - r && Terrain.info(x, y).walkable;
        if (ok(Player.x + ux * st, Player.y + uy * st)) { Player.x += ux * st; Player.y += uy * st; }
        else if (ok(Player.x + ux * st, Player.y)) Player.x += ux * st;
        else if (ok(Player.x, Player.y + uy * st)) Player.y += uy * st;
      }
    }
    this.atkT = Math.max(0, this.atkT - dt);
    this.speedNow = Math.hypot(Player.x - px, Player.y - py) / Math.max(dt, 1e-3);
    for (const sw of this.swings) sw.done = true;      // di luar arena serangan hanya efek visual
    this.swings = this.swings.filter((sw) => this.now < sw.t0 + sw.life);
  },

  assetList() {
    const out = BattleArena.assetList();
    for (const [id, m] of Object.entries(this.cfg().monsters)) if (m.sprite) out['mon:' + id] = m.sprite;
    return out;
  },

  weapon() {
    const W = this.cfg().weapons;
    const hand = Inventory.equipment && Inventory.equipment.hand;
    let id = hand && CONFIG.items[hand] && CONFIG.items[hand].weapon;
    if (!id) { const it = Inventory.items.find((i) => CONFIG.items[i.id] && CONFIG.items[i.id].weapon); id = it && CONFIG.items[it.id].weapon; }
    return { id: W[id] ? id : 'tangan', def: W[id] || W.tangan };
  },

  // ---------- masuk / keluar ----------
  async enter(d) {
    if (this.active || this.busy || !d) return;
    this.busy = true;
    try {
      const meta = await BattleNet.join(d.key, { kind: d.type, biome: d.biome, resume: d.type === 'fixed', units: (d.units || []).join(',') });
      this.room = d.key; this.kind = d.type; this.biome = d.biome; this.floorId = d.type === 'fixed' ? d.floorId : -1; this.arenas = {}; this.gatherPts = {}; this.seed = meta.seed; this.siaga = true; this._angles = d.angles || null; this._owners = d.owners || []; this.leaving = {}; this.leaveAt = {};
      const ru = meta.units ? String(meta.units).split(',').filter(Boolean) : [];
      this._unitIds = ru.length ? ru : (d.units || []);      // unit yang dikalahkan = unit milik room (bisa beda dari yang dihitung perangkat ini kalau melanjutkan raid)
      this.isHost = meta.isHost; this._spawns = d.spawns;
      this.rng = mulberry(meta.seed ^ 0x9e3779b9);
      this.mons = []; this.others.clear(); this.swings = []; this.floaters = []; this.flows = {};
      this.down = false; this.atkT = 0; this.kv = { x: 0, y: 0 }; this.clearT = 0; this._ls = null; this._vx = this._vy = 0; this._monAt = 0; this._lastMons = '';
      if (d.type === 'fixed') {
        this.arena = this.arenaFor(d.floorId);
        this.self = Player; Player.target = null; Interior.path = [];
      } else {
        this.arena = BattleArena.random(d.biome, meta.seed);
        const sp = this.arena.spawnPoint();
        this.self = { x: sp.x + (Math.random() - .5) * 120, y: sp.y + (Math.random() - .5) * 60, angle: -Math.PI / 2 };
      }
      this.active = true;
      if (d.type === 'random' && d.at && d.units && d.units[0]) { const u0 = (this.cfg().units || []).find((q) => q.id === d.units[0]); if (u0) this.endChase(u0); this.engStart(d.units[0], d.at); }     // lingkaran battle muncul di map gede (pemain lain bisa bergabung)
      BattleNet.listen();
      if (meta.mons) this.applyMons(meta.mons);
      if (this.isHost && this.mons.length) {      // melanjutkan monster yang sudah ada: yang sedang menyerang dianggap mengejar, perilaku jalan-jalan diacak lagi
        for (const m of this.mons) if (m.st > ST.CHASE && m.st < ST.DEAD) m.st = ST.CHASE;
        this.gather = this.rng() < .5;
        if (meta.heldAt) { this.heldExits(meta.heldAt); this.catchUp((BattleNet.now() - meta.heldAt) / 1000); this.heldStay(meta.heldAt); }
        for (const uid of d.units || []) {        // masuk raid yang sudah ada karena unit ini mengejar (bentrok di luar menara): monsternya ikut ditambahkan ke raid
          if (this._unitIds.includes(uid)) continue;
          const u = (this.cfg().units || []).find((q) => q.id === uid);
          if (u) this.addUnits([{ id: uid, pack: u.pack, ang: d.angles && d.angles[0] != null ? d.angles[0] : 0 }]);
        }
      }
      if (this.isHost && !this.mons.length) this.spawnMonsters();
      if (this.isHost) this.touchHold();
      document.body.classList.add('battle');
      Online.toast && Online.toast((d.type === 'fixed' ? 'Raid dimulai · ' : 'Battle · ') + this.arena.name + (this.isHost ? ' · kamu mengendalikan musuh' : ''));
    } catch (e) {
      console.warn('Battle: gagal masuk', e);
      this.cool = 3; this.enc = null;
      BattleNet.leave();
    }
    this.busy = false;
    BattleUI.refresh();
  },

  leave(reason) {
    if (!this.active && !this.busy) return;
    this.active = false; this.siaga = false;
    BattleNet.leave(this.persistSnap(), this.kind === 'fixed');     // pemain terakhir keluar / tumbang: monster yang masih hidup tetap di tempatnya (lantai + posisi + darah)
    if (this.kind === 'random' && this.enc) {          // keluar arena: geser player menjauh dari unit supaya tidak langsung menabrak lagi
      const u = this.enc, p = this.unitNow(u), dx = Player.x - p.x, dy = Player.y - p.y, d = Math.hypot(dx, dy) || 1, need = (this.engOf(u) ? this.engR(u) : u.radius) + CONFIG.player.radius + 70;
      if (d < need) { const nx = p.x + dx / d * need, ny = p.y + dy / d * need; if (Terrain.info(nx, ny).walkable) { Player.x = nx; Player.y = ny; } }
      Player.target = null;
    }
    this.enc = null; this.bumpCool = this.cfg().bumpCoolSec || 4;
    for (const u of this.cfg().units || []) this.endChase(u);
    this.mons = []; this.others.clear(); this.swings = []; this.arena = null; this.self = null;
    this.input.mx = this.input.my = 0; this.aim = null;
    document.body.classList.remove('battle');
    document.getElementById('game').style.transform = '';
    if (reason && Online.toast) Online.toast(reason);
    BattleUI.refresh();
  },

  valid() {
    if (!this.arena) return false;
    return this.kind === 'fixed' ? Interior.active : !Interior.active;    // fixed: selama masih di dalam menara (lantai mana pun); keluar lewat pintu Halaman = kabur
  },

  // ---------- monster (hanya host yang mengatur) ----------
  mk(type, id, x, y, fl) {
    const def = this.cfg().monsters[type];
    return { id, type, def, x, y, fl: fl == null ? this.floorId : fl, tcd: 0, a: Math.PI / 2, hp: def.hp, max: def.hp, st: ST.IDLE, t: 0, atk: -1, cd: [], dmg: {},
             tgt: null, tgtT: 0, kx: 0, ky: 0, flash: 0, rx: x, ry: y, ra: Math.PI / 2, dead: 0 };
  },

  spawnMonsters() {
    const sf = this.kind === 'fixed' ? (CONFIG.interior.startFloor || 0) : -1, a = this.arenaFor(sf), rng = this.rng;
    this.gather = rng() < .5;                 // perilaku jalan-jalan: berkumpul (satu tujuan bersama per lantai) atau mencar (tujuan masing-masing)
    this.gatherPts = {};
    this.mons = this._spawns.map((type, i) => {
      const def = this.cfg().monsters[type];
      let p;
      if (a.kind === 'random') p = a.spot(rng, def.radius + 6, a.monsterNear || { x: a.w / 2, y: a.h * .3, min: 0, max: 520 });
      else {                                  // arena tetap: muncul di PINGGIR dari arah masuknya (tiap monster punya sudut sendiri), bukan di tengah
        const ang = (this._angles && this._angles[i] != null ? this._angles[i] : rng() * 6.283) + (rng() - .5) * .35;
        p = a.edge ? a.edge(ang, def.radius + 6, 70) : a.spot(rng, def.radius + 6, { x: this.self.x, y: this.self.y, min: 650, max: 1e5 });
      }
      const m = this.mk(type, i, p.x, p.y, sf);
      if (this._owners && this._owners[i]) m.u = this._owners[i];
      return m;
    });
    this.respawnT = 0;
  },

  // jalan-jalan saat belum ada target: berkumpul / mencar ke titik acak yang bisa dijangkau, berhenti sebentar, lalu lanjut
  wanderMon(m, dt) {
    const a = this.arenaFor(m.fl), def = m.def, r = def.radius;
    if (m.hop) {                      // sedang menuju tangga untuk pindah lantai
      const e = m.hop, p = this.transitTarget(m.fl, e, r);
      const need = Math.max(CONFIG.interior.margin * Interior.S, this.distToRect(p.x, p.y, e.rect) + 12);
      if (m.tcd <= 0 && this.distToRect(m.x, m.y, e.rect) <= need) { m.hop = null; this.transit(m, e); return; }
      m.a = turnTo(m.a, this.steer(m, { x: p.x, y: p.y, uid: 'z' + m.fl + '>' + e.to }), def.turn * dt);
      const sp = def.speed * .4 * dt;
      this.moveMon(m, Math.cos(m.a) * sp, Math.sin(m.a) * sp);
      this.separate(m, dt);
      m.hopT = (m.hopT || 0) - dt; if (m.hopT <= 0) m.hop = null;      // tersangkut: menyerah
      return;
    }
    m.wt = (m.wt || 0) - dt;
    if (!m.wp || (m.wt <= 0 && Math.hypot(m.wp.x - m.x, m.wp.y - m.y) < 40 + (this.gather ? 60 : 0))) {
      if (this.gather) {
        const g = this.gatherPts[m.fl] || (this.gatherPts[m.fl] = { pt: null, t: 0 });
        g.t -= dt;
        if (!g.pt || g.t <= 0) { g.pt = a.spot(this.rng, 80); g.t = 10 + this.rng() * 10; }
        m.wp = { x: g.pt.x + (this.rng() - .5) * 140, y: g.pt.y + (this.rng() - .5) * 140 };
      } else m.wp = a.spot(this.rng, r + 4, { x: m.x, y: m.y, min: 200, max: 900 });
      m.wt = 1.5 + this.rng() * 3.5;
      const links = this.kind === 'fixed' ? this.floorLinks()[m.fl] || [] : [];       // kadang memilih pindah lantai lewat tangga
      if (links.length && m.tcd <= 0 && this.rng() < (this.cfg().wanderStairsChance == null ? .15 : this.cfg().wanderStairsChance)) { m.hop = links[Math.floor(this.rng() * links.length)]; m.hopT = 40; m.wp = null; return; }
    }
    const d = Math.hypot(m.wp.x - m.x, m.wp.y - m.y);
    if (d > 30) {
      m.a = turnTo(m.a, this.steer(m, { x: m.wp.x, y: m.wp.y, uid: 'w' + m.id }), def.turn * dt);
      const sp = def.speed * .4 * dt;
      this.moveMon(m, Math.cos(m.a) * sp, Math.sin(m.a) * sp);
      this.separate(m, dt);
    }
  },

  encodeMons() {
    return this.mons.map((m) => `${m.id}~${m.type}~${Math.round(m.x)}~${Math.round(m.y)}~${m.a.toFixed(2)}~${Math.ceil(m.hp)}~${m.st}~${m.fl}~${m.u || ''}~${Math.round(m.vx || 0)}~${Math.round(m.vy || 0)}`).join(';');
  },
  // dead reckoning monster (host): kirim snapshot hanya kalau perlu (melenceng dari perkiraan penerima, ganti state / arah / kecepatan, atau heartbeat 1 dtk saat ada yang bergerak)
  monNeed(now) {
    let moving = false;
    for (const m of this.mons) {
      const L = m._ls; if (!L) return true;
      if (m.st !== L.st || Math.ceil(m.hp) !== L.hp || m.fl !== L.fl || (m.u || '') !== L.u) return true;
      const age = (now - L.t) / 1000, ex = L.x + L.vx * age, ey = L.y + L.vy * age, sp0 = Math.hypot(L.vx, L.vy), sp1 = Math.hypot(m.vx || 0, m.vy || 0);
      if (sp1 > 5) moving = true;
      if (Math.hypot(m.x - ex, m.y - ey) > 4 || Math.abs(wrapA(m.a - L.a)) > .25 || (sp0 < 5) !== (sp1 < 5)) return true;
      if (sp0 > 5 && (Math.abs(sp1 - sp0) / sp0 > .25 || Math.abs(wrapA(Math.atan2(m.vy, m.vx) - Math.atan2(L.vy, L.vx))) > .25)) return true;
    }
    return moving && now - this._monAt > 1000;
  },
  monSent(now) { for (const m of this.mons) m._ls = { x: m.x, y: m.y, vx: m.vx || 0, vy: m.vy || 0, a: m.a, st: m.st, hp: Math.ceil(m.hp), fl: m.fl, u: m.u || '', t: now }; this._monAt = now; },

  applyMons(str) {
    if (!str) return;
    const seen = new Set();
    for (const part of str.split(';')) {
      const [id, type, x, y, a, hp, st, fl, un, vx, vy] = part.split('~');
      if (!this.cfg().monsters[type]) continue;
      const nf = fl === undefined || isNaN(+fl) ? this.floorId : +fl;
      let m = this.mons.find((q) => q.id === +id);
      if (!m) { m = this.mk(type, +id, +x, +y, nf); this.mons.push(m); m.hp = +hp; if (+st === ST.DEAD) m.dead = 99; }     // yang sudah mati dari awal: jangan muncul lagi lalu memudar
      if (m.fl !== nf) { m.fl = nf; m.rx = +x; m.ry = +y; m.ra = +a; }     // pindah lantai (naik / turun tangga): langsung loncat, jangan meluncur lintas lantai
      seen.add(m.id);
      if (un) m.u = un;
      const hpN = +hp;
      if (hpN < m.hp - 0.5) { m.flash = .15; this.floater(m.x, m.y - m.def.radius, String(Math.round(m.hp - hpN)), '#fff'); }
      if (+st !== ST.DEAD && m.st === ST.DEAD) { m.hp = m.max; m.rx = +x; m.ry = +y; m.dead = 0; }   // muncul lagi
      m.tx = +x; m.ty = +y; m.ta = +a; m.hp = hpN; m.st = +st; m.vx = +vx || 0; m.vy = +vy || 0; m.recv = performance.now();
    }
    this.mons = this.mons.filter((m) => seen.has(m.id));
  },

  becomeHost() {
    this.isHost = true;
    for (const m of this.mons) { m.x = m.rx; m.y = m.ry; m.a = m.ra; m.t = 0; if (m.st >= ST.WINDUP && m.st < ST.DEAD) m.st = ST.CHASE; }
    Online.toast && Online.toast('Kamu sekarang mengendalikan musuh');
  },

  // pemain yang bisa jadi target: [{uid,x,y}]
  targets() {
    const out = [];
    if (!this.down) out.push({ uid: this.uid(), x: this.self.x, y: this.self.y, fl: this.floorId });
    for (const [uid, o] of this.others) if (!o.down) out.push({ uid, x: o.rx, y: o.ry, fl: o.fl });
    return out;
  },

  // ---- medan alir (BFS dari target) supaya monster menghindari rintangan ----
  flow(a, fl, r, tg) {
    const nav = a.navFor(r), key = fl + ':' + nav.G + ':' + (r <= 26 ? 26 : Math.ceil(r / 10) * 10) + ':' + tg.uid;
    const ci = Math.max(0, Math.min(nav.cols - 1, Math.floor(tg.x / nav.G))), cj = Math.max(0, Math.min(nav.rows - 1, Math.floor(tg.y / nav.G)));
    const f = this.flows[key];
    if (f && f.ci === ci && f.cj === cj && this.now - f.at < 1) return f;
    const dist = new Int16Array(nav.cols * nav.rows).fill(-1), q = [];
    let si = -1;
    for (let d = 0; d < 4 && si < 0; d++) for (let j = cj - d; j <= cj + d && si < 0; j++) for (let i = ci - d; i <= ci + d; i++) {
      if (i < 0 || j < 0 || i >= nav.cols || j >= nav.rows) continue;
      if (nav.ok[j * nav.cols + i]) { si = j * nav.cols + i; break; }
    }
    if (si >= 0) {
      dist[si] = 0; q.push(si);
      for (let h = 0; h < q.length; h++) {
        const cur = q[h], c = cur % nav.cols, rr = (cur / nav.cols) | 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const nc = c + di, nr = rr + dj;
          if (nc < 0 || nr < 0 || nc >= nav.cols || nr >= nav.rows) continue;
          const ni = nr * nav.cols + nc;
          if (!nav.ok[ni] || dist[ni] >= 0) continue;
          if (di && dj && (!nav.ok[rr * nav.cols + nc] || !nav.ok[nr * nav.cols + c])) continue;
          dist[ni] = dist[cur] + 1; q.push(ni);
        }
      }
    }
    return (this.flows[key] = { ci, cj, at: this.now, dist, nav });
  },

  // arah jalan monster ke target: lurus kalau jalan bebas, kalau tidak ikuti medan alir
  steer(m, tg) {
    const a = this.arenaFor(m.fl), r = m.def.radius;
    const direct = Math.atan2(tg.y - m.y, tg.x - m.x);
    if (Math.hypot(tg.x - m.x, tg.y - m.y) < 120 || a.clearLine(m.x, m.y, tg.x, tg.y, r * .8)) return direct;
    const f = this.flow(a, m.fl, r, tg), nav = f.nav;
    const ci = Math.max(0, Math.min(nav.cols - 1, Math.floor(m.x / nav.G))), cj = Math.max(0, Math.min(nav.rows - 1, Math.floor(m.y / nav.G)));
    let best = f.dist[cj * nav.cols + ci], bi = ci, bj = cj;
    if (best < 0) best = 1e9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= nav.cols || j >= nav.rows) continue;
      const d = f.dist[j * nav.cols + i];
      if (d >= 0 && d < best) { best = d; bi = i; bj = j; }
    }
    if (bi === ci && bj === cj) return direct;
    return Math.atan2((bj + .5) * nav.G - m.y, (bi + .5) * nav.G - m.x);
  },

  moveMon(m, dx, dy) {
    const a = this.arenaFor(m.fl), r = m.def.radius, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 12));
    for (let i = 0; i < n; i++) {
      const sx = dx / n, sy = dy / n;
      if (a.canStand(m.x + sx, m.y + sy, r)) { m.x += sx; m.y += sy; }
      else if (a.canStand(m.x + sx, m.y, r)) m.x += sx;
      else if (a.canStand(m.x, m.y + sy, r)) m.y += sy;
    }
  },

  updateMon(m, dt) {
    const def = m.def;
    m.flash = Math.max(0, m.flash - dt);
    for (let i = 0; i < m.cd.length; i++) if (m.cd[i] > 0) m.cd[i] -= dt;
    if (m.st === ST.DEAD) { m.dead += dt; return; }
    // dorongan (knockback), monster besar lebih tahan
    if (m.kx || m.ky) { this.moveMon(m, m.kx * dt, m.ky * dt); const k = Math.exp(-9 * dt); m.kx *= k; m.ky *= k; if (Math.hypot(m.kx, m.ky) < 5) m.kx = m.ky = 0; }
    m.t += dt; m.tgtT -= dt; if (m.tcd > 0) m.tcd -= dt;

    const tgs = this.targets();
    if (m.tgtT <= 0) {            // pilih target: yang paling banyak melukai monster ini + yang paling dekat (hanya pemain di lantai yang sama)
      m.tgtT = .4; const prev = m.tgt; m.tgt = null;
      let bs = -1e9;
      for (const t of tgs) {
        if (t.fl !== m.fl) continue;
        const d = Math.hypot(t.x - m.x, t.y - m.y), threat = m.dmg[t.uid] || 0;
        const sees = d <= def.aggro || (prev === t.uid && d <= def.aggro * 1.8);     // melihat dekat -> kejar; sudah mengejar baru lepas di 1,8x jarak
        if (!sees && !threat) continue;
        const s = threat * 3 - d;
        if (s > bs) { bs = s; m.tgt = t.uid; }
      }
      if (!m.tgt) {               // teman satu kawanan (<= 450 px, lantai sama) yang sedang mengejar: ikut mengejar
        for (const o of this.mons) if (o !== m && o.fl === m.fl && o.tgt && o.st !== ST.DEAD && Math.hypot(o.x - m.x, o.y - m.y) < 450 && tgs.some((t) => t.uid === o.tgt && t.fl === m.fl)) { m.tgt = o.tgt; break; }
      }
      if (!m.tgt && this.cfg().followFloors !== false) {   // pemain yang dikejar / melukai monster ini pindah lantai: ikut naik / turun tangga (yang terdekat dulu)
        let bf = 1e9;
        for (const t of tgs) {
          if (t.fl === m.fl || (prev !== t.uid && !m.dmg[t.uid]) || this.nextHop(m.fl, t.fl) == null) continue;
          const fd = Math.abs(t.fl - m.fl); if (fd < bf) { bf = fd; m.tgt = t.uid; }
        }
      }
    }
    const tg = tgs.find((t) => t.uid === m.tgt);

    if (m.st === ST.IDLE || m.st === ST.CHASE) {
      if (!tg) { m.st = ST.IDLE; if (m.u && this.leaving[m.u]) this.goExit(m, dt); else this.wanderMon(m, dt); return; }
      m.st = ST.CHASE; m.hop = null; m.out = false;
      if (tg.fl !== m.fl) { this.pursueOtherFloor(m, tg, dt); return; }
      const dist = Math.hypot(tg.x - m.x, tg.y - m.y);
      const want = this.steer(m, tg);
      m.a = turnTo(m.a, want, def.turn * dt);
      const face = Math.abs(wrapA(Math.atan2(tg.y - m.y, tg.x - m.x) - m.a));
      // pilih serangan: yang siap, dalam jangkauan, dan menghadap target
      let pick = -1;
      for (let i = 0; i < def.attacks.length; i++) {
        const at = def.attacks[i];
        if ((m.cd[i] || 0) > 0 || dist > at.reach || dist < (at.minReach || 0) || face > .45) continue;
        pick = i; if (at.minReach) break;
      }
      if (pick >= 0) { this.beginAttack(m, pick); return; }
      const stop = Math.min(...def.attacks.map((x) => x.reach)) * .75;
      if (dist > stop) this.moveMon(m, Math.cos(m.a) * def.speed * dt, Math.sin(m.a) * def.speed * dt);
      this.separate(m, dt);
    } else if (m.st === ST.WINDUP) {
      const at = def.attacks[m.atk];
      if (m.t >= at.windup) { m.st = ST.ACTIVE; m.t = 0; }
    } else if (m.st === ST.ACTIVE) {
      const at = def.attacks[m.atk];
      if (at.kind === 'dash') this.moveMon(m, Math.cos(m.a) * at.range / at.active * dt, Math.sin(m.a) * at.range / at.active * dt);
      if (m.t >= at.active) { m.st = ST.RECOVER; m.t = 0; }
    } else if (m.st === ST.RECOVER) {
      if (m.t >= def.attacks[m.atk].recover) { m.st = ST.CHASE; m.t = 0; m.tgtT = 0; }
    }
  },

  // ---- unit masuk / keluar menara selama raid ----
  // Unit baru masuk (jadwal `cycle`): monsternya muncul di pinggir Halaman dari arah datangnya, id baru, ditandai `u` (unit asal).
  addUnits(list) {
    const sf = CONFIG.interior.startFloor || 0, a = this.arenaFor(sf), rng = this.rng, ids = [];
    let nid = this.mons.reduce((mx, m) => Math.max(mx, m.id), -1) + 1;
    if (this.gather === undefined) this.gather = rng() < .5;
    for (const e of list) {
      for (const type of e.pack) {
        const def = this.cfg().monsters[type], ang = e.ang + (rng() - .5) * .35;
        const p = a.edge ? a.edge(ang, def.radius + 6, 70) : a.spot(rng, def.radius + 6, { x: this.self.x, y: this.self.y, min: 650, max: 1e5 });
        const m = this.mk(type, nid++, p.x, p.y, sf); m.u = e.id; this.mons.push(m);
      }
      if (!this._unitIds.includes(e.id)) this._unitIds.push(e.id);
      ids.push(e.id);
    }
    this.setIn(ids, true); BattleNet.setUnits(this._unitIds.join(',')); this._lastMons = '';
    this.touchHold();
  },
  setUnitIds(str) { this._unitIds = str ? String(str).split(',').filter(Boolean) : []; },     // dari room: unit yang monsternya ada di raid ini
  // Unit yang berkemah di menara tidak selamanya di dalam: setelah beberapa lama (CONFIG.battle.leaveStaySec) kalau tidak sedang bertarung, semua monster
  // unit itu jalan ke pintu "Keluar" Halaman (turun tangga dulu kalau di lantai lain). Begitu semuanya sampai, unit keluar dari raid dan muncul lagi di
  // peta gede (jadwal `cycle` seperti biasa); darahnya pulih. Ada pemain yang menyerang / dikejar saat jalan ke pintu = batal, tetap di menara.
  stayRange() { const r = this.cfg().leaveStaySec || [90, 300]; return r[0] + this.rng() * (r[1] - r[0]); },
  exitFloor() {
    if (this._exitFl === undefined) { this._exitFl = null; for (const id of Object.keys(Interior.floors)) { const f = Interior.floors[id]; if (f.exit && f.exit.to === undefined) this._exitFl = +id; } }
    return this._exitFl;
  },
  stepLeaving(dt) {
    this._lvT = (this._lvT || 0) - dt; if (this._lvT > 0) return;
    this._lvT = .5;
    if (this.exitFloor() == null) return;
    for (const id of [...this._unitIds]) {
      const u = (this.cfg().units || []).find((q) => q.id === id);
      if (!u) continue;
      const ms = this.mons.filter((m) => m.u === id && m.st !== ST.DEAD);
      if (!ms.length) continue;
      if (this.leaveAt[id] === undefined) this.leaveAt[id] = this.now + this.stayRange();
      if (ms.some((m) => m.tgt)) {                       // sedang bertarung: batal pergi, coba lagi nanti
        if (this.leaving[id]) { delete this.leaving[id]; for (const m of ms) m.out = false; }
        this.leaveAt[id] = this.now + this.stayRange();
        continue;
      }
      if (!this.leaving[id]) { if (this.now >= this.leaveAt[id]) this.leaving[id] = true; continue; }
      if (ms.every((m) => m.out)) this.unitLeave(id);
    }
  },
  unitLeave(id, outMs) {
    this.mons = this.mons.filter((m) => m.u !== id);
    delete this.leaving[id]; delete this.leaveAt[id];
    this._unitIds = this._unitIds.filter((x) => x !== id);
    BattleNet.setUnits(this._unitIds.join(','));
    this.setIn([id], false);
    this.cleared['out:' + id] = Math.round(outMs || BattleNet.now());
    if (BattleNet.online()) Online.db.ref('battle_state/out:' + id).set(this.cleared['out:' + id]).catch(() => {});
    this._lastMons = '';
  },
  // raid yang ditinggal kosong lalu dilanjutkan pemain: unit yang menurut jadwal sudah keluar dihapus dari raid (dengan waktu keluar yang SAMA seperti yang dilihat pemain
  // di peta gede); sisanya lanjut, sisa waktu tinggalnya dihitung dari jadwal yang sama.
  heldExits(h) {
    const now = BattleNet.now();
    for (const id of [...this._unitIds]) {
      const u = (this.cfg().units || []).find((q) => q.id === id); if (!u) continue;
      const at = this.lazyOutAt(u, h);
      if (now >= at) this.unitLeave(id, at);
    }
  },
  heldStay(h) {
    const now = BattleNet.now();
    for (const id of this._unitIds) {
      const u = (this.cfg().units || []).find((q) => q.id === id); if (!u) continue;
      this.leaveAt[id] = this.now + Math.max(0, (h + this.stayFor(u, h) * 1000 - now) / 1000);
    }
  },
  // jalan ke pintu keluar menara (monster yang tidak sedang punya target)
  goExit(m, dt) {
    if (m.out) return;
    const fl = this.exitFloor(), def = m.def, r = def.radius;
    if (fl == null) { this.wanderMon(m, dt); return; }
    if (m.fl !== fl) { this.pursueOtherFloor(m, { fl }, dt); return; }
    const e = { to: 'out', rect: Interior.floors[fl].exit }, p = this.transitTarget(fl, e, r);
    const need = Math.max(CONFIG.interior.margin * Interior.S, this.distToRect(p.x, p.y, e.rect) + 12);
    if (this.distToRect(m.x, m.y, e.rect) <= need) { m.out = true; return; }
    m.a = turnTo(m.a, this.steer(m, { x: p.x, y: p.y, uid: 'x' + m.id }), def.turn * dt);
    this.moveMon(m, Math.cos(m.a) * def.speed * .4 * dt, Math.sin(m.a) * def.speed * .4 * dt);
    this.separate(m, dt);
  },

  // Monster terus hidup walau tidak ada pemain di menara: saat pemain masuk lagi, gerak mereka selama ditinggal dihitung ulang (jalan-jalan, kadang naik / turun
  // tangga ke lantai lain), jadi mereka ada di mana saja, bukan di tempat terakhir. Dihitung maksimal `raidCatchUpSec` terakhir.
  catchUp(sec) {
    sec = Math.min(sec, this.cfg().raidCatchUpSec || 600);
    if (!(sec > 1)) return;
    const wasDown = this.down, others = this.others;
    this.down = true; this.others = new Map();        // tidak ada target: semua monster hanya jalan-jalan
    for (let t = 0; t < sec; t += .5) {
      this.now += .5;
      for (const m of this.mons) { this.updateMon(m, .5); m.rx = m.x; m.ry = m.y; m.ra = m.a; }
    }
    this.down = wasDown; this.others = others;
    for (const m of this.mons) { m.wp = null; m.hop = null; m.st = m.st === ST.DEAD ? ST.DEAD : ST.IDLE; }
  },

  // ---- monster pindah lantai ----
  // Graf lantai dari CONFIG.interior (tangga + pintu yang punya `to`). Pintu Halaman ke peta dunia TIDAK dipakai monster: monster tidak keluar menara.
  floorLinks() {
    if (!this._links) {
      const L = {};
      for (const id of Object.keys(Interior.floors)) {
        const f = Interior.floors[id];
        L[id] = f.stairs.map((s) => ({ to: s.to, rect: s, arrive: s.arrive }));
        if (f.exit && f.exit.to !== undefined && f.exit.arrive) L[id].push({ to: f.exit.to, rect: f.exit, arrive: f.exit.arrive });
      }
      this._links = L;
    }
    return this._links;
  },
  // lantai berikutnya yang harus dituju dari `from` supaya sampai di `to` (BFS), null = tidak terhubung
  nextHop(from, to) {
    if (from === to) return null;
    const L = this.floorLinks(), prev = { [from]: null }, q = [from];
    for (let h = 0; h < q.length && !(to in prev); h++) for (const e of L[q[h]] || []) if (!(e.to in prev)) { prev[e.to] = q[h]; q.push(e.to); }
    if (!(to in prev)) return null;
    let c = to; while (prev[c] !== from) c = prev[c];
    return c;
  },
  distToRect(x, y, r) {
    return Math.hypot(Math.max(r.x - x, 0, x - (r.x + r.w)), Math.max(r.y - y, 0, y - (r.y + r.h)));
  },
  // titik di depan tangga yang muat badan monster (tangganya sendiri kadang menempel di tembok / menara)
  transitTarget(fl, e, r) {
    this._tt = this._tt || {};
    const k = fl + '>' + e.to + ':' + (r <= 26 ? 26 : Math.ceil(r / 10) * 10);
    return this._tt[k] || (this._tt[k] = this.arenaFor(fl).nearestStand(e.rect.x + e.rect.w / 2, e.rect.y + e.rect.h / 2, r));
  },
  // target ada di lantai lain: jalan ke tangga yang mengarah ke sana, lalu ikut naik / turun
  pursueOtherFloor(m, tg, dt) {
    const def = m.def, r = def.radius, next = this.nextHop(m.fl, tg.fl);
    const e = next == null ? null : (this.floorLinks()[m.fl] || []).find((q) => q.to === next);
    if (!e) { m.st = ST.IDLE; m.tgt = null; this.wanderMon(m, dt); return; }
    const p = this.transitTarget(m.fl, e, r);
    // sama seperti player: monster harus benar-benar jalan sampai ke tangga / pintu (zona + margin yang sama) baru pindah lantai, tidak muncul dari jauh
    const need = Math.max(CONFIG.interior.margin * Interior.S, this.distToRect(p.x, p.y, e.rect) + 12);
    if (m.tcd <= 0 && this.distToRect(m.x, m.y, e.rect) <= need) { this.transit(m, e); return; }
    m.a = turnTo(m.a, this.steer(m, { x: p.x, y: p.y, uid: 'z' + m.fl + '>' + e.to }), def.turn * dt);
    this.moveMon(m, Math.cos(m.a) * def.speed * dt, Math.sin(m.a) * def.speed * dt);
    this.separate(m, dt);
  },
  transit(m, e) {
    const na = this.arenaFor(e.to), r = m.def.radius;
    const here = this.targets().filter((t) => t.fl === e.to);
    const free = (x, y) => here.every((t) => Math.hypot(t.x - x, t.y - y) > r + 45) &&
      !this.mons.some((o) => o !== m && o.fl === e.to && o.st !== ST.DEAD && Math.hypot(o.x - x, o.y - y) < r + o.def.radius);
    let p = na.nearestStand(e.arrive.x, e.arrive.y, r);
    if (!free(p.x, p.y)) {            // jangan muncul menumpuk di atas player / monster lain yang berdiri di titik tiba
      search: for (const d of [70, 110, 150, 200, 260]) for (let k = 0; k < 16; k++) {
        const x = e.arrive.x + Math.cos(k * Math.PI / 8) * d, y = e.arrive.y + Math.sin(k * Math.PI / 8) * d;
        if (na.canStand(x, y, r) && free(x, y)) { p = { x, y }; break search; }
      }
    }
    m.fl = e.to; m.x = m.rx = p.x; m.y = m.ry = p.y; m.kx = m.ky = 0; m.wp = null; m.tgtT = 0;
    m.tcd = this.cfg().transitCdSec || 2;       // jeda sebelum boleh lewat tangga lagi (cegah bolak-balik)
  },

  separate(m, dt) {
    for (const o of this.mons) {
      if (o === m || o.st === ST.DEAD || o.fl !== m.fl) continue;
      const dx = m.x - o.x, dy = m.y - o.y, d = Math.hypot(dx, dy), min = m.def.radius + o.def.radius;
      if (d > 0 && d < min) this.moveMon(m, dx / d * (min - d) * Math.min(1, dt * 6), dy / d * (min - d) * Math.min(1, dt * 6));
    }
  },

  beginAttack(m, i) {
    const at = m.def.attacks[i];
    m.st = ST.WINDUP; m.t = 0; m.atk = i; m.cd[i] = at.cd;
    const ev = `m|${this.uid()}|${m.id}|${i}|${Math.round(m.x)}|${Math.round(m.y)}|${m.a.toFixed(3)}|${BattleNet.now()}|${m.fl}`;
    this.monsterSwing(m.def, i, m.x, m.y, m.a, m.fl);
    BattleNet.sendEvent(ev);
  },

  // ts = waktu server (ms) serangan dimulai. Perangkat yang menerima event terlambat memajukan waktunya sebesar keterlambatan itu, jadi saat kena (dan peringatan merah)
  // jatuh di detik yang sama di semua layar. Monster: maks 60% windup supaya pemain yang lag tidak langsung kena tanpa sempat melihat peringatan. Serangan pemain: kompensasi penuh (maks 0,5 dtk) karena windup-nya sangat pendek dan tidak ada peringatan.
  lagFor(ts, cap) { return ts ? Math.max(0, Math.min((BattleNet.now() - ts) / 1000, cap)) : 0; },
  monsterSwing(def, i, x, y, a, fl, ts) {
    const at = def.attacks[i];
    let shape;
    if (at.kind === 'cone') shape = { t: 'cone', x, y, a, r: at.range, arc: at.arc * Math.PI / 180 };
    else if (at.kind === 'circle') shape = { t: 'circle', x: x + Math.cos(a) * at.off, y: y + Math.sin(a) * at.off, a, r: at.radius };
    else shape = { t: 'line', x, y, a, r: at.range, w: at.w };
    this.swings.push({ src: 'm', uid: null, fl, shape, t0: this.now - this.lagFor(ts, at.windup * .6), windup: at.windup, dmg: at.dmg, kb: at.kb, done: false, life: at.windup + .3, color: '255,70,50' });
  },

  // ---------- serangan pemain ----------
  autoAim(range) {
    let best = null, bd = range * 1.6 + 60;
    for (const m of this.mons) {
      if (m.st === ST.DEAD || m.fl !== this.myFl()) continue;
      const d = Math.hypot(m.x - this.me().x, m.y - this.me().y) - m.def.radius;
      if (d < bd) { bd = d; best = m; }
    }
    return best ? Math.atan2(best.y - this.me().y, best.x - this.me().x) : this.me().angle;
  },

  attack(kind, angle) {
    // di map gede (di luar arena / menara) serangan tidak ada: skala dunia beda dengan skala arena
    if (!this.controls() || this.down || this.atkT > 0 || (!this.active && !Interior.active)) return;
    const w = this.weapon(), d = w.def[kind];
    if (!d) return;
    if (Vitals.v.energy < 1) { this.atkT = .5; this.floater(this.me().x, this.me().y - 30, 'Energi habis', '#d6b24a'); return; }   // jangan diam-diam: tampilkan alasannya
    if (angle == null) angle = this.autoAim(d.range);
    Vitals.add('energy', -(d.energy || 0));
    const me = this.me();
    me.angle = angle;
    this.atkT = d.windup + d.recover;
    if (d.lunge && this.active) { this.kv.x += Math.cos(angle) * d.lunge * 9; this.kv.y += Math.sin(angle) * d.lunge * 9; }
    this.playerSwing(this.uid(), kind, w.id, me.x, me.y, angle, this.myFl());
    if (this.active) BattleNet.sendEvent(`s|${this.uid()}|${kind}|${w.id}|${Math.round(me.x)}|${Math.round(me.y)}|${angle.toFixed(3)}|${BattleNet.now()}|${this.myFl()}`);
  },

  // bentuk area serangan senjata: kipas (slash biasa), garis (tusuk biasa) atau kotak di depan player (box: start, range, width)
  swingShape(d, kind, x, y, a) {
    if (d.box) { const st = d.start || 0; return { t: 'line', x: x + Math.cos(a) * st, y: y + Math.sin(a) * st, a, r: d.range, w: d.width }; }
    return kind === 'slash' ? { t: 'cone', x, y, a, r: d.range, arc: d.arc * Math.PI / 180 } : { t: 'line', x, y, a, r: d.range, w: d.width };
  },

  playerSwing(uid, kind, wid, x, y, a, fl, ts) {
    const d = (this.cfg().weapons[wid] || this.cfg().weapons.tangan)[kind];
    if (!d) return;
    const shape = this.swingShape(d, kind, x, y, a);
    this.swings.push({ src: 'p', uid, kind, fl, shape, box: !!d.box, t0: this.now - this.lagFor(ts, .5), windup: d.windup, dmg: d.dmg, kb: d.kb, done: false, life: d.windup + .22, color: '255,255,255' });
  },

  onEvent(str) {
    const p = str.split('|');
    if (Math.abs(BattleNet.now() - +p[7]) > this.cfg().staleEventMs) return;
    const fl = p[8] === undefined || isNaN(+p[8]) ? -1 : +p[8];       // lantai tempat serangan terjadi
    if (p[0] === 's') {
      if (p[1] === this.uid()) return;
      this.playerSwing(p[1], p[2], p[3], +p[4], +p[5], +p[6], fl, +p[7]);
    } else if (p[0] === 'm') {
      if (this.isHost) return;
      const m = this.mons.find((q) => q.id === +p[2]);
      const def = m ? m.def : null;
      if (def && def.attacks[+p[3]]) this.monsterSwing(def, +p[3], +p[4], +p[5], +p[6], fl, +p[7]);
    }
  },

  // saat jendela serangan tiba: hitung siapa yang kena
  resolve(sw) {
    sw.done = true;
    if (sw.src === 'p' && this.isHost) {
      for (const m of this.mons) {
        if (m.st === ST.DEAD || m.fl !== sw.fl || !Shape.hit(sw.shape, m.x, m.y, m.def.radius)) continue;
        m.hp -= sw.dmg; m.flash = .15;
        m.dmg[sw.uid] = (m.dmg[sw.uid] || 0) + sw.dmg;
        m.tgtT = 0;
        const ang = Math.atan2(m.y - sw.shape.y, m.x - sw.shape.x), res = Math.min(1, 24 / m.def.radius);
        m.kx += Math.cos(ang) * sw.kb * 6 * res; m.ky += Math.sin(ang) * sw.kb * 6 * res;
        this.floater(m.x, m.y - m.def.radius, String(Math.round(sw.dmg)), '#fff');
        if (m.hp <= 0) { m.hp = 0; m.st = ST.DEAD; m.dead = 0; }
        if (sw.uid === this.uid()) this.shake = Math.max(this.shake, 4);
      }
    }
    // kena diri sendiri? (serangan monster, atau teman = friendly fire)
    if (this.down || sw.fl !== this.myFl()) return;       // beda lantai = tidak kena
    let dmg = sw.dmg;
    if (sw.src === 'p') {
      if (sw.uid === this.uid()) return;
      dmg *= this.cfg().friendlyFire;
      if (dmg <= 0) return;
    }
    if (Shape.hit(sw.shape, this.self.x, this.self.y, this.selfR())) this.hurtSelf(dmg, sw.kb, sw.shape);
  },

  hurtSelf(dmg, kb, shape) {
    Vitals.add('health', -dmg);
    const ang = Math.atan2(this.self.y - shape.y, this.self.x - shape.x);
    this.kv.x += Math.cos(ang) * kb * 6; this.kv.y += Math.sin(ang) * kb * 6;
    this.floater(this.self.x, this.self.y - 30, '-' + Math.round(dmg), '#ff5a4a');
    this.shake = Math.max(this.shake, 9);
    this.hurtFlash = .2;
  },

  floater(x, y, txt, color) { this.floaters.push({ x, y, txt, color, t: 0 }); if (this.floaters.length > 40) this.floaters.shift(); },

  // ---------- loop ----------
  moveSelf(dx, dy) {
    const a = this.arena, r = this.selfR(), s = this.self, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    for (let i = 0; i < n; i++) {
      const sx = dx / n, sy = dy / n;
      if (a.canStand(s.x + sx, s.y + sy, r)) { s.x += sx; s.y += sy; }
      else if (a.canStand(s.x + sx, s.y, r)) s.x += sx;
      else if (a.canStand(s.x, s.y + sy, r)) s.y += sy;
    }
  },

  update(dt) {
    if (!this.active) return;
    if (!this.valid()) { this.leave(this.kind === 'fixed' ? 'Berhasil kabur!' : undefined); return; }   // keluar dari menara (lewat pintu Halaman) = kabur
    if (this.kind === 'fixed' && this.floorId !== Interior.floorId) {          // naik / turun tangga: battle lanjut di arena lantai baru
      this.floorId = Interior.floorId; this.arena = this.arenaFor(this.floorId); this.kv.x = this.kv.y = 0; this.aim = null;
    }
    this.now += dt;
    const c = this.cfg(), s = this.self;
    const px = s.x, py = s.y;

    // gerak
    if (!this.down) {
      const base = this.kind === 'fixed' ? CONFIG.interior.speed : c.arena.speed;
      const mag = Math.min(1, Math.hypot(this.input.mx, this.input.my));
      const sp = base * Vitals.speedMul() * (this.atkT > 0 ? .55 : 1);
      if (mag > .08) {
        const ux = this.input.mx / Math.hypot(this.input.mx, this.input.my), uy = this.input.my / Math.hypot(this.input.mx, this.input.my);
        this.moveSelf(ux * mag * sp * dt, uy * mag * sp * dt);
        if (this.atkT <= 0) s.angle = Math.atan2(uy, ux);
      }
    }
    if (this.kv.x || this.kv.y) { this.moveSelf(this.kv.x * dt, this.kv.y * dt); const k = Math.exp(-9 * dt); this.kv.x *= k; this.kv.y *= k; if (Math.hypot(this.kv.x, this.kv.y) < 4) this.kv.x = this.kv.y = 0; }
    this.atkT = Math.max(0, this.atkT - dt);
    this.speedNow = Math.hypot(s.x - px, s.y - py) / Math.max(dt, 1e-3);
    if (this.hurtFlash) this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    // serangan yang sedang berjalan
    for (const sw of this.swings) if (!sw.done && this.now >= sw.t0 + sw.windup) this.resolve(sw);
    this.swings = this.swings.filter((sw) => this.now < sw.t0 + sw.life);

    // monster
    if (this.isHost) {
      for (const m of this.mons) {
        const ox = m.x, oy = m.y, ofl = m.fl;
        this.updateMon(m, dt); m.rx = m.x; m.ry = m.y; m.ra = m.a;
        let ivx = (m.x - ox) / Math.max(dt, 1e-3), ivy = (m.y - oy) / Math.max(dt, 1e-3);
        if (m.fl !== ofl || Math.hypot(ivx, ivy) > 1500) ivx = ivy = 0;      // pindah lantai / loncat: bukan gerak
        const kv = Math.min(1, dt * 18); m.vx = (m.vx || 0) + (ivx - (m.vx || 0)) * kv; m.vy = (m.vy || 0) + (ivy - (m.vy || 0)) * kv;
      }
      if (this.kind === 'fixed') this.stepLeaving(dt);
    } else {
      const k = 1 - Math.exp(-dt * 28), pn = performance.now();
      for (const m of this.mons) {
        m.flash = Math.max(0, m.flash - dt);
        if (m.tx === undefined) continue;
        const age = Math.min(1.5, (pn - (m.recv || pn)) / 1000), tx = m.tx + (m.vx || 0) * age, ty = m.ty + (m.vy || 0) * age;      // perkiraan = kiriman terakhir + kecepatan x lama sejak diterima
        if (Math.hypot(tx - m.rx, ty - m.ry) > 400) { m.rx = tx; m.ry = ty; } else { m.rx += (tx - m.rx) * k; m.ry += (ty - m.ry) * k; }
        m.ra = turnTo(m.ra, m.ta, 14 * dt);
        if (m.st === ST.DEAD) m.dead += dt;
      }
    }
    // semua monster tumbang -> menang: tandai dibersihkan lalu semua pemain keluar arena
    if (this.mons.length && this.mons.every((m) => m.st === ST.DEAD)) {
      this.clearT += dt;
      if (this.clearT > 4) { this.setIn(this._unitIds, false); for (const id of this._unitIds) this.markCleared('enc:' + id); this.leave('Menang! Musuh dikalahkan'); return; }
    } else this.clearT = 0;
    // pemain lain
    const ko = 1 - Math.exp(-dt * 28), pn2 = performance.now();
    for (const o of this.others.values()) {
      const age = Math.min(1.5, (pn2 - (o.recv || pn2)) / 1000), tx = o.x + (o.vx || 0) * age, ty = o.y + (o.vy || 0) * age;
      if (Math.hypot(tx - o.rx, ty - o.ry) > 400) { o.rx = tx; o.ry = ty; } else { o.rx += (tx - o.rx) * ko; o.ry += (ty - o.ry) * ko; }
      o.ra = turnTo(o.ra, o.a, 14 * dt);
    }

    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < .9);
    this.shake = Math.max(0, this.shake - dt * 30);
    document.getElementById('game').style.transform = this.shake > .3 ? `translate(${(Math.random() - .5) * this.shake}px,${(Math.random() - .5) * this.shake}px)` : '';

    // tumbang
    if (!this.down && Vitals.v.health <= 0) { this.down = true; this.koT = 2.5; Online.toast && Online.toast('Kamu tumbang!'); }
    if (this.down) {
      this.koT -= dt;
      if (this.koT <= 0) { this.respawn(); return; }
    }

    // kirim ke jaringan (dead reckoning: posisi + kecepatan; dikirim hanya kalau penerima akan salah memperkirakan)
    let ivx = (s.x - px) / Math.max(dt, 1e-3), ivy = (s.y - py) / Math.max(dt, 1e-3);
    if (Math.hypot(ivx, ivy) > 1500) ivx = ivy = 0;
    const kv = Math.min(1, dt * 18); this._vx += (ivx - this._vx) * kv; this._vy += (ivy - this._vy) * kv;
    const nowMs = BattleNet.now(), minGap = c.sendMinMs || 50;
    {
      const L = this._ls, hp = Math.round(Vitals.v.health), dn = this.down ? 1 : 0, vx = this._vx, vy = this._vy, sp1 = Math.hypot(vx, vy);
      let need = !L || hp !== L.hp || dn !== L.dn || this.floorId !== L.fl;
      if (!need) {
        const age = (nowMs - L.t) / 1000, ex = L.x + L.vx * age, ey = L.y + L.vy * age, sp0 = Math.hypot(L.vx, L.vy);
        need = Math.hypot(s.x - ex, s.y - ey) > 3 || Math.abs(wrapA(s.angle - L.a)) > .15 || (sp0 < 5) !== (sp1 < 5) || (sp1 > 5 && nowMs - L.t > 1000) ||
               (sp0 > 5 && (Math.abs(sp1 - sp0) / sp0 > .25 || Math.abs(wrapA(Math.atan2(vy, vx) - Math.atan2(L.vy, L.vx))) > .2));
      }
      if (need && (!L || nowMs - L.t >= minGap)) {
        this._ls = { x: s.x, y: s.y, vx, vy, a: s.angle, hp, dn, fl: this.floorId, t: nowMs };
        BattleNet.sendSelf(`${Math.round(s.x)},${Math.round(s.y)},${s.angle.toFixed(2)},${hp},${dn},${this.floorId},${Math.round(vx)},${Math.round(vy)}`);
      }
    }
    if (this.isHost && this.others.size && nowMs - this._monAt >= minGap && (this._lastMons === '' || this.monNeed(nowMs))) {
      const ms = this.encodeMons();
      this._lastMons = ms; this.monSent(nowMs); BattleNet.sendMons(ms);
    }
    if (this.kind === 'fixed' && this.isHost) { this._holdT = (this._holdT || 0) + dt; if (this._holdT >= 30) { this._holdT = 0; this.touchHold(); } }   // raid masih hidup
  },

  // tumbang: darah dipulihkan sedikit, keluar dari battle / menara, muncul lagi di CONFIG.battle.respawn (peta dunia)
  respawn() {
    const rp = this.cfg().respawn;
    Vitals.v.health = this.cfg().koHealth; Vitals.emit();
    this.leave('Kamu tumbang... bangun lagi di luar menara');
    if (Interior.active) { Interior.active = false; Interior.tower = null; Interior.path = []; }
    Player.x = rp.x; Player.y = rp.y; Player.target = null;
    this.bumpCool = Math.max(this.bumpCool, this.cfg().bumpCoolSec || 4);
  },

  onPlayer(uid, str) {
    if (!str) { this.others.delete(uid); return; }
    const [x, y, a, hp, dn, f, vx, vy] = str.split(',').map(Number), fl = f === undefined || isNaN(f) ? -1 : f;
    let o = this.others.get(uid);
    if (!o) { o = { rx: x, ry: y, ra: a, hue: hueOf(uid), n: 'Pemain-' + uid.slice(-4).toUpperCase() }; this.others.set(uid, o); }
    if (o.fl !== fl) { o.rx = x; o.ry = y; }          // pindah lantai: langsung loncat
    Object.assign(o, { x, y, a, hp, down: !!dn, fl, vx: vx || 0, vy: vy || 0, recv: performance.now() });
  },

  has(uid) { return this.active && this.others.has(uid); },

  // ---------- gambar ----------
  hpBar(ctx, x, y, w, frac, color) {
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 7);
    ctx.fillStyle = color; ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 5);
  },

  // lapisan di bawah pemain: area peringatan serangan monster + bidikan
  drawGround(ctx) {
    for (const sw of this.swings) {
      if (sw.src !== 'm' || sw.fl !== this.myFl()) continue;
      const e = (this.now - sw.t0) / sw.windup, a = Math.min(1, e);
      this.path(ctx, sw.shape);
      ctx.fillStyle = `rgba(255,60,40,${0.12 + a * 0.28})`; ctx.fill();
      ctx.strokeStyle = 'rgba(255,90,60,.8)'; ctx.lineWidth = 3; ctx.stroke();
      // isi bertahap = hitungan mundur sebelum kena
      ctx.save(); this.path(ctx, sw.shape); ctx.clip();
      ctx.fillStyle = 'rgba(255,60,40,.35)';
      const s = sw.shape, rr = (s.r || 0) * a;
      ctx.beginPath();
      if (s.t === 'circle') ctx.arc(s.x, s.y, rr, 0, 6.3); else ctx.arc(s.x, s.y, Math.max(0, s.r * a), 0, 6.3);
      ctx.fill(); ctx.restore();
    }
    if (this.aim && !this.down) {
      const w = this.weapon().def[this.aim.kind];
      if (w) {
        const s = this.me(), shape = this.swingShape(w, this.aim.kind, s.x, s.y, this.aim.angle);
        this.path(ctx, shape); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
  },

  path(ctx, s) {
    ctx.beginPath();
    if (s.t === 'circle') ctx.arc(s.x, s.y, s.r, 0, 6.3);
    else if (s.t === 'cone') { ctx.moveTo(s.x, s.y); ctx.arc(s.x, s.y, s.r, s.a - s.arc / 2, s.a + s.arc / 2); ctx.closePath(); }
    else {
      const c = Math.cos(s.a), n = Math.sin(s.a), hw = s.w / 2;
      ctx.moveTo(s.x - n * hw, s.y + c * hw); ctx.lineTo(s.x - n * hw + c * s.r, s.y + c * hw + n * s.r);
      ctx.lineTo(s.x + n * hw + c * s.r, s.y - c * hw + n * s.r); ctx.lineTo(s.x + n * hw, s.y - c * hw); ctx.closePath();
    }
  },

  drawMon(ctx, m) {
    const d = m.def, r = d.radius;
    let alpha = 1;
    if (m.st === ST.DEAD) { alpha = Math.max(0, 1 - m.dead / 2); if (alpha <= 0) return; }
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(m.rx, m.ry + r * .75, r, r * .45, 0, 0, 6.3); ctx.fill();
    const img = Assets.get('mon:' + m.type);
    if (img) { ctx.save(); ctx.translate(m.rx, m.ry); ctx.rotate(m.ra + Math.PI / 2); ctx.drawImage(img, -r, -r, r * 2, r * 2); ctx.restore(); }
    else {
      const g = ctx.createRadialGradient(m.rx - r * .3, m.ry - r * .3, r * .1, m.rx, m.ry, r);
      g.addColorStop(0, '#ffffff22'); g.addColorStop(1, '#00000044');
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(m.rx, m.ry, r, 0, 6.3); ctx.fill();
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#0008'; ctx.lineWidth = 3; ctx.stroke();
      const ex = Math.cos(m.ra), ey = Math.sin(m.ra), px = -ey, py = ex;     // mata menghadap arah monster
      ctx.fillStyle = d.eye;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(m.rx + ex * r * .5 + px * r * .3 * sd, m.ry + ey * r * .5 + py * r * .3 * sd, Math.max(3, r * .12), 0, 6.3); ctx.fill(); }
    }
    if (m.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${m.flash / .15 * .7})`; ctx.beginPath(); ctx.arc(m.rx, m.ry, r, 0, 6.3); ctx.fill(); }
    ctx.restore();
    if (m.st !== ST.DEAD && (m.hp < m.max || d.boss)) this.hpBar(ctx, m.rx, m.ry - r - 12, Math.max(36, r * 1.3), m.hp / m.max, d.boss ? '#e0662c' : '#c33');
  },

  drawOther(ctx, o) {
    ctx.save();
    if (o.down) ctx.globalAlpha = .4;
    Player.render(ctx, o.rx, o.ry, o.ra, this.visR(), { border: `hsl(${o.hue} 75% 58%)`, label: o.n });
    ctx.restore();
    this.hpBar(ctx, o.rx, o.ry + this.visR() + 6, 34, (o.hp || 0) / 100, '#5fbf5f');
  },

  // lapisan di atas pemain: monster, pemain lain, efek tebasan, angka damage
  drawActors(ctx) {
    const list = [];
    const fl = this.myFl();      // yang satu ruang pandang dengan player yang digambar (lantai sama, atau Halaman <-> Atap)
    for (const m of this.mons) if (this.sameView(m.fl, fl)) list.push({ y: m.ry, f: () => this.drawMon(ctx, m) });
    for (const o of this.others.values()) if (this.sameView(o.fl, fl)) list.push({ y: o.ry, f: () => this.drawOther(ctx, o) });
    if (this.kind === 'random') {
      const s = this.self;
      list.push({ y: s.y, f: () => {
        ctx.save(); if (this.down) ctx.globalAlpha = .4;
        Player.render(ctx, s.x, s.y, s.angle, this.visR());
        if (this.hurtFlash) { ctx.fillStyle = `rgba(255,50,40,${this.hurtFlash * 2})`; ctx.beginPath(); ctx.arc(s.x, s.y, this.visR(), 0, 6.3); ctx.fill(); }
        ctx.restore();
      } });
    }
    list.sort((a, b) => a.y - b.y).forEach((e) => e.f());

    this.drawSwings(ctx);
    this.drawFloaters(ctx);
  },

  drawSwings(ctx) {
    for (const sw of this.swings) {      // efek tebas / tusuk
      if (sw.src !== 'p' || sw.fl !== this.myFl()) continue;
      const e = (this.now - sw.t0) / sw.life, s = sw.shape;
      if (e < 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - e) * .85;
      if (sw.box) {
        this.path(ctx, s); ctx.fillStyle = '#fff'; ctx.fill();
      } else if (s.t === 'cone') {
        const sweep = s.a - s.arc / 2 + s.arc * Math.min(1, e * 2.2);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * .92, sweep - .5, sweep); ctx.stroke();
      } else {
        const c = Math.cos(s.a), n = Math.sin(s.a), len = s.r * Math.min(1, e * 3);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x + c * s.r * .25, s.y + n * s.r * .25); ctx.lineTo(s.x + c * len, s.y + n * len); ctx.stroke();
      }
      ctx.restore();
    }
  },

  drawFloaters(ctx) {
    ctx.font = '700 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4;
    for (const f of this.floaters) {
      ctx.globalAlpha = 1 - f.t / .9;
      ctx.strokeStyle = '#000'; ctx.strokeText(f.txt, f.x, f.y - f.t * 50);
      ctx.fillStyle = f.color; ctx.fillText(f.txt, f.x, f.y - f.t * 50);
    }
    ctx.globalAlpha = 1;
  },

  // arena acak: gambar seluruh layar sendiri (arena tetap digambar oleh Interior.draw yang memanggil drawGround / drawActors)
  drawArena(ctx) {
    const W = window.innerWidth, H = window.innerHeight, a = this.arena;
    ctx.fillStyle = '#0b0d09'; ctx.fillRect(0, 0, W, H);
    const { f, ox, oy } = a.layout();
    ctx.save(); ctx.translate(ox, oy); ctx.scale(f, f);
    a.drawBack(ctx);
    this.drawGround(ctx);
    this.drawActors(ctx);
    a.drawFront(ctx);
    ctx.restore();
  },

  // unit monster di map gede: lingkaran berkeliaran seperti player (warna jenisnya, mata ke arah jalan, jumlah isi)
  drawUnits(ctx) {
    const vw = window.innerWidth / Camera.zoom, vh = window.innerHeight / Camera.zoom;
    for (const u of this.cfg().units || []) {
      if (!this.unitVisible(u)) continue;
      const p = this.unitNow(u), r = u.radius;
      const rr = this.engOf(u) ? this.engR(u) + 20 : r;
      if (p.x + rr < Camera.x || p.x - rr > Camera.x + vw || p.y + rr < Camera.y || p.y - rr > Camera.y + vh) continue;
      const d = this.cfg().monsters[u.pack[0]], n = u.pack.length, eg = this.engOf(u);
      if (eg) {         // lingkaran battle: pemain lain bisa masuk untuk bergabung
        const R = this.engR(u), pulse = .5 + .5 * Math.sin(performance.now() / 260);
        ctx.save();
        ctx.fillStyle = `rgba(196,56,43,${.10 + .08 * pulse})`; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 6.3); ctx.fill();
        ctx.setLineDash([10, 7]); ctx.lineDashOffset = -performance.now() / 60;
        ctx.strokeStyle = `rgba(255,120,90,${.65 + .3 * pulse})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 6.3); ctx.stroke();
        ctx.restore();
        ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText('⚔ BATTLE · masuk untuk ikut', p.x, p.y + R + 4);
        ctx.fillStyle = '#ffd9cf'; ctx.fillText('⚔ BATTLE · masuk untuk ikut', p.x, p.y + R + 4);
      }
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + r * .8, r, r * .45, 0, 0, 6.3); ctx.fill();
      const img = Assets.get('mon:' + u.pack[0]);
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.3); ctx.clip();
      if (img) ctx.drawImage(img, p.x - r, p.y - r, r * 2, r * 2);
      else {
        ctx.fillStyle = d.color; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        const ex = Math.cos(p.a), ey = Math.sin(p.a);
        ctx.fillStyle = d.eye;
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(p.x + ex * r * .45 - ey * r * .3 * sd, p.y + ey * r * .45 + ex * r * .3 * sd, Math.max(1.8, r * .13), 0, 6.3); ctx.fill(); }
      }
      ctx.restore();
      ctx.strokeStyle = '#c4382b'; ctx.lineWidth = Math.max(1.5, r * .14); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.3); ctx.stroke();
      const fs = 10; ctx.font = `600 ${fs}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const label = n > 1 ? `${u.name} ×${n}` : u.name;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(label, p.x, p.y - r - 3);
      ctx.fillStyle = '#f6d9d4'; ctx.fillText(label, p.x, p.y - r - 3);
    }
  },

  bossInfo() { return this.mons.find((m) => m.def.boss && m.st !== ST.DEAD && m.fl === this.myFl()) || null; },
};
