import type {
  DetectCornersResult,
  ExportMaskResult,
  ImageAsset,
  OpenProjectResult,
  ProjectFile,
  SaveProjectResult
} from '@/types/project';

export interface DesktopDialogsApi {
  openImage: () => Promise<ImageAsset | null>;
  openProject: () => Promise<OpenProjectResult | null>;
}

export interface DesktopProjectsApi {
  save: (payload: {
    project: ProjectFile;
    projectPath?: string | null;
    saveAs?: boolean;
  }) => Promise<SaveProjectResult | null>;
}

export interface DesktopWorkerApi {
  detectCorners: (payload: {
    filePath: string;
    maxCorners?: number;
  }) => Promise<DetectCornersResult>;
  exportMask: (payload: {
    project: ProjectFile;
    projectPath?: string | null;
  }) => Promise<ExportMaskResult | null>;
}

export interface DesktopApi {
  dialogs: DesktopDialogsApi;
  projects: DesktopProjectsApi;
  worker: DesktopWorkerApi;
}

export interface DesktopClient extends DesktopApi {}
