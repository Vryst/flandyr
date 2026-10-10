// Entry point: setup canvas, load asset, jalankan game loop.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function update(dt) {
  let coord;
  if (Interior.active) {
    Interior.update(dt);
    Interact.update();
    coord = '';
  } else {
    Player.update(dt);
    Camera.update(Player);
    Interact.update();
    coord = `x: ${Math.round(Player.x)}, y: ${Math.round(Player.y)} · ${Terrain.info(Player.x, Player.y).name}`;
  }
  Hud.set(coord, Interact.place);   // mis. "x: 17990, y: 18010 · Hutan" + "· Tower of Mabel" (animasi)
}

function draw() {
  if (Interior.active) { Interior.draw(ctx); return; }
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.save();
  ctx.scale(Camera.zoom, Camera.zoom);
  ctx.translate(-Camera.x, -Camera.y);
  World.draw(ctx);
  Objects.draw(ctx);
  Player.drawMarker(ctx);
  Player.draw(ctx);
  ctx.restore();

  Fog.draw(ctx);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

async function start() {
  resize();
  window.addEventListener('resize', resize);
  Terrain.init();
  Interior.init();
  Hud.init();
  Input.init(canvas);

  // load asset kalau path-nya diisi di config.js
  const list = {};
  if (CONFIG.player.sprite) list.player = CONFIG.player.sprite;
  if (CONFIG.world.backgroundImage) list.map = CONFIG.world.backgroundImage;
  Object.assign(list, Objects.assetList(), Interior.assetList());
  await Assets.load(list);

  requestAnimationFrame(loop);
}

start();
