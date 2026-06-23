/*
 * copy-vendor.js
 * --------------
 * Runs automatically after `npm install` (see "postinstall" in package.json).
 *
 * Its only job is to copy the locally-installed pdf.js library files out of
 * node_modules and into renderer/vendor/pdfjs/ so the app can load them with a
 * plain <script> tag using a relative file:// path. This keeps PDF parsing
 * 100% local — there is never a CDN or network request involved.
 *
 * We pin pdfjs-dist to the 3.x "legacy" UMD build, which exposes a global
 * `pdfjsLib` and works without an ES-module bundler.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build');
const destDir = path.join(root, 'renderer', 'vendor', 'pdfjs');

const files = ['pdf.js', 'pdf.worker.js'];

function main() {
  if (!fs.existsSync(srcDir)) {
    console.error(
      '[copy-vendor] Could not find pdfjs-dist legacy build at:\n  ' +
        srcDir +
        '\nDid `npm install` finish? PDF extraction will not work until this exists.'
    );
    process.exit(0); // do not hard-fail the install
  }
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of files) {
    const from = path.join(srcDir, f);
    const to = path.join(destDir, f);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, to);
      console.log('[copy-vendor] copied', f, '->', path.relative(root, to));
    } else {
      console.warn('[copy-vendor] missing', from);
    }
  }
  console.log('[copy-vendor] done. pdf.js is bundled locally for offline use.');
}

main();
