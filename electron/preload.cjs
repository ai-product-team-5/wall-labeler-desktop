const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openImage: () => ipcRenderer.invoke('dialog:open-image'),
  openProject: () => ipcRenderer.invoke('dialog:open-project'),
  detectCorners: (payload) => ipcRenderer.invoke('corners:detect', payload),
  saveProject: (payload) => ipcRenderer.invoke('project:save', payload),
  exportMask: (payload) => ipcRenderer.invoke('project:export-mask', payload)
});
