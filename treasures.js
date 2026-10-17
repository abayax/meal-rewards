// Treasure choices per food: a built-in emoji, or the parent's own picture
// (resized and saved only on this device, never uploaded anywhere).
const Treasures = (() => {
  const KEY = 'meal-treasure-treasures-v1';
  const PHOTO = 'photo';
  const PHOTO_PX = 160;
  const CHOICES = [
    '🪙', '💰', '🥇', '💎', '👑', '💍', '🔮', '🏅',
    '👸', '🧚', '🧜‍♀️', '🦄', '🏰', '🪄', '❄️', '⛄',
    '🐷', '🐶', '🐕', '🐾', '🐱', '🐰', '🦋', '🦖',
    '⭐', '🌟', '🌈', '🎈', '🍭', '🧁', '❤️', '🌸',
  ];

  let categories = [];
  let data = load(); // { choice: { carbs: '🪙' | 'photo' }, photos: { carbs: 'data:...' }, recent: ['🐉', ...] }
  let openKey = null;

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d) return { choice: d.choice || {}, photos: d.photos || {}, recent: d.recent || [] };
    } catch (e) {}
    return { choice: {}, photos: {}, recent: [] };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { alert('Sorry, there is not enough space on this device to save that picture.'); return false; }
  }

  const defaultOf = key => categories.find(c => c.key === key).gem;
  function current(key) {
    const ch = data.choice[key];
    if (ch === PHOTO && data.photos[key]) return { photo: data.photos[key] };
    return { emoji: ch && ch !== PHOTO ? ch : defaultOf(key) };
  }

  const esc = s => s.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

  // Markup for one treasure (used in piles and for the flying treasure).
  function html(key) {
    const t = current(key);
    return t.photo ? `<img src="${t.photo}" alt="" draggable="false">` : esc(t.emoji);
  }

  // First emoji (or, failing that, first visible character) of whatever was typed/pasted.
  function firstSymbol(text) {
    const parts = typeof Intl !== 'undefined' && Intl.Segmenter
      ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(s => s.segment)
      : Array.from(text);
    const visible = parts.filter(p => p.trim());
    return visible.find(p => /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(p)) || visible[0] || '';
  }

  // ---------- Resizing a picked picture ----------
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  // Let the parent zoom/pan the picture in a square; whatever is inside the square is kept.
  async function toSmallPicture(file) {
    const img = await loadImage(file);
    return Cropper.crop(img, PHOTO_PX);
  }

  // ---------- Settings picker ----------
  function buildPicker(container, onChange) {
    container.innerHTML = '';
    for (const c of categories) {
      const t = current(c.key);
      const row = document.createElement('div');
      row.className = 'tp' + (openKey === c.key ? ' open' : '');
      const photo = data.photos[c.key];
      const list = [...data.recent.filter(e => !CHOICES.includes(e)), ...CHOICES];
      if (t.emoji && !list.includes(t.emoji)) list.unshift(t.emoji);
      const chips = list.map(e =>
        `<button type="button" class="tp-chip${t.emoji === e ? ' on' : ''}" data-emoji="${esc(e)}">${esc(e)}</button>`).join('');
      row.innerHTML = `
        <div class="tp-head">
          <span>${c.emoji} ${c.label}</span>
          <button type="button" class="tp-current" aria-label="Change ${c.label} treasure">
            <span class="tp-preview">${html(c.key)}</span> Change
          </button>
        </div>
        <div class="tp-body">
          <div class="tp-grid">
            ${photo ? `<span class="tp-photo-wrap"><button type="button" class="tp-chip tp-photo${t.photo ? ' on' : ''}" data-photo="1"><img src="${photo}" alt="My picture"></button><button type="button" class="tp-remove" aria-label="Remove my picture">✕</button></span>` : ''}
            ${chips}
          </div>
          <div class="tp-type">
            <input type="text" class="tp-input" placeholder="Type any emoji 😀" autocomplete="off" enterkeyhint="done" aria-label="Type any emoji">
            <button type="button" class="tp-use">Use</button>
          </div>
          <button type="button" class="tp-upload">📷 ${photo ? 'Use a different picture' : 'Use my own picture'}</button>
          <input type="file" accept="image/*" hidden>
        </div>`;

      const choose = value => {
        data.choice[c.key] = value;
        if (save()) onChange();
        buildPicker(container, onChange);
      };
      row.querySelector('.tp-current').addEventListener('click', () => {
        openKey = openKey === c.key ? null : c.key;
        buildPicker(container, onChange);
      });
      row.querySelectorAll('[data-emoji]').forEach(b => b.addEventListener('click', () => choose(b.dataset.emoji)));
      const useTyped = () => {
        const sym = firstSymbol(row.querySelector('.tp-input').value);
        if (!sym) return;
        data.recent = [sym, ...data.recent.filter(x => x !== sym)].slice(0, 12);
        choose(sym);
      };
      row.querySelector('.tp-use').addEventListener('click', useTyped);
      row.querySelector('.tp-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); useTyped(); } // don't submit/close Settings
      });
      const photoBtn = row.querySelector('[data-photo]');
      if (photoBtn) photoBtn.addEventListener('click', () => choose(PHOTO));
      const removeBtn = row.querySelector('.tp-remove');
      if (removeBtn) removeBtn.addEventListener('click', () => {
        if (!confirm(`Remove your ${c.label} picture?`)) return;
        delete data.photos[c.key];
        if (data.choice[c.key] === PHOTO) delete data.choice[c.key];
        save();
        onChange();
        buildPicker(container, onChange);
      });
      const input = row.querySelector('input[type=file]');
      row.querySelector('.tp-upload').addEventListener('click', () => input.click());
      input.addEventListener('change', async () => {
        const file = input.files[0];
        input.value = '';
        if (!file) return;
        try {
          const before = data.photos[c.key];
          const picture = await toSmallPicture(file);
          if (!picture) return; // cancelled
          data.photos[c.key] = picture;
          data.choice[c.key] = PHOTO;
          if (!save()) { if (before) data.photos[c.key] = before; else delete data.photos[c.key]; }
          onChange();
        } catch (e) {
          alert("Sorry, that picture couldn't be opened. Try a different one (PNG or JPG work best).");
        }
        buildPicker(container, onChange);
      });
      container.appendChild(row);
    }
  }

  // ---------- Backup ----------
  function exportData() { return data; }
  function importData(d) {
    if (!d || typeof d !== 'object') return false;
    const photos = {};
    for (const [k, v] of Object.entries(d.photos || {})) {
      if (typeof v === 'string' && v.startsWith('data:image/')) photos[k] = v;
    }
    const choice = {};
    for (const [k, v] of Object.entries(d.choice || {})) {
      if (typeof v === 'string' && v.length <= 32) choice[k] = v;
    }
    const recent = Array.isArray(d.recent) ? d.recent.filter(v => typeof v === 'string' && v.length <= 32).slice(0, 12) : [];
    const prev = data;
    data = { choice, photos, recent };
    if (!save()) { data = prev; return false; }
    return true;
  }

  function init(cats) { categories = cats; }
  function resetPicker() { openKey = null; }

  return { init, html, buildPicker, resetPicker, exportData, importData };
})();
