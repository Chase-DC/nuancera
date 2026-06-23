/*
 * main.js — Electron main process for Nuancera
 * ==================================================
 * Responsibilities:
 *   1. Create the application window.
 *   2. ENFORCE OFFLINE OPERATION. We install a network blocker that cancels
 *      every request whose URL is not a local file:// / devtools resource.
 *      Even if some future code accidentally tried to reach the internet, it
 *      would be blocked here. This is the backbone of the "zero network" promise.
 *   3. Provide a tiny, safe IPC bridge for:
 *        - persisting the saved-palette library to a local JSON file on disk
 *        - writing export files (text and binary) via a native Save dialog
 *
 * No analytics, no telemetry, no auto-update, no remote anything.
 */
const { app, BrowserWindow, ipcMain, dialog, session, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

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

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    title: 'Nuancera',
    backgroundColor: '#f7f6f3',
    titleBarStyle: 'hiddenInset', // refined, native macOS look
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

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ---------------------------------------------------------------------------
// HARD OFFLINE GUARANTEE
// Cancel any request that is not a local resource. Allowed schemes:
//   file:    our bundled HTML/JS/CSS/fonts and pdf.js worker
//   devtools/chrome-extension/blob/data: internal renderer plumbing
// Everything else (http, https, ws, ...) is cancelled.
// ---------------------------------------------------------------------------
function installNetworkBlocker() {
  const allowed = ['file:', 'devtools:', 'chrome-extension:', 'blob:', 'data:'];
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    let scheme = '';
    try { scheme = new URL(details.url).protocol; } catch (_) { scheme = ''; }
    const ok = allowed.includes(scheme);
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
