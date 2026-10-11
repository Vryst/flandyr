// UI battle: tombol Siaga/Santai, joystick gerak (kiri), tombol serangan kipas = tebas & segi tajam = tusuk (kanan), bar darah.
// Tombol serangan: ketuk = serang ke musuh terdekat (bidik otomatis); tahan lalu geser = bidik arah sendiri, lepas = serang.
// Keyboard: WASD / panah = jalan, J = tebas, K = tusuk. Mouse: klik kiri = tebas ke arah kursor, klik kanan = tusuk.
const BattleUI = {
  keys: new Set(), stick: null, _acc: 0, _avAcc: 0, _avail: false,

  init() {
    const root = document.createElement('div');
    root.id = 'battle-ui';
    root.innerHTML = `
      <button id="bt-toggle" type="button">⚔ Siaga</button>
      <button id="bt-flee" type="button" hidden>Kabur</button>
      <button id="bt-act" type="button" hidden></button>
      <div id="bt-hud" hidden>
        <div class="bt-bar hp"><i id="bt-hp"></i></div>
        <div class="bt-bar en"><i id="bt-en"></i></div>
        <div id="bt-weapon"></div>
      </div>
      <div id="bt-boss" hidden><b id="bt-boss-name"></b><div class="bt-bar boss"><i id="bt-boss-hp"></i></div></div>
      <div id="bt-stick" hidden><div id="bt-knob"></div></div>
      <div id="bt-atk" hidden>
        <button id="bt-thrust" type="button" aria-label="Tusuk">
          <svg viewBox="0 0 48 48"><path d="M24 3 L35 30 L24 45 L13 30 Z" fill="currentColor" opacity=".9"/><path d="M24 8 V38" stroke="#000" stroke-opacity=".45" stroke-width="2"/></svg>
        </button>
        <button id="bt-slash" type="button" aria-label="Tebas">
          <svg viewBox="0 0 48 48"><path d="M24 44 L4 16 A28 28 0 0 1 44 16 Z" fill="currentColor" opacity=".9"/><path d="M24 44 L14 14 M24 44 L24 10 M24 44 L34 14" stroke="#000" stroke-opacity=".45" stroke-width="2"/></svg>
        </button>
      </div>`;
    document.body.appendChild(root);
    const $ = (id) => document.getElementById(id);
    this.el = { toggle: $('bt-toggle'), flee: $('bt-flee'), act: $('bt-act'), hud: $('bt-hud'), hp: $('bt-hp'), en: $('bt-en'), weapon: $('bt-weapon'), boss: $('bt-boss'),
                bossName: $('bt-boss-name'), bossHp: $('bt-boss-hp'), stick: $('bt-stick'), knob: $('bt-knob'), atk: $('bt-atk') };
    this.el.toggle.addEventListener('click', () => Battle.toggle());
    this.el.flee.addEventListener('click', () => Battle.flee());
    this.el.act.addEventListener('click', () => Interact.trigger());   // Masuk / Naik / Turun / Keluar saat Siaga (ketuk-2x dimatikan)

    // ---- joystick gerak ----
    const st = this.el.stick, R = 52;
    let pid = null;
    const move = (e) => {
      const b = st.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      this.el.knob.style.transform = `translate(${dx}px,${dy}px)`;
      this.stick = { x: dx / R, y: dy / R };
    };
    st.addEventListener('pointerdown', (e) => { pid = e.pointerId; st.setPointerCapture(pid); move(e); e.preventDefault(); });
    st.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e); });
    const up = (e) => { if (e.pointerId !== pid) return; pid = null; this.stick = null; this.el.knob.style.transform = ''; };
    st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);

    // ---- tombol serangan (ketuk / geser untuk bidik) ----
    for (const [id, kind] of [['bt-slash', 'slash'], ['bt-thrust', 'thrust']]) {
      const b = $(id);
      let apid = null, ctr = null, aimed = false;
      b.addEventListener('pointerdown', (e) => {
        apid = e.pointerId; b.setPointerCapture(apid); aimed = false;
        const r = b.getBoundingClientRect(); ctr = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        b.classList.add('down'); e.preventDefault();
      });
      b.addEventListener('pointermove', (e) => {
        if (e.pointerId !== apid) return;
        const dx = e.clientX - ctr.x, dy = e.clientY - ctr.y;
        if (Math.hypot(dx, dy) > 18) { aimed = true; Battle.aim = { kind, angle: Math.atan2(dy, dx) }; }
      });
      const end = (e) => {
        if (e.pointerId !== apid) return;
        apid = null; b.classList.remove('down');
        const aim = aimed && Battle.aim ? Battle.aim.angle : null;
        Battle.aim = null;
        if (e.type === 'pointerup') Battle.attack(kind, aim);
      };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
    }

    // ---- keyboard ----
    window.addEventListener('keydown', (e) => {
      if (!Battle.controls() || e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if ('wasd'.includes(k) && k.length === 1 || k.startsWith('arrow')) { this.keys.add(k); e.preventDefault(); }
      else if (k === 'j' && !e.repeat) Battle.attack('slash', null);
      else if (k === 'k' && !e.repeat) Battle.attack('thrust', null);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    // ---- mouse di canvas ----
    document.getElementById('game').addEventListener('pointerdown', (e) => {
      if (!Battle.controls() || e.pointerType !== 'mouse') return;
      const me = Battle.me(), p = Battle.active ? Battle.arena.toLocal(e.clientX, e.clientY) : (Interior.active ? Interior.toLocal(e.clientX, e.clientY) : null);
      if (!p) return;
      Battle.attack(e.button === 2 ? 'thrust' : 'slash', Math.atan2(p.y - me.y, p.x - me.x));
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { Battle.leave(); Battle.setSiaga(false); } });
    window.addEventListener('pagehide', () => Battle.leave());
  },

  // vektor gerak: joystick, atau keyboard
  vec() {
    if (this.stick) return this.stick;
    const k = this.keys;
    const x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const y = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    return { x, y };
  },

  // Siaga / Santai = hanya menampilkan / menyembunyikan kontrol battle. Di dalam battle kontrol selalu tampil dan tombol Kabur menggantikan Siaga.
  refresh() {
    const on = Battle.active, e = this.el, show = Battle.controls();
    this.syncToggle();
    // Raid menara: tidak ada tombol Kabur instan. Kabur = betul-betul keluar dari Halaman Mabel (tombol aksi "Keluar"), lihat CONFIG.battle.fixedFleeButton
    // Kabur selalu lewat pintu keluar + diam di sana `exitHoldSec` detik; tombol instan hanya muncul kalau dinyalakan di config (fixedFleeButton / randomFleeButton)
    e.flee.hidden = !on || !(Battle.kind === 'fixed' ? Battle.cfg().fixedFleeButton : Battle.cfg().randomFleeButton);
    e.hud.hidden = e.stick.hidden = e.atk.hidden = !show;
    if (!on) e.boss.hidden = true;
  },

  // Siaga / Santai hanya ada di map battle (di dalam menara). Di peta dunia tidak ada. Saat battle menara tanpa monster hidup tombolnya jadi Santai.
  syncToggle() {
    const e = this.el, show = Battle.active ? (Battle.kind === 'fixed' && Battle.relaxOk()) : Interior.active;
    if (e.toggle.hidden === show) e.toggle.hidden = !show;
    const t = Battle.siaga ? '☮ Santai' : '⚔ Siaga';
    if (e.toggle.textContent !== t) { e.toggle.textContent = t; e.toggle.classList.toggle('on', Battle.siaga); }
  },

  update(dt) {
    Battle.tick(dt);
    this.syncToggle();
    // tombol aksi (Masuk / Naik / Turun / Keluar): saat battle di menara tetap ada, supaya player bisa lari lewat tangga / pintu
    const act = Battle.siaga && (!Battle.active || Battle.kind === 'fixed') && Interact.current;
    this.el.act.hidden = !act;
    if (act && this.el.act.textContent !== Interact.current.label) this.el.act.textContent = Interact.current.label || 'Aksi';
    if (!Battle.controls()) return;
    const wd = Battle.weapon().def;       // senjata tanpa tusuk / tebas = tombolnya disembunyikan
    document.getElementById('bt-thrust').hidden = !wd.thrust;
    document.getElementById('bt-slash').hidden = !wd.slash;
    const v = this.vec();
    Battle.input.mx = v.x; Battle.input.my = v.y;
    if (!Battle.active) { if (this._acc > .1) { this._acc = 0; this.el.hp.style.width = Vitals.v.health + '%'; this.el.en.style.width = Vitals.v.energy + '%'; this.el.weapon.textContent = Battle.weapon().def.name; } this._acc += dt; return; }
    this._acc += dt;
    if (this._acc < .1) return;
    this._acc = 0;
    this.el.hp.style.width = Vitals.v.health + '%';
    this.el.en.style.width = Vitals.v.energy + '%';
    this.el.weapon.textContent = Battle.weapon().def.name + (Battle.isHost && BattleNet.base ? ' · host' : '');
    const boss = Battle.bossInfo();
    this.el.boss.hidden = !boss;
    if (boss) { this.el.bossName.textContent = boss.def.name; this.el.bossHp.style.width = (boss.hp / boss.max * 100) + '%'; }
  },
};
