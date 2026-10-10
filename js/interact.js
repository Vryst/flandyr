// Interaksi: nama tempat + tombol aksi (Masuk / Naik / Turun / Keluar).
// Tombol muncul hanya kalau player ada di zona yang bisa diinteraksi. Tekan E / Enter = klik tombol.
const Interact = {
  nameEl: null, btnEl: null, fadeEl: null,
  current: null,
  busy: false,

  init() {
    this.nameEl = document.getElementById('place-name');
    this.btnEl = document.getElementById('action-btn');
    this.fadeEl = document.getElementById('fade');
    this.btnEl.addEventListener('click', () => this.trigger());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') this.trigger();
    });
  },

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
        if (o.interior) action = { label: 'Masuk', run: () => Interior.enter(o) };
      }
    }

    this.current = action;
    this.nameEl.textContent = place || '';
    this.nameEl.classList.toggle('show', !!place);
    this.btnEl.textContent = action ? action.label : '';
    this.btnEl.classList.toggle('show', !!action && !this.busy);
  },

  trigger() {
    if (!this.current || this.busy) return;
    const run = this.current.run;
    this.busy = true;
    this.fadeEl.classList.add('on');                 // layar gelap sebentar saat pindah tempat
    setTimeout(() => {
      run();
      this.fadeEl.classList.remove('on');
      setTimeout(() => { this.busy = false; }, 150);
    }, 180);
  },
};
