/*
 * app.js — UI controller for Nuancera.
 * Ties together i18n (I18N), color-utils (CE), vision (Vision), cluster
 * (Cluster), exporters (Exporters), pdf-extract (PDFExtract), the preset
 * library (window.PRESETS) and the persistent saved library (window.api).
 */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const t = (k, v) => I18N.t(k, v);
  const LANG_KEY = 'nuancera.lang';

  const state = {
    current: CE.hexToRgb('#1b3a5c'),
    palette: ['#1b3a5c', '#2f6b7e', '#5a8a8c', '#9aa7a0', '#c99a4e']
      .map((hex) => ({ hex, locked: false })),
    presets: (window.PRESETS && window.PRESETS.palettes) || [],
    filters: { type: 'all', mood: 'all', cb: 'all' },
    saved: [],
    colors: [],
    journals: [],
    pendingSave: null,
    extracted: null,
    view: 'build'
  };
  const currentHex = () => CE.rgbToHex(state.current.r, state.current.g, state.current.b);

  // ---- utilities ----------------------------------------------------------
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), 1500);
  }
  function copy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (_) {}
    toast(t('toast.copied', { v: text }));
  }
  function cbBadge(verdict) {
    if (!verdict || verdict === 'n/a') return '';
    return `<span class="badge ${verdict}">${t('cb.' + verdict)}</span>`;
  }
  const paletteHexes = () => state.palette.map((p) => p.hex);
  const isStarred = (hex) => state.colors.some((c) => c.hex === CE.normalizeHex(hex));
  const textHexOn = (hex) => { const x = CE.bestTextOn(CE.hexToRgb(hex)); return CE.rgbToHex(x.r, x.g, x.b); };

  // ---- view switching -----------------------------------------------------
  function showView(name) {
    state.view = name;
    $$('.view').forEach((v) => v.classList.add('hidden'));
    $('#view-' + name).classList.remove('hidden');
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'build') { $('#colorInput').value = currentHex(); }
    if (name === 'presets') renderPresets();
    if (name === 'suggest') { $('#suggestInput').value = currentHex(); $('#suggestPicker').value = currentHex(); renderSuggest(); }
    if (name === 'journals') renderJournals();
    if (name === 'colors') renderColorLibrary();
    if (name === 'library') renderSaved();
    if (name === 'guide') renderGuide();
  }

  // ---- color input panel --------------------------------------------------
  function renderColorPanel(rgb) {
    state.current = rgb;
    const d = CE.describe(rgb);
    $('#bigSwatch').style.background = d.hex;
    const items = [['HEX', d.hex], ['RGB', d.rgbString], ['HSL', d.hslString], ['CMYK', d.cmykString]];
    $('#codeList').innerHTML = items
      .map(([k, v]) => `<div class="code-item" data-copy="${v}"><span class="k">${k}</span><span class="v">${v}</span></div>`)
      .join('');
    $$('#codeList .code-item').forEach((el) => el.addEventListener('click', () => copy(el.dataset.copy)));
    $('#colorPicker').value = d.hex;
  }
  // Keep the Suggestions base color in sync with the active color.
  function syncSuggestInputs() {
    const hex = currentHex();
    const si = $('#suggestInput'), sp = $('#suggestPicker');
    if (si) si.value = hex; if (sp) sp.value = hex;
  }
  function wireColorInput() {
    const input = $('#colorInput');
    const picker = $('#colorPicker');
    input.addEventListener('input', () => { const rgb = CE.parseColor(input.value); if (rgb) { renderColorPanel(rgb); syncSuggestInputs(); } });
    picker.addEventListener('input', () => { input.value = picker.value; renderColorPanel(CE.hexToRgb(picker.value)); syncSuggestInputs(); });
    $('#addToPalette').addEventListener('click', () => {
      if (state.palette.length >= 8) return toast(t('toast.full'));
      state.palette.push({ hex: CE.rgbToHex(state.current.r, state.current.g, state.current.b), locked: false });
      renderPalette();
    });
    $('#saveColorBtn').addEventListener('click', () => addColorToLibrary(CE.rgbToHex(state.current.r, state.current.g, state.current.b)));
  }

  // ---- working palette ----------------------------------------------------
  function renderPalette() {
    const strip = $('#swatchStrip');
    strip.innerHTML = '';
    state.palette.forEach((sw, idx) => {
      const d = CE.describe(CE.hexToRgb(sw.hex));
      const starred = isStarred(sw.hex);
      const el = document.createElement('div');
      el.className = 'swatch' + (sw.locked ? ' locked' : '');
      el.setAttribute('draggable', 'true');
      el.dataset.idx = idx;
      el.innerHTML =
        `<div class="chip" style="background:${d.hex}" title="${d.hex}">
           <span class="star ${starred ? 'on' : ''}" title="${t('sw.star')}">${starred ? '★' : '☆'}</span>
           <span class="lock">${sw.locked ? '🔒' : '🔓'}</span>
         </div>
         <div class="meta">
           <div class="hexcode">${d.hex}</div>
           <div class="rgbcode">${d.rgbString}</div>
           <div class="swatch-tools">
             <button data-act="lock">${sw.locked ? t('sw.unlock') : t('sw.lock')}</button>
             <button data-act="del">${t('sw.delete')}</button>
           </div>
         </div>`;
      $('.star', el).addEventListener('click', (e) => { e.stopPropagation(); toggleStar(sw.hex); });
      $('.chip', el).addEventListener('click', () => copy(d.hex));
      $('.hexcode', el).addEventListener('click', () => copy(d.hex));
      $('[data-act="lock"]', el).addEventListener('click', () => { state.palette[idx].locked = !state.palette[idx].locked; renderPalette(); });
      $('[data-act="del"]', el).addEventListener('click', () => {
        if (state.palette.length <= 1) return toast(t('toast.keepOne'));
        state.palette.splice(idx, 1); renderPalette();
      });
      el.addEventListener('dragstart', (e) => { el.classList.add('dragging'); e.dataTransfer.setData('text/plain', String(idx)); });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
      el.addEventListener('dragover', (e) => e.preventDefault());
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(from) || from === idx) return;
        const [moved] = state.palette.splice(from, 1);
        state.palette.splice(idx, 0, moved);
        renderPalette();
      });
      strip.appendChild(el);
    });

    $('#paletteCount').textContent = `(${state.palette.length}/8)`;
    $('#addSwatchBtn').disabled = state.palette.length >= 8;
    const assess = Vision.assessPalette(paletteHexes());
    $('#paletteMeta').innerHTML = `${cbBadge(assess.verdict)} <span>${assess.verdict === 'n/a' ? '' : t('note.' + assess.verdict)}</span>`;
    renderMocks(paletteHexes());
  }
  function wirePaletteControls() {
    $('#addSwatchBtn').addEventListener('click', () => { if (state.palette.length >= 8) return; state.palette.push({ hex: '#9aa7a0', locked: false }); renderPalette(); });
    $('#clearPaletteBtn').addEventListener('click', () => {
      const kept = state.palette.filter((p) => p.locked);
      state.palette = kept.length ? kept : [{ hex: '#1b3a5c', locked: false }];
      renderPalette(); toast(t('toast.cleared'));
    });
    $$('[data-export]').forEach((btn) => btn.addEventListener('click', () => doExport(btn.dataset.export)));
    $('#saveWorkingBtn').addEventListener('click', () => openSaveModal(paletteHexes(), ''));
  }

  // ---- mock previews ------------------------------------------------------
  function renderMocks(colors) {
    const c = (i) => colors[i % colors.length];
    const heights = [54, 88, 40, 102, 70, 120];
    const bars = heights.map((h, i) => `<rect x="${18 + i * 34}" y="${130 - h}" width="22" height="${h}" rx="2" fill="${c(i)}"/>`).join('');
    $('#mockBar').innerHTML = `<svg viewBox="0 0 240 140"><line x1="14" y1="130" x2="226" y2="130" stroke="#d8d3c8"/>${bars}</svg>`;
    const series = [[20, 60, 35, 80, 55, 95, 70], [40, 30, 70, 50, 90, 65, 110], [10, 45, 25, 60, 40, 75, 50]];
    const xstep = 200 / (series[0].length - 1);
    const lines = series.map((s, si) => {
      const pts = s.map((y, i) => `${18 + i * xstep},${130 - y}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${c(si)}" stroke-width="2.5"/>` +
        s.map((y, i) => `<circle cx="${18 + i * xstep}" cy="${130 - y}" r="2.5" fill="${c(si)}"/>`).join('');
    }).join('');
    $('#mockLine').innerHTML = `<svg viewBox="0 0 240 140"><line x1="14" y1="130" x2="226" y2="130" stroke="#d8d3c8"/><line x1="14" y1="14" x2="14" y2="130" stroke="#d8d3c8"/>${lines}</svg>`;
    const txtHex = textHexOn(c(0));
    $('#mockSlide').innerHTML =
      `<svg viewBox="0 0 240 140">
         <rect x="0" y="0" width="240" height="140" rx="6" fill="${c(0)}"/>
         <rect x="20" y="44" width="46" height="5" rx="2.5" fill="${c(1)}"/>
         <text x="20" y="74" font-family="-apple-system, Helvetica, Arial" font-size="17" font-weight="700" fill="${txtHex}">${t('slide.title')}</text>
         <text x="20" y="96" font-family="-apple-system, Helvetica, Arial" font-size="10" fill="${txtHex}" opacity="0.85">${t('slide.caption')}</text>
       </svg>`;
  }

  // ---- exports ------------------------------------------------------------
  async function doExport(kind) {
    const hexes = paletteHexes();
    if (kind === 'hex') await window.api.exportText('palette.txt', Exporters.toHexList(hexes));
    else if (kind === 'json') await window.api.exportText('palette.json', Exporters.toJSON(hexes, { name: 'Nuancera' }));
    else if (kind === 'gpl') await window.api.exportText('palette.gpl', Exporters.toGPL(hexes, 'Nuancera'));
    else if (kind === 'ase') await window.api.exportBinary('palette.ase', Exporters.bytesToB64(Exporters.toASE(hexes, 'Nuancera')));
    else if (kind === 'png') await window.api.exportBinary('palette.png', renderSwatchSheetPNG(hexes));
    toast(t('toast.exportReady'));
  }
  function renderSwatchSheetPNG(hexes) {
    const sw = 200, gap = 16, pad = 40, labelH = 46;
    const cols = Math.min(hexes.length, 4), rows = Math.ceil(hexes.length / cols);
    const W = pad * 2 + cols * sw + (cols - 1) * gap;
    const H = pad * 2 + 30 + rows * (sw + labelH) + (rows - 1) * gap;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1f242b'; ctx.font = '600 22px -apple-system, Helvetica, Arial';
    ctx.fillText('Nuancera', pad, pad + 6);
    hexes.forEach((hex, i) => {
      const r = Math.floor(i / cols), cI = i % cols;
      const x = pad + cI * (sw + gap), y = pad + 30 + r * (sw + labelH + gap);
      ctx.fillStyle = hex; ctx.fillRect(x, y, sw, sw);
      ctx.strokeStyle = '#e7e3db'; ctx.strokeRect(x + 0.5, y + 0.5, sw, sw);
      const rgb = CE.hexToRgb(hex);
      ctx.fillStyle = '#1f242b'; ctx.font = '600 16px -apple-system, Helvetica, Arial';
      ctx.fillText(hex.toUpperCase(), x, y + sw + 22);
      ctx.fillStyle = '#5c636d'; ctx.font = '13px -apple-system, Helvetica, Arial';
      ctx.fillText(`${rgb.r}, ${rgb.g}, ${rgb.b}`, x, y + sw + 40);
    });
    return cv.toDataURL('image/png').split(',')[1];
  }

  // ---- presets ------------------------------------------------------------
  function renderPresets() {
    const list = $('#presetList'); const f = state.filters;
    const items = state.presets.filter((p) => {
      if (f.type !== 'all' && p.type !== f.type) return false;
      if (f.mood !== 'all' && !(p.moods || []).includes(f.mood)) return false;
      if (f.cb === 'safe' && p.colorblind !== 'safe') return false;
      return true;
    });
    list.innerHTML = items.map((p) => `
      <div class="preset" data-id="${p.id}">
        <div class="pname">${p.name} ${cbBadge(p.colorblind)}</div>
        <div class="strip">${p.colors.map((c) => `<span style="background:${c}"></span>`).join('')}</div>
        <div class="pfoot"><span class="ptype">${t('type.' + p.type)}</span><span>${p.source}</span></div>
      </div>`).join('');
    $$('.preset', list).forEach((el) => el.addEventListener('click', () => {
      const p = state.presets.find((x) => x.id === el.dataset.id);
      loadIntoBuild(p.colors); toast(t('toast.loadedName', { name: p.name }));
    }));
  }
  function wirePresetFilters() {
    $$('#presetFilters .filter-group').forEach((group) => {
      const key = group.dataset.group;
      $$('.chip', group).forEach((chip) => chip.addEventListener('click', () => {
        $$('.chip', group).forEach((c) => c.classList.remove('active'));
        chip.classList.add('active'); state.filters[key] = chip.dataset.val; renderPresets();
      }));
    });
  }
  function loadIntoBuild(colors) {
    state.palette = colors.slice(0, 8).map((hex) => ({ hex: CE.normalizeHex(hex) || hex, locked: false }));
    renderPalette(); showView('build');
  }

  // ---- suggestions engine -------------------------------------------------
  // Ordered scheme list shown under "All", plus their title/description keys.
  const SCHEMES = ['analogous', 'complementary', 'split', 'triadic', 'tetradic', 'square', 'mono', 'shades', 'similar'];
  const SCHEME_META = {
    analogous: { tk: 'h.analogous.t', dk: 'h.analogous.d' },
    complementary: { tk: 'h.complementary.t', dk: 'h.complementary.d' },
    split: { tk: 'h.split.t', dk: 'h.split.d' },
    triadic: { tk: 'h.triadic.t', dk: 'h.triadic.d' },
    tetradic: { tk: 'h.tetradic.t', dk: 'h.tetradic.d' },
    square: { tk: 'h.square.t', dk: 'h.square.d' },
    mono: { tk: 'h.mono.t', dk: 'h.mono.d' },
    shades: { tk: 'h.shades.t', dk: 'h.shades.d' },
    similar: { tk: 'h.similar.t', dk: 'h.similar.d' }
  };
  function schemeColors(key, base) {
    switch (key) {
      case 'analogous': return CE.harmony(base, 'analogous');
      case 'complementary': return CE.harmony(base, 'complementary');
      case 'split': return CE.harmony(base, 'split-complementary');
      case 'triadic': return CE.harmony(base, 'triadic');
      case 'tetradic': return CE.harmony(base, 'tetradic');
      case 'square': return CE.harmony(base, 'square');
      case 'mono': return CE.harmony(base, 'monochromatic');
      case 'shades': return CE.shades(base, 10);
      case 'similar': return CE.similar(base, 6);
      default: return [];
    }
  }
  // Accessibility panel: this color as text on white/black, with a 1–5 score.
  function a11yCard(base) {
    const a = CE.accessibility(base);
    if (!a) return '';
    const stars = (s) => '★'.repeat(s) + '☆'.repeat(5 - s);
    const label = (s) => (s <= 2 ? t('a11y.poor') : (s <= 4 ? t('a11y.good') : t('a11y.perfect')));
    const cls = (s) => (s <= 2 ? 'risky' : (s <= 4 ? 'caution' : 'safe'));
    const row = (lbl, o) =>
      `<div class="a11y-row"><span class="a11y-k">${lbl}</span><span class="a11y-ratio">${o.ratio}:1</span>` +
      `<span class="a11y-stars">${stars(o.score)}</span><span class="badge ${cls(o.score)}">${label(o.score)}</span></div>`;
    // The selected color is the BACKGROUND; we evaluate white text and black
    // text placed on it. (Contrast ratio is symmetric, so the numbers equal
    // color-vs-white and color-vs-black, but the meaning is text-on-this-color.)
    return `<div class="harmony-card a11y-card">
      <h3>${t('a11y.title')}</h3><p class="desc">${t('a11y.sub')}</p>
      <div class="a11y-sample">
        <span style="background:${base};color:#fff">Aa</span>
        <span style="background:${base};color:#000">Aa</span>
      </div>
      ${row(t('a11y.onWhite'), a.onWhite)}
      ${row(t('a11y.onBlack'), a.onBlack)}
    </div>`;
  }
  // Publication-grade qualitative palettes used as journal-style candidates.
  const JOURNAL_IDS = ['okabe-ito', 'Dark2', 'Set2', 'editorial-navy', 'terracotta-field', 'muted-jewel', 'harbor', 'slate-minimal', 'twilight-editorial'];

  // Pool for the "journal palettes containing your color" suggestion.
  // ONLY the user's saved high-impact journal palettes (imported from real
  // papers) — never the curated presets. If nothing in this pool contains a
  // color near the base, we recommend nothing.
  function journalCandidatePool() {
    return state.journals.map((j) => ({
      label: (j.abbrev || j.journal || t('common.untagged')),
      colors: j.colors
    }));
  }
  const nearestDeltaE = (baseRgb, colors) => Math.min.apply(null, colors.map((c) => CE.deltaE(baseRgb, CE.hexToRgb(c))));

  function harmonyCard(titleText, descText, colors) {
    const assess = Vision.assessPalette(colors);
    const bg = CE.hexToRgb(colors[0]);
    const wl = CE.wcagLevels(CE.contrastRatio(bg, CE.bestTextOn(bg)));
    const swatches = colors.map((c) =>
      `<span style="background:${c}" data-copy="${c}"><span class="lbl" style="color:${textHexOn(c)}">${c}</span></span>`).join('');
    return `<div class="harmony-card">
      <h3>${titleText}</h3>
      <p class="desc">${descText}</p>
      <div class="strip">${swatches}</div>
      <div class="flags">${cbBadge(assess.verdict)}
        <span class="badge ${wl.normalAA ? 'safe' : 'caution'}">${t('suggest.textContrast')} ${wl.ratio}:1</span>
      </div>
      <div class="load"><button class="btn" data-colors='${JSON.stringify(colors)}'>${t('common.loadIntoBuild')}</button></div>
    </div>`;
  }

  function renderSuggest() {
    const base = CE.normalizeHex($('#suggestInput').value) || '#1b3a5c';
    const type = $('#suggestType').value;
    const out = $('#suggestList');
    let html = '';

    const schemeKeys = (type === 'all') ? SCHEMES : (SCHEME_META[type] ? [type] : []);
    if (schemeKeys.length) {
      html += '<div class="harmony-list">';
      html += schemeKeys.map((k) => harmonyCard(t(SCHEME_META[k].tk), t(SCHEME_META[k].dk), schemeColors(k, base))).join('');
      html += '</div>';
    }

    if (type === 'all' || type === 'accessibility') {
      html += '<div class="harmony-list">' + a11yCard(base) + '</div>';
    }

    if (type === 'all' || type === 'journal') {
      // Journal-based suggestion: journal-grade palettes (curated + the user's
      // imported per-journal palettes) that CONTAIN a color close to the base —
      // i.e. "papers that used a color like yours, here's the rest of their set."
      const baseRgb = CE.hexToRgb(base);
      const THRESH = 30; // ΔE: how close a palette color must be to the base
      const matches = journalCandidatePool()
        .map((e) => ({ e, near: nearestDeltaE(baseRgb, e.colors) }))
        .filter((x) => x.near <= THRESH)
        .sort((a, b) => a.near - b.near);
      html += `<div class="suggest-section-head"><h2>${t('suggest.journalBasedHead')}</h2><p class="sub">${t('suggest.journalBasedSub')}</p></div>`;
      if (matches.length) {
        html += '<div class="harmony-list">' +
          matches.map(({ e }) => harmonyCard(e.label, '', e.colors)).join('') + '</div>';
      } else {
        html += `<p class="empty">${t('suggest.journalNone')}</p>`;
      }
    }

    out.innerHTML = html;
    $$('.harmony-card .strip span', out).forEach((s) => s.addEventListener('click', () => copy(s.dataset.copy)));
    $$('.harmony-card .load .btn', out).forEach((b) => b.addEventListener('click', () => { loadIntoBuild(JSON.parse(b.dataset.colors)); toast(t('toast.addedPalette')); }));
  }
  function wireSuggest() {
    const input = $('#suggestInput'), picker = $('#suggestPicker');
    // Typing/picking here updates the single shared active color, so Build and
    // Suggestions always show the same color.
    input.addEventListener('input', () => {
      const rgb = CE.parseColor(input.value);
      if (rgb) { renderColorPanel(rgb); picker.value = currentHex(); $('#colorInput').value = currentHex(); renderSuggest(); }
    });
    picker.addEventListener('input', () => {
      input.value = picker.value; renderColorPanel(CE.hexToRgb(picker.value)); $('#colorInput').value = currentHex(); renderSuggest();
    });
    $('#suggestType').addEventListener('change', renderSuggest);
  }

  // ---- PDF extraction -----------------------------------------------------
  function wireExtract() {
    const dz = $('#dropzone'), fileInput = $('#pdfFile');
    $('#browseBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handlePDF(fileInput.files[0]); });
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', (e) => {
      const f = e.dataTransfer.files[0];
      if (f && f.type === 'application/pdf') handlePDF(f); else toast(t('toast.invalidColor'));
    });
    $('#loadExtracted').addEventListener('click', () => { if (state.extracted) loadIntoBuild(state.extracted.map((c) => c.hex)); });
    $('#saveExtracted').addEventListener('click', () => { if (state.extracted) openSaveModal(state.extracted.map((c) => c.hex), state.extracted._source || ''); });
    $('#saveExtractedJournal').addEventListener('click', saveExtractedToJournal);
  }
  async function saveExtractedToJournal() {
    if (!state.extracted) return;
    const entry = {
      id: 'j' + Date.now().toString(36),
      journal: $('#jmName').value.trim() || t('q.unknown'),
      abbrev: $('#jmAbbrev').value.trim(),
      quartile: $('#jmQuartile').value.trim(),
      impactFactor: $('#jmIF').value.trim(),
      category: $('#jmCat').value.trim(),
      doi: $('#jmDOI').value.trim(),
      source: (state.extracted && state.extracted._source) || '',
      colors: state.extracted.map((c) => c.hex),
      savedAt: new Date().toISOString()
    };
    state.journals.unshift(entry);
    await persistLibrary();
    toast(t('toast.savedJournal'));
  }
  async function handlePDF(file) {
    const status = $('#extractStatus');
    $('#extractResultCard').classList.add('hidden');
    try {
      const buf = await file.arrayBuffer();
      const k = parseInt($('#extractK').value, 10);
      const pages = parseInt($('#extractPages').value, 10);
      const res = await PDFExtract.extract(buf, {
        k, pages,
        onStatus: (m) => (status.textContent = m) // localized status set inside via t below
      });
      if (res.empty || !res.palette.length) { status.textContent = t('ex.noColors'); return; }
      status.textContent = t('ex.done', { c: res.palette.length, name: file.name });
      res.palette._source = file.name;
      state.extracted = res.palette;
      state.extractedMeta = res.meta || {};
      // pre-fill the editable journal fields from detection
      const m = state.extractedMeta;
      $('#jmName').value = m.journal || '';
      $('#jmAbbrev').value = m.abbrev || '';
      $('#jmQuartile').value = m.quartile || '';
      $('#jmIF').value = (m.impactFactor === 0 || m.impactFactor) ? String(m.impactFactor) : '';
      $('#jmCat').value = m.category || '';
      $('#jmDOI').value = m.doi || '';
      renderExtracted(res.palette, res.scheme);
    } catch (err) {
      console.error(err); status.textContent = t('ex.error', { msg: err.message });
    }
  }
  function renderExtracted(palette, scheme) {
    const strip = $('#extractStrip');
    strip.innerHTML = palette.map((c) => {
      const d = CE.describe(c.rgb);
      return `<div class="swatch">
        <div class="chip" style="background:${d.hex}" data-copy="${d.hex}"></div>
        <div class="meta">
          <div class="hexcode" data-copy="${d.hex}">${d.hex}</div>
          <div class="rgbcode">${d.rgbString}</div>
          <div class="rgbcode">${Math.round(c.weight * 100)}% ${t('ex.area')}</div>
        </div></div>`;
    }).join('');
    $$('#extractStrip [data-copy]', strip).forEach((el) => el.addEventListener('click', () => copy(el.dataset.copy)));
    const roles = $('#schemeRoles');
    if (scheme) {
      const tag = (label, hex) => hex ? `<span class="role-tag"><span class="dot" style="background:${hex}"></span>${label}: ${hex}</span>` : '';
      roles.innerHTML = tag(t('role.primary'), scheme.primary) + tag(t('role.secondary'), scheme.secondary) +
        (scheme.accents || []).slice(0, 2).map((a) => tag(t('role.accent'), a)).join('');
    } else roles.innerHTML = '';
    $('#extractResultCard').classList.remove('hidden');
  }

  // ---- persistence (palettes + colors) ------------------------------------
  async function loadSavedFromDisk() {
    const res = await window.api.loadLibrary();
    const d = (res.ok && res.data) ? res.data : {};
    state.saved = d.palettes || [];
    state.colors = d.colors || [];
    state.journals = d.journals || [];
  }
  async function persistLibrary() { await window.api.saveLibrary({ palettes: state.saved, colors: state.colors, journals: state.journals }); }

  function renderSaved() {
    const list = $('#savedList');
    $('#savedEmpty').classList.toggle('hidden', state.saved.length > 0);
    list.innerHTML = state.saved.map((p) => `
      <div class="preset" data-id="${p.id}">
        <div class="pname">${p.name} ${cbBadge(Vision.assessPalette(p.colors).verdict)}</div>
        <div class="strip">${p.colors.map((c) => `<span style="background:${c}"></span>`).join('')}</div>
        <div class="pfoot"><span class="ptype">${(p.tags || []).join(' · ') || t('common.untagged')}</span><span>${p.source || ''}</span></div>
        <div class="export-row" style="border:0;padding-top:10px">
          <button class="btn" data-act="load">${t('common.load')}</button>
          <button class="btn ghost" data-act="del">${t('common.delete')}</button>
        </div>
      </div>`).join('');
    $$('.preset', list).forEach((el) => {
      const p = state.saved.find((x) => x.id === el.dataset.id);
      $('[data-act="load"]', el).addEventListener('click', () => { loadIntoBuild(p.colors); toast(t('toast.loadedName', { name: p.name })); });
      $('[data-act="del"]', el).addEventListener('click', async () => { state.saved = state.saved.filter((x) => x.id !== p.id); await persistLibrary(); renderSaved(); toast(t('toast.deleted')); });
    });
  }
  function wireLibrary() { $('#revealLib').addEventListener('click', () => window.api.revealLibrary()); }

  // ---- Journal Palettes module --------------------------------------------
  function renderJournals() {
    // Section 1: curated high-impact palettes (default recommendation)
    const curated = $('#journalCurated');
    curated.innerHTML = JOURNAL_IDS
      .map((id) => state.presets.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => harmonyCard(p.name, t('type.' + p.type), p.colors))
      .join('');
    $$('.harmony-card .strip span', curated).forEach((s) => s.addEventListener('click', () => copy(s.dataset.copy)));
    $$('.harmony-card .load .btn', curated).forEach((b) => b.addEventListener('click', () => { loadIntoBuild(JSON.parse(b.dataset.colors)); toast(t('toast.addedPalette')); }));

    // Section 2: the user's saved per-journal palettes
    const saved = $('#journalSaved');
    $('#journalsEmpty').classList.toggle('hidden', state.journals.length > 0);
    saved.innerHTML = state.journals.map((j) => {
      const metaBits = [];
      if (j.abbrev || j.journal) metaBits.push(j.abbrev || j.journal);
      if (j.quartile) metaBits.push(`<span class="q">${j.quartile}</span>`);
      if (j.impactFactor !== '' && j.impactFactor != null) metaBits.push('IF ' + j.impactFactor);
      if (j.category) metaBits.push(j.category);
      return `<div class="preset" data-id="${j.id}">
        <div class="pname">${j.journal || t('q.unknown')} ${cbBadge(Vision.assessPalette(j.colors).verdict)}</div>
        <div class="strip">${j.colors.map((c) => `<span style="background:${c}"></span>`).join('')}</div>
        <div class="jmeta">${metaBits.join(' · ')}</div>
        <div class="pfoot"><span class="ptype">${j.source || ''}</span><span>${j.doi || ''}</span></div>
        <div class="export-row" style="border:0;padding-top:10px">
          <button class="btn" data-act="load">${t('common.load')}</button>
          <button class="btn ghost" data-act="del">${t('common.delete')}</button>
        </div>
      </div>`;
    }).join('');
    $$('.preset', saved).forEach((el) => {
      const j = state.journals.find((x) => x.id === el.dataset.id);
      $$('.strip span', el).forEach((s, i) => s.addEventListener('click', () => copy(j.colors[i])));
      $('[data-act="load"]', el).addEventListener('click', () => { loadIntoBuild(j.colors); toast(t('toast.loadedName', { name: j.journal || j.abbrev || '' })); });
      $('[data-act="del"]', el).addEventListener('click', async () => { state.journals = state.journals.filter((x) => x.id !== j.id); await persistLibrary(); renderJournals(); toast(t('toast.deleted')); });
    });
  }

  // ---- Color Library ------------------------------------------------------
  async function addColorToLibrary(hex) {
    const norm = CE.normalizeHex(hex);
    if (!norm) return toast(t('toast.invalidColor'));
    if (state.colors.some((c) => c.hex === norm)) return toast(t('toast.dupColor'));
    state.colors.unshift({ id: 'c' + Date.now().toString(36), hex: norm, savedAt: new Date().toISOString() });
    await persistLibrary();
    toast(t('toast.savedColor', { v: norm }));
    if (!$('#view-colors').classList.contains('hidden')) renderColorLibrary();
    if (!$('#view-build').classList.contains('hidden')) renderPalette();
  }
  async function toggleStar(hex) {
    const norm = CE.normalizeHex(hex);
    const existing = state.colors.find((c) => c.hex === norm);
    if (existing) {
      state.colors = state.colors.filter((c) => c.id !== existing.id);
      await persistLibrary(); toast(t('toast.removedColor'));
    } else {
      state.colors.unshift({ id: 'c' + Date.now().toString(36), hex: norm, savedAt: new Date().toISOString() });
      await persistLibrary(); toast(t('toast.savedColor', { v: norm }));
    }
    renderPalette();
    if (!$('#view-colors').classList.contains('hidden')) renderColorLibrary();
  }
  function renderColorLibrary() {
    const grid = $('#colorGrid');
    $('#colorsEmpty').classList.toggle('hidden', state.colors.length > 0);
    $('#colorLibCount').textContent = state.colors.length ? t('colors.count', { n: state.colors.length }) : '';
    grid.innerHTML = state.colors.map((c) => {
      const d = CE.describe(CE.hexToRgb(c.hex));
      return `<div class="color-card" data-id="${c.id}">
        <div class="chip" style="background:${d.hex}" data-copy="${d.hex}"></div>
        <div class="meta">
          <div class="hexcode" data-copy="${d.hex}">${d.hex}</div>
          <div class="rgbcode">${d.rgbString}</div>
          <div class="tools">
            <button data-act="add">${t('colors.toPalette')}</button>
            <button data-act="del">${t('common.delete')}</button>
          </div>
        </div></div>`;
    }).join('');
    $$('.color-card', grid).forEach((el) => {
      const id = el.dataset.id, c = state.colors.find((x) => x.id === id);
      $$('[data-copy]', el).forEach((n) => n.addEventListener('click', () => copy(n.dataset.copy)));
      $('[data-act="add"]', el).addEventListener('click', () => {
        if (state.palette.length >= 8) return toast(t('toast.full'));
        state.palette.push({ hex: c.hex, locked: false }); renderPalette(); toast(t('toast.addedPalette'));
      });
      $('[data-act="del"]', el).addEventListener('click', async () => { state.colors = state.colors.filter((x) => x.id !== id); await persistLibrary(); renderColorLibrary(); });
    });
  }
  function wireColorLibrary() {
    const input = $('#colorLibInput'), picker = $('#colorLibPicker');
    picker.addEventListener('input', () => { input.value = picker.value; });
    const submit = () => {
      const rgb = CE.parseColor(input.value);
      if (!rgb) return toast(t('toast.invalidColor'));
      addColorToLibrary(CE.rgbToHex(rgb.r, rgb.g, rgb.b)); input.value = '';
    };
    $('#colorLibAdd').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  // ---- save modal ---------------------------------------------------------
  function openSaveModal(colors, source) {
    state.pendingSave = colors.slice();
    $('#saveName').value = ''; $('#saveTags').value = ''; $('#saveSource').value = source || '';
    $('#saveModal').classList.remove('hidden'); $('#saveName').focus();
  }
  function wireSaveModal() {
    $('#saveCancel').addEventListener('click', () => $('#saveModal').classList.add('hidden'));
    $('#saveConfirm').addEventListener('click', async () => {
      const colors = state.pendingSave || []; if (!colors.length) return;
      state.saved.unshift({
        id: 'p' + Date.now().toString(36),
        name: $('#saveName').value.trim() || 'Untitled',
        colors,
        tags: $('#saveTags').value.split(',').map((s) => s.trim()).filter(Boolean),
        source: $('#saveSource').value.trim(),
        savedAt: new Date().toISOString()
      });
      await persistLibrary();
      $('#saveModal').classList.add('hidden'); toast(t('toast.savedLib'));
    });
  }

  // ---- guide (localized prose) --------------------------------------------
  function strip(colors) { return `<span class="inline-strip">${colors.map((c) => `<span style="background:${c}"></span>`).join('')}</span>`; }
  const GUIDE = {
    en: () => `
      <h3>Why palette choice matters</h3>
      <p>For journals like Nature, Science and Cell, color should encode meaning, survive grayscale and colorblind viewing, and look restrained. Muted, desaturated tones read as editorial; saturated primaries and rainbow ramps read as dated.</p>
      <h3>Sequential, diverging, qualitative</h3>
      <p><strong>Sequential</strong> ${strip(['#eef3f7', '#94b2c6', '#2f5b78', '#133247'])} for ordered magnitude. <strong>Diverging</strong> ${strip(['#173a52', '#9cc0d4', '#f2efe9', '#e0bd86', '#7a531b'])} around a meaningful midpoint. <strong>Qualitative</strong> ${strip(['#1b3a5c', '#b5654a', '#7d8a6a', '#c99a4e'])} for unordered categories.</p>
      <h3>Perceptually uniform colormaps</h3>
      <p>Viridis ${strip(['#440154', '#31688e', '#35b779', '#fde725'])} and cividis ${strip(['#00224e', '#575d6d', '#a59c74', '#fee838'])} keep equal data steps looking equal and stay readable for most color-vision deficiencies. Prefer them over jet/rainbow.</p>
      <h3>Harmony rules</h3>
      <p><strong>Complementary</strong> opposite hues; <strong>analogous</strong> neighbors; <strong>triadic</strong> three balanced hues; <strong>split-complementary</strong> for softer contrast; <strong>monochromatic</strong> one hue across lightness. Generate these live in the Suggestions tab.</p>
      <h3>Colorblind safety</h3>
      <p>About 8% of men have a red-green deficiency. The Okabe–Ito set ${strip(['#000000', '#e69f00', '#56b4e9', '#009e73', '#0072b2', '#d55e00', '#cc79a7'])} stays distinct. Nuancera simulates deuteranopia, protanopia and tritanopia and flags palettes that collapse — usually fixed by varying <em>lightness</em>, not just hue.</p>
      <h3>Text contrast & print (CMYK)</h3>
      <p>Aim for WCAG ≥ 4.5:1 for normal text, ≥ 3:1 for large text. The CMYK values shown are a device-independent approximation — confirm against the journal's profile for final print.</p>`,
    zh: () => `
      <h3>为什么配色很重要</h3>
      <p>对 Nature、Science、Cell 这类期刊，颜色应当承载含义、在灰度和色盲条件下依然可读，并保持克制。低饱和、柔和的色调显得专业；高饱和原色与彩虹渐变则显得过时。</p>
      <h3>顺序型、发散型、定性型</h3>
      <p><strong>顺序型</strong> ${strip(['#eef3f7', '#94b2c6', '#2f5b78', '#133247'])} 表示有序的大小。<strong>发散型</strong> ${strip(['#173a52', '#9cc0d4', '#f2efe9', '#e0bd86', '#7a531b'])} 围绕一个有意义的中点。<strong>定性型</strong> ${strip(['#1b3a5c', '#b5654a', '#7d8a6a', '#c99a4e'])} 表示无序的类别。</p>
      <h3>感知均匀色谱</h3>
      <p>Viridis ${strip(['#440154', '#31688e', '#35b779', '#fde725'])} 与 cividis ${strip(['#00224e', '#575d6d', '#a59c74', '#fee838'])} 让等量的数据步长看起来也等距，且对多数色觉缺陷仍可读。优先于 jet/彩虹色。</p>
      <h3>配色和谐法则</h3>
      <p><strong>互补色</strong>相对色相；<strong>邻近色</strong>相邻色相；<strong>三元色</strong>三个均衡色相；<strong>分裂互补</strong>对比更柔和；<strong>单色系</strong>同色相不同明度。可在「配色建议」标签中实时生成。</p>
      <h3>色盲安全</h3>
      <p>约 8% 的男性有红绿色觉缺陷。Okabe–Ito 配色 ${strip(['#000000', '#e69f00', '#56b4e9', '#009e73', '#0072b2', '#d55e00', '#cc79a7'])} 可保持区分。Nuancera 会模拟红色盲、绿色盲与蓝黄色盲，并对会混淆的配色给出提示 —— 通常靠拉开<em>明度</em>而非仅色相来解决。</p>
      <h3>文字对比与印刷 (CMYK)</h3>
      <p>正文建议 WCAG ≥ 4.5:1，大字号 ≥ 3:1。此处 CMYK 为与设备无关的近似值 —— 最终送印请以期刊色彩配置为准。</p>`,
    fr: () => `
      <h3>Pourquoi le choix des couleurs compte</h3>
      <p>Pour des revues comme Nature, Science et Cell, la couleur doit porter du sens, survivre au niveaux de gris et à la vision daltonienne, et rester sobre. Les tons désaturés font « éditorial » ; les primaires saturées et les dégradés arc-en-ciel font daté.</p>
      <h3>Séquentielle, divergente, qualitative</h3>
      <p><strong>Séquentielle</strong> ${strip(['#eef3f7', '#94b2c6', '#2f5b78', '#133247'])} pour une grandeur ordonnée. <strong>Divergente</strong> ${strip(['#173a52', '#9cc0d4', '#f2efe9', '#e0bd86', '#7a531b'])} autour d’un point médian. <strong>Qualitative</strong> ${strip(['#1b3a5c', '#b5654a', '#7d8a6a', '#c99a4e'])} pour des catégories non ordonnées.</p>
      <h3>Cartes perceptuellement uniformes</h3>
      <p>Viridis ${strip(['#440154', '#31688e', '#35b779', '#fde725'])} et cividis ${strip(['#00224e', '#575d6d', '#a59c74', '#fee838'])} gardent des pas égaux visuellement égaux et restent lisibles pour la plupart des déficiences. À préférer à jet/arc-en-ciel.</p>
      <h3>Règles d’harmonie</h3>
      <p><strong>Complémentaire</strong> teintes opposées ; <strong>analogue</strong> voisines ; <strong>triadique</strong> trois teintes équilibrées ; <strong>complémentaire divisée</strong> contraste plus doux ; <strong>monochrome</strong> une teinte sur la luminosité. À générer dans l’onglet Suggestions.</p>
      <h3>Sûreté daltonisme</h3>
      <p>Environ 8 % des hommes ont une déficience rouge-vert. Le jeu Okabe–Ito ${strip(['#000000', '#e69f00', '#56b4e9', '#009e73', '#0072b2', '#d55e00', '#cc79a7'])} reste distinct. Nuancera simule deutéranopie, protanopie et tritanopie et signale les palettes qui fusionnent — corrigez par la <em>luminosité</em>, pas seulement la teinte.</p>
      <h3>Contraste du texte & impression (CMJN)</h3>
      <p>Visez WCAG ≥ 4,5:1 (texte normal), ≥ 3:1 (grand texte). Les valeurs CMJN sont une approximation indépendante du périphérique — vérifiez avec le profil de la revue avant impression.</p>`
  };
  function renderGuide() { $('#guideProse').innerHTML = (GUIDE[I18N.getLang()] || GUIDE.en)(); }

  // ---- language ------------------------------------------------------------
  function setLanguage(lang) {
    I18N.setLang(lang);
    try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
    document.documentElement.lang = lang;
    I18N.apply(document);               // static text + placeholders + <option>s
    renderColorPanel(state.current);    // refresh dynamic content
    renderPalette();
    showView(state.view);               // re-render the active view in the new language
  }
  function wireLanguage() {
    const sel = $('#langSelect');
    sel.addEventListener('change', () => setLanguage(sel.value));
  }

  // ---- boot ----------------------------------------------------------------
  async function init() {
    $('#versionTag').textContent = I18N.APP_VERSION;
    let lang = 'zh';
    try { lang = localStorage.getItem(LANG_KEY) || 'zh'; } catch (_) {}
    if (!I18N.LANGS.includes(lang)) lang = 'zh';
    $('#langSelect').value = lang;
    I18N.setLang(lang);
    document.documentElement.lang = lang;

    $$('.nav-item').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
    wireColorInput();
    wirePaletteControls();
    wirePresetFilters();
    wireSuggest();
    wireExtract();
    wireLibrary();
    wireColorLibrary();
    wireSaveModal();
    wireLanguage();

    I18N.apply(document);
    renderColorPanel(state.current);
    renderPalette();
    await loadSavedFromDisk();
    showView('build');
  }
  document.addEventListener('DOMContentLoaded', init);
})();
