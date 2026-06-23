/*
 * cluster.js — k-means color clustering used by the PDF extractor.
 *
 * Operates in CIE Lab space (perceptually uniform) so that "dominant colors"
 * match how a human would group them, rather than raw RGB distance. Uses
 * k-means++ seeding for stable, repeatable results. Each returned cluster
 * carries a weight = fraction of sampled pixels assigned to it, so palettes
 * can be ordered by visual prominence (area).
 *
 * Loads in browser (window.Cluster) and Node (module.exports).
 */
(function (root, factory) {
  const api = factory(
    typeof require !== 'undefined' ? require('./color-utils.js') : root.CE
  );
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Cluster = api;
})(this, function (CE) {
  'use strict';

  function labOf(rgb) {
    const l = CE.rgbToLab(rgb);
    return [l.L, l.a, l.b];
  }
  function dist2(a, b) {
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  }

  // k-means++ initial centroid selection
  function seed(points, k, rand) {
    const centroids = [points[Math.floor(rand() * points.length)]];
    while (centroids.length < k) {
      const d2 = points.map((p) => {
        let m = Infinity;
        for (const c of centroids) m = Math.min(m, dist2(p, c));
        return m;
      });
      const sum = d2.reduce((a, b) => a + b, 0);
      if (sum === 0) break;
      let r = rand() * sum;
      let idx = 0;
      while (r > d2[idx] && idx < d2.length - 1) { r -= d2[idx]; idx++; }
      centroids.push(points[idx]);
    }
    return centroids;
  }

  // Deterministic PRNG (mulberry32) so results are repeatable run-to-run.
  function prng(seedInt) {
    let a = seedInt >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /*
   * rgbSamples: array of {r,g,b}
   * k: number of clusters
   * returns array of { hex, rgb, weight } sorted by weight desc
   */
  function kmeans(rgbSamples, k, opts = {}) {
    const maxIter = opts.maxIter || 30;
    const rand = prng(opts.seedInt || 1234567);
    if (rgbSamples.length === 0) return [];
    const pts = rgbSamples.map(labOf);
    k = Math.min(k, pts.length);

    let centroids = seed(pts, k, rand);
    let assign = new Array(pts.length).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
      let moved = false;
      // assignment step
      for (let i = 0; i < pts.length; i++) {
        let best = 0, bestD = Infinity;
        for (let c = 0; c < centroids.length; c++) {
          const d = dist2(pts[i], centroids[c]);
          if (d < bestD) { bestD = d; best = c; }
        }
        if (assign[i] !== best) { assign[i] = best; moved = true; }
      }
      // update step
      const sums = centroids.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < pts.length; i++) {
        const a = assign[i];
        sums[a][0] += pts[i][0]; sums[a][1] += pts[i][1];
        sums[a][2] += pts[i][2]; sums[a][3] += 1;
      }
      for (let c = 0; c < centroids.length; c++) {
        if (sums[c][3] > 0) {
          centroids[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
        }
      }
      if (!moved && iter > 0) break;
    }

    // counts per cluster
    const counts = centroids.map(() => 0);
    for (const a of assign) counts[a]++;
    const total = pts.length;

    // Convert each centroid back to a representative RGB: use the mean RGB of
    // its members (more faithful than inverse-Lab of the centroid).
    const rgbSums = centroids.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < rgbSamples.length; i++) {
      const a = assign[i];
      rgbSums[a][0] += rgbSamples[i].r;
      rgbSums[a][1] += rgbSamples[i].g;
      rgbSums[a][2] += rgbSamples[i].b;
      rgbSums[a][3] += 1;
    }

    const out = [];
    for (let c = 0; c < centroids.length; c++) {
      if (rgbSums[c][3] === 0) continue;
      const r = Math.round(rgbSums[c][0] / rgbSums[c][3]);
      const g = Math.round(rgbSums[c][1] / rgbSums[c][3]);
      const b = Math.round(rgbSums[c][2] / rgbSums[c][3]);
      out.push({ hex: CE.rgbToHex(r, g, b), rgb: { r, g, b }, weight: counts[c] / total });
    }
    out.sort((a, b) => b.weight - a.weight);
    return out;
  }

  return { kmeans };
});
