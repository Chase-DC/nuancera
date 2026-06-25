/*
 * pdf-extract.js — render PDF pages locally and extract a de-noised palette.
 *
 * Pipeline:
 *   1. pdf.js (bundled, offline) renders each page to an offscreen canvas.
 *   2. We read pixels and DISCARD noise:
 *        - near-white (page background)
 *        - near-black (text / rules), with a low-saturation guard
 *        - near-gray, low-saturation pixels (axes, gridlines, anti-aliasing)
 *      Colored pixels are kept and weighted by how often they occur (~area).
 *   3. k-means (in Lab) clusters the kept pixels into the requested number of
 *      colors, ordered by area.
 *   4. A light "scheme" heuristic assigns primary / secondary / accent roles.
 *
 * Depends on globals: pdfjsLib (vendor), CE (color-utils), Cluster (cluster).
 * Browser-only (uses canvas + pdf.js worker).
 */
(function () {
  'use strict';

  // Point pdf.js at the locally bundled worker. No network.
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.js';
  }

  // Decide whether a pixel is "noise" we should ignore.
  function isNoise(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; // approx 0..255
    const sat = max === 0 ? 0 : (max - min) / max;     // simple HSV saturation
    const chroma = max - min;
    if (lum > 248 && sat < 0.10) return true;          // page white
    if (lum < 18) return true;                         // near-black ink
    if (sat < 0.045) return true;                      // gray text / gridlines / AA
    if (sat < 0.08 && chroma < 14) return true;        // keep muted editorial colors
    return false;
  }

  function quantizeChannel(v) {
    return Math.max(0, Math.min(255, Math.round(v / 8) * 8));
  }

  function addPixelToHistogram(hist, r, g, b) {
    const qr = quantizeChannel(r), qg = quantizeChannel(g), qb = quantizeChannel(b);
    const key = `${qr},${qg},${qb}`;
    const item = hist.get(key);
    if (item) item.count += 1;
    else hist.set(key, { r: qr, g: qg, b: qb, count: 1 });
  }

  function histogramToSamples(hist, sampleCap) {
    const bins = Array.from(hist.values());
    if (!bins.length) return [];

    const byCount = [...bins].sort((a, b) => b.count - a.count).slice(0, 1600);
    const byDistinct = [...bins]
      .sort((a, b) => {
        const sa = Math.max(a.r, a.g, a.b) - Math.min(a.r, a.g, a.b);
        const sb = Math.max(b.r, b.g, b.b) - Math.min(b.r, b.g, b.b);
        return (sb * Math.log1p(b.count)) - (sa * Math.log1p(a.count));
      })
      .slice(0, 500);
    const selected = new Map();
    [...byCount, ...byDistinct].forEach((bin) => selected.set(`${bin.r},${bin.g},${bin.b}`, bin));

    const weighted = Array.from(selected.values()).map((bin) => ({
      ...bin,
      reps: Math.max(1, Math.round(Math.sqrt(bin.count)))
    }));
    const repTotal = weighted.reduce((sum, bin) => sum + bin.reps, 0);
    const scale = repTotal > sampleCap ? sampleCap / repTotal : 1;
    const samples = [];
    for (const bin of weighted) {
      const reps = Math.max(1, Math.round(bin.reps * scale));
      for (let i = 0; i < reps; i++) samples.push({ r: bin.r, g: bin.g, b: bin.b });
    }
    return samples;
  }

  async function renderPageToImageData(page, maxW) {
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(maxW / baseViewport.width, 2.0);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    await page.render({ canvasContext: ctx, viewport }).promise;
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  /*
   * extract(arrayBuffer, { k, pages, onStatus }) -> Promise<{
   *   palette: [{hex,rgb,weight}], scheme: {primary, secondary, accents[]}
   * }>
   */
  async function extract(arrayBuffer, opts = {}) {
    const k = opts.k || 6;
    const pageLimit = opts.pages || 3;
    const onStatus = opts.onStatus || (() => {});
    const maxW = 1100;           // render width cap (speed/quality balance)
    const sampleCap = Math.max(90000, k * 9000);

    onStatus('Opening PDF…');
    const doc = await pdfjsLib.getDocument({
      data: arrayBuffer,
      // keep everything offline; skip optional remote font/cmap fetches
      disableFontFace: false,
      isEvalSupported: false
    }).promise;

    const n = pageLimit === 'all' ? doc.numPages : Math.min(doc.numPages, pageLimit);

    // Grab document text from likely metadata-bearing pages for journal detection
    // (offline). Many publishers put journal/ISSN details outside page 1.
    let metaText = '';
    try {
      const md = await doc.getMetadata();
      if (md && md.info && md.info.Title) metaText += ' ' + md.info.Title;
      if (md && md.info && md.info.Subject) metaText += ' ' + md.info.Subject;
      if (md && md.info && md.info.Keywords) metaText += ' ' + md.info.Keywords;
    } catch (_) {}
    const textPages = new Set([1, doc.numPages]);
    const frontTextPages = Math.min(doc.numPages, Math.max(4, Math.min(n, 8)));
    for (let p = 1; p <= frontTextPages; p++) textPages.add(p);
    for (const p of textPages) {
      try {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        metaText += ' ' + tc.items.map((it) => it.str).join(' ');
      } catch (_) {}
    }

    const hist = new Map();
    let coloredPixels = 0;
    for (let p = 1; p <= n; p++) {
      onStatus(`Rendering page ${p} of ${n}…`);
      const page = await doc.getPage(p);
      const img = await renderPageToImageData(page, maxW);
      const data = img.data;
      const totalPx = data.length / 4;
      const stride = Math.max(1, Math.floor((totalPx * n) / 2500000));
      for (let i = 0; i < totalPx; i += stride) {
        const o = i * 4;
        const a = data[o + 3];
        if (a < 200) continue; // skip transparent
        const r = data[o], g = data[o + 1], b = data[o + 2];
        if (isNoise(r, g, b)) continue;
        addPixelToHistogram(hist, r, g, b);
        coloredPixels++;
      }
    }

    const samples = histogramToSamples(hist, sampleCap);
    onStatus(`Clustering ${samples.length.toLocaleString()} colored pixels…`);
    const meta = detectJournal(metaText);
    if (samples.length < k) {
      return { palette: [], scheme: null, meta, empty: true };
    }
    const palette = Cluster.kmeans(samples, k, { maxIter: 30 });
    const totalBinCount = Array.from(hist.values()).reduce((sum, bin) => sum + bin.count, 0);
    if (totalBinCount > 0) {
      const labs = palette.map((color) => CE.rgbToLab(color.rgb));
      const weights = palette.map(() => 0);
      for (const bin of hist.values()) {
        const lab = CE.rgbToLab({ r: bin.r, g: bin.g, b: bin.b });
        let best = 0, bestDist = Infinity;
        for (let i = 0; i < labs.length; i++) {
          const d = labs[i];
          const dist = (lab.L - d.L) ** 2 + (lab.a - d.a) ** 2 + (lab.b - d.b) ** 2;
          if (dist < bestDist) { bestDist = dist; best = i; }
        }
        weights[best] += bin.count;
      }
      for (let i = 0; i < palette.length; i++) {
        palette[i].weight = weights[i] / totalBinCount;
      }
      palette.sort((a, b) => b.weight - a.weight);
    }

    return { palette, scheme: detectScheme(palette), meta, empty: palette.length === 0 || coloredPixels === 0 };
  }

  /*
   * Best-effort journal detection from first-page text, fully offline.
   * Matches against the bundled window.JOURNALS table by distinctive alias
   * substrings; the longest matched alias wins (most specific). Returns
   * editable metadata + any DOI found. Everything is a suggestion the user can
   * correct in the UI.
   */
  function detectJournal(rawText) {
    const raw = (rawText || '').toLowerCase();
    const text = ' ' + normalizeJournal(rawText) + ' ';     // token-boundary searches
    const doiMatch = (rawText || '').match(/10\.\d{4,9}\/[^\s"'<>)]+/);
    const doi = doiMatch ? doiMatch[0].replace(/[.,;]+$/, '') : '';
    const table = (window.JOURNALS && window.JOURNALS.list) || [];

    let best = null, bestScore = 0;
    for (const j of table) {
      let score = 0;
      // ISSN / eISSN are the strongest, lowest-false-positive signal.
      if (j.issn && j.issn !== 'N/A' && raw.indexOf(j.issn.toLowerCase()) !== -1) score = Math.max(score, 120);
      if (j.eissn && j.eissn !== 'N/A' && raw.indexOf(j.eissn.toLowerCase()) !== -1) score = Math.max(score, 120);
      for (const alias of journalAliases(j)) {
        if (text.indexOf(' ' + alias + ' ') !== -1) score = Math.max(score, alias.length);
      }
      if (score > bestScore) { bestScore = score; best = j; }
    }
    if (best) {
      const merged = mergeJournalRows(best, table);
      return {
        matched: true, journal: merged.name, abbrev: merged.abbrev,
        impactFactor: (merged.if == null ? '' : merged.if),
        quartile: merged.q || '', category: merged.cat || '', doi
      };
    }
    return { matched: false, journal: '', abbrev: '', impactFactor: '', quartile: '', category: '', doi };
  }

  function normalizeJournal(s) {
    return (s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function journalKey(j) {
    return ((j.issn && j.issn !== 'N/A') || (j.eissn && j.eissn !== 'N/A') || j.name || j.abbrev || '').toLowerCase();
  }

  function mergeJournalRows(row, table) {
    const key = journalKey(row);
    const rows = table.filter((j) => journalKey(j) === key);
    const cats = Array.from(new Set(rows.map((j) => j.cat).filter(Boolean)));
    const q = rows.find((j) => j.q) || row;
    return { ...row, cat: cats.join('; '), q: q.q || row.q || '' };
  }

  function journalAliases(j) {
    const out = [];
    const push = (value) => {
      const alias = normalizeJournal(value);
      if (alias && alias.length >= 5) out.push(alias);
    };
    push(j.name);
    push(j.abbrev);
    push((j.abbrev || '').replace(/\bJ\b/g, 'journal'));
    push((j.abbrev || '').replace(/\bNAT\b/g, 'nature'));
    push((j.abbrev || '').replace(/\bSCI\b/g, 'science'));
    push((j.name || '').replace(/&/g, 'and'));
    return Array.from(new Set(out));
  }

  // Lightweight role detection: most-area color is primary; next is secondary;
  // the rest are accents, but a small-area yet highly-saturated color is a good
  // accent candidate and gets surfaced.
  function detectScheme(palette) {
    if (!palette.length) return null;
    const withSat = palette.map((c) => {
      const hsl = CE.rgbToHsl(c.rgb.r, c.rgb.g, c.rgb.b);
      return { ...c, sat: hsl.s, light: hsl.l };
    });
    const byWeight = [...withSat].sort((a, b) => b.weight - a.weight);
    const primary = byWeight[0];
    const secondary = byWeight[1] || null;
    const accents = byWeight
      .slice(2)
      .sort((a, b) => b.sat - a.sat); // most saturated leftovers first
    return {
      primary: primary.hex,
      secondary: secondary ? secondary.hex : null,
      accents: accents.map((a) => a.hex)
    };
  }

  window.PDFExtract = { extract, isNoise };
})();
