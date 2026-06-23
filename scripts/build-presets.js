/*
 * build-presets.js — generates renderer/data/presets.json
 *
 * Scientific colormap values (viridis, cividis, mako, rocket, crest, flare,
 * magma) and the ColorBrewer sets are sampled directly from matplotlib /
 * seaborn (authentic LUTs), not eyeballed. The editorial "house" palettes are
 * hand-designed muted/desaturated sets in the Nature-editorial spirit.
 *
 * Each palette is auto-tagged with a colorblind verdict using the app's OWN
 * vision.js assessment, so the badge you see in the UI is computed the same way
 * everywhere. Run with:  node scripts/build-presets.js
 */
const fs = require('fs');
const path = require('path');
const Vision = require('../renderer/js/vision.js');

// --- authentic LUT samples (from matplotlib/seaborn) -----------------------
const SCI = {
  viridis: ['#440154', '#443983', '#31688e', '#21918c', '#35b779', '#90d743', '#fde725'],
  cividis: ['#00224e', '#2a3f6d', '#575d6d', '#7d7c78', '#a59c74', '#d2c060', '#fee838'],
  mako: ['#0b0405', '#332345', '#40498e', '#357ba3', '#38aaac', '#79d6ae', '#def5e5'],
  rocket: ['#03051a', '#3f1b43', '#841e5a', '#cb1b4f', '#f06043', '#f6ab83', '#faebdd'],
  crest: ['#a5cd90', '#76b791', '#509e90', '#33858d', '#1d6c8a', '#234f81', '#2c3172'],
  flare: ['#edb081', '#e98768', '#de5d5c', '#c14168', '#9a3670', '#722c6e', '#4b2362'],
  magma: ['#000004', '#2c115f', '#721f81', '#b73779', '#f1605d', '#feb078', '#fcfdbf']
};
const CB_SEQ = {
  Blues: ['#f7fbff', '#d0e1f2', '#94c4df', '#4a98c9', '#1764ab', '#08306b'],
  BuGn: ['#f7fcfd', '#d6f0ee', '#8fd4c2', '#48b27f', '#157f3b', '#00441b'],
  YlGnBu: ['#ffffd9', '#d6efb3', '#73c8bd', '#2498c1', '#234da0', '#081d58'],
  YlOrBr: ['#ffffe5', '#feeba2', '#febb47', '#f07818', '#b84203', '#662506'],
  PuBuGn: ['#fff7fb', '#dbd8ea', '#99b9d9', '#4095c3', '#027976', '#014636']
};
const CB_DIV = {
  RdBu: ['#67001f', '#c94741', '#f7b799', '#f6f7f7', '#a7d0e4', '#3783bb', '#053061'],
  BrBG: ['#543005', '#ad7021', '#e7cf94', '#f4f5f5', '#98d7cd', '#23867e', '#003c30'],
  PuOr: ['#7f3b08', '#d0730f', '#fdc57f', '#f6f6f7', '#bfbbda', '#70589f', '#2d004b'],
  Spectral: ['#9e0142', '#e95c47', '#fdbf6f', '#ffffbe', '#bfe5a0', '#54aead', '#5e4fa2'],
  RdYlBu: ['#a50026', '#ea5739', '#fdbf71', '#feffc0', '#bde2ee', '#6399c7', '#313695']
};
const CB_QUAL = {
  Set2: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
  Dark2: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666'],
  Set1: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'],
  Paired: ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a']
};

