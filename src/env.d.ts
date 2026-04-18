/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

import type { DesktopApi } from '@/types/desktop';

declare global {
  interface Window {
    api: DesktopApi;
  }
}

export {};
