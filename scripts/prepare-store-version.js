/*
 * Prepare package metadata for Microsoft Store AppX builds.
 *
 * The normal local iteration version can be a SemVer prerelease such as
 * 0.0.7-local.1, but electron-builder requires package.json.version to be
 * a valid three-part SemVer value. For Store packages, map it to 0.0.7;
 * electron-builder will then write 0.0.7.0 into the AppX manifest.
 */
const fs = require('fs');

function storeVersionFrom(raw) {
  const match = String(raw || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Cannot derive Store version from ${raw}`);
  }
  return `${match[1]}.${match[2]}.${match[3]}`;
}

function updateJson(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const raw = data.version || (data.packages && data.packages[''] && data.packages[''].version);
  const storeVersion = storeVersionFrom(raw);

  if (data.version) data.version = storeVersion;
  if (data.packages && data.packages['']) data.packages[''].version = storeVersion;

  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${file}: ${raw} -> ${storeVersion}`);
}

updateJson('package.json');
updateJson('package-lock.json');
