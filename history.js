// Meal history: saved on this device, with a weekly summary, streaks, and export/import.
const MealHistory = (() => {
  const KEY = 'meal-treasure-history-v1';
  const DAY = 86400000;
  const RESULTS = {
    won:    { icon: '🏆', label: 'Finished',      color: '#2f9e57' },
    timeup: { icon: '🌧️', label: "Time's up",     color: '#c97d10' },
    ended:  { icon: '✋', label: 'Stopped early', color: '#7a6fd0' },
  };

  let categories = [];
  let hooks = {};
  let weekOffset = 0; // 0 = this week, -1 = last week, ...
  const $ = sel => document.querySelector(sel);

  // ---------- Storage ----------
  function all() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function store(meals) {
    meals.sort((a, b) => a.start - b.start);
    try { localStorage.setItem(KEY, JSON.stringify(meals)); } catch (e) {}
  }
  function add(meal) {
    const meals = all().filter(m => m.id !== meal.id);
    meals.push(meal);
    store(meals);
  }
  function remove(id) { store(all().filter(m => m.id !== id)); }

  // Consecutive finished meals, counting back from the most recent.
  function streaks(meals = all()) {
    let current = 0, best = 0, run = 0;
    for (const m of meals) {
      run = m.result === 'won' ? run + 1 : 0;
      best = Math.max(best, run);
    }
    for (let i = meals.length - 1; i >= 0 && meals[i].result === 'won'; i--) current++;
    return { current, best };
  }

  // ---------- Dates ----------
  function weekStart(offset) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7); // Monday
    return d;
  }
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtDay = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const fmtTime = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const fmtDur = sec => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
  const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

  function mealsInWeek(offset, meals = all()) {
    const s = weekStart(offset).getTime(), e = addDays(weekStart(offset), 7).getTime();
    return meals.filter(m => m.start >= s && m.start < e);
  }

  // ---------- UI ----------
  function open() {
    weekOffset = 0;
    render();
    $('#history').showModal();
    $('#history .hist-body').scrollTop = 0;
  }

  function render() {
    const meals = all();
    const week = mealsInWeek(weekOffset, meals);
    const start = weekStart(weekOffset);
    $('#hist-week').textContent = weekOffset === 0 ? 'This week'
      : weekOffset === -1 ? 'Last week'
      : `${fmtDay(start)} – ${fmtDay(addDays(start, 6))}`;
    $('#hist-next').disabled = weekOffset >= 0;
    $('#hist-prev').disabled = !meals.length || meals[0].start >= start.getTime();

    renderSummary(week, mealsInWeek(weekOffset - 1, meals), meals);
    renderChart(week, start);
    renderList(week);
  }

  function renderSummary(week, prevWeek, meals) {
    const won = week.filter(m => m.result === 'won').length;
    const avg = list => list.length ? list.reduce((s, m) => s + m.eatSec, 0) / list.length : 0;
    const avgSec = avg(week);
    const { current, best } = streaks(meals);

    let compare = '';
    if (week.length && prevWeek.length) {
      const diff = Math.round((avg(prevWeek) - avgSec) / 60);
      compare = diff > 0 ? `⚡ ${diff} min faster than the week before`
        : diff < 0 ? `🐢 ${-diff} min slower than the week before`
        : 'Same speed as the week before';
    }

    const totals = categories.map(c => {
      const n = week.reduce((s, m) => s + (m.foods[c.key] ? m.foods[c.key][0] : 0), 0);
      return `<span class="treasure-total">${c.emoji} <b>${n}</b></span>`;
    }).join('');

    $('#hist-summary').innerHTML = `
      <div class="stats">
        <div class="stat"><div class="stat-num">${week.length}</div><div class="stat-label">Meals</div></div>
        <div class="stat"><div class="stat-num">🏆 ${won}</div><div class="stat-label">Finished</div></div>
        <div class="stat"><div class="stat-num">${week.length ? Math.round(avgSec / 60) : '–'}</div><div class="stat-label">Avg minutes</div></div>
        <div class="stat"><div class="stat-num">🔥 ${current}</div><div class="stat-label">Streak now (best ${best})</div></div>
      </div>
      <div class="treasure-row">${totals}</div>
      ${compare ? `<div class="compare">${compare}</div>` : ''}`;
  }

  function renderChart(week, start) {
    const chart = $('#hist-chart');
    if (!week.length) { chart.innerHTML = ''; return; }
    const maxMin = Math.max(5, ...week.map(m => m.eatSec / 60));
    const top = Math.ceil(maxMin / 10) * 10;
    const grid = [top, top / 2, 0].map(v =>
      `<div class="grid-line" style="bottom:${(v / top) * 100}%"><span>${v}</span></div>`).join('');

    let cols = '';
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      const dayMeals = week.filter(m => sameDay(m.start, day));
      const bars = dayMeals.map(m => {
        const r = RESULTS[m.result];
        const h = Math.max(2, (m.eatSec / 60 / top) * 100);
        return `<button class="bar" data-id="${m.id}" style="height:${h}%;background:${r.color}"
          title="${fmtTime(m.start)} · ${fmtDur(m.eatSec)} · ${r.label}"
          aria-label="${fmtTime(m.start)}, ${Math.round(m.eatSec / 60)} minutes, ${r.label}"><span>${r.icon}</span></button>`;
      }).join('');
      const today = sameDay(day, Date.now()) ? ' today' : '';
      cols += `<div class="col${today}"><div class="bars">${bars}</div>
        <div class="col-label">${day.toLocaleDateString(undefined, { weekday: 'narrow' })}</div></div>`;
    }

    const legend = Object.values(RESULTS).map(r =>
      `<span><i style="background:${r.color}"></i>${r.icon} ${r.label}</span>`).join('');

    chart.innerHTML = `
      <div class="chart-title">Minutes eating</div>
      <div class="plot">${grid}<div class="cols">${cols}</div></div>
      <div class="legend">${legend}</div>`;

    chart.querySelectorAll('.bar').forEach(b => b.addEventListener('click', () => {
      const item = document.querySelector(`.meal[data-id="${b.dataset.id}"]`);
      if (!item) return;
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      item.classList.remove('flash');
      void item.offsetWidth;
      item.classList.add('flash');
    }));
  }

  function renderList(week) {
    const list = $('#hist-list');
    if (!week.length) {
      list.innerHTML = `<p class="empty">${weekOffset === 0
        ? 'No meals recorded this week yet.<br>Finish a meal and it will show up here! 🍽️'
        : 'No meals this week.'}</p>`;
      return;
    }
    let html = '';
    let lastDay = '';
    for (const m of [...week].reverse()) {
      const dayKey = new Date(m.start).toDateString();
      if (dayKey !== lastDay) {
        lastDay = dayKey;
        html += `<h4>${new Date(m.start).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h4>`;
      }
      const r = RESULTS[m.result];
      const foods = categories.filter(c => m.foods[c.key]).map(c => {
        const [got, target] = m.foods[c.key];
        return `<span class="${got >= target ? 'hit' : ''}">${c.emoji} ${got}/${target}</span>`;
      }).join('');
      const extra = m.extraMin ? ` (+${m.extraMin})` : '';
      html += `
        <div class="meal" data-id="${m.id}">
          <div class="meal-top">
            <span class="meal-time">${fmtTime(m.start)}</span>
            <span class="meal-result" style="--rc:${r.color}">${r.icon} ${r.label}</span>
            <span class="meal-dur">⏱ ${fmtDur(m.eatSec)} <small>of ${m.plannedMin}${extra} min</small></span>
            <button type="button" class="del" aria-label="Delete this meal">🗑</button>
          </div>
          <div class="meal-foods">${foods}</div>
        </div>`;
    }
    list.innerHTML = html;

    list.querySelectorAll('.meal').forEach(el => {
      el.querySelector('.del').addEventListener('click', () => {
        const start = Number(el.dataset.id);
        const when = `${new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${fmtTime(start)}`;
        if (confirm(`Delete the meal from ${when}?`)) { remove(start); render(); }
      });
    });
  }

  // ---------- Export / import ----------
  async function exportFile() {
    const extra = hooks.exportExtra ? hooks.exportExtra() : {};
    const data = JSON.stringify({ app: 'meal-treasure', version: 1, exported: new Date().toISOString(), meals: all(), ...extra });
    const name = `meal-history-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([data], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Meal history' }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async function importFile(file) {
    try {
      const data = JSON.parse(await file.text());
      const incoming = (Array.isArray(data) ? data : data.meals || [])
        .filter(m => m && typeof m.id === 'number' && typeof m.start === 'number' && RESULTS[m.result] && m.foods);
      const meals = all();
      const ids = new Set(meals.map(m => m.id));
      const fresh = incoming.filter(m => !ids.has(m.id));
      store(meals.concat(fresh));
      alert(`Imported ${fresh.length} meal${fresh.length === 1 ? '' : 's'}` +
            (incoming.length > fresh.length ? ` (${incoming.length - fresh.length} already here).` : '.'));
      render();
      if (hooks.importExtra && !Array.isArray(data)) hooks.importExtra(data);
    } catch (e) {
      alert("Sorry, that file doesn't look like a meal history export.");
    }
  }

  function init(cats, extraHooks = {}) {
    categories = cats;
    hooks = extraHooks;
    $('#hist-close').addEventListener('click', () => $('#history').close());
    $('#hist-prev').addEventListener('click', () => { weekOffset--; render(); });
    $('#hist-next').addEventListener('click', () => { weekOffset = Math.min(0, weekOffset + 1); render(); });
    $('#hist-export').addEventListener('click', exportFile);
    $('#hist-import').addEventListener('click', () => $('#hist-file').click());
    $('#hist-clear').addEventListener('click', () => {
      const n = all().length;
      if (!n) { alert('History is already empty.'); return; }
      if (confirm(`Delete ALL ${n} meal${n === 1 ? '' : 's'} from history on this device?\n\nTip: tap Cancel and Export a backup first if you might want them later.`)) {
        store([]);
        render();
      }
    });
    $('#hist-file').addEventListener('change', e => {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = '';
    });
    // Ask the browser not to clear our saved data when space runs low.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  return { init, open, add, all, streaks };
})();
