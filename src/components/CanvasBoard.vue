<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { KonvaEventObject } from 'konva/lib/Node';
import type {
  CornerPoint,
  DraftState,
  ImageAsset,
  Point,
  ThemeMode,
  WallStroke
} from '@/types/project';
import { clamp, distance, flattenPoints, roundPoint } from '@/utils/geometry';

interface DraftWall {
  widthPx: number;
  points: Array<{ x: number; y: number; cornerId?: string | null }>;
}

type SnapSource = 'candidate-corner' | 'wall-endpoint';

interface SnapCandidate extends Point {
  id: string;
  source: SnapSource;
  cornerId?: string | null;
}

const props = defineProps<{
  image: ImageAsset | null;
  walls: WallStroke[];
  candidateCorners: CornerPoint[];
  selectedWallId: string | null;
  wallWidthPx: number;
  snapRadiusPx: number;
  snapToCorners: boolean;
  showCorners: boolean;
  theme: ThemeMode;
}>();

const emit = defineEmits<{
  'create-wall': [wall: WallStroke];
  'select-wall': [wallId: string | null];
  'draft-state': [state: DraftState];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const stageRef = ref<any>(null);
const imageElement = ref<HTMLImageElement | null>(null);
const stageSize = reactive({ width: 960, height: 720 });
const viewport = reactive({ x: 0, y: 0, scale: 1 });
const draft = ref<DraftWall | null>(null);
const hoverPoint = ref<Point | null>(null);
const snapTarget = ref<SnapCandidate | null>(null);
const isPanning = ref(false);
const lastPanPoint = ref<Point | null>(null);
const hasFitted = ref(false);
const lastPointerButton = ref<number | null>(null);

const resizeObserver = new ResizeObserver(() => {
  measureStage();
});

const stageConfig = computed(() => ({
  width: stageSize.width,
  height: stageSize.height
}));

const viewportConfig = computed(() => ({
  x: viewport.x,
  y: viewport.y,
  scaleX: viewport.scale,
  scaleY: viewport.scale
}));

const stageBackground = computed(() =>
  props.theme === 'dark' ? '#111827' : '#eef3f8'
);

const boardBackground = computed(() =>
  props.theme === 'dark' ? '#0f172a' : '#ffffff'
);

const boardShadowColor = computed(() =>
  props.theme === 'dark' ? 'rgba(15, 23, 42, 0.38)' : 'rgba(15, 23, 42, 0.12)'
);

const displayCornerRadius = computed(() => 3.5 / viewport.scale);
const snapRingRadius = computed(() => 8 / viewport.scale);
const wallEndpointRadius = computed(() => 4.6 / viewport.scale);
const wallStrokeColor = '#ff6b35';

const wallEndpointSnapPoints = computed<SnapCandidate[]>(() => {
  const pointMap = new Map<string, SnapCandidate>();

  for (const wall of props.walls) {
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

const draftConfig = computed(() => ({
  points: draftLinePoints.value,
  stroke: wallStrokeColor,
  strokeWidth: draft.value?.widthPx ?? props.wallWidthPx,
  lineCap: 'round',
  lineJoin: 'round',
  opacity: 0.76,
  listening: false,
  hitStrokeWidth: 18
}));

function emitDraftState() {
  emit('draft-state', {
    active: Boolean(draft.value),
    points: draft.value?.points.length ?? 0
  });
}

function measureStage() {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  stageSize.width = Math.max(360, Math.floor(rect.width));
  stageSize.height = Math.max(360, Math.floor(rect.height));
  if (props.image && !hasFitted.value) {
    fitView();
  }
}

function fitView() {
  if (!props.image || !stageSize.width || !stageSize.height) return;
  const padding = 48;
  const scale = Math.min(
    (stageSize.width - padding * 2) / props.image.width,
    (stageSize.height - padding * 2) / props.image.height
  );
  viewport.scale = clamp(scale, 0.08, 6);
  viewport.x = (stageSize.width - props.image.width * viewport.scale) / 2;
  viewport.y = (stageSize.height - props.image.height * viewport.scale) / 2;
  hasFitted.value = true;
}

function stageToImagePoint() {
  if (!props.image) return null;
  const stage = stageRef.value?.getNode?.();
  const pointer = stage?.getPointerPosition?.();
  if (!pointer) return null;

  const point = {
    x: (pointer.x - viewport.x) / viewport.scale,
    y: (pointer.y - viewport.y) / viewport.scale
  };

  if (
    point.x < 0 ||
    point.y < 0 ||
    point.x > props.image.width ||
    point.y > props.image.height
  ) {
    return null;
  }

  return point;
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

  if (nearest && minDistance <= props.snapRadiusPx) {
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
  if (!props.snapToCorners) {
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

  const nearestCorner = findNearestWithinRadius(point, props.candidateCorners);
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

function addDraftPoint() {
  const rawPoint = stageToImagePoint();
  if (!rawPoint) return;

  const snapped = resolveSnap(rawPoint);
  hoverPoint.value = snapped.point;
  snapTarget.value = snapped.snap;

  if (!draft.value) {
    draft.value = {
      widthPx: props.wallWidthPx,
      points: [
        {
          ...roundPoint(snapped.point),
          cornerId: snapped.cornerId
        }
      ]
    };
    emitDraftState();
    return;
  }

  const lastPoint = draft.value.points[draft.value.points.length - 1];
  if (distance(lastPoint, snapped.point) < 0.6) {
    return;
  }

  draft.value.points.push({
    ...roundPoint(snapped.point),
    cornerId: snapped.cornerId
  });
  emitDraftState();
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
  emitDraftState();
  emit('create-wall', wall);
}

function cancelDraft() {
  draft.value = null;
  hoverPoint.value = null;
  snapTarget.value = null;
  emitDraftState();
}

function clearSelection() {
  if (props.selectedWallId) {
    emit('select-wall', null);
  }
}

function onStageClick(evt: KonvaEventObject<MouseEvent>) {
  if (!props.image) return;
  const pointerButton = lastPointerButton.value ?? evt.evt.button;
  lastPointerButton.value = null;
  if (pointerButton !== 0 || isPanning.value) return;

  if (!draft.value) {
    clearSelection();
  }
  addDraftPoint();
}

function onWallClick(wallId: string, evt: KonvaEventObject<MouseEvent>) {
  const pointerButton = lastPointerButton.value ?? evt.evt.button;
  lastPointerButton.value = null;
  if (pointerButton !== 0 || isPanning.value) return;

  if (draft.value) {
    addDraftPoint();
    return;
  }

  emit('select-wall', props.selectedWallId === wallId ? null : wallId);
}

function onStageMouseMove(_evt: KonvaEventObject<MouseEvent>) {
  if (!props.image) return;

  if (isPanning.value) {
    const stage = stageRef.value?.getNode?.();
    const pointer = stage?.getPointerPosition?.();
    if (pointer && lastPanPoint.value) {
      viewport.x += pointer.x - lastPanPoint.value.x;
      viewport.y += pointer.y - lastPanPoint.value.y;
      lastPanPoint.value = { x: pointer.x, y: pointer.y };
    }
    return;
  }

  if (!draft.value) return;
  const rawPoint = stageToImagePoint();
  if (!rawPoint) {
    hoverPoint.value = null;
    snapTarget.value = null;
    return;
  }

  const snapped = resolveSnap(rawPoint);
  hoverPoint.value = snapped.point;
  snapTarget.value = snapped.snap;
}

function onStageMouseDown(evt: KonvaEventObject<MouseEvent>) {
  lastPointerButton.value = evt.evt.button;
  if (evt.evt.button !== 1 && evt.evt.button !== 2) return;
  const stage = stageRef.value?.getNode?.();
  const pointer = stage?.getPointerPosition?.();
  if (!pointer) return;
  isPanning.value = true;
  lastPanPoint.value = { x: pointer.x, y: pointer.y };
}

function onStageMouseUp() {
  isPanning.value = false;
  lastPanPoint.value = null;
}

function onWheel(evt: KonvaEventObject<WheelEvent>) {
  evt.evt.preventDefault();
  const stage = stageRef.value?.getNode?.();
  const pointer = stage?.getPointerPosition?.();
  if (!pointer) return;

  const oldScale = viewport.scale;
  const mousePoint = {
    x: (pointer.x - viewport.x) / oldScale,
    y: (pointer.y - viewport.y) / oldScale
  };

  const direction = evt.evt.deltaY > 0 ? -1 : 1;
  const scaleBy = direction > 0 ? 1.08 : 1 / 1.08;
  const nextScale = clamp(oldScale * scaleBy, 0.08, 8);

  viewport.scale = nextScale;
  viewport.x = pointer.x - mousePoint.x * nextScale;
  viewport.y = pointer.y - mousePoint.y * nextScale;
}

function candidateCornerConfig(corner: CornerPoint) {
  return {
    x: corner.x,
    y: corner.y,
    radius: displayCornerRadius.value,
    fill: '#4a7dff',
    opacity: 0.34,
    listening: false
  };
}

function wallEndpointConfig(point: SnapCandidate) {
  return {
    x: point.x,
    y: point.y,
    radius: wallEndpointRadius.value,
    fill: wallStrokeColor,
    stroke: '#ffffff',
    strokeWidth: 1.2 / viewport.scale,
    opacity: 0.72,
    listening: false
  };
}

function snapTargetConfig(target: SnapCandidate) {
  const isWallEndpoint = target.source === 'wall-endpoint';
  return {
    x: target.x,
    y: target.y,
    radius: snapRingRadius.value,
    stroke: isWallEndpoint ? wallStrokeColor : '#4a7dff',
    strokeWidth: 1.8 / viewport.scale,
    fill: isWallEndpoint ? 'rgba(255, 107, 53, 0.14)' : 'rgba(74, 125, 255, 0.12)',
    listening: false
  };
}

function wallLineConfig(wall: WallStroke) {
  return {
    points: flattenPoints(wall.points),
    stroke: wallStrokeColor,
    strokeWidth: wall.widthPx,
    lineCap: 'round',
    lineJoin: 'round',
    opacity: wall.id === props.selectedWallId ? 0.88 : 0.56,
    hitStrokeWidth: Math.max(wall.widthPx + 10, 18)
  };
}

function selectedGlowConfig(wall: WallStroke) {
  return {
    points: flattenPoints(wall.points),
    stroke: wallStrokeColor,
    strokeWidth: wall.widthPx + 6,
    lineCap: 'round',
    lineJoin: 'round',
    opacity: 0.22,
    listening: false
  };
}

watch(
  () => props.image?.dataUrl,
  async (dataUrl) => {
    draft.value = null;
    hoverPoint.value = null;
    snapTarget.value = null;
    emitDraftState();
    hasFitted.value = false;

    if (!dataUrl) {
      imageElement.value = null;
      return;
    }

    const img = new window.Image();
    img.src = dataUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
    imageElement.value = img;
    await nextTick();
    fitView();
  },
  { immediate: true }
);

watch(
  () => props.wallWidthPx,
  (widthPx) => {
    if (draft.value) {
      draft.value.widthPx = widthPx;
    }
  }
);

watch(
  () => props.snapToCorners,
  (enabled) => {
    if (!enabled) {
      snapTarget.value = null;
    }
  }
);

onMounted(() => {
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
  }
  measureStage();
});

onBeforeUnmount(() => {
  resizeObserver.disconnect();
});

defineExpose({
  finishDraft,
  cancelDraft,
  fitView
});
</script>

<template>
  <div ref="containerRef" class="board-root" @contextmenu.prevent>
    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @click="onStageClick"
      @wheel="onWheel"
      @mousemove="onStageMouseMove"
      @mousedown="onStageMouseDown"
      @mouseup="onStageMouseUp"
      @mouseleave="onStageMouseUp"
    >
      <v-layer>
        <v-rect
          :config="{
            x: 0,
            y: 0,
            width: stageSize.width,
            height: stageSize.height,
            fill: stageBackground
          }"
        />

        <v-group v-if="image" :config="viewportConfig">
          <v-rect
            :config="{
              x: -18,
              y: -18,
              width: image.width + 36,
              height: image.height + 36,
              fill: boardBackground,
              cornerRadius: 24,
              shadowColor: boardShadowColor,
              shadowBlur: 28,
              shadowOffset: { x: 0, y: 10 },
              shadowOpacity: 0.55,
              listening: false
            }"
          />

          <v-image
            v-if="imageElement"
            :config="{
              image: imageElement,
              x: 0,
              y: 0,
              width: image.width,
              height: image.height
            }"
          />

          <template v-if="showCorners">
            <v-circle
              v-for="corner in candidateCorners"
              :key="corner.id"
              :config="candidateCornerConfig(corner)"
            />
            <v-circle
              v-for="point in wallEndpointSnapPoints"
              :key="point.id"
              :config="wallEndpointConfig(point)"
            />
          </template>

          <template v-for="wall in walls" :key="wall.id">
            <v-line
              v-if="wall.id === selectedWallId"
              :config="selectedGlowConfig(wall)"
            />
            <v-line
              :config="wallLineConfig(wall)"
              @click.stop="onWallClick(wall.id, $event)"
            />
          </template>

          <v-line v-if="draftLinePoints.length >= 2" :config="draftConfig" />
          <v-circle
            v-if="snapTarget"
            :config="snapTargetConfig(snapTarget)"
          />
        </v-group>
      </v-layer>
    </v-stage>

    <div v-if="!image" class="board-placeholder">
      <div class="placeholder-card">
        <div class="placeholder-icon">⌘</div>
        <div class="placeholder-title">导入一张图</div>
        <div class="placeholder-subtitle">开始画墙</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 520px;
  overflow: hidden;
  border-radius: 28px;
}

.board-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.placeholder-card {
  display: grid;
  gap: 10px;
  min-width: 240px;
  padding: 26px 30px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.26);
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(16px);
  text-align: center;
}

.placeholder-icon {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  margin: 0 auto;
  display: grid;
  place-items: center;
  color: #4a7dff;
  background: rgba(74, 125, 255, 0.12);
  font-weight: 700;
}

.placeholder-title {
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
}

.placeholder-subtitle {
  color: #94a3b8;
  font-size: 13px;
}
</style>
