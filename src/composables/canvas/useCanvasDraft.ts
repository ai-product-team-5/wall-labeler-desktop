import { computed, ref, watch, type Ref } from 'vue';
import type {
  CornerPoint,
  DraftState,
  ImageAsset,
  Point,
  WallStroke
} from '@/types/project';
import {
  distance,
  flattenPoints,
  projectPointToPolyline,
  roundPoint
} from '@/utils/geometry';

interface DraftWall {
  widthPx: number;
  points: Array<{ x: number; y: number; cornerId?: string | null }>;
}

type SnapSource = 'candidate-corner' | 'wall-endpoint';

export interface SnapCandidate extends Point {
  id: string;
  source: SnapSource;
  cornerId?: string | null;
}

interface UseCanvasDraftOptions {
  image: Ref<ImageAsset | null>;
  walls: Ref<WallStroke[]>;
  candidateCorners: Ref<CornerPoint[]>;
  selectedWallId: Ref<string | null>;
  wallWidthPx: Ref<number>;
  snapRadiusPx: Ref<number>;
  snapToCorners: Ref<boolean>;
  stageToImagePoint: (config?: { allowOutsideImage?: boolean }) => Point | null;
  emitCreateWall: (wall: WallStroke) => void;
  emitSelectWall: (wallId: string | null) => void;
  emitDraftState: (state: DraftState) => void;
}

interface ResolvedDraftPoint {
  point: Point;
  snap: SnapCandidate | null;
  cornerId: string | null;
}

