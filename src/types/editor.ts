import type { DraftState, ImageAsset, ThemeMode, WallStroke, CornerPoint } from '@/types/project';

export interface ProjectEditorState {
  image: ImageAsset | null;
  walls: WallStroke[];
  candidateCorners: CornerPoint[];
  projectPath: string | null;
  selectedWallId: string | null;
  theme: ThemeMode;
  defaultWallWidthPx: number;
  snapRadiusPx: number;
  snapToCorners: boolean;
  showCorners: boolean;
  dirty: boolean;
  detectingCorners: boolean;
  draftState: DraftState;
}

export interface ProjectEditorView {
  hasImage: boolean;
  hasSelectedWall: boolean;
  selectedWall: WallStroke | null;
  appThemeClass: string;
  activeName: string;
  projectBadge: string;
  canvasStatus: string;
  cornerSnapStatus: string;
  cornerDisplayStatus: string;
  cornerSnapToolLabel: string;
  cornerDisplayToolLabel: string;
}

export interface ProjectEditorActions {
  importImage: () => Promise<void>;
  openProject: () => Promise<void>;
  detectCorners: () => Promise<void>;
  saveProject: (saveAs?: boolean) => Promise<void>;
  exportMask: () => Promise<void>;
  onCreateWall: (wall: WallStroke) => void;
  deleteSelectedWall: () => void;
}

export interface ProjectEditorControls {
  finishDraft: () => void;
  cancelDraft: () => void;
  fitCanvas: () => void;
  focusDrawing: () => void;
  toggleCornerSnap: () => void;
  toggleShowCorners: () => void;
  toggleTheme: () => void;
  setSelectedWallId: (wallId: string | null) => void;
  toggleWallSelection: (wallId: string) => void;
  updateDraftState: (state: DraftState) => void;
  setDefaultWallWidthPx: (value: number) => void;
  setSnapRadiusPx: (value: number) => void;
  setSnapToCorners: (value: boolean) => void;
  setShowCorners: (value: boolean) => void;
}

export interface ProjectEditor {
  state: ProjectEditorState;
  view: ProjectEditorView;
  actions: ProjectEditorActions;
  controls: ProjectEditorControls;
}

export interface ToolbarState {
  imageReady: boolean;
  detectingCorners: boolean;
  draftActive: boolean;
  hasSelection: boolean;
  snapToCorners: boolean;
  showCorners: boolean;
  cornerSnapToolLabel: string;
  cornerDisplayToolLabel: string;
  theme: ThemeMode;
}

export interface ToolbarActions {
  importImage: () => void | Promise<void>;
  openProject: () => void | Promise<void>;
  saveProject: () => void | Promise<void>;
  exportMask: () => void | Promise<void>;
  focusDrawing: () => void;
  finishDraft: () => void;
  cancelDraft: () => void;
  deleteWall: () => void;
  detectCorners: () => void | Promise<void>;
  toggleCornerSnap: () => void;
  toggleShowCorners: () => void;
  fitCanvas: () => void;
  toggleTheme: () => void;
}

export interface EditorSettingsModel {
  image: ImageAsset | null;
  wallWidthPx: number;
  snapRadiusPx: number;
  snapToCorners: boolean;
  showCorners: boolean;
  setWallWidthPx: (value: number) => void;
  setSnapRadiusPx: (value: number) => void;
  setSnapToCorners: (value: boolean) => void;
  setShowCorners: (value: boolean) => void;
}

export interface EditorStatusModel {
  canvasStatus: string;
  cornerSnapStatus: string;
  cornerDisplayStatus: string;
  candidateCornerCount: number;
  wallCount: number;
  draftActive: boolean;
  draftPointCount: number;
}

export interface CanvasHudModel {
  canvasStatus: string;
  draftState: DraftState;
}

export interface WallListModel {
  walls: WallStroke[];
  selectedWallId: string | null;
}

export interface SelectedWallModel {
  wall: WallStroke;
}

export interface CanvasBoardBindings {
  image: ImageAsset | null;
  walls: WallStroke[];
  candidateCorners: CornerPoint[];
  selectedWallId: string | null;
  wallWidthPx: number;
  snapRadiusPx: number;
  snapToCorners: boolean;
  showCorners: boolean;
  theme: ThemeMode;
}
