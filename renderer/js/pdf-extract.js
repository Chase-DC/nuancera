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
    if (lum > 240 && sat < 0.12) return true;          // page white
    if (lum < 22) return true;                         // near-black ink
    if (sat < 0.10) return true;                       // gray text / gridlines / AA
    return false;
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
    const maxW = 900;            // render width cap (speed/quality balance)
    const sampleCap = 60000;     // max pixels fed to k-means

    onStatus('Opening PDF…');
    const doc = await pdfjsLib.getDocument({
      data: arrayBuffer,
      // keep everything offline; skip optional remote font/cmap fetches
      disableFontFace: false,
      isEvalSupported: false
    }).promise;

    // Grab first-page text + document title for journal detection (offline).
    let metaText = '';
    try {
      const md = await doc.getMetadata();
      if (md && md.info && md.info.Title) metaText += ' ' + md.info.Title;
    } catch (_) {}
    try {
      const p1 = await doc.getPage(1);
      const tc = await p1.getTextContent();
      metaText += ' ' + tc.items.map((it) => it.str).join(' ');
    } catch (_) {}

    const n = Math.min(doc.numPages, pageLimit);
    const samples = [];
    for (let p = 1; p <= n; p++) {
      onStatus(`Rendering page ${p} of ${n}…`);
      const page = await doc.getPage(p);
      const img = await renderPageToImageData(page, maxW);
      const data = img.data;
      // stride so we never collect more than ~sampleCap pixels overall
      const totalPx = data.length / 4;
      const stride = Math.max(1, Math.floor((totalPx * n) / sampleCap));
      for (let i = 0; i < totalPx; i += stride) {
        const o = i * 4;
        const a = data[o + 3];
        if (a < 200) continue; // skip transparent
        const r = data[o], g = data[o + 1], b = data[o + 2];
        if (isNoise(r, g, b)) continue;
        samples.push({ r, g, b });
      }
    }

    onStatus(`Clustering ${samples.length.toLocaleString()} colored pixels…`);
    const meta = detectJournal(metaText);
    if (samples.length < k) {
      return { palette: [], scheme: null, meta, empty: true };
    }
    const palette = Cluster.kmeans(samples, k, { maxIter: 30 });

    return { palette, scheme: detectScheme(palette), meta, empty: palette.length === 0 };
  }

  /*
   * Best-effort journal detection from first-page text, fully offline.
   * Matches against the bundled window.JOURNALS table by distinctive alias
   * substrings; the longest matched alias wins (most specific). Returns
   * editable metadata + any DOI found. Everything is a suggestion the user can
   * correct in the UI.
   */
  function detectJournal(rawText) {
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const raw = (rawText || '').toLowerCase();
    const text = ' ' + norm(rawText) + ' ';     // token-boundary searches
    const doiMatch = (rawText || '').match(/10\.\d{4,9}\/[^\s"'<>)]+/);
    const doi = doiMatch ? doiMatch[0].replace(/[.,;]+$/, '') : '';
    const table = (window.JOURNALS && window.JOURNALS.list) || [];

    let best = null, bestScore = 0;
    for (const j of table) {
      let score = 0;
      // ISSN / eISSN are the strongest, lowest-false-positive signal.
      if (j.issn && raw.indexOf(j.issn.toLowerCase()) !== -1) score = Math.max(score, 100);
      if (j.eissn && raw.indexOf(j.eissn.toLowerCase()) !== -1) score = Math.max(score, 100);
      // Full journal name as a whole token sequence (avoids substring-in-word hits).
      const nm = norm(j.name);
      if (nm.length >= 5 && text.indexOf(' ' + nm + ' ') !== -1) score = Math.max(score, nm.length);
      // JCR abbreviation as a whole token sequence.
      const ab = norm(j.abbrev);
      if (ab.length >= 5 && text.indexOf(' ' + ab + ' ') !== -1) score = Math.max(score, ab.length - 1);
      if (score > bestScore) { bestScore = score; best = j; }
    }
    if (best) {
      return {
        matched: true, journal: best.name, abbrev: best.abbrev,
        impactFactor: (best.if == null ? '' : best.if),
        quartile: best.q || '', category: best.cat || '', doi
      };
    }
    return { matched: false, journal: '', abbrev: '', impactFactor: '', quartile: '', category: '', doi };
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
