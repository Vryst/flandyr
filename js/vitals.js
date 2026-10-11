// Vitals: darah (health), energi, kelaparan, kehausan. Ditampilkan di layar inventory.
// Semua nilai 0..100. Angka laju ada di CONFIG.vitals (per detik NYATA, game ikut ter-pause saat inventory terbuka).
//
//   hunger / thirst : ISI perut / ISI minum (100 = kenyang / segar, turun terus; lebih cepat saat bergerak)
//   energy          : turun saat berjalan, pulih saat diam. Energi rendah memperlambat jalan (Vitals.speedMul)
//   health          : pulih pelan kalau kenyang & tidak haus; berkurang kalau lapar / haus sudah habis
//
// API untuk item / event nanti:  Vitals.add('hunger', 30)  Vitals.add('health', -20)  Vitals.add('thirst', 40)
const Vitals = {
  KEYS: ['health', 'energy', 'hunger', 'thirst'],
  SHORT: { health: 'h', energy: 'e', hunger: 'f', thirst: 'w' },   // kunci pendek di database (cocok dgn database.rules.json)
  v: { health: 100, energy: 100, hunger: 100, thirst: 100 },
  dead: false,
  listeners: [],
  _acc: 0,

  cfg() { return CONFIG.vitals; },

  // dipanggil tiap frame saat game jalan. speed = kecepatan gerak player sekarang (px/detik)
  update(dt, speed) {
    const c = this.cfg(), v = this.v, moving = speed > 1;
    const act = moving ? c.activeMul : 1;

    v.hunger = clamp(v.hunger - c.hungerPerMin / 60 * act * dt);
    v.thirst = clamp(v.thirst - c.thirstPerMin / 60 * act * dt);
    v.energy = clamp(v.energy + (moving ? -c.energyDrainPerSec : c.energyRegenPerSec) * dt);
    // lapar / haus habis -> energi tidak bisa pulih
    if (!moving && (v.hunger <= 0 || v.thirst <= 0)) v.energy = clamp(v.energy - c.energyRegenPerSec * dt);

    let dmg = 0;
    if (v.hunger <= 0) dmg += c.starveDmgPerSec;
    if (v.thirst <= 0) dmg += c.dehydrateDmgPerSec;
    if (dmg) v.health = clamp(v.health - dmg * dt);
    else if (v.hunger >= c.regenMin && v.thirst >= c.regenMin) v.health = clamp(v.health + c.regenPerSec * dt);

    this.dead = v.health <= 0;
    this._acc += dt;
    if (this._acc >= 0.25) { this._acc = 0; this.emit(); }   // UI cukup diperbarui 4x per detik
  },

  // pengali kecepatan jalan: energi < lowEnergy -> melambat sampai minSpeedMul saat energi habis
  speedMul() {
    const c = this.cfg(), e = this.v.energy;
    if (e >= c.lowEnergy) return 1;
    return c.minSpeedMul + (1 - c.minSpeedMul) * (e / c.lowEnergy);
  },

  add(key, n) {
    if (!(key in this.v)) return;
    this.v[key] = clamp(this.v[key] + n);
    this.emit();
  },

  // ---- simpan / muat (dipakai online.js) ----
  pack() { const o = {}; for (const k of this.KEYS) o[this.SHORT[k]] = Math.round(this.v[k] * 10) / 10; return o; },
  apply(o) {
    if (!o) return;
    for (const k of this.KEYS) { const n = Number(o[this.SHORT[k]]); if (isFinite(n)) this.v[k] = clamp(n); }
    this.emit();
  },
  sig() { return this.KEYS.map((k) => Math.round(this.v[k])).join(','); },

  onChange(fn) { this.listeners.push(fn); },
  emit() { for (const fn of this.listeners) fn(this.v); },
};

function clamp(n) { return n < 0 ? 0 : n > 100 ? 100 : n; }
