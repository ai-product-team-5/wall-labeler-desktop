import { computed, onBeforeUnmount, onMounted, reactive, ref, type Ref } from 'vue';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ImageAsset, Point } from '@/types/project';
import { clamp } from '@/utils/geometry';

interface UseCanvasViewportOptions {
  containerRef: Ref<HTMLDivElement | null>;
  stageRef: Ref<any>;
  image: Ref<ImageAsset | null>;
}

export function useCanvasViewport(options: UseCanvasViewportOptions) {
  const stageSize = reactive({ width: 960, height: 720 });
  const viewport = reactive({ x: 0, y: 0, scale: 1 });
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

  function measureStage() {
    if (!options.containerRef.value) return;
    const rect = options.containerRef.value.getBoundingClientRect();
    stageSize.width = Math.max(360, Math.floor(rect.width));
    stageSize.height = Math.max(360, Math.floor(rect.height));
    if (options.image.value && !hasFitted.value) {
      fitView();
    }
  }

  function fitView() {
    if (!options.image.value || !stageSize.width || !stageSize.height) return;
    const padding = 48;
    const scale = Math.min(
      (stageSize.width - padding * 2) / options.image.value.width,
      (stageSize.height - padding * 2) / options.image.value.height
    );
    viewport.scale = clamp(scale, 0.08, 6);
    viewport.x = (stageSize.width - options.image.value.width * viewport.scale) / 2;
    viewport.y = (stageSize.height - options.image.value.height * viewport.scale) / 2;
    hasFitted.value = true;
  }

  function resetFit() {
    hasFitted.value = false;
  }

  function stageToImagePoint(config: { allowOutsideImage?: boolean } = {}) {
    if (!options.image.value) return null;
    const stage = options.stageRef.value?.getNode?.();
    const pointer = stage?.getPointerPosition?.();
    if (!pointer) return null;

    const point = {
      x: (pointer.x - viewport.x) / viewport.scale,
      y: (pointer.y - viewport.y) / viewport.scale
    };

    if (
      !config.allowOutsideImage &&
      (point.x < 0 ||
        point.y < 0 ||
        point.x > options.image.value.width ||
        point.y > options.image.value.height)
    ) {
      return null;
    }

    return point;
  }

  function startPan(evt: KonvaEventObject<MouseEvent>) {
    lastPointerButton.value = evt.evt.button;
    if (evt.evt.button !== 1 && evt.evt.button !== 2) return;

    const stage = options.stageRef.value?.getNode?.();
    const pointer = stage?.getPointerPosition?.();
    if (!pointer) return;

    isPanning.value = true;
    lastPanPoint.value = { x: pointer.x, y: pointer.y };
  }

  function updatePan() {
    if (!isPanning.value) return false;

    const stage = options.stageRef.value?.getNode?.();
    const pointer = stage?.getPointerPosition?.();
    if (pointer && lastPanPoint.value) {
      viewport.x += pointer.x - lastPanPoint.value.x;
      viewport.y += pointer.y - lastPanPoint.value.y;
      lastPanPoint.value = { x: pointer.x, y: pointer.y };
    }

    return true;
  }

  function stopPan() {
    isPanning.value = false;
    lastPanPoint.value = null;
  }

  function consumePointerButton(fallbackButton: number) {
    const button = lastPointerButton.value ?? fallbackButton;
    lastPointerButton.value = null;
    return button;
  }

  function onWheel(evt: KonvaEventObject<WheelEvent>) {
    evt.evt.preventDefault();
    const stage = options.stageRef.value?.getNode?.();
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

  onMounted(() => {
    if (options.containerRef.value) {
      resizeObserver.observe(options.containerRef.value);
    }
    measureStage();
  });

  onBeforeUnmount(() => {
    resizeObserver.disconnect();
  });

  return {
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
  };
}
