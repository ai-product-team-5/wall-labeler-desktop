const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  dialogs: {
    openImage: () => ipcRenderer.invoke('dialogs:open-image'),
    openProject: () => ipcRenderer.invoke('dialogs:open-project')
  },
  projects: {
    save: (payload) => ipcRenderer.invoke('projects:save', payload)
  },
  worker: {
    detectCorners: (payload) => ipcRenderer.invoke('worker:detect-corners', payload),
    exportMask: (payload) => ipcRenderer.invoke('worker:export-mask', payload)
  }
});
