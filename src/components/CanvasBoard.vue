<script setup lang="ts">
import { computed, toRef, ref } from 'vue';
import type { KonvaEventObject } from 'konva/lib/Node';
import type {
  CornerPoint,
  DraftState,
  ImageAsset,
  ThemeMode,
  WallStroke
} from '@/types/project';
import { useCanvasDraft } from '@/composables/canvas/useCanvasDraft';
import { useCanvasImage } from '@/composables/canvas/useCanvasImage';
import { useCanvasViewport } from '@/composables/canvas/useCanvasViewport';

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

const {
  stageSize,
  viewport,
  stageConfig,
  viewportConfig,
  isPanning,
  fitView,
  resetFit,
  stageToImagePoint,
  startPan,
  updatePan,
  stopPan,
  consumePointerButton,
  onWheel
} = useCanvasViewport({
  containerRef,
  stageRef,
  image: toRef(props, 'image')
});

const {
  draft,
  snapTarget,
  wallEndpointSnapPoints,
  draftLinePoints,
  addDraftPoint,
  addDraftPointOnWall,
  updateDraftPreview,
  finishDraft,
  cancelDraft,
  clearSelection
} = useCanvasDraft({
  image: toRef(props, 'image'),
  walls: toRef(props, 'walls'),
  candidateCorners: toRef(props, 'candidateCorners'),
  selectedWallId: toRef(props, 'selectedWallId'),
  wallWidthPx: toRef(props, 'wallWidthPx'),
  snapRadiusPx: toRef(props, 'snapRadiusPx'),
  snapToCorners: toRef(props, 'snapToCorners'),
  stageToImagePoint,
  emitCreateWall: (wall) => emit('create-wall', wall),
  emitSelectWall: (wallId) => emit('select-wall', wallId),
  emitDraftState: (state) => emit('draft-state', state)
});

const { imageElement } = useCanvasImage({
  image: toRef(props, 'image'),
  resetTransientState: () => {
    cancelDraft();
    resetFit();
  },
  onImageReady: fitView
});

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

function onStageClick(evt: KonvaEventObject<MouseEvent>) {
  if (!props.image) return;
  const pointerButton = consumePointerButton(evt.evt.button);
  if (pointerButton !== 0 || isPanning.value) return;

  if (!draft.value) {
    clearSelection();
  }
  addDraftPoint();
}

function onWallClick(wall: WallStroke, evt: KonvaEventObject<MouseEvent>) {
  // Konva events need cancelBubble instead of Vue's DOM-style .stop modifier.
  evt.cancelBubble = true;

  const pointerButton = consumePointerButton(evt.evt.button);
  if (pointerButton !== 0 || isPanning.value) return;

  if (draft.value || !props.selectedWallId) {
    addDraftPointOnWall(wall);
    return;
  }

  emit('select-wall', props.selectedWallId === wall.id ? null : wall.id);
}

function onStageMouseMove() {
  if (!props.image) return;
  if (updatePan()) return;
  updateDraftPreview();
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

function wallEndpointConfig(point: { x: number; y: number }) {
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

function snapTargetConfig(target: { x: number; y: number; source: string }) {
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
    points: wall.points.flatMap((point) => [point.x, point.y]),
    stroke: wallStrokeColor,
    strokeWidth: wall.widthPx,
    lineCap: 'round',
    lineJoin: 'round',
    opacity: wall.id === props.selectedWallId ? 0.88 : 0.56,
    hitStrokeWidth: Math.max(wall.widthPx + 14, 24)
  };
}

function selectedGlowConfig(wall: WallStroke) {
  return {
    points: wall.points.flatMap((point) => [point.x, point.y]),
    stroke: wallStrokeColor,
    strokeWidth: wall.widthPx + 6,
    lineCap: 'round',
    lineJoin: 'round',
    opacity: 0.22,
    listening: false
  };
}

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
      @mousedown="startPan"
      @mouseup="stopPan"
      @mouseleave="stopPan"
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
              @click="onWallClick(wall, $event)"
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
