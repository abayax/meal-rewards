// Canvas particle effects: fireworks, confetti, and rain.
const Effects = (() => {
  const canvas = document.getElementById('fx');
  const g = canvas.getContext('2d');
  let W = 0, H = 0;
  let particles = [];
  let drops = [];
  let raining = false;
  let running = false;
  let last = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize);
  resize();

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const RAINBOW = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff8fd8', '#ffffff'];

  function burst(x, y, colors = RAINBOW, count = 60) {
    const speed = Math.min(W, H) * 0.55;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(-0.1, 0.1);
      const v = speed * rand(0.4, 1);
      particles.push({
        kind: 'spark', x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: rand(0.9, 1.5), age: 0,
        color: pick(colors), size: rand(2, 4),
      });
    }
  }

  // A rocket that rises from the bottom and bursts at (tx, ty).
  function rocket(tx, ty, colors) {
    const sy = H + 10;
    const t = rand(0.5, 0.8);
    particles.push({
      kind: 'rocket', x: tx + rand(-40, 40), y: sy,
      tx, ty, vx: 0, vy: (ty - sy) / t,
      life: t, age: 0, colors, color: '#fff7c2', size: 3,
    });
  }

  function confetti(count = 120) {
    for (let i = 0; i < count; i++) {
      particles.push({
        kind: 'confetti', x: rand(0, W), y: rand(-H * 0.5, -10),
        vx: rand(-40, 40), vy: rand(120, 260),
        life: 8, age: 0, color: pick(RAINBOW),
        size: rand(6, 12), rot: rand(0, Math.PI), vr: rand(-6, 6),
      });
    }
  }

  function addDrop(initial) {
    drops.push({
      x: rand(-50, W + 50), y: initial ? rand(-H, H) : rand(-60, -10),
      v: rand(H * 0.9, H * 1.4), len: rand(12, 26),
    });
  }

  function step(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    g.clearRect(0, 0, W, H);

    // Rain
    if (drops.length) {
      g.strokeStyle = 'rgba(190, 210, 235, 0.65)';
      g.lineWidth = 2;
      g.lineCap = 'round';
      g.beginPath();
      for (const d of drops) {
        d.y += d.v * dt;
        d.x -= d.v * 0.12 * dt;
        g.moveTo(d.x, d.y);
        g.lineTo(d.x + d.len * 0.12, d.y - d.len);
        if (d.y > H + 30) {
          if (raining) { d.y = rand(-60, -10); d.x = rand(-50, W + 50); }
          else d.dead = true;
        }
      }
      g.stroke();
      drops = drops.filter(d => !d.dead);
    }

    // Fireworks & confetti
    const born = [];
    for (const p of particles) {
      p.age += dt;
      if (p.kind === 'spark') {
        p.vx *= 0.97; p.vy = p.vy * 0.97 + 220 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        g.globalAlpha = Math.max(0, 1 - p.age / p.life);
        g.fillStyle = p.color;
        g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill();
      } else if (p.kind === 'rocket') {
        p.y += p.vy * dt;
        p.x += (p.tx - p.x) * Math.min(1, dt * 4);
        g.globalAlpha = 1;
        g.fillStyle = p.color;
        g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill();
        if (p.age >= p.life) born.push(p);
      } else if (p.kind === 'confetti') {
        p.x += (p.vx + Math.sin(p.age * 3 + p.rot) * 30) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        g.globalAlpha = 1;
        g.save();
        g.translate(p.x, p.y); g.rotate(p.rot);
        g.fillStyle = p.color;
        g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * Math.abs(Math.cos(p.rot * 2)) + 1);
        g.restore();
        if (p.y > H + 20) p.age = p.life;
      }
    }
    g.globalAlpha = 1;
    particles = particles.filter(p => p.age < p.life);
    born.forEach(p => burst(p.x, p.y, p.colors));

    if (particles.length || drops.length) requestAnimationFrame(step);
    else running = false;
  }

  function kick() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(step);
  }

  return {
    // Fireworks over a point (e.g. a finished tile).
    fireworks(x, y, colors) {
      if (reduced) return;
      const c = colors ? [...colors, '#ffffff', '#ffe066'] : RAINBOW;
      burst(x, y, c, 70);
      setTimeout(() => { burst(x + rand(-60, 60), y + rand(-50, 20), c, 50); kick(); }, 300);
      setTimeout(() => { burst(x + rand(-60, 60), y + rand(-50, 20), c, 50); kick(); }, 600);
      kick();
    },

    // The huge "all done" show.
    celebrate(seconds = 6) {
      if (reduced) { confetti(60); kick(); return; }
      confetti(160);
      const end = performance.now() + seconds * 1000;
      const launch = () => {
        if (performance.now() > end) return;
        for (let i = 0; i < 2; i++) rocket(rand(W * 0.1, W * 0.9), rand(H * 0.1, H * 0.45), RAINBOW);
        kick();
        setTimeout(launch, rand(250, 450));
      };
      launch();
      setTimeout(() => { confetti(120); kick(); }, 2000);
      kick();
    },

    startRain() {
      raining = true;
      const n = reduced ? 40 : Math.round(Math.min(220, W * H / 4500));
      while (drops.length < n) addDrop(true);
      kick();
    },

    stopRain() { raining = false; },
  };
})();
