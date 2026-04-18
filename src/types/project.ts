export type ThemeMode = 'light' | 'dark';

export interface Point {
  x: number;
  y: number;
}

export interface CornerPoint extends Point {
  id: string;
  score?: number;
  source?: string;
}

export interface WallPoint extends Point {
  cornerId?: string | null;
}

export interface WallStroke {
  id: string;
  type: 'centerline';
  widthPx: number;
  points: WallPoint[];
  createdAt: string;
}

export interface ImageAsset {
  fileName: string;
  filePath: string;
  width: number;
  height: number;
  dataUrl: string;
}

export interface ProjectFile {
  kind: 'wall-label-project';
  version: 1;
  image: Omit<ImageAsset, 'dataUrl'>;
  settings: {
    defaultWallWidthPx: number;
    snapRadiusPx: number;
    snapToCorners: boolean;
    showCorners: boolean;
    theme: ThemeMode;
  };
  candidateCorners: CornerPoint[];
  walls: WallStroke[];
  meta: {
    createdAt: string;
    updatedAt: string;
  };
}

export interface OpenProjectResult {
  projectPath: string;
  project: ProjectFile;
  image: ImageAsset;
}

export interface DetectCornersResult {
  corners: CornerPoint[];
  stats?: {
    contourCandidates: number;
    lineSegments: number;
    intersections: number;
    clustered: number;
  };
}

export interface SaveProjectResult {
  projectPath: string;
  project: ProjectFile;
}

export interface ExportMaskResult {
  outputPath: string;
  wallCount: number;
}

export interface DraftState {
  active: boolean;
  points: number;
}
