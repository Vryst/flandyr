// Jaringan battle (Firebase Realtime Database). Offline / Firebase gagal -> semua fungsi jadi no-op dan pemain jadi host sendirian.
//
//   battle/{room}/m/host        uid pemain yang menjalankan AI monster (diklaim lewat transaksi: yang pertama menang)
//   battle/{room}/m/seed        seed arena acak + penempatan monster (sama untuk semua pemain di room)
//   battle/{room}/m/kind        'fixed' | 'random'
//   battle/{room}/p/{uid}       "x,y,sudut,darah,tumbang" tiap ~100 ms (hilang otomatis saat putus)
//   battle/{room}/mon           snapshot semua monster "id~tipe~x~y~a~hp~state;..." (hanya host yang menulis)
//   battle/{room}/ev/{pushId}   event serangan (tebas / tusuk / serangan monster), dihapus penulisnya setelah 5 detik
//
// Host keluar / putus -> m/host terhapus (onDisconnect) -> semua pemain lain menunggu waktu acak 50-450 ms lalu mencoba
// mengklaim; yang berhasil jadi host baru dan melanjutkan dari snapshot monster terakhir.
// Room kosong (pemain terakhir keluar) dihapus; room basi dari sesi yang crash di-reset oleh pemain berikutnya.
const BattleNet = {
  room: null, base: null, pRef: null, hostRef: null, subs: [], claimT: 0,

  now() { return Date.now() + ((typeof Online !== 'undefined' && Online.offset) || 0); },
  online() { return typeof Online !== 'undefined' && Online.ready && Online.enabled && Online.db; },

  // Room raid menara yang ditinggalkan pemain terakhir tapi masih ada monster hidup TIDAK dihapus: snapshot monster (lantai, posisi, darah) disimpan
  // di battle/{room}/mon + penanda waktu battle_state/hold:{room}. Pemain berikutnya melanjutkan dari snapshot itu (Battle.catchUp menghitung gerak monster selama ditinggal), bukan spawn ulang.
  _held: {},        // mode offline: snapshot yang sama disimpan di memori
  isHeld(key) {
    if (!this.online()) return !!this._held[key] && Battle.heldAlive();
    return Battle.cleared['hold:' + key] > 0 && Battle.heldAlive();     // raid tertinggal yang semua unitnya sudah keluar (menurut jadwal) dianggap tidak ada
  },
  aliveIn(str) { return !!str && String(str).split(';').some((p) => p.split('~')[6] !== '5'); },     // ada monster yang belum mati (state 5 = DEAD)
  async readHeld(base, key) {
    const [h, mon, seed, un] = await Promise.all(['battle_state/hold:' + key].map((p) => Online.db.ref(p).once('value'))
      .concat([base.child('mon').once('value'), base.child('m/seed').once('value'), base.child('m/units').once('value')]));
    const t = h.val();
    if (!(t > 0) || seed.val() == null || !this.aliveIn(mon.val())) return null;
    return { seed: seed.val(), mons: mon.val(), units: un.val(), t };
  },

  async join(key, info) {
    this.room = key;
    const resume = !!info.resume;
    if (!this.online()) {
      const h = this._held[key];
      if (resume && h) { delete this._held[key]; return { seed: h.seed, isHost: true, mons: h.mons, units: h.units, heldAt: h.t }; }
      return { seed: (Math.random() * 2 ** 31) | 0, isHost: true, mons: null, units: null };
    }
    const db = Online.db, uid = Online.uid, base = db.ref('battle/' + key);
    this.base = base;
    this.pRef = base.child('p/' + uid);
    this.hostRef = base.child('m/host');
    this.pRef.onDisconnect().remove();
    await this.pRef.set('0,0,0,100,0');

    const ps = await base.child('p').once('value');
    let others = 0; ps.forEach((c) => { if (c.key !== uid) others++; });

    const tx = await this.hostRef.transaction((cur) => cur || uid);
    const isHost = tx.snapshot.val() === uid;
    let seed = null, mons = null, units = null, heldAt = 0;
    if (isHost) {
      this.hostRef.onDisconnect().remove();
      const held = others === 0 && resume ? await this.readHeld(base, key).catch(() => null) : null;
      if (held) {                         // room kosong tapi monster masih tertinggal di menara: lanjutkan, jangan spawn ulang
        ({ seed, mons, units } = held); heldAt = held.t;
      } else if (others === 0) {          // room baru / basi: mulai dari nol
        seed = (Math.random() * 2 ** 31) | 0;
        await Promise.all([base.child('m/seed').set(seed), base.child('m/kind').set(info.kind), base.child('m/units').set(info.units || null),
                           base.child('mon').remove(), base.child('ev').remove().catch(() => {})]);
      } else {                            // ada pemain lain (host sebelumnya pergi): lanjutkan
        seed = (await base.child('m/seed').once('value')).val();
        mons = (await base.child('mon').once('value')).val();
        units = (await base.child('m/units').once('value')).val();
      }
    } else {
      for (let i = 0; i < 15 && seed == null; i++) {       // host baru saja menulis seed
        seed = (await base.child('m/seed').once('value')).val();
        if (seed == null) await new Promise((r) => setTimeout(r, 200));
      }
      mons = (await base.child('mon').once('value')).val();
      units = (await base.child('m/units').once('value')).val();
    }
    if (seed == null) seed = (Math.random() * 2 ** 31) | 0;
    return { seed, isHost, mons, units, heldAt };
  },

  // dipasang setelah Battle siap menerima data
  listen() {
    if (!this.base) return;
    const base = this.base, uid = Online.uid, sub = (ref, ev, fn) => { ref.on(ev, fn); this.subs.push([ref, ev, fn]); };
    const pl = (s) => { if (s.key !== uid) Battle.onPlayer(s.key, s.val()); };
    const p = base.child('p');
    sub(p, 'child_added', (s) => { if (s.key !== uid && Battle.isHost) Battle._lastMons = ''; pl(s); });   // pemain baru: kirim ulang snapshot monster
    sub(p, 'child_changed', pl);
    sub(p, 'child_removed', (s) => { if (s.key !== uid) Battle.onPlayer(s.key, null); });
    sub(base.child('mon'), 'value', (s) => { if (!Battle.isHost) Battle.applyMons(s.val()); });
    sub(base.child('m/units'), 'value', (s) => { if (!Battle.isHost) Battle.setUnitIds(s.val()); });     // unit masuk / keluar raid
    sub(base.child('ev'), 'child_added', (s) => Battle.onEvent(s.val()));
    sub(this.hostRef, 'value', (s) => { if (s.val() === null) this.tryClaim(); });
  },

  tryClaim() {
    if (!this.base || Battle.isHost) return;
    clearTimeout(this.claimT);
    this.claimT = setTimeout(async () => {
      if (!this.base || Battle.isHost) return;
      try {
        const tx = await this.hostRef.transaction((cur) => cur || Online.uid);
        if (tx.snapshot.val() === Online.uid && this.base) { this.hostRef.onDisconnect().remove(); Battle.becomeHost(); }
      } catch (e) {}
    }, 50 + Math.random() * 400);
  },

  sendSelf(str) { if (this.pRef) this.pRef.set(str).catch(() => {}); },
  setUnits(str) { if (this.base) this.base.child('m/units').set(str || null).catch(() => {}); },
  sendMons(str) { if (this.base) this.base.child('mon').set(str).catch(() => {}); },
  sendEvent(str) {
    if (!this.base) return;
    const r = this.base.child('ev').push();
    r.set(str).catch(() => {});
    setTimeout(() => r.remove().catch(() => {}), 5000);
  },

  // snap = { mons, units, seed } snapshot monster hidup untuk disimpan kalau ini pemain terakhir (null = tidak ada yang perlu disimpan);
  // track = room raid menara (penanda `hold` ikut dibersihkan kalau tidak ada yang disimpan)
  leave(snap, track) {
    clearTimeout(this.claimT);
    for (const [ref, ev, fn] of this.subs) ref.off(ev, fn);
    this.subs = [];
    const { base, pRef, hostRef, room } = this;
    this.base = this.pRef = this.hostRef = null; this.room = null;
    if (!base) {                          // offline: simpan di memori
      if (room && track) { if (snap) this._held[room] = { t: this.now(), seed: snap.seed, mons: snap.mons, units: snap.units }; else delete this._held[room]; }
      return;
    }
    pRef.onDisconnect().cancel();
    const wasHost = Battle.isHost, holdRef = Online.db.ref('battle_state/hold:' + room);
    if (wasHost) hostRef.onDisconnect().cancel();
    Promise.all([pRef.remove(), wasHost ? hostRef.remove() : null]).then(() => base.child('p').once('value'))
      .then((s) => {
        if (s.exists()) return;           // masih ada pemain lain di room
        if (snap) return Promise.all([base.child('mon').set(snap.mons), snap.units ? base.child('m/units').set(snap.units) : null, holdRef.set(this.now())]);
        return Promise.all([track ? holdRef.set(0) : null, base.remove().catch(() => {})]);
      }).catch(() => {});
  },
};
