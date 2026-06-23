/*
 * vision.js — color-blindness simulation + palette safety check.
 *
 * Uses the widely-used approximate confusion matrices (applied to sRGB) for
 * dichromatic vision. These are approximations — good enough to FLAG risk in a
 * palette, not a clinical simulator. We support the three dichromacies:
 *   protanopia   (no L cones)
 *   deuteranopia (no M cones)  <- most common
 *   tritanopia   (no S cones)
 *
 * Safety logic: simulate the whole palette under deuteranopia & protanopia,
 * then look at the smallest perceptual gap (deltaE) between any two colors.
 * If colors collapse together under simulation, the palette is risky for
 * colorblind viewers.
 *
 * Loads in browser (window.Vision) and Node (module.exports).
 */
(function (root, factory) {
  const api = factory(
    typeof require !== 'undefined' ? require('./color-utils.js') : root.CE
  );
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Vision = api;
})(this, function (CE) {
  'use strict';

  /*
   * Machado, Oliveira & Fernandes (2009) dichromacy matrices at severity 1.0.
   * These are applied in LINEAR sRGB space (gamma removed), which is what makes
   * them collapse confusable red/green pairs realistically — unlike the naive
   * matrices that operate on gamma-encoded values. Reference values are the
   * canonical ones reproduced across many color-vision tools.
   */
  const MATRICES = {
    protanopia: [
      [0.152286, 1.052583, -0.204868],
      [0.114503, 0.786281, 0.099216],
      [-0.003882, -0.048116, 1.051998]
    ],
    deuteranopia: [
      [0.367322, 0.860646, -0.227968],
      [0.280085, 0.672501, 0.047413],
      [-0.011820, 0.042940, 0.968881]
    ],
    tritanopia: [
      [1.255528, -0.076749, -0.178779],
      [-0.078411, 0.930809, 0.147602],
      [0.004733, 0.691367, 0.303900]
    ]
  };

  // sRGB gamma transfer functions (8-bit <-> linear)
  function toLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function toSrgb(c) {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return CE.clamp(Math.round(v * 255), 0, 255);
  }

  function simulateRgb(rgb, type) {
    const m = MATRICES[type];
    if (!m) return rgb;
    const R = toLinear(rgb.r), G = toLinear(rgb.g), B = toLinear(rgb.b);
    const lin = (row) => row[0] * R + row[1] * G + row[2] * B;
    return { r: toSrgb(lin(m[0])), g: toSrgb(lin(m[1])), b: toSrgb(lin(m[2])) };
  }

  function simulateHex(hex, type) {
    const rgb = CE.hexToRgb(hex);
    if (!rgb) return hex;
    const sim = simulateRgb(rgb, type);
    return CE.rgbToHex(sim.r, sim.g, sim.b);
  }

  // Smallest pairwise deltaE within an array of hex colors after simulation.
  function minPairwiseDeltaE(hexes, type) {
    const sims = hexes.map((h) => simulateRgb(CE.hexToRgb(h), type));
    let min = Infinity, pair = null;
    for (let i = 0; i < sims.length; i++) {
      for (let j = i + 1; j < sims.length; j++) {
        const d = CE.deltaE(sims[i], sims[j]);
        if (d < min) { min = d; pair = [i, j]; }
      }
    }
    return { min: min === Infinity ? null : min, pair };
  }

  /*
   * Assess a palette for color-vision safety.
   *
   * The HEADLINE verdict is driven by the two common red-green deficiencies
   * (deuteranopia + protanopia), which together account for ~99% of color
   * blindness. Tritanopia (blue-yellow, ~1%) is reported separately so it
   * informs without unfairly downgrading palettes — e.g. the Okabe-Ito set is
   * engineered for red-green safety and should read "safe" here.
   *
   * deltaE thresholds on the common-deficiency minimum (perceptual):
   *   < 8   -> colors easily confused -> "risky"
   *   8-13  -> borderline             -> "caution"
   *   >= 13 -> well separated         -> "safe"
   */
  function assessPalette(hexes) {
    const valid = hexes.filter((h) => CE.hexToRgb(h));
    if (valid.length < 2) {
      return { verdict: 'n/a', note: 'Need at least two colors to assess.', details: {} };
    }
    const types = ['deuteranopia', 'protanopia', 'tritanopia'];
    const details = {};
    for (const t of types) {
      const { min, pair } = minPairwiseDeltaE(valid, t);
      details[t] = { minDeltaE: Math.round(min * 10) / 10, pair };
    }

    const commonMin = Math.min(details.deuteranopia.minDeltaE, details.protanopia.minDeltaE);
    let verdict = 'safe';
    if (commonMin < 8) verdict = 'risky';
    else if (commonMin < 13) verdict = 'caution';

    let note =
      verdict === 'safe'
        ? 'Colors stay distinguishable for the common red-green deficiencies.'
        : verdict === 'caution'
        ? 'Some colors get close for red-green viewers. Consider varying lightness, not just hue.'
        : 'Two or more colors collapse together for red-green viewers. Differentiate by lightness or shape.';

    // Tritanopia is informational only.
    if (details.tritanopia.minDeltaE < 8) {
      note += ' (Blue-yellow deficiency also brings a pair close.)';
    }

    return { verdict, note, commonMinDeltaE: Math.round(commonMin * 10) / 10, details };
  }

  return { simulateRgb, simulateHex, minPairwiseDeltaE, assessPalette, MATRICES };
});
