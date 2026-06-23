/*
 * preload.js — secure bridge between the sandboxed renderer and the main process.
 *
 * The renderer (the UI) has NO direct Node.js access. It can only call the
 * handful of functions we explicitly expose here on window.api. Each one is a
 * thin wrapper over an IPC channel handled in main.js.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Persistent saved-palette library (local JSON on disk)
  loadLibrary: () => ipcRenderer.invoke('library:load'),
  saveLibrary: (data) => ipcRenderer.invoke('library:save', data),
  libraryPath: () => ipcRenderer.invoke('library:path'),
  revealLibrary: () => ipcRenderer.invoke('library:reveal'),

  // Exports through native Save dialog
  exportText: (defaultName, content) =>
    ipcRenderer.invoke('export:text', { defaultName, content }),
  exportBinary: (defaultName, base64) =>
    ipcRenderer.invoke('export:binary', { defaultName, base64 })
});
