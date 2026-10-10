// Logika inventory berbasis slot (grid). Tanpa DOM, murni data.
//
//   Grid       = satu kotak slot (cols x rows) berisi item. Dipakai oleh tas yang dipakai player
//                DAN tas yang tergeletak di tanah (lihat ground-items.js), jadi isinya sama-sama bisa dibuka.
//   Inventory  = tas yang sedang dipakai player (bisa kosong = tidak bawa tas).
//
//   Inventory.add('perban')            -> taruh di slot kosong pertama yang muat (null kalau penuh / tidak ada tas)
//   Inventory.move(uid, x, y, rotated) -> pindah item di dalam tas
//   Inventory.unequip()                -> lepas tas (return { bagId, grid }), isinya ikut tas
//   Inventory.equip(bagId, grid)       -> pakai tas (hanya kalau belum pakai tas)
//   Inventory.setBag('tas_besar')      -> ganti tas langsung, isi dipindah (yang tidak muat dikembalikan)

// Definisi item berdasarkan id. Tas juga bisa jadi item (ukuran 1x1, bisa diubah lewat itemW / itemH di CONFIG.inventory.bags)
// supaya tas KOSONG bisa disimpan di dalam tas lain.
function itemDef(id) {
  const d = CONFIG.items[id];
  if (d) return d;
  const b = CONFIG.inventory.bags[id];
  return b ? { name: b.name, w: b.itemW || 1, h: b.itemH || 1, icon: b.image, isBag: true } : null;
}

// uid unik untuk semua item / tas, supaya item bisa pindah antar wadah tanpa bentrok
// Awal hitungan diacak per sesi, jadi uid tidak bentrok antar pemain (dipakai juga sebagai kunci di Firebase, lihat online.js)
const Uid = { n: Math.floor(Math.random() * 9e9) * 1e5 + 1, next() { return this.n++; } };

class Grid {
  constructor(cols, rows, items = []) {
    this.cols = cols;
    this.rows = rows;
    this.items = items;   // { uid, id, x, y, rotated }
  }

  // ukuran item di grid (w/h tertukar kalau diputar)
  sizeOf(it, rotated = it.rotated) {
    const d = itemDef(it.id) || { w: 1, h: 1 };
    return rotated ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
  }

  // Apakah kotak ukuran `size` muat di (x, y)? `ignoreUid` = abaikan item itu (untuk memindah item sendiri).
  fits(size, x, y, ignoreUid = null) {
    if (x < 0 || y < 0 || x + size.w > this.cols || y + size.h > this.rows) return false;
    for (const o of this.items) {
      if (o.uid === ignoreUid) continue;
      const s = this.sizeOf(o);
      if (x < o.x + s.w && x + size.w > o.x && y < o.y + s.h && y + size.h > o.y) return false;
    }
    return true;
  }

  // slot kosong pertama (kiri-atas ke kanan-bawah) yang muat
  findSpot(size, ignoreUid = null) {
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.cols; x++)
        if (this.fits(size, x, y, ignoreUid)) return { x, y };
    return null;
  }

  // taruh item baru berdasarkan id (coba diputar kalau tidak muat). Return item, atau null kalau penuh.
  add(id, uid = Uid.next()) {
    const d = itemDef(id);
    if (!d) { console.warn('Item tidak dikenal:', id); return null; }
    let rotated = false;
    let spot = this.findSpot({ w: d.w, h: d.h });
    if (!spot && d.w !== d.h) { spot = this.findSpot({ w: d.h, h: d.w }); rotated = !!spot; }
    if (!spot) return null;
    const it = { uid, id, x: spot.x, y: spot.y, rotated };
    this.items.push(it);
    return it;
  }

  get(uid) { return this.items.find((it) => it.uid === uid) || null; }

  // cabut item dari grid ini (return item-nya, atau null)
  take(uid) {
    const i = this.items.findIndex((it) => it.uid === uid);
    return i < 0 ? null : this.items.splice(i, 1)[0];
  }

  // pindah item di dalam grid yang sama
  move(uid, x, y, rotated) {
    const it = this.get(uid);
    if (!it) return false;
    const rot = rotated === undefined ? it.rotated : rotated;
    if (!this.fits(this.sizeOf(it, rot), x, y, uid)) return false;
    it.x = x; it.y = y; it.rotated = rot;
    return true;
  }

  // masukkan item yang sudah ada (dari wadah lain) ke (x, y). False kalau tidak muat.
  put(it, x, y, rotated = it.rotated) {
    if (!this.fits(this.sizeOf(it, rotated), x, y)) return false;
    this.items.push({ ...it, x, y, rotated });
    return true;
  }

  usedCells() {
    return this.items.reduce((n, it) => { const s = this.sizeOf(it); return n + s.w * s.h; }, 0);
  }
}

