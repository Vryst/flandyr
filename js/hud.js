// HUD pojok kanan atas: koordinat + medan, dan nama tempat yang muncul dengan animasi
// (melebar + fade + geser sedikit) lalu menghilang dengan animasi juga.
const Hud = {
  coordEl: null, tagEl: null,
  lastCoord: null, lastPlace: null, shownPlace: '',

  init() {
    this.coordEl = document.getElementById('coords-text');
    this.tagEl = document.getElementById('place-tag');
  },

  // coord: teks koordinat ('' kalau tidak ada), place: nama tempat atau null
  set(coord, place) {
    if (coord !== this.lastCoord) { this.coordEl.textContent = coord; this.lastCoord = coord; }

    if (place === this.lastPlace) return;
    const wasShown = !!this.lastPlace;
    this.lastPlace = place;

    if (place) {
      const changed = place !== this.shownPlace;
      this.shownPlace = place;
      this.tagEl.textContent = place;
      this.tagEl.style.maxWidth = this.tagEl.scrollWidth + 'px';   // lebar pas teksnya, supaya animasi melebarnya terasa
      this.tagEl.classList.add('show');
      if (wasShown && changed) {            // ganti lantai: teks "berganti" dengan halus
        this.tagEl.animate(
          [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }],
          { duration: 320, easing: 'ease-out' });
      }
    } else {
      this.tagEl.style.maxWidth = '0px';
      this.tagEl.classList.remove('show');  // teks lama dibiarkan supaya bisa memudar keluar
    }
  },
};
