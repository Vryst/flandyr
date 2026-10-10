// Barang yang tergeletak di dunia. Yang dekat player muncul di panel Pencarian (inventory-ui.js).
// Ada dua jenis, dan keduanya terpisah (ala Delta Force Ops):
//   - item lepas : barang yang ada DI LUAR tas              -> GroundItems.list  { uid, id, x, y, loc }
//   - tas        : tas yang dijatuhkan, ISINYA ikut di tas   -> GroundItems.bags  { uid, bagId, x, y, loc, grid }
// Item di dalam tas tetap di dalam tas (muncul sebagai panel tas + grid-nya), item di luar tas tetap di luar.
//
//   `loc` = tempat barang berada: 'world' (di luar) atau 'tower:<id>:<lantai>' (di dalam menara).
//   Daftar awal: CONFIG.worldItems / CONFIG.worldBags
//
//   GroundItems.near()                  -> item lepas dalam jangkauan player
//   GroundItems.nearBags()              -> tas dalam jangkauan player
//   GroundItems.take(uid)               -> item lepas -> tas player (false kalau tas penuh / tidak bawa tas)
//   GroundItems.dropBag()               -> jatuhkan tas yang dipakai (beserta isinya) di posisi player
//   GroundItems.pickBag(uid)            -> pakai tas dari tanah (isinya ikut); kalau sudah pakai tas, ditukar
//   GroundItems.dropFromGrid(grid, uid) -> keluarkan item dari tas ke tanah (jadi item lepas)
const GroundItems = {
  list: [],
  bags: [],

  init() {
    this.list = [];
    this.bags = [];
    for (const it of CONFIG.worldItems || []) this.drop(it.id, it.x, it.y);
    for (const b of CONFIG.worldBags || []) {
      const bag = CONFIG.inventory.bags[b.bag];
      if (!bag) continue;
      const grid = new Grid(bag.cols, bag.rows);
      for (const id of b.items || []) grid.add(id);
      this.bags.push({ uid: Uid.next(), bagId: b.bag, x: b.x, y: b.y, loc: 'world', grid });
    }
  },

  // ---- tempat & jarak ----
  loc() { return Interior.active ? `tower:${Interior.tower.id}:${Interior.floorId}` : 'world'; },
  radius() { return Interior.active ? CONFIG.interior.pickupRadius : CONFIG.inventory.pickupRadius; },

  inReach(it) {
    return it.loc === this.loc() && Math.hypot(it.x - Player.x, it.y - Player.y) <= this.radius();
  },

  near() { return this.list.filter((it) => this.inReach(it)); },
  nearBags() { return this.bags.filter((b) => this.inReach(b)); },

  // titik jatuh di samping player (bukan tepat di bawahnya, supaya kelihatan). Tiap barang bergeser sedikit.
  spot() {
    const n = this.list.length + this.bags.length, k = Interior.active ? 2.2 : 1;
    const a = n * 2.4;   // sudut berputar supaya tidak menumpuk
    return { x: Player.x + Math.cos(a) * 30 * k, y: Player.y + Math.sin(a) * 30 * k };
  },

  // ---- item lepas ----
  drop(id, x = Player.x, y = Player.y, loc = this.loc()) {
    const it = { uid: Uid.next(), id, x, y, loc };
    this.list.push(it);
    return it;
  },

  // ambil item lepas ke tas player (posisi otomatis)
  take(uid) {
    const i = this.list.findIndex((it) => it.uid === uid);
    if (i < 0) return false;
    if (!Inventory.add(this.list[i].id)) return false;   // tas penuh / tidak bawa tas
    this.list.splice(i, 1);
    return true;
  },

  // ambil item lepas ke posisi tertentu di sebuah grid (drag & drop)
  takeTo(uid, grid, x, y, rotated) {
    const i = this.list.findIndex((it) => it.uid === uid);
    if (i < 0) return false;
    const it = this.list[i];
    if (!grid.put({ uid: it.uid, id: it.id, x, y, rotated: false }, x, y, rotated)) return false;
    this.list.splice(i, 1);
    Inventory.emit();
    return true;
  },

  // keluarkan item dari grid (tas player atau tas di tanah) ke tanah: jadi item di luar tas
  dropFromGrid(grid, uid) {
    const it = grid.take(uid);
    if (!it) return false;
    const d = itemDef(it.id);
    if (d && d.isBag) {                    // tas kosong yang disimpan sebagai item -> jatuh sebagai tas
      const bag = CONFIG.inventory.bags[it.id], p = this.spot();
      this.bags.push({ uid: Uid.next(), bagId: it.id, x: p.x, y: p.y, loc: this.loc(), grid: new Grid(bag.cols, bag.rows) });
      Inventory.emit();
      return true;
    }
    const p = this.spot();
    this.list.push({ uid: it.uid, id: it.id, x: p.x, y: p.y, loc: this.loc() });
    Inventory.emit();
    return true;
  },

  // ---- tas ----
  // jatuhkan tas yang sedang dipakai, isinya ikut
  dropBag() {
    const b = Inventory.unequip();         // emit -> UI render
    if (!b) return false;
    const p = this.spot();
    this.bags.push({ uid: Uid.next(), bagId: b.bagId, x: p.x, y: p.y, loc: this.loc(), grid: b.grid });
    Inventory.emit();
    return true;
  },

  // pakai tas dari tanah. Kalau player masih pakai tas, tasnya DITUKAR: tas lama (beserta isinya)
  // jatuh di tempat tas baru tadi berada.
  pickBag(uid) {
    const i = this.bags.findIndex((b) => b.uid === uid);
    if (i < 0) return false;
    const b = this.bags.splice(i, 1)[0];
    const old = Inventory.unequip();
    if (old) this.bags.push({ uid: Uid.next(), bagId: old.bagId, x: b.x, y: b.y, loc: b.loc, grid: old.grid });
    Inventory.equip(b.bagId, b.grid);      // emit -> UI render
    return true;
  },

  // Simpan tas KOSONG sebagai item 1x1 di dalam sebuah grid. src: { from: 'equipped' } atau { from: 'ground', uid }
  stowBag(src, grid, x, y) {
    let bagId;
    if (src.from === 'equipped') {
      const b = Inventory.unequip();
      if (!b) return false;
      bagId = b.bagId;
    } else {
      const i = this.bags.findIndex((b) => b.uid === src.uid);
      if (i < 0) return false;
      bagId = this.bags.splice(i, 1)[0].bagId;
    }
    grid.items.push({ uid: Uid.next(), id: bagId, x, y, rotated: false });
    Inventory.emit();
    return true;
  },

  // Tas yang tersimpan sebagai item di sebuah grid dipakai (slot Tas). Tas yang sedang dipakai jatuh ke tanah.
  equipFromItem(grid, uid) {
    const it = grid.get(uid);
    if (!it || !(itemDef(it.id) || {}).isBag) return false;
    grid.take(uid);
    const old = Inventory.unequip();
    if (old) { const p = this.spot(); this.bags.push({ uid: Uid.next(), bagId: old.bagId, x: p.x, y: p.y, loc: this.loc(), grid: old.grid }); }
    Inventory.equip(it.id);
    return true;
  },

  // ---- gambar di peta / lantai menara ----
  // loc: tempat yang digambar. r: radius penanda (px). Di dunia dipotong sesuai kamera.
  draw(ctx, loc = 'world', r = 14) {
    const world = loc === 'world';
    const vw = window.innerWidth / Camera.zoom, vh = window.innerHeight / Camera.zoom;
    const visible = (x, y, rr) => !world || !(x + rr < Camera.x || x - rr > Camera.x + vw || y + rr < Camera.y || y - rr > Camera.y + vh);

    // gambar barangnya saja (tanpa lingkaran), dengan bayangan tipis supaya terbaca di atas map
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = r * .5; ctx.shadowOffsetY = r * .15;

    for (const b of this.bags) {
      if (b.loc !== loc || !visible(b.x, b.y, r)) continue;
      const img = Assets.get('bag:' + b.bagId);
      if (!img) continue;
      const w = r * 1.2, h = w * img.height / img.width;
      ctx.drawImage(img, b.x - w / 2, b.y - h / 2, w, h);
    }

    for (const it of this.list) {
      if (it.loc !== loc || !visible(it.x, it.y, r * 1.6)) continue;
      const d = Inventory.def(it.id);
      if (!d) continue;
      const img = d.icon ? Assets.get('item:' + it.id) : null;
      const k = r * 1.5 / Math.max(d.w, d.h);        // sisi terpanjang item ~ r*1.5*... skala slot
      if (img) {
        const sc = Math.min(d.w * k * 0.5 / img.width, d.h * k * 0.5 / img.height);
        const w = img.width * sc, h = img.height * sc;
        ctx.drawImage(img, it.x - w / 2, it.y - h / 2, w, h);
      } else {                                         // belum ada gambar: kotak berwarna seukuran item
        const w = d.w * k * 0.4, h = d.h * k * 0.4;
        ctx.fillStyle = d.color || '#6b5238';
        ctx.fillRect(it.x - w / 2, it.y - h / 2, w, h);
      }
    }
    ctx.restore();
  },

  assetList() {
    const out = {};
    for (const [id, d] of Object.entries(CONFIG.items)) if (d.icon) out['item:' + id] = d.icon;
    for (const [id, d] of Object.entries(CONFIG.inventory.bags)) if (d.image) out['bag:' + id] = d.image;
    return out;
  },
};
