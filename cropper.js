// Square picture cropper: pinch / drag / scroll / slider to zoom and move.
// Whatever is inside the square becomes the treasure picture.
const Cropper = (() => {
  const MAX_SRC = 1600; // big library photos are scaled down first to keep things fast
  const $ = sel => document.querySelector(sel);

  let dialog, frame, src, slider;
  let F = 0, sw = 0, sh = 0;  // frame size, source size
  let s = 1, x = 0, y = 0;    // scale and top-left of the picture inside the frame
  let minS = 1, maxS = 1;
  let resolveFn = null;
  const pointers = new Map();
  let gesture = null;

  function init() {
    dialog = $('#cropper');
    frame = $('#crop-frame');
    src = $('#crop-src');
    slider = $('#crop-zoom');

    frame.addEventListener('pointerdown', e => {
      frame.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, pt(e));
      gesture = snapshot();
    });
    frame.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, pt(e));
      const now = snapshot();
      if (gesture && now.n === gesture.n) {
        if (now.n >= 2 && gesture.dist > 0) zoomAt(s * now.dist / gesture.dist, gesture.mx, gesture.my);
        x += now.mx - gesture.mx;
        y += now.my - gesture.my;
        render();
      }
      gesture = now;
    });
    const up = e => { pointers.delete(e.pointerId); gesture = snapshot(); };
    frame.addEventListener('pointerup', up);
    frame.addEventListener('pointercancel', up);
    frame.addEventListener('wheel', e => {
      e.preventDefault();
      const r = frame.getBoundingClientRect();
      zoomAt(s * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
      render();
    }, { passive: false });

    slider.addEventListener('input', () => {
      zoomAt(minS * Math.pow(maxS / minS, Number(slider.value)), F / 2, F / 2);
      render(false);
    });
    $('#crop-zoom-out').addEventListener('click', () => { zoomAt(s / 1.25, F / 2, F / 2); render(); });
    $('#crop-zoom-in').addEventListener('click', () => { zoomAt(s * 1.25, F / 2, F / 2); render(); });
    $('#crop-cancel').addEventListener('click', () => finish(null));
    $('#crop-ok').addEventListener('click', () => finish(output()));
    dialog.addEventListener('cancel', e => { e.preventDefault(); finish(null); });
  }

  const pt = e => {
    const r = frame.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // Centre and spread of the fingers currently down.
  function snapshot() {
    const ps = [...pointers.values()];
    const n = ps.length;
    if (!n) return null;
    const mx = ps.reduce((a, p) => a + p.x, 0) / n;
    const my = ps.reduce((a, p) => a + p.y, 0) / n;
    const dist = n >= 2 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0;
    return { n, mx, my, dist };
  }

  // Zoom to newS keeping the frame point (cx, cy) still.
  function zoomAt(newS, cx, cy) {
    newS = Math.max(minS, Math.min(maxS, newS));
    x = cx - (cx - x) * (newS / s);
    y = cy - (cy - y) * (newS / s);
    s = newS;
  }

  // Keep the picture covering the square; if it's smaller than the square, centre it.
  function clamp() {
    const w = sw * s, h = sh * s;
    x = w >= F ? Math.min(0, Math.max(F - w, x)) : (F - w) / 2;
    y = h >= F ? Math.min(0, Math.max(F - h, y)) : (F - h) / 2;
  }

  function render(updateSlider = true) {
    clamp();
    src.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    if (updateSlider) slider.value = String(Math.log(s / minS) / Math.log(maxS / minS || 2));
  }

  function output() {
    const out = document.createElement('canvas');
    out.width = out.height = outPx;
    const g = out.getContext('2d');
    const k = outPx / F;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, x * k, y * k, sw * s * k, sh * s * k);
    return out.toDataURL('image/png');
  }

  let outPx = 160;
  function crop(img, size) {
    outPx = size;
    const scale = Math.min(1, MAX_SRC / Math.max(img.naturalWidth, img.naturalHeight));
    sw = Math.round(img.naturalWidth * scale);
    sh = Math.round(img.naturalHeight * scale);
    src.width = sw;
    src.height = sh;
    src.style.width = sw + 'px';
    src.style.height = sh + 'px';
    const g = src.getContext('2d');
    g.clearRect(0, 0, sw, sh);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, sw, sh);

    pointers.clear();
    gesture = null;
    dialog.showModal();
    F = frame.clientWidth;
    minS = Math.min(F / sw, F / sh);          // whole picture fits
    const cover = Math.max(F / sw, F / sh);   // picture fills the square
    maxS = Math.max(cover * 8, minS * 2);
    s = cover;
    x = (F - sw * s) / 2;
    y = (F - sh * s) / 2;
    render();
    return new Promise(res => { resolveFn = res; });
  }

  function finish(result) {
    if (dialog.open) dialog.close();
    const r = resolveFn;
    resolveFn = null;
    if (r) r(result);
  }

  return { init, crop };
})();
