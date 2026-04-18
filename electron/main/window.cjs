const { BrowserWindow } = require('electron');
const path = require('node:path');
const { APP_NAME, APP_ROOT } = require('./config.cjs');

function loadRenderer(win) {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    return win.loadURL(devServerUrl);
  }

  return win.loadFile(path.join(APP_ROOT, 'dist', 'index.html'));
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1520,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    title: APP_NAME,
    backgroundColor: '#eef2f7',
    autoHideMenuBar: true,
    webPreferences: {
      // preload 是 renderer 和 Electron 主进程之间的最小桥。
      preload: path.join(__dirname, '..', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  void loadRenderer(win);
  return win;
}

module.exports = {
  createMainWindow
};