export function useCanvasDraft(options: UseCanvasDraftOptions) {
  const draft = ref<DraftWall | null>(null);
  const hoverPoint = ref<Point | null>(null);
  const snapTarget = ref<SnapCandidate | null>(null);

  const wallEndpointSnapPoints = computed<SnapCandidate[]>(() => {
    const pointMap = new Map<string, SnapCandidate>();

    for (const wall of options.walls.value) {
      const endpoints = [wall.points[0], wall.points[wall.points.length - 1]];
      endpoints.forEach((point, index) => {
        if (!point) return;

        const roundedPoint = roundPoint(point);
        const key = `${roundedPoint.x}:${roundedPoint.y}`;
        const existing = pointMap.get(key);
        if (existing) {
          existing.cornerId = existing.cornerId ?? point.cornerId ?? null;
          return;
        }

        pointMap.set(key, {
          id: `${wall.id}:${index === 0 ? 'start' : 'end'}`,
          x: point.x,
          y: point.y,
          source: 'wall-endpoint',
          cornerId: point.cornerId ?? null
        });
      });
    }

    return [...pointMap.values()];
  });

  const draftLinePoints = computed(() => {
    if (!draft.value) return [];
    const points = [...draft.value.points];
    if (hoverPoint.value) {
      points.push({ x: hoverPoint.value.x, y: hoverPoint.value.y });
    }
    return flattenPoints(points);
  });

  function syncDraftState() {
    options.emitDraftState({
      active: Boolean(draft.value),
      points: draft.value?.points.length ?? 0
    });
  }

  function findNearestWithinRadius<T extends Point>(point: Point, candidates: T[]) {
    let nearest: T | null = null;
    let minDistance = Infinity;

    for (const candidate of candidates) {
      const currentDistance = distance(point, candidate);
      if (currentDistance < minDistance) {
        minDistance = currentDistance;
        nearest = candidate;
      }
    }

    if (nearest && minDistance <= options.snapRadiusPx.value) {
      return nearest;
    }

    return null;
  }

  function toCandidateCornerSnap(corner: CornerPoint): SnapCandidate {
    return {
      id: corner.id,
      x: corner.x,
      y: corner.y,
      source: 'candidate-corner',
      cornerId: corner.id
    };
  }

  function resolveSnap(point: Point) {
    if (!options.snapToCorners.value) {
      return {
        point,
        snap: null,
        cornerId: null
      };
    }

    const wallEndpoint = findNearestWithinRadius(point, wallEndpointSnapPoints.value);
    if (wallEndpoint) {
      return {
        point: { x: wallEndpoint.x, y: wallEndpoint.y },
        snap: wallEndpoint,
        cornerId: wallEndpoint.cornerId ?? null
      };
    }

    const nearestCorner = findNearestWithinRadius(point, options.candidateCorners.value);
    if (nearestCorner) {
      return {
        point: { x: nearestCorner.x, y: nearestCorner.y },
        snap: toCandidateCornerSnap(nearestCorner),
        cornerId: nearestCorner.id
      };
    }

    return {
      point,
      snap: null,
      cornerId: null
    };
  }

  function resolveWallPoint(point: Point, wall: WallStroke): ResolvedDraftPoint {
    const projection = projectPointToPolyline(point, wall.points);
    if (!projection) {
      return resolveSnap(point);
    }

    const endpoints = [
      {
        id: `${wall.id}:start`,
        x: wall.points[0].x,
        y: wall.points[0].y,
        source: 'wall-endpoint' as const,
        cornerId: wall.points[0].cornerId ?? null
      },
      {
        id: `${wall.id}:end`,
        x: wall.points[wall.points.length - 1].x,
        y: wall.points[wall.points.length - 1].y,
        source: 'wall-endpoint' as const,
        cornerId: wall.points[wall.points.length - 1].cornerId ?? null
      }
    ];
    const endpointTolerance = Math.max(wall.widthPx / 2 + 1, 3);
    const matchingEndpoint = endpoints.find(
      (endpoint) => distance(projection.point, endpoint) <= endpointTolerance
    );

    if (matchingEndpoint) {
      return {
        point: { x: matchingEndpoint.x, y: matchingEndpoint.y },
        snap: matchingEndpoint,
        cornerId: matchingEndpoint.cornerId ?? null
      };
    }

    return {
      point: projection.point,
      snap: null,
      cornerId: null
    };
  }

  function commitDraftPoint(resolved: ResolvedDraftPoint) {
    hoverPoint.value = resolved.point;
    snapTarget.value = resolved.snap;

    const roundedPoint = roundPoint(resolved.point);

    if (!draft.value) {
      draft.value = {
        widthPx: options.wallWidthPx.value,
        points: [
          {
            ...roundedPoint,
            cornerId: resolved.cornerId
          }
        ]
      };
      syncDraftState();
      return;
    }

    const lastPoint = draft.value.points[draft.value.points.length - 1];
    if (distance(lastPoint, roundedPoint) < 0.6) {
      return;
    }

    draft.value.points.push({
      ...roundedPoint,
      cornerId: resolved.cornerId
    });
    syncDraftState();
  }

  function updateDraftPreview() {
    if (!draft.value) return;

    const rawPoint = options.stageToImagePoint();
    if (!rawPoint) {
      hoverPoint.value = null;
      snapTarget.value = null;
      return;
    }

    const snapped = resolveSnap(rawPoint);
    hoverPoint.value = snapped.point;
    snapTarget.value = snapped.snap;
  }

  function addDraftPoint() {
    const rawPoint = options.stageToImagePoint();
    if (!rawPoint) return;

    commitDraftPoint(resolveSnap(rawPoint));
  }

  function addDraftPointOnWall(wall: WallStroke) {
    const rawPoint = options.stageToImagePoint({ allowOutsideImage: true });
    if (!rawPoint) return;

    commitDraftPoint(resolveWallPoint(rawPoint, wall));
  }

  function finishDraft() {
    if (!draft.value) return;

    if (draft.value.points.length < 2) {
      cancelDraft();
      return;
    }

    const wall: WallStroke = {
      id: crypto.randomUUID(),
      type: 'centerline',
      widthPx: draft.value.widthPx,
      points: draft.value.points.map((point) => ({
        x: point.x,
        y: point.y,
        cornerId: point.cornerId ?? null
      })),
      createdAt: new Date().toISOString()
    };

    draft.value = null;
    hoverPoint.value = null;
    snapTarget.value = null;
    syncDraftState();
    options.emitCreateWall(wall);
  }

  function cancelDraft() {
    draft.value = null;
    hoverPoint.value = null;
    snapTarget.value = null;
    syncDraftState();
  }

  function clearSelection() {
    if (options.selectedWallId.value) {
      options.emitSelectWall(null);
    }
  }

  watch(
    () => options.wallWidthPx.value,
    (widthPx) => {
      if (draft.value) {
        draft.value.widthPx = widthPx;
      }
    }
  );

  watch(
    () => options.snapToCorners.value,
    (enabled) => {
      if (!enabled) {
        snapTarget.value = null;
      }
    }
  );

  return {
    draft,
    hoverPoint,
    snapTarget,
    wallEndpointSnapPoints,
    draftLinePoints,
    addDraftPoint,
    addDraftPointOnWall,
    updateDraftPreview,
    finishDraft,
    cancelDraft,
    clearSelection
  };
}
