/*
 * main.js — Electron main process for Nuancera
 * ==================================================
 * Responsibilities:
 *   1. Create the application window.
 *   2. Keep the renderer local-first. We install a network blocker that cancels
 *      requests outside local resources and the explicit GitHub release/update
 *      endpoints used for version checks. No analytics or telemetry are sent.
 *   3. Provide a tiny, safe IPC bridge for:
 *        - persisting the saved-palette library to a local JSON file on disk
 *        - writing export files (text and binary) via a native Save dialog
 *
 * No analytics, no telemetry. Update checks only read GitHub Releases.
 */
const { app, BrowserWindow, ipcMain, dialog, session, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

const UPDATE_API_URL = 'https://api.github.com/repos/Chase-DC/nuancera/releases/latest';
const VALID_LANGS = ['zh', 'en', 'fr'];

// ---------------------------------------------------------------------------
// Where saved palettes live on disk.
// app.getPath('userData') resolves to:
//   ~/Library/Application Support/Nuancera/
// We keep a single human-readable JSON file there. Easy to back up, inspect,
// or delete. (A SQLite file could drop in here instead; JSON keeps the app
// dependency-free and avoids native compilation.)
// ---------------------------------------------------------------------------
function libraryPath() {
  return path.join(app.getPath('userData'), 'palette-library.json');
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
  const p = settingsPath();
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeSettings(data) {
  const p = settingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data || {}, null, 2), 'utf8');
  return p;
}

let mainWindow = null;
let updateCheckStarted = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    title: 'Nuancera',
    backgroundColor: '#f7f6f3',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // renderer cannot touch Node directly
      nodeIntegration: false,   // safer; all privileged ops go through IPC
      sandbox: false            // preload needs require(); still no node in renderer
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Never open external URLs in-app; if anything ever requests one, refuse.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => checkForUpdatesOnStartup().catch((err) => {
      console.warn('[updates] check failed:', err.message || err);
    }), 1200);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ---------------------------------------------------------------------------
// LOCAL-FIRST NETWORK POLICY
// Cancel any renderer request that is not a local resource or explicit update
// endpoint. Allowed schemes/hosts:
//   file:    our bundled HTML/JS/CSS/fonts and pdf.js worker
//   devtools/chrome-extension/blob/data: internal renderer plumbing
//   github.com / api.github.com / release-assets.githubusercontent.com:
//            release metadata and installer downloads opened externally
// ---------------------------------------------------------------------------
function installNetworkBlocker() {
  const allowed = ['file:', 'devtools:', 'chrome-extension:', 'blob:', 'data:'];
  const updateHosts = new Set([
    'github.com',
    'api.github.com',
    'release-assets.githubusercontent.com'
  ]);

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    let scheme = '';
    let host = '';
    try {
      const url = new URL(details.url);
      scheme = url.protocol;
      host = url.hostname;
    } catch (_) {
      scheme = '';
    }
    const ok = allowed.includes(scheme) || (scheme === 'https:' && updateHosts.has(host));
    if (!ok) {
      console.warn('[offline] blocked non-local request:', details.url);
    }
    callback({ cancel: !ok });
  });
}

