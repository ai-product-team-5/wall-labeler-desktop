/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

import type {
  DetectCornersResult,
  ExportMaskResult,
  ImageAsset,
  OpenProjectResult,
  ProjectFile,
  SaveProjectResult
} from '@/types/project';

declare global {
  interface Window {
    api: {
      openImage: () => Promise<ImageAsset | null>;
      openProject: () => Promise<OpenProjectResult | null>;
      detectCorners: (payload: {
        filePath: string;
        maxCorners?: number;
      }) => Promise<DetectCornersResult>;
      saveProject: (payload: {
        project: ProjectFile;
        projectPath?: string | null;
        saveAs?: boolean;
      }) => Promise<SaveProjectResult | null>;
      exportMask: (payload: {
        project: ProjectFile;
        projectPath?: string | null;
      }) => Promise<ExportMaskResult | null>;
    };
  }
}

export {};
