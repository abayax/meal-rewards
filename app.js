// Meal Treasure: game state, timer, and tap handling.
(() => {
  const CATEGORIES = [
    { key: 'carbs',   label: 'Carbs',   emoji: '🍚', gem: '🪙', c1: '#ffc163', c2: '#ff7b00' },
    { key: 'protein', label: 'Protein', emoji: '🍗', gem: '💎', c1: '#ff7a9a', c2: '#e0245e' },
    { key: 'milk',    label: 'Milk',    emoji: '🥛', gem: '⭐', c1: '#6fd0ff', c2: '#2a6fff' },
    { key: 'veggies', label: 'Veggies', emoji: '🥦', gem: '🍀', c1: '#8ee87b', c2: '#1f9e45' },
  ];
  const MINUTE_CHOICES = [10, 15, 20, 25, 30];
  const MAX_TARGET = 30;
  const STORE_KEY = 'meal-treasure-v1';

  const $ = sel => document.querySelector(sel);
  const board = $('#board');
  const btnStart = $('#btn-start');
  const clock = $('#clock');
  const barFill = $('#bar-fill');
  const gameEl = $('#game');

  // ---------- State ----------
  const defaults = {
    settings: {
      name: '',
      targets: { carbs: 5, protein: 4, milk: 3, veggies: 3 },
      minutes: 20,
      warn: true,
      sound: true,
    },
    game: freshGame(),
  };

  function freshGame() {
    return {
      status: 'ready', // ready | playing | paused | timeup | won | ended
      counts: { carbs: 0, protein: 0, milk: 0, veggies: 0 },
      done: [],
      endTime: 0,
      remaining: 0,
      total: 0,
      warned: false,
      startedAt: 0,
      extraMin: 0,
      recorded: false,
    };
  }

  let state = load();
  const inFlight = {}; // treasures still flying toward each pile

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved) {
        return {
          settings: { ...defaults.settings, ...saved.settings,
                      targets: { ...defaults.settings.targets, ...(saved.settings || {}).targets } },
          game: { ...freshGame(), ...saved.game },
        };
      }
    } catch (e) {}
    return structuredClone(defaults);
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  const S = () => state.settings;
  const G = () => state.game;
  const activeCats = () => CATEGORIES.filter(c => S().targets[c.key] > 0);

  // ---------- Board ----------
  function buildBoard() {
    board.innerHTML = '';
    const cats = activeCats();
    board.className = `count-${cats.length}`;
    for (const c of cats) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.key = c.key;
      tile.style.setProperty('--c1', c.c1);
      tile.style.setProperty('--c2', c.c2);
      tile.innerHTML = `
        <div class="tile-badge">⭐</div>
        <button class="undo" aria-label="Undo ${c.label}">−</button>
        <div class="tile-head"><span class="tile-emoji">${c.emoji}</span><span>${c.label}</span></div>
        <div class="pile"></div>
        <div class="tile-count"></div>`;
      tile.addEventListener('pointerdown', e => onTileTap(e, c));
      tile.querySelector('.undo').addEventListener('pointerdown', e => {
        e.stopPropagation();
        onUndo(c);
      });
      board.appendChild(tile);
    }
    renderAllTiles();
  }

  function renderAllTiles() {
    activeCats().forEach(c => renderTile(c));
  }

  function renderTile(c, landedIndex = -1) {
    const tile = board.querySelector(`[data-key="${c.key}"]`);
    if (!tile) return;
    const count = G().counts[c.key];
    const target = S().targets[c.key];
    const flying = inFlight[c.key] || 0;
    const slots = Math.max(count, target);
    const pile = tile.querySelector('.pile');

    const gemHTML = Treasures.html(c.key);
    let html = '';
    for (let i = 0; i < slots; i++) {
      const cls = i >= count ? 'empty' : i >= count - flying ? 'hidden' : i === landedIndex ? 'landed' : '';
      html += `<span class="gem ${cls}">${gemHTML}</span>`;
    }
    pile.innerHTML = html;
    pile.style.setProperty('--gem', fitGemSize(pile, slots) + 'px');

    tile.querySelector('.tile-count').textContent = `${count} / ${target}`;
    tile.classList.toggle('done', count >= target);
    tile.classList.toggle('locked', G().status !== 'playing');
    tile.querySelector('.undo').hidden = !(count > 0 && ['playing', 'paused'].includes(G().status));
  }

  // Largest gem size so that n gems fit inside the pile box. Starts from an estimate,
  // then checks the real layout and shrinks until every gem is fully inside.
  function fitGemSize(pile, n) {
    const w = pile.clientWidth;
    const h = pile.clientHeight - 8;
    if (!n || !w || h <= 0) return 32;
    const gap = 4;
    let size = 10;
    for (let s = Math.min(96, h / 1.2); s > 10; s -= 1) {
      const cols = Math.max(1, Math.floor((w + gap) / (s * 1.2 + gap)));
      if (Math.ceil(n / cols) * (s * 1.2 + gap) - gap <= h) { size = Math.floor(s); break; }
    }
    const gems = pile.children;
    // Layout offsets (not screen rects) so animations and tap-scaling don't skew the check.
    // With wrap-reverse, the first gem is in the bottom row and the last gem in the top row.
    const fits = () => {
      const top = pile.offsetTop, bottom = top + pile.offsetHeight;
      return [gems[0], gems[gems.length - 1]].every(g =>
        g.offsetTop >= top - 0.5 && g.offsetTop + g.offsetHeight <= bottom + 0.5);
    };
    pile.style.setProperty('--gem', size + 'px');
    while (size > 10 && !fits()) {
      size -= 2;
      pile.style.setProperty('--gem', size + 'px');
    }
    return size;
  }

  // ---------- Tapping ----------
  function onTileTap(e, c) {
    Sounds.unlock();
    const status = G().status;
    if (status !== 'playing') {
      if (status === 'ready' || status === 'paused') {
        const tile = e.currentTarget;
        tile.classList.remove('shake');
        void tile.offsetWidth;
        tile.classList.add('shake');
        Sounds.nope();
        toast(status === 'ready' ? 'Press Start first! ▶' : 'Paused — press Resume ▶');
      }
      return;
    }

    G().counts[c.key]++;
    save();
    Sounds.coin();
    inFlight[c.key] = (inFlight[c.key] || 0) + 1;
    renderTile(c);

    const tile = e.currentTarget;
    const index = G().counts[c.key] - 1;
    const slot = tile.querySelectorAll('.gem')[index];
    flyTreasure(c, e.clientX, e.clientY, slot, () => {
      inFlight[c.key] = Math.max(0, inFlight[c.key] - 1);
      renderTile(c, index);
      checkCategoryDone(c);
    });
  }

  function flyTreasure(c, x, y, slot, onLand) {
    const el = document.createElement('div');
    el.className = 'flyer';
    el.innerHTML = Treasures.html(c.key);
    const size = slot ? parseFloat(getComputedStyle(slot).fontSize) : 40;
    el.style.fontSize = size + 'px';
    document.body.appendChild(el);
    const fr = el.getBoundingClientRect();
    const r = slot ? slot.getBoundingClientRect() : { left: x, top: y, width: 0, height: 0 };

    const sx = x - fr.width / 2, sy = y - fr.height / 2;
    const tx = r.left + r.width / 2 - fr.width / 2, ty = r.top + r.height / 2 - fr.height / 2;
    const mx = (sx + tx) / 2, my = Math.min(sy, ty) - Math.max(60, Math.abs(ty - sy) * 0.4);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const anim = el.animate([
      { transform: `translate(${sx}px, ${sy}px) scale(2)` },
      { transform: `translate(${mx}px, ${my}px) scale(1.5) rotate(200deg)`, offset: 0.45 },
      { transform: `translate(${tx}px, ${ty}px) scale(1) rotate(360deg)` },
    ], { duration: reduced ? 150 : 650, easing: 'ease-in-out', fill: 'forwards' });
    anim.onfinish = () => { el.remove(); onLand(); };
  }

  function checkCategoryDone(c) {
    const g = G();
    if (g.counts[c.key] >= S().targets[c.key] && !g.done.includes(c.key)) {
      g.done.push(c.key);
      save();
      const tile = board.querySelector(`[data-key="${c.key}"]`);
      const r = tile.getBoundingClientRect();
      Effects.fireworks(r.left + r.width / 2, r.top + r.height * 0.4, [c.c1, c.c2]);
      Sounds.sparkle();
      checkWin();
    }
  }

  function onUndo(c) {
    const g = G();
    if (!['playing', 'paused'].includes(g.status) || g.counts[c.key] <= 0) return;
    if (inFlight[c.key]) return; // wait for the flying treasure to land first
    g.counts[c.key]--;
    if (g.counts[c.key] < S().targets[c.key]) g.done = g.done.filter(k => k !== c.key);
    save();
    Sounds.undo();
    renderTile(c);
  }

  function allDone() {
    const cats = activeCats();
    return cats.length > 0 && cats.every(c => G().counts[c.key] >= S().targets[c.key]);
  }

  function checkWin() {
    if (G().status !== 'playing' || !allDone()) return;
    const g = G();
    g.remaining = Math.max(0, g.endTime - Date.now());
    g.status = 'won';
    recordMeal('won');
    releaseWakeLock();
    renderAll();

    const name = S().name.trim();
    const streak = MealHistory.streaks().current;
    $('#win-title').textContent = name ? `You did it, ${name}!` : 'You did it!';
    $('#win-sub').textContent = (g.remaining > 0
      ? `All treasures collected with ${fmt(g.remaining)} to spare!`
      : 'All the treasures are yours!')
      + (streak >= 2 ? ` 🔥 ${streak} finished meals in a row!` : '');
    setTimeout(() => {
      if (G().status !== 'won') return;
      $('#win').hidden = false;
      Effects.celebrate(7);
      Sounds.fanfare();
    }, 700);
  }

  // ---------- Timer ----------
  function remainingMs() {
    const g = G();
    if (g.status === 'playing') return Math.max(0, g.endTime - Date.now());
    if (g.status === 'ready') return S().minutes * 60000;
    if (g.status === 'timeup') return 0;
    return g.remaining;
  }

  function fmt(ms) {
    const total = Math.ceil(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function renderClock() {
    const g = G();
    const ms = remainingMs();
    const icon = g.status === 'won' ? '🏆' : g.status === 'paused' ? '⏸' : '⏰';
    clock.textContent = `${icon} ${fmt(ms)}`;
    clock.classList.toggle('hurry', g.status === 'playing' && ms <= 60000);

    const total = g.status === 'ready' ? ms : g.total || 1;
    const frac = Math.max(0, Math.min(1, ms / total));
    barFill.style.width = (frac * 100) + '%';
    barFill.style.background = frac > 0.5 ? '#5be37d' : frac > 0.2 ? '#ffd34d' : '#ff5c5c';
  }

  function tick() {
    const g = G();
    if (g.status !== 'playing') return;
    const ms = g.endTime - Date.now();
    if (S().warn && !g.warned && g.total > 5 * 60000 && ms <= 5 * 60000 && ms > 0) {
      g.warned = true;
      save();
      Sounds.warn();
      toast('5 minutes left! ⏰');
    }
    if (ms <= 0) timeUp();
    renderClock();
  }
  setInterval(tick, 250);

  function timeUp() {
    G().status = 'timeup';
    save();
    renderAll();
    gameEl.classList.add('gloomy');
    Effects.startRain();
    Sounds.ring();
    setTimeout(() => { if (G().status === 'timeup') $('#timeup').hidden = false; }, 600);
  }

  function extend(minutes) {
    Sounds.unlock();
    Sounds.stopRing();
    Effects.stopRain();
    gameEl.classList.remove('gloomy');
    $('#timeup').hidden = true;
    const g = G();
    const add = minutes * 60000;
    g.status = 'playing';
    g.endTime = Date.now() + add;
    g.total += add;
    g.extraMin += minutes;
    save();
    Sounds.start();
    requestWakeLock();
    renderAll();
  }

  // ---------- Buttons ----------
  btnStart.addEventListener('click', () => {
    Sounds.unlock();
    const g = G();
    switch (g.status) {
      case 'ready': {
        if (!activeCats().length) { toast('Set some targets in ⚙️ first'); return; }
        g.status = 'playing';
        g.total = S().minutes * 60000;
        g.endTime = Date.now() + g.total;
        g.warned = false;
        g.startedAt = Date.now();
        g.extraMin = 0;
        Sounds.start();
        requestWakeLock();
        break;
      }
      case 'playing':
        g.remaining = Math.max(0, g.endTime - Date.now());
        g.status = 'paused';
        releaseWakeLock();
        break;
      case 'paused':
        g.endTime = Date.now() + g.remaining;
        g.status = 'playing';
        Sounds.start();
        requestWakeLock();
        break;
      default: // won / ended
        newMeal();
        return;
    }
    save();
    renderAll();
  });

  $('#btn-reset').addEventListener('click', () => {
    const g = G();
    const inProgress = ['playing', 'paused', 'timeup'].includes(g.status)
      && Object.values(g.counts).some(n => n > 0);
    if (inProgress && !confirm('Start a new meal? This clears the treasures.')) return;
    newMeal();
  });

  function newMeal() {
    const s = G().status;
    if (s === 'timeup') recordMeal('timeup');
    else if (s === 'playing' || s === 'paused') recordMeal('ended');
    Sounds.stopRing();
    Effects.stopRain();
    gameEl.classList.remove('gloomy');
    $('#timeup').hidden = true;
    $('#win').hidden = true;
    releaseWakeLock();
    for (const k in inFlight) inFlight[k] = 0;
    state.game = freshGame();
    save();
    renderAll();
  }

  $('#btn-win-ok').addEventListener('click', () => { $('#win').hidden = true; });

  document.querySelectorAll('[data-extend]').forEach(b =>
    b.addEventListener('click', () => extend(Number(b.dataset.extend))));

  $('#timeup').addEventListener('pointerdown', () => Sounds.stopRing());

  $('#btn-end').addEventListener('click', () => {
    Sounds.stopRing();
    Sounds.sad();
    Effects.stopRain();
    gameEl.classList.remove('gloomy');
    $('#timeup').hidden = true;
    recordMeal('timeup');
    G().status = 'ended';
    G().remaining = 0;
    save();
    releaseWakeLock();
    renderAll();
  });

  function renderControls() {
    const s = G().status;
    const labels = {
      ready: '▶ Start', playing: '⏸ Pause', paused: '▶ Resume',
      timeup: '⏰ Time’s up', won: '▶ New meal', ended: '▶ New meal',
    };
    btnStart.textContent = labels[s];
    btnStart.classList.toggle('go', s === 'ready' || s === 'paused');
    btnStart.classList.toggle('pause', s === 'playing');
  }

  function renderGreeting() {
    const name = S().name.trim();
    $('#greeting').textContent = name ? `${name}'s Treasure Meal` : 'Treasure Meal';
    const streak = MealHistory.streaks().current;
    const chip = $('#streak');
    chip.hidden = streak < 2;
    chip.textContent = `🔥 ${streak}`;
    chip.title = `${streak} finished meals in a row`;
  }

  // ---------- History ----------
  // Save the current meal to history (once). Meals stopped with no bites are skipped.
  function recordMeal(result) {
    const g = G();
    if (g.recorded || !g.startedAt) return;
    const bites = Object.values(g.counts).reduce((a, b) => a + b, 0);
    if (result === 'ended' && bites === 0) return;
    const left = result === 'timeup' ? 0
      : g.status === 'playing' ? Math.max(0, g.endTime - Date.now())
      : g.remaining;
    const foods = {};
    for (const c of activeCats()) foods[c.key] = [g.counts[c.key], S().targets[c.key]];
    MealHistory.add({
      id: g.startedAt,
      start: g.startedAt,
      end: Date.now(),
      eatSec: Math.round(Math.max(0, g.total - left) / 1000),
      plannedMin: Math.round((g.total / 60000) - g.extraMin),
      extraMin: g.extraMin,
      result,
      foods,
    });
    g.recorded = true;
    save();
  }

  $('#btn-history').addEventListener('click', () => MealHistory.open());
  $('#history').addEventListener('close', renderGreeting);

  function renderAll() {
    renderGreeting();
    renderControls();
    renderClock();
    renderAllTiles();
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  // ---------- Keep the screen awake ----------
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (e) {}
  }
  function releaseWakeLock() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      tick();
      if (['playing', 'timeup'].includes(G().status)) requestWakeLock();
    }
  });

  // ---------- Settings ----------
  const dialog = $('#settings');

  $('#btn-settings').addEventListener('click', () => {
    Sounds.unlock();
    buildSettings();
    dialog.showModal();
  });

  function buildSettings() {
    $('#set-name').value = S().name;
    $('#set-warn').checked = S().warn;
    $('#set-sound').checked = S().sound;

    const targets = $('#set-targets');
    targets.innerHTML = '';
    for (const c of CATEGORIES) {
      const row = document.createElement('div');
      row.className = 'stepper';
      row.innerHTML = `<span>${c.emoji} ${c.label}</span>
        <span class="ctrl"><button type="button" data-d="-1">−</button>
        <output>${S().targets[c.key]}</output>
        <button type="button" data-d="1">+</button></span>`;
      row.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        const v = Math.max(0, Math.min(MAX_TARGET, S().targets[c.key] + Number(b.dataset.d)));
        S().targets[c.key] = v;
        row.querySelector('output').textContent = v;
        onTargetsChanged();
      }));
      targets.appendChild(row);
    }
    renderMinuteChips();
    Treasures.resetPicker();
    Treasures.buildPicker($('#set-treasures'), renderAllTiles);
  }

  function renderMinuteChips() {
    const wrap = $('#set-minutes');
    wrap.innerHTML = '';
    for (const m of MINUTE_CHOICES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${m} min`;
      b.classList.toggle('on', S().minutes === m);
      b.addEventListener('click', () => setMinutes(m));
      wrap.appendChild(b);
    }
    $('#set-custom').value = MINUTE_CHOICES.includes(S().minutes) ? '' : S().minutes;
  }

  function setMinutes(m) {
    S().minutes = m;
    save();
    renderMinuteChips();
    renderClock();
  }

  $('#set-custom').addEventListener('change', e => {
    const m = Math.round(Number(e.target.value));
    if (m >= 1 && m <= 120) setMinutes(m);
  });
  $('#set-name').addEventListener('input', e => { S().name = e.target.value; save(); renderGreeting(); });
  $('#set-warn').addEventListener('change', e => { S().warn = e.target.checked; save(); });
  $('#set-sound').addEventListener('change', e => {
    S().sound = e.target.checked;
    Sounds.setEnabled(S().sound);
    save();
  });

  function onTargetsChanged() {
    const g = G();
    g.done = g.done.filter(k => g.counts[k] >= S().targets[k]);
    save();
    buildBoard();
  }

  dialog.addEventListener('close', () => {
    // Lowered targets may have just completed a category (or the whole meal).
    if (G().status === 'playing') {
      for (const c of activeCats()) {
        if (G().counts[c.key] >= S().targets[c.key] && !G().done.includes(c.key)) G().done.push(c.key);
      }
      save();
      checkWin();
    }
    renderAll();
  });

  // ---------- Start up ----------
  Treasures.init(CATEGORIES);
  MealHistory.init(CATEGORIES, {
    exportExtra: () => ({ treasures: Treasures.exportData() }),
    importExtra: data => {
      if (!data.treasures) return;
      if (confirm('This backup also has treasure choices (and any pictures). Use them on this device?')
          && Treasures.importData(data.treasures)) renderAllTiles();
    },
  });
  addEventListener('resize', () => renderAllTiles());
  Sounds.setEnabled(S().sound);
  buildBoard();
  renderAll();

  // Restore a meal that was in progress when the page was closed.
  if (G().status === 'playing' && G().endTime <= Date.now()) timeUp();
  else if (G().status === 'timeup') {
    gameEl.classList.add('gloomy');
    Effects.startRain();
    $('#timeup').hidden = false;
  } else if (G().status === 'playing') requestWakeLock();
})();
