// Semua pengaturan game ada di sini.

// ===== SKALA DUNIA =====
// pxPerKm   : 300 px = 1 km (dulu 100; map & player dibesarkan 3x, ukuran dunia tetap 80 km)
// timeScale : 1 detik nyata = berapa detik waktu game (360 = 1 detik nyata = 6 menit game, alias 1:360)
const SCALE = {
  pxPerKm: 300,
  timeScale: 360,
};

const CONFIG = {
  world: {
    // Gambar map (9208 x 7424, hasil upscale 4x dari 2302 x 1856) ditarik ke ukuran dunia ini, rasio tetap.
    // Dengan 300 px = 1 km: dunia = 80 km x 64,5 km
    width: 24000,             // px
    height: 19350,            // px (24000 * 1856 / 2302)
    spawn: { x: 17724, y: 16680 }, // posisi awal player (di darat; tengah map = danau)
    color: '#2a3326',
    gridSize: 100,            // grid sementara, set 0 untuk matikan
    backgroundImage: 'assets/images/map/map.png',
    // Map dipecah jadi petak (hasil tools/gen_map_tiles.py) supaya HP tidak perlu memuat 1 gambar raksasa.
    // Set ke null untuk kembali memakai backgroundImage utuh.
    mapTiles: { dir: 'assets/images/map/tiles', size: 2048, cols: 5, rows: 4, width: 9208, height: 7424 },
  },

  player: {
    radius: 12,               // ukuran lingkaran/sprite (px). Skala 300 px = 1 km, jadi ini hanya ikon simbolis
    speedKmh: 2,              // kecepatan jalan (km/jam, waktu game)
    speed: 0,                 // px per detik nyata, dihitung otomatis di bawah
    color: '#e8ecdf',
    sprite: 'assets/images/player/player.png',   // potret karakter (sudah bulat)
    rotateSprite: false,      // false = potret tetap tegak (true = ikut memutar sesuai arah jalan)
  },

  // Jenis medan (id sesuai Terrain: 0 darat, 1 air, 2 hutan).
  // speed = pengali kecepatan jalan, walkable = false berarti player tidak bisa masuk.
  terrain: {
    0: { name: 'Darat', walkable: true,  speed: 1.0 },   // (tambah battle: 'plain' + arena 'plain' kalau mau darat juga bisa battle)
    1: { name: 'Air',   walkable: false, speed: 0 },
    2: { name: 'Hutan', walkable: true,  speed: 0.6, battle: 'forest' },   // battle: nama kumpulan arena acak (CONFIG.battle.arenas). Tanpa `battle` = tombol Siaga tidak muncul
  },

  // Objek di dunia (bulat, bisa diinteraksi nanti).
  //   x, y           : posisi tengah (px dunia)
  //   radius         : radius lingkaran yang digambar (px)
  //   interactRadius : jarak player boleh berinteraksi (px, dari tengah objek)
  objects: [
    {
      id: 'tower',
      name: 'Tower of Mabel',
      x: 18000,
      y: 18000,
      radius: 90,
      interactRadius: 90,           // = radius: tombol Masuk muncul begitu player ada di dalam lingkaran
      interior: true,               // punya bagian dalam (lihat CONFIG.interior)
      sprite: 'assets/images/objects/tower.png',
    },
  ],

  // Bagian dalam Tower of Mabel: 3 lantai. Semua koordinat dalam px GAMBAR LANTAI (503 x ~495), dikali `scale` saat dipakai.
  //   walls   : poligon area yang bisa diinjak (segi delapan di dalam tembok)
  //   blocked : [x, y, w, h] furnitur / benda yang tidak bisa ditembus
  //   stairs  : tangga. dir 'up' / 'down', `to` = lantai tujuan, `arrive` = posisi player setelah sampai di lantai itu
  //   exit    : pintu keluar menara (hanya lantai 1)
  //   spawn   : posisi player waktu masuk dari luar (hanya lantai 1)
  //   Lantai 0 = Halaman (di luar menara, sebelum masuk). Lantai 3 memakai gambar yang SAMA dengan halaman (imageFrom: 0), tapi collision-nya beda.
  //   Opsional per lantai: label (nama di pojok kanan atas), zoom (>1 = kamera ikut player), blockedPolys (poligon yang tidak bisa diinjak).
  interior: {
    scale: 2,                 // gambar lantai diperbesar 2x
    linkedFloors: [0, 3],     // lantai yang satu ruang pandang (Halaman & Atap pakai gambar sama): pemainnya saling kelihatan
    startFloor: 0,            // masuk dari peta dunia -> mulai di Halaman
    speed: 260,               // px per detik (px lantai yang sudah di-scale)
    playerRadius: 26,         // ukuran karakter di dalam menara (px lantai ter-scale)
    margin: 26,               // jarak (px lantai) dari tangga / pintu supaya tombol muncul
    pickupRadius: 50,         // jarak (px lantai ter-scale) barang masih muncul di panel Pencarian di dalam menara
    floors: [
      {
        id: 0, image: 'assets/images/tower/yard.jpg', w: 1200, h: 896, label: 'Halaman', zoom: 1.8,
        battle: {},   // lantai ini jadi arena raid tetap: isinya unit monster yang sedang di dalam menara (lihat CONFIG.battle.units `cycle`). Hapus = menara aman
        walls: [[10,10],[1190,10],[1190,886],[10,886]],     // seluruh gambar bebas dijelajahi (tepi gambar = batas)
        blocked: [],
        blockedPolys: [
          [[626,226],[797,226],[897,322],[897,534],[803,630],[627,630],[522,534],[522,322]],     // hanya menara yang collision
        ],
        stairs: [{ x: 740, y: 606, w: 56, h: 26, dir: 'in', to: 1, arrive: { x: 251, y: 78 } }],    // pintu di tembok bawah menara (di atas jalan berbatu) -> lantai 1
        exit: { x: 690, y: 862, w: 110, h: 34 },                                                    // jalan di bawah -> peta dunia
        spawn: { x: 740, y: 835 },
      },
      {
        id: 1, image: 'assets/images/tower/floor1.png', w: 503, h: 495,
        walls: 'oct',
        blocked: [[41,290,213,90],[131,240,48,52],[252,293,44,44],[363,253,96,110],[381,373,36,35],[366,103,93,142],[119,388,90,70],[274,423,109,32]],
        stairs: [{ x: 36, y: 133, w: 87, h: 135, dir: 'up', to: 2, arrive: { x: 140, y: 240 } }],
        exit: { x: 214, y: 38, w: 74, h: 36, to: 0, arrive: { x: 768, y: 650 } },     // pintu di tembok atas -> keluar ke Halaman (depan pintu menara)
        spawn: { x: 251, y: 78 },
      },
      {
        id: 2, image: 'assets/images/tower/floor2.png', w: 503, h: 495,
        walls: 'oct',
        blocked: [[219,46,74,166],[296,41,80,36],[96,66,75,95],[36,128,45,43],[437,139,28,28],[63,356,85,75],[203,381,160,70]],
        stairs: [
          { x: 33, y: 181, w: 88, h: 115, dir: 'down', to: 1, arrive: { x: 140, y: 200 } },
          { x: 381, y: 179, w: 87, h: 147, dir: 'up',   to: 3, arrive: { x: 775, y: 460 } },
        ],
      },
      {
        // Atap menara: gambar SAMA dengan Halaman (imageFrom: 0), koordinat di ruang gambar yang sama; hanya atapnya yang bisa diinjak.
        id: 3, imageFrom: 0, w: 1200, h: 896, zoom: 2.4,
        walls: [[615,250],[800,250],[866,320],[866,542],[800,601],[615,601],[552,542],[552,320]],
        blocked: [[566,520,66,64]],
        stairs: [{ x: 797, y: 397, w: 69, h: 125, dir: 'down', to: 2, arrive: { x: 362, y: 240 } }],
      },
    ],
  },

  // Inventory berbasis slot (grid) ala Resident Evil / Delta Force.
  // Ukuran grid ditentukan oleh tas yang dipakai (bag): cols x rows slot.
  inventory: {
    bag: 'backpack',          // id tas yang sedang dipakai (kunci di `bags`)
    character: null,          // gambar karakter, mis. 'assets/images/player/char.png' (null = siluet bawaan)
    // Slot perlengkapan di sekitar karakter (area karakter 360 x 300 px).
    //   side: 'left' / 'right' / 'center', top: jarak dari atas (px), w / h: ukuran slot (px, default 64 x 64).
    // Slot 'bag' menentukan ukuran grid; slot lain masih kosong (menunggu item).
    slots: [
      { id: 'bag',   label: 'Tas',          side: 'left',  top: 14  },   // samping kepala (ada tombol Jatuhkan)
      { id: 'armor', label: 'Baju / Armor', side: 'left',  top: 134 },   // di bawah tas
      { id: 'hand',  label: 'Tangan',       side: 'right', top: 134 },   // samping badan
    ],
    cellSize: 52,             // ukuran maksimal 1 slot (px). Otomatis mengecil supaya tas besar tetap muat di layar
    minCellSize: 26,          // batas terkecil; kalau tas lebih besar lagi, layar bisa di-scroll
    pickupRadius: 50,         // jarak (px dunia) barang masih muncul di panel Pencarian (50 px ≈ 167 m)
    start: [],                // isi tas waktu mulai game (id item, kosongkan [] kalau tidak mau)
    bags: {
      backpack: { name: 'Ransel', cols: 3, rows: 3, image: 'assets/images/items/backpack.png' },
      // tas lain nanti tinggal tambah di sini, mis. { name: 'Tas Besar', cols: 5, rows: 4, image: '...' }
    },
  },

  // Definisi item. Format:
  //   id: { name: 'Pisau', w: 1, h: 2, icon: 'assets/images/items/pisau.png', color: '#4a4a52' }
  // w x h = jumlah slot yang dipakai item di grid. icon boleh dikosongkan (tampil nama + warna `color`).
  // Tas juga bisa jadi item (lihat CONFIG.inventory.bags), jadi tidak perlu didaftarkan di sini.
  items: {
    pisau: { name: 'Pisau', w: 1, h: 2, icon: 'assets/images/items/pisau.png', weapon: 'pisau' },   // weapon = kunci di CONFIG.battle.weapons
  },

  // Barang tergeletak di dunia (di luar tas): { id: 'pisau', x: 17800, y: 17400 }
  worldItems: [
    { id: 'pisau', x: 17780, y: 16700 },
  ],

  // Tas tergeletak di dunia, lengkap dengan isinya: { bag: 'backpack', x, y, items: ['pisau'] }
  worldBags: [
    { bag: 'backpack', x: 17690, y: 16650, items: [] },
  ],

  // ===== BATTLE (js/battle*.js) =====
  // Siaga = ikut battle di map ini (joystick muncul), Santai = jalan biasa.
  // Tombol Siaga hanya muncul di map yang bisa battle: lantai menara dengan `battle: {...}` (arena tetap)
  // dan medan dengan `battle: 'nama'` di CONFIG.terrain (arena acak dari CONFIG.battle.arenas[nama]).
  battle: {
    enabled: true,
    roomCell: 2400,            // arena acak: pemain di sel dunia yang sama (px) ikut satu battle & satu set monster
    arena: { w: 2400, h: 1792, zoom: 2.2, playerRadius: 22, speed: 260 },   // arena acak (ukuran sama dgn Halaman menara)
    sendMs: 100,               // kirim posisi / monster ke server tiap sekian ms (10x per detik)
    friendlyFire: 0.5,         // pengali damage ke teman satu battle (0 = tidak ada friendly fire, 1 = penuh)
    koHealth: 5,               // darah setelah tumbang
    respawn: { x: 18000, y: 17800 },   // tumbang -> keluar battle / menara, muncul lagi di titik ini (peta dunia, di atas Tower of Mabel)
    staleEventMs: 2500,        // event serangan lebih tua dari ini diabaikan

    // Unit monster di map gede: lingkaran seperti player yang berkeliaran di sekitar kemahnya (deterministik dari jam server,
    // jadi semua pemain melihat posisi yang sama tanpa trafik jaringan). Player menabrak unit = masuk battle di arena acak.
    //   home    : id objek (mis. 'tower' = berkemah di Tower of Mabel) atau { x, y }
    //   roam    : jarak keliaran dari kemah (px). Unit berjalan antar titik acak di dalamnya (jauh dari kemah), speed: kecepatan jalan (px/detik), radius: ukuran lingkaran (px)
    //   pack    : isi lingkaran = monster yang dihadapi di arena (1 atau banyak, jenis boleh campur)
    //   biome   : kunci CONFIG.battle.arenas (kosong = dari medan di titik unit)
    //   Dikalahkan -> unit hilang `respawnSec` detik untuk semua pemain, lalu muncul lagi di kemah.
    //   cycle   : { every, in }. Unit berkemah di objek yang punya interior (menara): tiap `every` leg perjalanan, satu leg menuju pintu menara; masuk,
    //             menunggu `in` detik di dalam (pemain yang masuk menara langsung bertemu mereka di Halaman = raid), lalu keluar lagi dan berkelana.
    //   aggro / chaseSpeed : bila player lebih dekat dari `aggro` (px) unit mengejar dengan `chaseSpeed` (px/detik); `chase: false` = tidak mengejar
    units: [
      { id: 'serigala1', name: 'Kawanan Serigala', home: 'tower', roam: 3200, speed: 48, radius: 15, pack: ['serigala', 'serigala', 'serigala'], respawnSec: 180, cycle: { every: 4, in: 70 } },
      { id: 'troll1',    name: 'Troll',            home: 'tower', roam: 1800, speed: 26, radius: 24, pack: ['troll'], respawnSec: 300, cycle: { every: 4, in: 90 }, aggro: 130 },
      { id: 'bayangan1', name: 'Bayangan',         home: 'tower', roam: 2600, speed: 38, radius: 16, pack: ['bayangan', 'bayangan'], respawnSec: 180, cycle: { every: 5, in: 80 } },
      { id: 'serigala2', name: 'Serigala',         home: { x: 17500, y: 16500 }, roam: 2800, speed: 48, radius: 15, pack: ['serigala', 'serigala'], respawnSec: 120 },
    ],
    // MODE TES: semua unit `cycle` (serigala1, troll1, bayangan1) mengitari menara dekat-dekat lalu masuk pintu BARENGAN tiap `period` detik (jam server, jadi semua pemain sama).
    // approach = detik jalan dari titik awal ke pintu, ring = jarak titik awal dari menara (px), stagger = jeda antar unit (detik; 0 = barengan). Set null untuk jadwal normal. Console: Battle.testInfo()
    testSync: null,
    fixedMargin: 50,           // bentrok dalam jarak segini (px dunia) dari tepi menara = di map Mabel; lebih jauh = arena acak sesuai medan (hutan)
    aggroRange: 170,           // jarak (px dunia) unit mulai mengejar player
    chaseSpeed: 52,            // kecepatan kejar (px/detik); player: ~60 di darat, ~36 di hutan, jadi bisa kabur di darat
    bumpCoolSec: 4,            // setelah kabur / menang, tabrakan baru dihitung lagi sekian detik kemudian

    // Raid Tower of Mabel berlangsung di SELURUH menara (Halaman, lantai 1, 2, Atap). Player tetap bisa pakai tangga / pintu selama battle.
    // Kabur = player keluar dari Halaman ke peta dunia (pintu "Keluar" di Halaman). Pindah lantai di dalam menara BUKAN kabur.
    fixedFleeButton: false,    // true = tombol "Kabur" instan di raid menara tetap ada (melewati aturan di atas)
    followFloors: true,        // monster yang sedang mengejar / dilukai pemain ikut naik-turun tangga ke lantai pemain itu (false = tetap di lantainya)
    transitCdSec: 2,           // jeda monster sebelum boleh lewat tangga lagi setelah pindah lantai
    raidCatchUpSec: 600,       // monster di menara terus hidup walau tidak ada pemain: tidak hilang / spawn ulang (sampai dikalahkan). Saat ada pemain masuk lagi, gerak mereka selama ditinggal (jalan-jalan, naik / turun tangga) dihitung ulang sampai sekian detik ke belakang
    leaveStaySec: [90, 300],   // unit yang berkemah di menara tinggal sekian detik (acak di rentang ini) lalu semua monsternya jalan ke pintu Keluar Halaman dan unit muncul lagi di peta gede (batal kalau lagi bertarung)
    wanderStairsChance: .15,   // peluang tiap monster yang jalan-jalan memilih pindah lantai lewat tangga (bukan titik biasa)

    // Senjata. Tiap senjata punya `slash` (tebas, ikon kipas) dan `thrust` (tusuk, ikon segi tajam).
    //   dmg, range (px), arc (derajat, hanya slash), width (px, hanya thrust), windup / recover (detik), kb (dorongan), lunge (maju saat tusuk), energy (biaya)
    weapons: {
      tangan: { name: 'Tangan kosong',
        // box: serangan berupa kotak di depan player. start = jarak awal dari titik tengah (tepi badan), range = panjang kotak, width = lebar
        // Tangan kosong hanya punya SATU serangan (tombol kipas / klik kiri / J). Tebas + tusuk khusus senjata seperti pisau; senjata tanpa `thrust` = tombol tusuk disembunyikan.
        slash:  { dmg: 5,  box: true, start: 22, range: 20, width: 36, windup: .1, recover: .35, kb: 45, energy: 1.2 } },
      pisau: { name: 'Pisau Dapur',
        slash:  { dmg: 10, range: 100, arc: 120, windup: .07, recover: .26, kb: 70, energy: 1.5 },
        thrust: { dmg: 19, range: 145, width: 34, windup: .16, recover: .48, kb: 30, lunge: 60, energy: 2.5 } },
    },

    // Monster (dikendalikan perangkat host). aggro = jarak (px arena) monster melihat & mulai mengejar; lebih jauh dari itu mereka berjalan-jalan
    // (kadang berkumpul, kadang mencar) sampai ada pemain yang dekat atau melukai mereka. Setelah mengejar, baru melepas target di 1,8x aggro.
    // (lihat juga baris di bawah) sprite opsional; tanpa sprite digambar bentuk bawaan.
    //   attacks: kind 'cone' | 'circle' | 'line' | 'dash'. circle = lingkaran di depan monster sejauh `off`. dash = melesat sepanjang `range`.
    monsters: {
      serigala: { name: 'Serigala', hp: 40, radius: 24, speed: 230, turn: 12, aggro: 600, color: '#7d8087', eye: '#ffd24a',
        attacks: [{ kind: 'cone', range: 70, arc: 80, windup: .35, active: .1, recover: .6, dmg: 8, kb: 60, cd: 1.0, reach: 60 }] },
      bayangan: { name: 'Bayangan', hp: 60, radius: 24, speed: 170, turn: 8, aggro: 600, color: '#3b2f55', eye: '#c9a8ff',
        attacks: [
          { kind: 'cone', range: 80, arc: 90, windup: .5, active: .1, recover: .7, dmg: 11, kb: 60, cd: 1.2, reach: 70 },
          { kind: 'dash', range: 330, w: 56, windup: .7, active: .25, recover: .9, dmg: 14, kb: 80, cd: 4, reach: 330, minReach: 140 } ] },
      troll: { name: 'Troll', hp: 400, radius: 62, speed: 85, turn: 2.2, aggro: 750, color: '#4d6b3a', eye: '#ff6b3d', boss: true,
        attacks: [
          { kind: 'circle', off: 110, radius: 120, windup: 1.0, active: .15, recover: 1.2, dmg: 28, kb: 140, cd: 2.5, reach: 170 },
          { kind: 'cone', range: 190, arc: 150, windup: .8, active: .15, recover: 1.0, dmg: 18, kb: 100, cd: 1.5, reach: 160 } ] },
    },

    // Kumpulan arena acak per medan. Tiap seed memilih salah satu template lalu menyebar rintangan. image/blocked opsional (kalau punya gambar sendiri).
    //   obstacles: [jenis, jumlah, radius min, radius max]. jenis 'tree' / 'rock' / 'pillar'
    arenas: {
      forest: {
        name: 'Hutan', ground: ['#2b3a22', '#33452a', '#26331e'],
        // template bergambar: image + skala (px arena per px gambar). poly = area yang bisa diinjak (px gambar), blocked = lingkaran rintangan [x, y, r] (px gambar),
        // spawn = titik muncul pemain, mspawn = pusat muncul monster. Tambah template lagi ke daftar ini = map hutan acak bertambah (dipilih dari seed).
        templates: [
          { id: 'kemah', name: 'Hutan Kemah', image: 'assets/images/battle/forest1.jpg', iw: 736, ih: 736, scale: 3,
            poly: [[205,215],[330,205],[420,235],[500,250],[560,300],[610,380],[620,480],[585,545],[500,575],[400,575],[300,590],[200,575],[150,540],[130,470],[160,400],[140,330],[170,265]],
            blocked: [[370, 345, 48]], spawn: [330, 520], mspawn: [420, 300] },
          // contoh template buatan (tanpa gambar): { id: 'lebat', name: 'Hutan Lebat', obstacles: [['tree', 46, 34, 52], ['rock', 8, 24, 40]] }
        ],
      },
    },
  },

  camera: {
    zoom: 1,                  // zoom awal
    minZoom: 0.5,             // zoom out maksimal
    maxZoom: 3,               // zoom in maksimal
    zoomStep: 1.1,            // kelipatan per scroll / tombol
  },

  // Fog of war: area di luar jarak pandang gelap.
  fog: {
    enabled: false,
    radiusKm: 5,              // jarak pandang (km), mata manusia normal ~4-5 km
    radius: 0,                // px, dihitung otomatis di bawah
    softness: 0.35,           // 0 = tepi tegas, 1 = pudar dari tengah
    color: '8,10,8',          // warna kabut (RGB)
    opacity: 1,               // 1 = di luar jarak pandang gelap total
  },

  marker: {
    color: '255,255,255',
  },

  // Sambungan Firebase Realtime Database (lihat js/online.js + js/firebase-config.js)
  // Vitals (lihat vitals.js). Laju per detik NYATA; game ter-pause saat inventory terbuka.
  vitals: {
    hungerPerMin: 1.0,        // kenyang -> habis dalam ~100 menit diam (lebih cepat kalau bergerak)
    thirstPerMin: 1.5,        // haus lebih cepat: ~67 menit
    activeMul: 1.5,           // pengali laju lapar / haus saat bergerak
    energyDrainPerSec: 0.04,  // energi turun saat berjalan (~42 menit jalan terus)
    energyRegenPerSec: 0.08,  // energi pulih saat diam (~21 menit)
    regenPerSec: 0.05,        // darah pulih kalau lapar & haus >= regenMin
    regenMin: 30,
    starveDmgPerSec: 0.15,    // darah berkurang kalau kelaparan habis
    dehydrateDmgPerSec: 0.2,  // ... dan kehausan habis
    lowEnergy: 20,            // di bawah ini jalan melambat
    minSpeedMul: 0.5,         // kecepatan jalan saat energi 0
  },

  online: {
    enabled: true,            // false = main offline murni (tanpa Firebase)
    connectTimeoutMs: 8000,   // lebih lama dari ini waktu mulai -> main offline
    presenceMs: 16,           // seberapa sering dicek (lokal) apakah posisi perlu dikirim; kirim hanya kalau perlu (dead reckoning)
    cellSize: 2400,           // ukuran area presence (px). Hanya area sendiri + 8 tetangga yang didownload (harus > setengah layar saat zoom out)
    saveDelayMs: 400,         // jeda simpan progress setelah inventory berubah
    positionSaveMs: 3000,     // simpan posisi tiap sekian ms (kalau berubah)
  },
};

// ===== NILAI TURUNAN (jangan diedit, ubah angka di atas) =====
// px/detik = km/jam * px/km / 3600 detik * timeScale
CONFIG.player.speed = CONFIG.player.speedKmh * SCALE.pxPerKm / 3600 * SCALE.timeScale;
CONFIG.fog.radius = CONFIG.fog.radiusKm * SCALE.pxPerKm;
