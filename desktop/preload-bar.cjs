/* Preload for the coding-canvas floating bar — the only preload in this app.
 *
 * CommonJS on purpose: the bar window runs with sandbox: true (the Electron
 * default once nodeIntegration is off), and a sandboxed renderer cannot load
 * an ESM preload.
 *
 * Deliberately tiny. The main window has no preload at all, which is what
 * gives the renderer — and therefore the code the canvas executes — zero reach
 * into Node or the main process. This window needs exactly two things a web
 * page cannot do for itself: dismiss itself, and ask to be resized. Nothing
 * else is exposed, and nothing here accepts a path, a URL, or a command.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('simplicityBar', {
  hide: () => ipcRenderer.send('canvas-bar:hide'),
  resize: (width, height) =>
    ipcRenderer.send('canvas-bar:resize', {
      width: Number(width) || 0,
      height: Number(height) || 0,
    }),
});
