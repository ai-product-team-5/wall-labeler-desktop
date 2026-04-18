import type { DesktopApi, DesktopClient } from '@/types/desktop';

function requireDesktopApi(): DesktopApi {
  if (!window.api) {
    throw new Error('桌面桥接接口未注入，请确认 Electron preload 已加载。');
  }

  return window.api;
}

export const desktopClient: DesktopClient = {
  dialogs: {
    openImage: () => requireDesktopApi().dialogs.openImage(),
    openProject: () => requireDesktopApi().dialogs.openProject()
  },
  projects: {
    save: (payload) => requireDesktopApi().projects.save(payload)
  },
  worker: {
    detectCorners: (payload) => requireDesktopApi().worker.detectCorners(payload),
    exportMask: (payload) => requireDesktopApi().worker.exportMask(payload)
  }
};