// --- hand-designed editorial "house" palettes ------------------------------
const EDITORIAL = [
  { id: 'editorial-navy', name: 'Editorial Navy', type: 'qualitative', moods: ['editorial', 'cool'],
    colors: ['#1b3a5c', '#2f6b7e', '#5a8a8c', '#9aa7a0', '#c99a4e'] },
  { id: 'terracotta-field', name: 'Terracotta Field', type: 'qualitative', moods: ['warm', 'editorial'],
    colors: ['#7c3a2d', '#b5654a', '#d99a6c', '#e3cf9e', '#7d8a6a'] },
  { id: 'slate-minimal', name: 'Slate Minimal', type: 'qualitative', moods: ['cool', 'minimal'],
    colors: ['#2b3a42', '#4a5f6a', '#748a93', '#a9b7bc', '#d6dde0'] },
  { id: 'muted-jewel', name: 'Muted Jewel', type: 'qualitative', moods: ['editorial'],
    colors: ['#46324f', '#2f5d62', '#8a6d3b', '#934b3c', '#6b7a4f'] },
  { id: 'harbor', name: 'Harbor', type: 'qualitative', moods: ['cool', 'editorial'],
    colors: ['#13344b', '#2e6e8e', '#5fa8a0', '#cfc1a8', '#8a5a44'] },
  { id: 'sage-stone', name: 'Sage & Stone', type: 'qualitative', moods: ['warm', 'minimal'],
    colors: ['#5b6b54', '#8a9779', '#b9b6a3', '#d8d2c4', '#6e5d4e'] },
  { id: 'ink-brick', name: 'Ink & Brick', type: 'qualitative', moods: ['high-contrast', 'editorial'],
    colors: ['#1f2933', '#3e4c59', '#9aa5b1', '#b54b3a', '#d99a2b'] },
  { id: 'twilight-editorial', name: 'Twilight Editorial', type: 'qualitative', moods: ['cool', 'editorial'],
    colors: ['#33324e', '#4a5a7a', '#7c91a8', '#c7a98f', '#a85d4a'] },
  { id: 'navy-sequential', name: 'Navy (sequential)', type: 'sequential', moods: ['cool', 'minimal'],
    colors: ['#eef3f7', '#c5d6e2', '#94b2c6', '#5c849f', '#2f5b78', '#133247'] },
  { id: 'ochre-sequential', name: 'Ochre (sequential)', type: 'sequential', moods: ['warm', 'editorial'],
    colors: ['#fbf3e2', '#f0ddae', '#dcb96e', '#c0903f', '#93611f', '#5c3a10'] },
  { id: 'slate-ochre-div', name: 'Slate–Ochre (diverging)', type: 'diverging', moods: ['editorial', 'high-contrast'],
    colors: ['#173a52', '#3f7494', '#9cc0d4', '#f2efe9', '#e0bd86', '#bd8a3a', '#7a531b'] }
];

const moodFor = {
  viridis: ['cool', 'minimal'], cividis: ['cool', 'minimal'], mako: ['cool', 'editorial'],
  rocket: ['warm', 'high-contrast'], crest: ['cool', 'editorial'], flare: ['warm', 'editorial'],
  magma: ['warm', 'high-contrast'],
  Blues: ['cool', 'minimal'], BuGn: ['cool'], YlGnBu: ['cool'], YlOrBr: ['warm'], PuBuGn: ['cool'],
  RdBu: ['high-contrast'], BrBG: ['warm', 'editorial'], PuOr: ['editorial'], Spectral: ['high-contrast'], RdYlBu: ['high-contrast'],
  Set2: ['minimal'], Dark2: ['editorial'], Set1: ['high-contrast'], Paired: ['minimal']
};

const palettes = [];
function add(id, name, colors, type, source, note) {
  const verdict = Vision.assessPalette(colors).verdict;
  palettes.push({
    id, name, colors, type,
    moods: moodFor[id] || ['editorial'],
    source: source || 'custom',
    colorblind: verdict, // 'safe' | 'caution' | 'risky' | 'n/a'
    note: note || ''
  });
}

// Okabe-Ito (exact, the reference colorblind-safe qualitative set)
add('okabe-ito', 'Okabe–Ito', ['#000000', '#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00', '#cc79a7'],
  'qualitative', 'Okabe & Ito (2008)', 'The reference colorblind-safe qualitative set.');

for (const [id, colors] of Object.entries(SCI))
  add(id, id[0].toUpperCase() + id.slice(1), colors, 'sequential', 'matplotlib/seaborn',
    'Perceptually uniform colormap.');
for (const [id, colors] of Object.entries(CB_SEQ))
  add(id, id, colors, 'sequential', 'ColorBrewer', 'ColorBrewer sequential.');
for (const [id, colors] of Object.entries(CB_DIV))
  add(id, id, colors, 'diverging', 'ColorBrewer', 'ColorBrewer diverging.');
for (const [id, colors] of Object.entries(CB_QUAL))
  add(id, id, colors, 'qualitative', 'ColorBrewer', 'ColorBrewer qualitative.');

for (const p of EDITORIAL) {
  const verdict = Vision.assessPalette(p.colors).verdict;
  palettes.push({ ...p, source: 'Palette Studio', colorblind: verdict, note: '' });
}

const dataDir = path.resolve(__dirname, '..', 'renderer', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const payload = { version: 1, palettes };
// (a) JSON — a clean deliverable / inspectable artifact
fs.writeFileSync(path.join(dataDir, 'presets.json'), JSON.stringify(payload, null, 2));
// (b) JS global — loaded by the app via a plain <script> tag, so there is no
//     fetch() and therefore no file:// / CSP friction. Fully static + offline.
fs.writeFileSync(
  path.join(dataDir, 'presets.js'),
  '/* AUTO-GENERATED by scripts/build-presets.js — do not edit by hand. */\n' +
    'window.PRESETS = ' + JSON.stringify(payload) + ';\n'
);
console.log('Wrote', palettes.length, 'presets -> renderer/data/presets.json + presets.js');
// quick summary of colorblind tags
const counts = palettes.reduce((m, p) => ((m[p.colorblind] = (m[p.colorblind] || 0) + 1), m), {});
console.log('colorblind tags:', counts);
