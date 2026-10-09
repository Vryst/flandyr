// Input klik / tap.
const Input = {
  init(canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      const p = Camera.toWorld(e.clientX, e.clientY);
      Player.moveTo(p.x, p.y);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },
};
