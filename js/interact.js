// Interaksi: klik 2x (double-click / double-tap).
//   - Klik 2x lingkaran Tower of Mabel  -> masuk
//   - Klik 2x tangga                    -> naik / turun
//   - Klik 2x pintu                     -> keluar
// Kalau player belum dekat, dia jalan ke sana dulu dan aksi jalan otomatis begitu sampai.
// Nama tempat ditampilkan di teks pojok kanan atas (lihat hud.js).
const Interact = {
  current: null,      // zona yang sedang dalam jangkauan player (atau null)
  pending: null,      // key zona yang sudah di-klik 2x tapi player belum sampai
  place: null,        // nama tempat saat ini

  // dipanggil tiap frame
  update() {
    let place = null, action = null;

    if (Interior.active) {
      place = `${Interior.tower.name} · Lantai ${Interior.floorId}`;
      action = Interior.action();
    } else {
      const o = Objects.nearby(Player.x, Player.y);
      if (o) {
        place = o.name;
        if (o.interior) action = { key: 'obj:' + o.id, run: () => Interior.enter(o) };
      }
    }
    this.current = action;
    this.place = place;

    if (this.pending && action && action.key === this.pending) this.trigger();
  },

  // dipanggil Input tiap tap. dbl = true kalau ini tap kedua (double).
  onTap(clientX, clientY, dbl) {
    let hitKey = null;
    if (Interior.active) {
      const p = Interior.toLocal(clientX, clientY);
      const z = Interior.zoneAt(p.x, p.y);
      if (z) hitKey = z.key;
    } else {
      const w = Camera.toWorld(clientX, clientY);
      const o = Objects.hitTest(w.x, w.y);
      if (o && o.interior) hitKey = 'obj:' + o.id;
    }
    this.pending = (dbl && hitKey) ? hitKey : null;
    if (this.pending && this.current && this.current.key === this.pending) this.trigger();
  },

  trigger() {
    if (!this.current) return;
    const run = this.current.run;
    this.pending = null;
    this.current = null;
    run();
    if (!Interior.active) Camera.update(Player);
  },
};
