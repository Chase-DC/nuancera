const fs = require('fs/promises');

const STORE_MIN_VERSION = '10.0.17763.0';

module.exports = async function patchAppxManifest(manifestPath) {
  const manifest = await fs.readFile(manifestPath, 'utf8');
  const patched = manifest.replace(
    /<TargetDeviceFamily Name="Windows\.Desktop" MinVersion="[^"]+" MaxVersionTested="[^"]+" \/>/,
    `<TargetDeviceFamily Name="Windows.Desktop" MinVersion="${STORE_MIN_VERSION}" MaxVersionTested="${STORE_MIN_VERSION}" />`
  );

  if (patched === manifest) {
    throw new Error('Unable to patch AppX TargetDeviceFamily MinVersion.');
  }

  await fs.writeFile(manifestPath, patched);
};
