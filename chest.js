// Treasure chest celebration for great-meal streaks (medium at 3, big every full week).
const Chest = (() => {
  const $ = sel => document.querySelector(sel);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let opened = false;
  let autoOpen = null;
  let opts = null;
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  const SVG = `
  <svg class="chest-svg" viewBox="0 0 240 200" aria-hidden="true">
    <defs>
      <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#c0702a"/><stop offset="1" stop-color="#7a3e12"/>
      </linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff0a0"/><stop offset=".5" stop-color="#ffcc33"/><stop offset="1" stop-color="#d99a00"/>
      </linearGradient>
      <radialGradient id="shine" cx="50%" cy="100%" r="80%">
        <stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="#ffd84d"/><stop offset="1" stop-color="#ff9f1c" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="120" cy="192" rx="100" ry="8" fill="rgba(0,0,0,.3)"/>
    <!-- inside of the chest, visible once the lid lifts -->
    <path class="chest-inside" d="M36 102 L204 102 L194 80 L46 80 Z" fill="#3a1c08"/>
    <ellipse class="chest-light" cx="120" cy="92" rx="80" ry="22" fill="url(#shine)"/>
    <!-- base -->
    <rect x="30" y="100" width="180" height="90" rx="10" fill="url(#wood)"/>
    <path d="M30 130 H210 M30 160 H210" stroke="#6a3410" stroke-width="2" opacity=".6"/>
    <rect x="30" y="100" width="180" height="12" fill="url(#gold)"/>
    <rect x="30" y="178" width="180" height="12" rx="6" fill="url(#gold)"/>
    <rect x="52" y="100" width="14" height="90" fill="url(#gold)"/>
    <rect x="174" y="100" width="14" height="90" fill="url(#gold)"/>
    <rect x="102" y="104" width="36" height="40" rx="7" fill="url(#gold)" stroke="#b07a00" stroke-width="2"/>
    <circle cx="120" cy="119" r="5" fill="#3a1c08"/><rect x="117.5" y="120" width="5" height="14" rx="2" fill="#3a1c08"/>
    <!-- lid -->
    <g class="chest-lid">
      <path d="M30 101 L30 72 Q120 22 210 72 L210 101 Z" fill="url(#wood)"/>
      <path d="M30 74 Q120 24 210 74" stroke="url(#gold)" stroke-width="10" fill="none"/>
      <path d="M59 101 V56 M181 101 V56" stroke="url(#gold)" stroke-width="14"/>
      <rect x="30" y="91" width="180" height="11" fill="url(#gold)"/>
      <rect x="108" y="84" width="24" height="20" rx="5" fill="url(#gold)" stroke="#b07a00" stroke-width="2"/>
    </g>
  </svg>`;

  // opts: { level: 'medium' | 'big', streak, name, spare, treasures: [html], onClose }
  function show(o) {
    opts = o;
    opened = false;
    const big = o.level === 'big';
    const el = $('#chest');
    el.className = `overlay chest-overlay ${o.level}`;
    $('#chest-box').innerHTML = SVG;
    $('#chest-title').textContent = `🔥 ${o.streak} great meals in a row!`;
    $('#chest-hint').hidden = false;
    $('#chest-msg').hidden = true;
    el.hidden = false;
    Sounds.warn();
    if (big) Effects.fireworks(innerWidth / 2, innerHeight * 0.25);
    clearTimeout(autoOpen);
    autoOpen = setTimeout(open, 4500);
  }

  function open() {
    if (opened || !opts) return;
    opened = true;
    clearTimeout(autoOpen);
    const big = opts.level === 'big';
    const el = $('#chest');
    el.classList.add('open');
    $('#chest-hint').hidden = true;

    Sounds.chestOpen();
    later(() => (big ? Sounds.bigFanfare() : Sounds.fanfare()), 450);
    Effects.celebrate(big ? 12 : 5);

    const weeks = opts.streak / 7;
    const who = opts.name ? `${opts.name}, you` : 'You';
    $('#chest-msg-title').textContent = big
      ? (weeks === 1 ? 'A WHOLE WEEK! 👑' : `${weeks} WHOLE WEEKS! 👑`)
      : 'Treasure chest! 🎉';
    $('#chest-msg-sub').textContent = big
      ? `${who} ate ${opts.streak} great meals in a row. Super Eater!`
      : `${who} ate ${opts.streak} great meals in a row!`;
    $('#chest-msg-spare').textContent = opts.spare ? `Finished with ${opts.spare} to spare.` : '';
    later(() => { $('#chest-msg').hidden = false; }, 700);

    burst(big ? 34 : 16);
    if (big) {
      later(() => burst(24), 1300);
      later(() => burst(24), 2600);
    }
  }

  // Treasures pour out of the chest and tumble down.
  function burst(count) {
    if (reduced || !opts) return;
    const box = $('#chest-box').getBoundingClientRect();
    const ox = box.left + box.width / 2;
    const oy = box.top + box.height * 0.42;
    const pool = [...opts.treasures, '🪙', '💎', '⭐', '🪙'];
    const size = Math.max(28, Math.min(64, box.width * 0.16));
    for (let i = 0; i < count; i++) {
      const t = document.createElement('div');
      t.className = 'chest-item';
      t.innerHTML = pool[i % pool.length];
      t.style.fontSize = size * (0.7 + Math.random() * 0.5) + 'px';
      document.body.appendChild(t);
      const dx = (Math.random() - 0.5) * innerWidth * 0.9;
      const up = innerHeight * (0.25 + Math.random() * 0.3);
      const dur = 1600 + Math.random() * 1200;
      const spin = (Math.random() - 0.5) * 720;
      const a = t.animate([
        { transform: `translate(${ox}px, ${oy}px) translate(-50%, -50%) scale(.3)`, opacity: 1 },
        { transform: `translate(${ox + dx * 0.6}px, ${oy - up}px) translate(-50%, -50%) scale(1) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${ox + dx}px, ${innerHeight + 80}px) translate(-50%, -50%) scale(1) rotate(${spin}deg)`, opacity: 1 },
      ], { duration: dur, delay: Math.random() * 400, easing: 'cubic-bezier(.2,.6,.5,1)', fill: 'both' });
      a.onfinish = () => t.remove();
    }
  }

  function close() {
    clearTimeout(autoOpen);
    timers.forEach(clearTimeout);
    timers = [];
    $('#chest').hidden = true;
    const done = opts && opts.onClose;
    opts = null;
    if (done) done();
  }

  function init() {
    $('#chest-box').addEventListener('click', () => { Sounds.unlock(); open(); });
    $('#chest-hint').addEventListener('click', () => { Sounds.unlock(); open(); });
    $('#chest-ok').addEventListener('click', close);
  }

  return { init, show };
})();
