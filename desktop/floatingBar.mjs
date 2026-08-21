/* The coding canvas as an always-on-top floating bar.
 *
 * Additive by construction: this module never touches the main window's
 * configuration or lifecycle. It creates its own window, registers its own
 * global shortcut, and cleans both up on quit.
 *
 * Whether it exists at all is a user preference ("Coding canvas" in Settings),
 * stored server-side in data/config.json. The main process reads that file
 * directly — it has no IPC channel into the main window to ask, and adding one
 * would mean giving that window a preload it currently does not have.
 */

import { BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ACCELERATOR = 'CommandOrControl+Shift+\\';
const DEFAULT_WIDTH = 820;
const DEFAULT_HEIGHT = 520;
const MARGIN_TOP = 90;
/* Smallest size the bar stays usable at: below this the canvas toolbar and
   its editor have nowhere to go. Also the floor for a renderer-requested
   resize. */
const MIN_WIDTH = 480;
const MIN_HEIGHT = 280;
/* Ceiling for a renderer-requested resize. The bar is an always-on-top
   overlay, so an unbounded request from the page could cover the screen. */
const MAX_WIDTH = 2000;
const MAX_HEIGHT = 1400;
/* How often the config file is polled for the canvas-surface preference. See
   applyPreference for why this polls rather than using fs.watch. */
const CONFIG_POLL_MS = 2000;

let ctx = null;
let barWindow = null;
let registered = false;
let watchedConfig = null;
let ipcBound = false;

const configPath = (dataDir) => path.join(dataDir, 'data', 'config.json');

/* 'route' | 'panel' | 'bar' | 'all' — only the last two want this window. */
const barEnabled = (dataDir) => {
  try {
    const raw = fs.readFileSync(configPath(dataDir), 'utf-8');
    const surface = JSON.parse(raw)?.preferences?.canvasSurface ?? 'route';
    return surface === 'bar' || surface === 'all';
  } catch {
    /* No config yet, or mid-write. Default to off — a global shortcut the user
       did not ask for is worse than a missing one. */
    return false;
  }
};

const barURL = () => {
  const base = ctx?.getServerURL?.();
  return base ? `${base}/canvas?surface=bar` : null;
};

const create = () => {
  const url = barURL();
  if (!url) return null;

  const cursor = screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(cursor).workArea;

  const win = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    x: Math.round(area.x + (area.width - DEFAULT_WIDTH) / 2),
    y: Math.round(area.y + MARGIN_TOP),
    frame: false,
    transparent: true,
    hasShadow: true,
    resizable: true,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    show: false,
    title: 'Canvas',
    webPreferences: {
      preload: path.join(__dirname, 'preload-bar.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  /* Float above full-screen apps too, otherwise the shortcut appears to do
     nothing whenever the user is in a full-screen editor — which is exactly
     when they would reach for it. */
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  /* Same policy as the main window: real links open in the system browser
     rather than spawning a second app window. */
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.on('closed', () => {
    barWindow = null;
  });

  win
    .loadURL(url)
    .catch((err) => ctx?.log?.(`floating bar failed to load: ${err}`));

  return win;
};

const show = () => {
  if (!barWindow || barWindow.isDestroyed()) {
    barWindow = create();
    if (!barWindow) return;
    barWindow.once('ready-to-show', () => {
      barWindow?.show();
      barWindow?.focus();
    });
    return;
  }

  /* The server gets a new port whenever it restarts, so a bar left open
     across a restart is pointing at a dead origin. Re-point it on show. */
  const url = barURL();
  if (url && !barWindow.webContents.getURL().startsWith(url.split('?')[0])) {
    barWindow.loadURL(url).catch(() => {});
  }

  barWindow.show();
  barWindow.focus();
};

const hide = () => {
  if (barWindow && !barWindow.isDestroyed()) barWindow.hide();
};

/* Exported so the shortcut is not the only way in — a tray item or menu entry
   can drive the same toggle, and it makes the window testable without
   synthesising a global hotkey. */
export const toggle = () => {
  if (barWindow && !barWindow.isDestroyed() && barWindow.isVisible()) hide();
  else show();
};

export const isVisible = () =>
  Boolean(barWindow && !barWindow.isDestroyed() && barWindow.isVisible());

const destroy = () => {
  if (barWindow && !barWindow.isDestroyed()) barWindow.destroy();
  barWindow = null;
};

const applyPreference = () => {
  if (!ctx) return;

  const wanted = barEnabled(ctx.dataDir);

  if (wanted && !registered) {
    registered = globalShortcut.register(ACCELERATOR, toggle);
    ctx.log?.(
      registered
        ? `floating bar: ${ACCELERATOR} registered`
        : `floating bar: ${ACCELERATOR} is already taken by another app`,
    );
  } else if (!wanted && registered) {
    globalShortcut.unregister(ACCELERATOR);
    registered = false;
    destroy();
    ctx.log?.('floating bar: disabled');
  }
};

export function init({ mainWindow, dataDir, getServerURL, log }) {
  ctx = { dataDir, getServerURL, log };

  if (!ipcBound) {
    ipcBound = true;

    /* Both handlers verify the sender is this window before acting — an IPC
       channel that trusts whoever calls it is a channel any frame can drive. */
    const fromBar = (event) =>
      barWindow &&
      !barWindow.isDestroyed() &&
      event.sender === barWindow.webContents;

    ipcMain.on('canvas-bar:hide', (event) => {
      if (fromBar(event)) hide();
    });

    ipcMain.on('canvas-bar:resize', (event, size) => {
      if (!fromBar(event)) return;
      const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(size?.width || 0)));
      const height = Math.max(
        MIN_HEIGHT,
        Math.min(MAX_HEIGHT, Math.round(size?.height || 0)),
      );
      if (width && height) barWindow.setSize(width, height, true);
    });
  }

  /* The bar must not outlive the main window. On Windows and Linux
     'window-all-closed' is what quits the app, and it only fires when every
     window is gone — a hidden bar would silently keep the process alive after
     the user closed the app. */
  mainWindow?.on('closed', destroy);

  applyPreference();

  /* React to the preference changing in Settings. watchFile polls, which is
     the boring-but-reliable choice across platforms for a file the renderer
     rewrites atomically (write-temp-then-rename defeats fs.watch on some
     systems). */
  const file = configPath(dataDir);
  if (watchedConfig !== file) {
    if (watchedConfig) fs.unwatchFile(watchedConfig);
    fs.watchFile(file, { interval: CONFIG_POLL_MS }, applyPreference);
    watchedConfig = file;
  }
}

export function shutdown() {
  if (registered) {
    globalShortcut.unregister(ACCELERATOR);
    registered = false;
  }
  if (watchedConfig) {
    fs.unwatchFile(watchedConfig);
    watchedConfig = null;
  }
  destroy();
  ctx = null;
}
