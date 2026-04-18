import { computed, reactive, ref, watch, type Ref } from 'vue';
import { ElMessage } from 'element-plus';
import { desktopClient } from '@/services/desktop-client';
import type { CanvasBoardHandle } from '@/types/canvas';
import type { ProjectEditor } from '@/types/editor';
import type {
  CornerPoint,
  DraftState,
  ImageAsset,
  ProjectFile,
  ThemeMode,
  WallStroke
} from '@/types/project';
import { cloneWalls, createEmptyProject } from '@/utils/project';

export function useProjectEditor(canvasRef: Ref<CanvasBoardHandle | null>): ProjectEditor {
  const image = ref<ImageAsset | null>(null);
  const walls = ref<WallStroke[]>([]);
  const candidateCorners = ref<CornerPoint[]>([]);
  const projectPath = ref<string | null>(null);
  const selectedWallId = ref<string | null>(null);
  const theme = ref<ThemeMode>('light');
  const defaultWallWidthPx = ref(4);
  const snapRadiusPx = ref(10);
  const snapToCorners = ref(true);
  const showCorners = ref(true);
  const dirty = ref(false);
  const detectingCorners = ref(false);
  const syncingState = ref(false);
  const draftState = ref<DraftState>({ active: false, points: 0 });
  const projectCreatedAt = ref(new Date().toISOString());

  const hasImage = computed(() => Boolean(image.value));
  const hasSelectedWall = computed(() => Boolean(selectedWallId.value));
  const selectedWall = computed(() =>
    walls.value.find((wall) => wall.id === selectedWallId.value) ?? null
  );

  const appThemeClass = computed(() =>
    theme.value === 'dark' ? 'theme-dark' : 'theme-light'
  );
  const activeName = computed(() => image.value?.fileName ?? 'wall-labeler-desktop');
  const projectBadge = computed(() => {
    if (!image.value) return '空';
    if (!projectPath.value) return '新建';
    return '已存';
  });
  const canvasStatus = computed(() => {
    if (!image.value) return '导入图片';
    if (draftState.value.active) return '绘制中';
    return selectedWall.value ? '已选线' : '画墙';
  });
  const cornerSnapStatus = computed(() => (snapToCorners.value ? '开启' : '关闭'));
  const cornerDisplayStatus = computed(() => (showCorners.value ? '显示' : '隐藏'));
  const cornerSnapToolLabel = computed(() =>
    snapToCorners.value ? '关闭角点吸附（C）' : '开启角点吸附（C）'
  );
  const cornerDisplayToolLabel = computed(() =>
    showCorners.value ? '关闭角点显示（V）' : '开启角点显示（V）'
  );

  function markDirty() {
    dirty.value = true;
  }

  function buildProject(): ProjectFile {
    if (!image.value) {
      throw new Error('请先导入图片');
    }

    const base = createEmptyProject(image.value, theme.value);
    base.settings.defaultWallWidthPx = defaultWallWidthPx.value;
    base.settings.snapRadiusPx = snapRadiusPx.value;
    base.settings.snapToCorners = snapToCorners.value;
    base.settings.showCorners = showCorners.value;
    base.candidateCorners = candidateCorners.value.map((corner) => ({ ...corner }));
    base.walls = cloneWalls(walls.value);
    base.meta.createdAt = projectCreatedAt.value;
    base.meta.updatedAt = new Date().toISOString();
    return base;
  }

  async function importImage() {
    const picked = await desktopClient.dialogs.openImage();
    if (!picked) return;

    syncingState.value = true;
    image.value = picked;
    walls.value = [];
    candidateCorners.value = [];
    selectedWallId.value = null;
    projectPath.value = null;
    dirty.value = false;
    defaultWallWidthPx.value = 4;
    snapRadiusPx.value = 10;
    snapToCorners.value = true;
    showCorners.value = true;
    projectCreatedAt.value = new Date().toISOString();
    syncingState.value = false;

    await detectCorners();
  }

  async function openProject() {
    const opened = await desktopClient.dialogs.openProject();
    if (!opened) return;

    syncingState.value = true;
    image.value = opened.image;
    walls.value = cloneWalls(opened.project.walls);
    candidateCorners.value = opened.project.candidateCorners.map((corner) => ({ ...corner }));
    selectedWallId.value = null;
    projectPath.value = opened.projectPath;
    dirty.value = false;
    theme.value = opened.project.settings.theme || 'light';
    defaultWallWidthPx.value = opened.project.settings.defaultWallWidthPx ?? 4;
    snapRadiusPx.value = opened.project.settings.snapRadiusPx ?? 10;
    snapToCorners.value = opened.project.settings.snapToCorners ?? true;
    showCorners.value = opened.project.settings.showCorners ?? true;
    projectCreatedAt.value = opened.project.meta.createdAt || new Date().toISOString();
    syncingState.value = false;

    if (!candidateCorners.value.length) {
      await detectCorners();
    } else {
      canvasRef.value?.fitView();
    }
  }

  async function detectCorners() {
    if (!image.value || detectingCorners.value) return;
    detectingCorners.value = true;
    try {
      const result = await desktopClient.worker.detectCorners({
        filePath: image.value.filePath,
        maxCorners: 900
      });
      candidateCorners.value = result.corners ?? [];
      markDirty();
      ElMessage.success(`角点 ${candidateCorners.value.length}`);
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '识别失败');
    } finally {
      detectingCorners.value = false;
    }
  }

  async function saveProject(saveAs = false) {
    if (!image.value) {
      ElMessage.warning('先导入图片');
      return;
    }

    try {
      const result = await desktopClient.projects.save({
        project: buildProject(),
        projectPath: projectPath.value,
        saveAs
      });

      if (!result) return;
      projectPath.value = result.projectPath;
      projectCreatedAt.value = result.project.meta.createdAt;
      dirty.value = false;
      ElMessage.success('已保存');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '保存失败');
    }
  }

  async function exportMask() {
    if (!image.value) {
      ElMessage.warning('先导入图片');
      return;
    }

    try {
      const result = await desktopClient.worker.exportMask({
        project: buildProject(),
        projectPath: projectPath.value
      });
      if (!result) return;
      ElMessage.success('Mask 已导出');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '导出失败');
    }
  }

  function onCreateWall(wall: WallStroke) {
    walls.value = [...walls.value, wall];
    selectedWallId.value = null;
    markDirty();
  }

  function deleteSelectedWall() {
    if (!selectedWallId.value) return;
    walls.value = walls.value.filter((wall) => wall.id !== selectedWallId.value);
    selectedWallId.value = null;
    markDirty();
    ElMessage.success('已删除');
  }

  function finishDraft() {
    canvasRef.value?.finishDraft();
  }

  function cancelDraft() {
    canvasRef.value?.cancelDraft();
  }

  function fitCanvas() {
    canvasRef.value?.fitView();
  }

  function focusDrawing() {
    selectedWallId.value = null;
  }

  function toggleCornerSnap() {
    snapToCorners.value = !snapToCorners.value;
    markDirty();
  }

  function toggleShowCorners() {
    showCorners.value = !showCorners.value;
    markDirty();
  }

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
    markDirty();
  }

  function setSelectedWallId(wallId: string | null) {
    selectedWallId.value = wallId;
  }

  function toggleWallSelection(wallId: string) {
    selectedWallId.value = selectedWallId.value === wallId ? null : wallId;
  }

  function updateDraftState(state: DraftState) {
    draftState.value = state;
  }

  function setDefaultWallWidthPx(value: number) {
    defaultWallWidthPx.value = value;
  }

  function setSnapRadiusPx(value: number) {
    snapRadiusPx.value = value;
  }

  function setSnapToCorners(value: boolean) {
    snapToCorners.value = value;
  }

  function setShowCorners(value: boolean) {
    showCorners.value = value;
  }

  watch([defaultWallWidthPx, snapRadiusPx, snapToCorners, showCorners], () => {
    if (image.value && !syncingState.value) {
      markDirty();
    }
  });

  const state = reactive({
    image,
    walls,
    candidateCorners,
    projectPath,
    selectedWallId,
    theme,
    defaultWallWidthPx,
    snapRadiusPx,
    snapToCorners,
    showCorners,
    dirty,
    detectingCorners,
    draftState
  });

  const view = reactive({
    hasImage,
    hasSelectedWall,
    selectedWall,
    appThemeClass,
    activeName,
    projectBadge,
    canvasStatus,
    cornerSnapStatus,
    cornerDisplayStatus,
    cornerSnapToolLabel,
    cornerDisplayToolLabel
  });

  const actions = {
    importImage,
    openProject,
    detectCorners,
    saveProject,
    exportMask,
    onCreateWall,
    deleteSelectedWall
  };

  const controls = {
    finishDraft,
    cancelDraft,
    fitCanvas,
    focusDrawing,
    toggleCornerSnap,
    toggleShowCorners,
    toggleTheme,
    setSelectedWallId,
    toggleWallSelection,
    updateDraftState,
    setDefaultWallWidthPx,
    setSnapRadiusPx,
    setSnapToCorners,
    setShowCorners
  };

  return {
    state,
    view,
    actions,
    controls
  };
}
