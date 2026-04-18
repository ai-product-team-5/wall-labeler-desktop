const { app, BrowserWindow } = require('electron');
const { registerIpcHandlers } = require('./main/ipc-handlers.cjs');
const { createMainWindow } = require('./main/window.cjs');

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
