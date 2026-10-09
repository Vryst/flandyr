// Entry point: setup canvas, load asset, jalankan game loop.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const coordsEl = document.getElementById('coords');

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function update(dt) {
  Player.update(dt);
  Camera.update(Player);
  coordsEl.textContent = `x: ${Math.round(Player.x)}, y: ${Math.round(Player.y)}`;
}

function draw() {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.save();
  ctx.scale(Camera.zoom, Camera.zoom);
  ctx.translate(-Camera.x, -Camera.y);
  World.draw(ctx);
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
  Input.init(canvas);

  // load asset kalau path-nya diisi di config.js
  const list = {};
  if (CONFIG.player.sprite) list.player = CONFIG.player.sprite;
  if (CONFIG.world.backgroundImage) list.map = CONFIG.world.backgroundImage;
  await Assets.load(list);

  requestAnimationFrame(loop);
}

start();
