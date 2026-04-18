import type { ImageAsset, ProjectFile, ThemeMode, WallStroke } from '@/types/project';

export function createEmptyProject(image: ImageAsset, theme: ThemeMode): ProjectFile {
  const now = new Date().toISOString();
  return {
    kind: 'wall-label-project',
    version: 1,
    image: {
      fileName: image.fileName,
      filePath: image.filePath,
      width: image.width,
      height: image.height
    },
    settings: {
      defaultWallWidthPx: 4,
      snapRadiusPx: 10,
      snapToCorners: true,
      showCorners: true,
      theme
    },
    candidateCorners: [],
    walls: [],
    meta: {
      createdAt: now,
      updatedAt: now
    }
  };
}

export function cloneWalls(walls: WallStroke[]) {
  return walls.map((wall) => ({
    ...wall,
    points: wall.points.map((point) => ({ ...point }))
  }));
}
