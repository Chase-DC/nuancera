/*
 * preload.js — secure bridge between the sandboxed renderer and the main process.
 *
 * The renderer (the UI) has NO direct Node.js access. It can only call the
 * handful of functions we explicitly expose here on window.api. Each one is a
 * thin wrapper over an IPC channel handled in main.js.
 */
const { contextBridge, ipcRenderer } = require('electron');

const LANG_KEY = 'nuancera.lang';
const LANGS = ['zh', 'en', 'fr'];
let cachedSettings = {};

// Seed the renderer's existing language loader before app.js runs. This keeps
// the UI code simple while making the preference survive app updates and moves.
try {
  const res = ipcRenderer.sendSync('settings:load-sync');
  cachedSettings = (res && res.ok && res.data) ? res.data : {};
  if (LANGS.includes(cachedSettings.language)) {
    localStorage.setItem(LANG_KEY, cachedSettings.language);
  }
} catch (_) {}

window.addEventListener('DOMContentLoaded', () => {
  const langSelect = document.getElementById('langSelect');
  if (!langSelect) return;
  langSelect.addEventListener('change', () => {
    const language = langSelect.value;
    if (!LANGS.includes(language)) return;
    cachedSettings = { ...cachedSettings, language };
    ipcRenderer.invoke('settings:save', cachedSettings).catch(() => {});
  });
});

contextBridge.exposeInMainWorld('api', {
  // Persistent saved-palette library (local JSON on disk)
  loadLibrary: () => ipcRenderer.invoke('library:load'),
  saveLibrary: (data) => ipcRenderer.invoke('library:save', data),
  libraryPath: () => ipcRenderer.invoke('library:path'),
  revealLibrary: () => ipcRenderer.invoke('library:reveal'),

  // Persistent user settings (local JSON on disk)
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (data) => ipcRenderer.invoke('settings:save', data),

  // Exports through native Save dialog
  exportText: (defaultName, content) =>
    ipcRenderer.invoke('export:text', { defaultName, content }),
  exportBinary: (defaultName, base64) =>
    ipcRenderer.invoke('export:binary', { defaultName, base64 })
});