// ---------------------------------------------------------------------------
// IPC: persistent saved-palette library
// ---------------------------------------------------------------------------
ipcMain.handle('library:load', async () => {
  try {
    const p = libraryPath();
    if (!fs.existsSync(p)) return { ok: true, data: { palettes: [] } };
    const raw = fs.readFileSync(p, 'utf8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('library:save', async (_evt, data) => {
  try {
    const p = libraryPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, path: p };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('library:path', async () => libraryPath());

ipcMain.handle('library:reveal', async () => {
  const p = libraryPath();
  if (fs.existsSync(p)) shell.showItemInFolder(p);
  else shell.openPath(path.dirname(p));
  return { ok: true };
});

// ---------------------------------------------------------------------------
// IPC: user settings
// ---------------------------------------------------------------------------
ipcMain.handle('settings:load', async () => {
  try {
    return { ok: true, data: readSettings() };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.on('settings:load-sync', (event) => {
  try {
    event.returnValue = { ok: true, data: readSettings() };
  } catch (err) {
    event.returnValue = { ok: false, error: String(err) };
  }
});

ipcMain.handle('settings:save', async (_evt, data) => {
  try {
    const p = writeSettings({ ...readSettings(), ...(data || {}) });
    return { ok: true, path: p };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ---------------------------------------------------------------------------
// Update checks
// ---------------------------------------------------------------------------
function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': `Nuancera/${app.getVersion()}`
      }
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GitHub returned HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.setTimeout(8000, () => req.destroy(new Error('Update check timed out')));
    req.on('error', reject);
  });
}

function normalizeVersion(version) {
  return String(version || '').trim().replace(/^v/i, '');
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const right = normalizeVersion(b).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    if ((left[i] || 0) > (right[i] || 0)) return 1;
    if ((left[i] || 0) < (right[i] || 0)) return -1;
  }
  return 0;
}

function updateCopy(language) {
  const lang = VALID_LANGS.includes(language) ? language : 'zh';
  const copy = {
    zh: {
      title: '发现新版本',
      message: (latest, current) => `Nuancera ${latest} 已可用。当前版本是 ${current}。`,
      notesLabel: '本次更新日志',
      noNotes: '此版本未填写更新日志。',
      buttons: ['现在更新', '忽略此版本', '下次提醒']
    },
    en: {
      title: 'Update available',
      message: (latest, current) => `Nuancera ${latest} is available. You are using ${current}.`,
      notesLabel: 'Release notes',
      noNotes: 'No release notes were provided for this version.',
      buttons: ['Update now', 'Ignore this version', 'Remind me later']
    },
    fr: {
      title: 'Mise a jour disponible',
      message: (latest, current) => `Nuancera ${latest} est disponible. Version actuelle : ${current}.`,
      notesLabel: 'Notes de version',
      noNotes: 'Aucune note de version n\'a ete fournie pour cette version.',
      buttons: ['Mettre a jour', 'Ignorer cette version', 'Me le rappeler plus tard']
    }
  };
  return copy[lang];
}

function releaseNotes(body) {
  const notes = String(body || '').trim();
  if (!notes) return '';
  return notes.length > 1800 ? `${notes.slice(0, 1800)}...` : notes;
}

function preferredAssetUrl(release) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const platformPattern = process.platform === 'darwin'
    ? /mac-arm64\.dmg$/i
    : process.platform === 'win32'
      ? /win-x64\.exe$/i
      : null;

  if (!platformPattern) return release.html_url;
  const match = assets.find((asset) => platformPattern.test(asset.name || ''));
  return (match && match.browser_download_url) || release.html_url;
}

async function checkForUpdatesOnStartup() {
  if (updateCheckStarted) return;
  updateCheckStarted = true;

  const settings = readSettings();
  const release = await requestJson(UPDATE_API_URL);
  if (release.draft || release.prerelease) return;

  const currentVersion = app.getVersion();
  const latestVersion = normalizeVersion(release.tag_name || release.name);
  if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) return;
  if (settings.ignoredUpdateVersion === latestVersion) return;

  const copy = updateCopy(settings.language);
  const notes = releaseNotes(release.body) || copy.noNotes;
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: copy.title,
    message: copy.message(latestVersion, currentVersion),
    detail: `${copy.notesLabel}:\n\n${notes}`,
    buttons: copy.buttons,
    defaultId: 0,
    cancelId: 2,
    noLink: true
  });

  if (result.response === 0) {
    await shell.openExternal(preferredAssetUrl(release));
    return;
  }
  if (result.response === 1) {
    writeSettings({ ...readSettings(), ignoredUpdateVersion: latestVersion });
  }
}

// ---------------------------------------------------------------------------
// IPC: export files via native Save dialog
//   export:text   -> plain UTF-8 string (hex list, .json, .gpl, .ase-text)
//   export:binary -> base64 payload decoded to bytes (.png swatch sheet, .ase)
// ---------------------------------------------------------------------------
ipcMain.handle('export:text', async (_evt, { defaultName, content }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  fs.writeFileSync(filePath, content, 'utf8');
  return { ok: true, path: filePath };
});

ipcMain.handle('export:binary', async (_evt, { defaultName, base64 }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return { ok: true, path: filePath };
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  // Dev dock icon (the packaged .app gets its icon from electron-builder).
  try {
    if (process.platform === 'darwin') {
      const iconPath = path.join(__dirname, 'build', 'icon.png');
      if (fs.existsSync(iconPath)) app.dock.setIcon(nativeImage.createFromPath(iconPath));
    }
  } catch (_) { /* icon is optional */ }

  installNetworkBlocker();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