const Inventory = {
  bagId: null,
  grid: null,             // Grid tas yang dipakai, null = tidak bawa tas
  equipment: {},          // slot perlengkapan: { bag: 'backpack', armor: null, hand: null } (nilai = id item / tas)
  listeners: [],

  init() {
    for (const sl of CONFIG.inventory.slots) this.equipment[sl.id] = null;
    if (CONFIG.inventory.bag) this.equip(CONFIG.inventory.bag);
    for (const id of CONFIG.inventory.start || []) this.add(id);
  },

  // ukuran grid & isi (0 / kosong kalau tidak bawa tas)
  get cols() { return this.grid ? this.grid.cols : 0; },
  get rows() { return this.grid ? this.grid.rows : 0; },
  get items() { return this.grid ? this.grid.items : []; },

  hasBag() { return !!this.grid; },
  bag() { return this.bagId ? CONFIG.inventory.bags[this.bagId] : null; },

  onChange(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach((fn) => fn()); },

  // Pakai tas. `grid` = isi tas yang ikut dipakai (mis. tas yang dipungut dari tanah); kosong = tas baru.
  equip(bagId, grid = null) {
    const bag = CONFIG.inventory.bags[bagId];
    if (!bag) { console.warn('Tas tidak dikenal:', bagId); return false; }
    if (this.grid) return false;               // sudah pakai tas: lepas dulu
    this.bagId = bagId;
    this.equipment.bag = bagId;
    this.grid = grid || new Grid(bag.cols, bag.rows);
    this.emit();
    return true;
  },

  // Lepas tas. Isinya tetap di dalam tas. Return { bagId, grid } (atau null kalau tidak bawa tas).
  unequip() {
    if (!this.grid) return null;
    const out = { bagId: this.bagId, grid: this.grid };
    this.bagId = null;
    this.equipment.bag = null;
    this.grid = null;
    this.emit();
    return out;
  },

  // Ganti tas langsung. Item dicoba tetap di posisi lama; yang tidak muat dicarikan slot lain.
  // Return: daftar item yang tidak muat sama sekali (kosong kalau semua aman).
  setBag(bagId) {
    const bag = CONFIG.inventory.bags[bagId];
    if (!bag) { console.warn('Tas tidak dikenal:', bagId); return []; }
    const old = this.items;
    const g = new Grid(bag.cols, bag.rows);
    const dropped = [];
    for (const it of old) {
      if (!g.put(it, it.x, it.y)) {
        const spot = g.findSpot(g.sizeOf(it));
        if (spot) g.put(it, spot.x, spot.y);
        else dropped.push(it);
      }
    }
    this.bagId = bagId;
    this.equipment.bag = bagId;
    this.grid = g;
    this.emit();
    return dropped;
  },

  def(id) { return itemDef(id); },

  sizeOf(it, rotated = it.rotated) { return (this.grid || Inventory._none).sizeOf(it, rotated); },
  fits(size, x, y, ignoreUid = null) { return this.grid ? this.grid.fits(size, x, y, ignoreUid) : false; },
  findSpot(size, ignoreUid = null) { return this.grid ? this.grid.findSpot(size, ignoreUid) : null; },

  add(id, uid) {                 // uid opsional: dipertahankan saat barang diambil dari tanah (identitas sama di seluruh dunia)
    if (!this.grid) return null;
    const it = this.grid.add(id, uid);
    if (it) this.emit();
    return it;
  },

  move(uid, x, y, rotated) {
    if (!this.grid || !this.grid.move(uid, x, y, rotated)) return false;
    this.emit();
    return true;
  },

  remove(uid) {
    if (!this.grid || !this.grid.take(uid)) return false;
    this.emit();
    return true;
  },

  // Pindahkan item antar wadah (tas player <-> tas di tanah). Return false kalau tidak muat.
  transfer(from, uid, to, x, y, rotated) {
    const it = from.get(uid);
    if (!it) return false;
    if (from === to) return to.move(uid, x, y, rotated) && (this.emit(), true);
    if (!to.put(it, x, y, rotated)) return false;
    from.take(uid);
    this.emit();
    return true;
  },

  get(uid) { return this.grid ? this.grid.get(uid) : null; },

  // jumlah slot terpakai
  usedCells() { return this.grid ? this.grid.usedCells() : 0; },
};
Inventory._none = new Grid(0, 0);
