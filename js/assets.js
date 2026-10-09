// Loader gambar sederhana.
//   await Assets.load({ player: 'assets/images/player/player.png' });
//   const img = Assets.get('player');
const Assets = {
  images: {},

  load(list) {
    const jobs = Object.entries(list).map(([key, src]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { this.images[key] = img; resolve(); };
      img.onerror = () => { console.warn('Gagal load asset:', src); resolve(); };
      img.src = src;
    }));
    return Promise.all(jobs);
  },

  get(key) {
    return this.images[key] || null;
  },
};
