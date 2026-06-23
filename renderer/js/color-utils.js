/*
 * color-utils.js — pure color math, no DOM, no dependencies.
 * Loaded both in the browser (attaches to window.CE) and in Node (module.exports)
 * so the same code can be unit-tested headlessly.
 *
 * Covers:
 *   - parsing & formatting:  HEX, RGB, HSL, CMYK
 *   - conversions between all of the above
 *   - WCAG relative luminance + contrast ratio
 *   - CIE Lab + deltaE (CIE76) for perceptual distance
 *   - color-harmony generators (complementary, analogous, triadic,
 *     monochromatic, split-complementary)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.CE = api;
})(this, function () {
  'use strict';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round = (v) => Math.round(v);

  // ---- HEX <-> RGB ----------------------------------------------------------
  function normalizeHex(hex) {
    if (typeof hex !== 'string') return null;
    // Strip ANY number of leading '#' (so "ec9a29", "#ec9a29", "##ec9a29",
    // "####ec9a29" all normalize to "#ec9a29"), then ignore inner whitespace.
    let h = hex.trim().replace(/^#+/, '').replace(/\s+/g, '');
    if (/^[0-9a-fA-F]{3}$/.test(h)) {
      h = h.split('').map((c) => c + c).join('');
    }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return '#' + h.toLowerCase();
  }

  function hexToRgb(hex) {
    const h = normalizeHex(hex);
    if (!h) return null;
    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16)
    };
  }

  function rgbToHex(r, g, b) {
    const to2 = (v) => clamp(round(v), 0, 255).toString(16).padStart(2, '0');
    return ('#' + to2(r) + to2(g) + to2(b)).toLowerCase();
  }

  // ---- RGB <-> HSL ----------------------------------------------------------
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return { h: round(h), s: round(s * 100), l: round(l * 100) };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rp = 0, gp = 0, bp = 0;
    if (h < 60) { rp = c; gp = x; }
    else if (h < 120) { rp = x; gp = c; }
    else if (h < 180) { gp = c; bp = x; }
    else if (h < 240) { gp = x; bp = c; }
    else if (h < 300) { rp = x; bp = c; }
    else { rp = c; bp = x; }
    return { r: round((rp + m) * 255), g: round((gp + m) * 255), b: round((bp + m) * 255) };
  }

  // ---- RGB <-> CMYK (naive device CMYK; good enough for screen preview) -----
  function rgbToCmyk(r, g, b) {
    const rr = r / 255, gg = g / 255, bb = b / 255;
    const k = 1 - Math.max(rr, gg, bb);
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
    const c = (1 - rr - k) / (1 - k);
    const m = (1 - gg - k) / (1 - k);
    const y = (1 - bb - k) / (1 - k);
    return { c: round(c * 100), m: round(m * 100), y: round(y * 100), k: round(k * 100) };
  }

  function cmykToRgb(c, m, y, k) {
    c /= 100; m /= 100; y /= 100; k /= 100;
    return {
      r: round(255 * (1 - c) * (1 - k)),
      g: round(255 * (1 - m) * (1 - k)),
      b: round(255 * (1 - y) * (1 - k))
    };
  }

  // ---- Flexible parser: accepts "#1b3a5c", "1b3a5c", "27,58,92",
  //      "rgb(27,58,92)", "hsl(210,55%,23%)" -> returns {r,g,b} or null -------
  function parseColor(input) {
    if (input == null) return null;
    const s = String(input).trim().toLowerCase();
    if (!s) return null;

    // hex
    const asHex = normalizeHex(s);
    if (asHex) return hexToRgb(asHex);

    // rgb(...) or bare "r,g,b"
    let m = s.match(/^rgba?\(([^)]+)\)$/) || s.match(/^(\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3})$/);
    if (m) {
      const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
      if (parts.length >= 3 && parts.slice(0, 3).every((n) => !isNaN(n))) {
        return { r: clamp(round(parts[0]), 0, 255), g: clamp(round(parts[1]), 0, 255), b: clamp(round(parts[2]), 0, 255) };
      }
    }

    // hsl(...)
    m = s.match(/^hsla?\(([^)]+)\)$/);
    if (m) {
      const parts = m[1].split(',').map((x) => parseFloat(x.replace('%', '').trim()));
      if (parts.length >= 3 && parts.slice(0, 3).every((n) => !isNaN(n))) {
        return hslToRgb(parts[0], parts[1], parts[2]);
      }
    }
    return null;
  }

  // Convenience: build every representation from one rgb
  function describe(rgb) {
    const { r, g, b } = rgb;
    const hsl = rgbToHsl(r, g, b);
    const cmyk = rgbToCmyk(r, g, b);
    return {
      hex: rgbToHex(r, g, b),
      rgb,
      rgbString: `${r}, ${g}, ${b}`,
      hsl,
      hslString: `${hsl.h}, ${hsl.s}%, ${hsl.l}%`,
      cmyk,
      cmykString: `${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`
    };
  }

  // ---- WCAG luminance & contrast -------------------------------------------
  function relLuminance(r, g, b) {
    const lin = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function contrastRatio(rgb1, rgb2) {
    const L1 = relLuminance(rgb1.r, rgb1.g, rgb1.b);
    const L2 = relLuminance(rgb2.r, rgb2.g, rgb2.b);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Best readable text color (black/white) for a given background
  function bestTextOn(rgb) {
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    return contrastRatio(rgb, white) >= contrastRatio(rgb, black) ? white : black;
  }

  // WCAG pass labels for a given contrast ratio
  function wcagLevels(ratio) {
    return {
      ratio: Math.round(ratio * 100) / 100,
      normalAA: ratio >= 4.5,
      normalAAA: ratio >= 7,
      largeAA: ratio >= 3,
      largeAAA: ratio >= 4.5
    };
  }

  // ---- CIE Lab + deltaE (CIE76) --------------------------------------------
  function rgbToXyz(r, g, b) {
    const lin = (c) => {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const R = lin(r), G = lin(g), B = lin(b);
    return {
      x: (R * 0.4124 + G * 0.3576 + B * 0.1805) * 100,
      y: (R * 0.2126 + G * 0.7152 + B * 0.0722) * 100,
      z: (R * 0.0193 + G * 0.1192 + B * 0.9505) * 100
    };
  }

  function xyzToLab(x, y, z) {
    // D65 reference white
    const xn = 95.047, yn = 100.0, zn = 108.883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(x / xn), fy = f(y / yn), fz = f(z / zn);
    return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }

  function rgbToLab(rgb) {
    const { x, y, z } = rgbToXyz(rgb.r, rgb.g, rgb.b);
    return xyzToLab(x, y, z);
  }

  function deltaE(rgb1, rgb2) {
    const a = rgbToLab(rgb1), b = rgbToLab(rgb2);
    return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
  }

  // ---- Harmony generators (return array of hex strings) ---------------------
  function rotate(rgb, deg) {
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return hslToRgb(hsl.h + deg, hsl.s, hsl.l);
  }
  function withL(rgb, l) {
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return hslToRgb(hsl.h, hsl.s, clamp(l, 0, 100));
  }

  function harmony(baseHex, kind) {
    const base = hexToRgb(baseHex);
    if (!base) return [];
    const hsl = rgbToHsl(base.r, base.g, base.b);
    const H = (d) => rgbToHex(...Object.values(rotate(base, d)));
    switch (kind) {
      case 'complementary':
        return [baseHex, H(180)];
      case 'analogous':
        return [H(-30), baseHex, H(30)];
      case 'triadic':
        return [baseHex, H(120), H(240)];
      case 'split-complementary':
        return [baseHex, H(150), H(210)];
      case 'tetradic': // rectangle: two complementary pairs
        return [baseHex, H(60), H(180), H(240)];
      case 'square':   // four hues 90° apart
        return [baseHex, H(90), H(180), H(270)];
      case 'monochromatic':
        return [
          rgbToHex(...Object.values(withL(base, clamp(hsl.l - 28, 8, 92)))),
          rgbToHex(...Object.values(withL(base, clamp(hsl.l - 12, 8, 92)))),
          baseHex,
          rgbToHex(...Object.values(withL(base, clamp(hsl.l + 12, 8, 92)))),
          rgbToHex(...Object.values(withL(base, clamp(hsl.l + 26, 8, 92))))
        ];
      default:
        return [baseHex];
    }
  }

  const toHex = (rgb) => rgbToHex(rgb.r, rgb.g, rgb.b);

  // Shades/tints: same hue & saturation, lightness swept across `n` steps
  // (light → dark). n defaults to 10.
  function shades(baseHex, n) {
    const base = hexToRgb(baseHex);
    if (!base) return [];
    n = Math.max(2, n || 10);
    const hsl = rgbToHsl(base.r, base.g, base.b);
    const out = [];
    for (let i = 0; i < n; i++) {
      const l = 92 - i * (84 / (n - 1)); // 92% down to 8%
      out.push(toHex(hslToRgb(hsl.h, hsl.s, clamp(l, 4, 96))));
    }
    return out;
  }

  // Similar colors: subtle neighbors of the base (small hue + lightness tweaks).
  function similar(baseHex, n) {
    const base = hexToRgb(baseHex);
    if (!base) return [];
    n = Math.max(4, n || 6);
    const hsl = rgbToHsl(base.r, base.g, base.b);
    const variants = [[0, 0], [-8, 0], [8, 0], [0, 8], [0, -8], [-8, 8], [8, -8], [-4, 5], [4, -5]];
    const out = [];
    for (const [dh, dl] of variants) {
      if (out.length >= n) break;
      out.push(toHex(hslToRgb(hsl.h + dh, hsl.s, clamp(hsl.l + dl, 5, 95))));
    }
    return out;
  }

  // Accessibility: contrast of the color as text on white and on black, plus a
  // 1–5 score (1-2 poor, 3-4 good, 5 perfect) derived from WCAG thresholds.
  function a11yScore(ratio) {
    if (ratio >= 7) return 5;        // AAA
    if (ratio >= 4.5) return 4;      // AA normal
    if (ratio >= 3) return 3;        // AA large
    if (ratio >= 2) return 2;
    return 1;
  }
  function accessibility(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const rw = contrastRatio(rgb, { r: 255, g: 255, b: 255 });
    const rb = contrastRatio(rgb, { r: 0, g: 0, b: 0 });
    return {
      onWhite: { ratio: Math.round(rw * 100) / 100, score: a11yScore(rw) },
      onBlack: { ratio: Math.round(rb * 100) / 100, score: a11yScore(rb) }
    };
  }

  return {
    clamp, normalizeHex, hexToRgb, rgbToHex, toHex,
    rgbToHsl, hslToRgb, rgbToCmyk, cmykToRgb,
    parseColor, describe,
    relLuminance, contrastRatio, bestTextOn, wcagLevels,
    rgbToLab, deltaE,
    harmony, shades, similar, accessibility
  };
});
