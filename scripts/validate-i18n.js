/*
 * validate-i18n.js — dev utility.
 * Checks that (a) every data-i18n key used in index.html exists in the English
 * dictionary, and (b) the zh and fr dictionaries have the same keys as en.
 * Run: node scripts/validate-i18n.js   (exits non-zero if anything is missing)
 */
const fs = require('fs');
const root = require('path').resolve(__dirname, '..');
const html = fs.readFileSync(root + '/renderer/index.html', 'utf8');
const i18n = fs.readFileSync(root + '/renderer/js/i18n.js', 'utf8');

const used = new Set();
for (const m of html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)) used.add(m[1]);

function keysOf(start, end) {
  const block = i18n.slice(i18n.indexOf(start), end ? i18n.indexOf(end) : i18n.length);
  return new Set([...block.matchAll(/'([\w.\-]+)':/g)].map((m) => m[1]));
}
const en = keysOf('en: {', 'zh: {');
const zh = keysOf('zh: {', 'fr: {');
const fr = keysOf('fr: {', 'function t(');
const enArr = [...en];

const missHtml = [...used].filter((k) => !en.has(k));
const missZh = enArr.filter((k) => !zh.has(k));
const missFr = enArr.filter((k) => !fr.has(k));

console.log('counts en/zh/fr:', en.size, zh.size, fr.size);
console.log('HTML keys missing from EN:', missHtml);
console.log('zh missing vs en:', missZh);
console.log('fr missing vs en:', missFr);

if (missHtml.length || missZh.length || missFr.length) process.exit(1);
console.log('i18n OK');
