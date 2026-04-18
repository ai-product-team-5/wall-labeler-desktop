<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Aim,
  Check,
  Close,
  Delete,
  Document,
  Download,
  EditPen,
  FolderOpened,
  FullScreen,
  Moon,
  PictureFilled,
  RefreshRight,
  Hide,
  Sunny,
  View
} from '@element-plus/icons-vue';
import CanvasBoard from '@/components/CanvasBoard.vue';
import ToolIconButton from '@/components/ToolIconButton.vue';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import type {
  CornerPoint,
  DraftState,
  ImageAsset,
  ProjectFile,
  ThemeMode,
  WallStroke
} from '@/types/project';
import { cloneWalls, createEmptyProject } from '@/utils/project';

const canvasRef = ref<any>(null);

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

const selectedWall = computed(() =>
  walls.value.find((wall) => wall.id === selectedWallId.value) ?? null
);

const appThemeClass = computed(() =>
  theme.value === 'dark' ? 'theme-dark' : 'theme-light'
);

const activeName = computed(() => image.value?.fileName ?? 'Wall Label');
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
  const picked = await window.api.openImage();
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
  const opened = await window.api.openProject();
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
    canvasRef.value?.fitView?.();
  }
}

async function detectCorners() {
  if (!image.value || detectingCorners.value) return;
  detectingCorners.value = true;
  try {
    const result = await window.api.detectCorners({
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
    const result = await window.api.saveProject({
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
    const result = await window.api.exportMask({
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
  canvasRef.value?.finishDraft?.();
}

function cancelDraft() {
  canvasRef.value?.cancelDraft?.();
}

function fitCanvas() {
  canvasRef.value?.fitView?.();
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

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
}


watch([defaultWallWidthPx, snapRadiusPx, snapToCorners, showCorners], () => {
  if (image.value && !syncingState.value) {
    markDirty();
  }
});

useKeyboardShortcuts((event) => {
  if (isTypingTarget(event.target)) return;

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    void saveProject(false);
    return;
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedWallId.value) {
      event.preventDefault();
      deleteSelectedWall();
    }
    return;
  }

  if (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'c'
  ) {
    if (image.value) {
      event.preventDefault();
      toggleCornerSnap();
    }
    return;
  }

  if (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'v'
  ) {
    if (image.value) {
      event.preventDefault();
      toggleShowCorners();
    }
    return;
  }

  if (event.key === 'Enter' || event.code === 'NumpadEnter') {
    event.preventDefault();
    finishDraft();
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    cancelDraft();
  }
});
</script>

<template>
  <div class="app-root" :class="appThemeClass">
    <header class="topbar panel-surface">
      <div class="brand-block">
        <div class="brand-mark">W</div>
        <div class="brand-copy">
          <div class="brand-title">Wall Label</div>
          <div class="brand-subtitle">
            {{ activeName }}
            <span class="brand-badge">{{ projectBadge }}</span>
            <span v-if="dirty" class="dirty-dot" />
          </div>
        </div>
      </div>

      <div class="toolbar-strip">
        <div class="toolbar-group">
          <ToolIconButton :icon="PictureFilled" label="导入图片" @click="importImage" />
          <ToolIconButton :icon="FolderOpened" label="打开项目" @click="openProject" />
          <ToolIconButton :icon="Document" label="保存" @click="saveProject(false)" :disabled="!image" />
          <ToolIconButton :icon="Download" label="导出 Mask" @click="exportMask" :disabled="!image" />
        </div>

        <div class="toolbar-separator" />

        <div class="toolbar-group">
          <ToolIconButton
            :icon="EditPen"
            label="画墙"
            :active="!selectedWallId"
            :disabled="!image"
            @click="focusDrawing"
          />
          <ToolIconButton
            :icon="Check"
            label="完成"
            :disabled="!draftState.active"
            @click="finishDraft"
          />
          <ToolIconButton
            :icon="Close"
            label="取消"
            :disabled="!draftState.active"
            @click="cancelDraft"
          />
          <ToolIconButton
            :icon="Delete"
            label="删除线"
            danger
            :disabled="!selectedWallId"
            @click="deleteSelectedWall"
          />
        </div>

        <div class="toolbar-separator" />

        <div class="toolbar-group">
          <ToolIconButton
            :icon="RefreshRight"
            label="重识别角点"
            :disabled="!image || detectingCorners"
            @click="detectCorners"
          />
          <ToolIconButton
            :icon="Aim"
            :label="cornerSnapToolLabel"
            :active="snapToCorners"
            :disabled="!image"
            @click="toggleCornerSnap"
          />
          <ToolIconButton
            :icon="showCorners ? View : Hide"
            :label="cornerDisplayToolLabel"
            :active="showCorners"
            :disabled="!image"
            @click="toggleShowCorners"
          />
          <ToolIconButton :icon="FullScreen" label="适配" :disabled="!image" @click="fitCanvas" />
          <ToolIconButton
            :icon="theme === 'light' ? Moon : Sunny"
            :label="theme === 'light' ? '夜间' : '日间'"
            @click="toggleTheme"
          />
        </div>
      </div>
    </header>

    <main class="workspace">
      <aside class="side-column left-column">
        <section class="panel-surface settings-card">
          <div class="section-title-row">
            <span>设置</span>
            <span class="section-muted" v-if="image">{{ image.width }} × {{ image.height }}</span>
          </div>

          <div class="field-row">
            <div class="field-head">
              <span>宽</span>
              <span class="value-pill">{{ defaultWallWidthPx }} px</span>
            </div>
            <el-slider v-model="defaultWallWidthPx" :min="1" :max="40" :step="1" />
          </div>

          <div class="field-row">
            <div class="field-head">
              <span>吸附</span>
              <span class="value-pill">{{ snapRadiusPx }} px</span>
            </div>
            <el-slider v-model="snapRadiusPx" :min="4" :max="32" :step="1" />
          </div>

          <div class="switch-row">
            <span>角点吸附</span>
            <el-switch v-model="snapToCorners" size="small" :disabled="!image" />
          </div>

          <div class="switch-row">
            <span>角点显示</span>
            <el-switch v-model="showCorners" size="small" :disabled="!image" />
          </div>
        </section>

        <section class="panel-surface stat-card">
          <div class="section-title-row">
            <span>状态</span>
          </div>
          <div class="state-grid">
            <div class="state-chip">
              <span class="chip-label">模式</span>
              <span class="chip-value">{{ canvasStatus }}</span>
            </div>
            <div class="state-chip">
              <span class="chip-label">角点吸附</span>
              <span class="chip-value">{{ cornerSnapStatus }}</span>
            </div>
            <div class="state-chip">
              <span class="chip-label">角点显示</span>
              <span class="chip-value">{{ cornerDisplayStatus }}</span>
            </div>
            <div class="state-chip">
              <span class="chip-label">候选角点</span>
              <span class="chip-value">{{ candidateCorners.length }}</span>
            </div>
            <div class="state-chip">
              <span class="chip-label">线</span>
              <span class="chip-value">{{ walls.length }}</span>
            </div>
            <div class="state-chip" v-if="draftState.active">
              <span class="chip-label">草稿</span>
              <span class="chip-value">{{ draftState.points }} 点</span>
            </div>
          </div>
        </section>
      </aside>

      <section class="canvas-shell panel-surface">
        <CanvasBoard
          ref="canvasRef"
          :image="image"
          :walls="walls"
          :candidate-corners="candidateCorners"
          :selected-wall-id="selectedWallId"
          :wall-width-px="defaultWallWidthPx"
          :snap-radius-px="snapRadiusPx"
          :snap-to-corners="snapToCorners"
          :show-corners="showCorners"
          :theme="theme"
          @create-wall="onCreateWall"
          @select-wall="selectedWallId = $event"
          @draft-state="draftState = $event"
        />

        <div class="canvas-hud panel-surface hud-surface">
          <span>{{ canvasStatus }}</span>
          <span v-if="draftState.active">{{ draftState.points }} 点</span>
          <span>C 切换角点吸附</span>
          <span>V 切换角点显示</span>
          <span>中键/右键拖动 · 滚轮缩放</span>
        </div>
      </section>

      <aside class="side-column right-column">
        <section class="panel-surface list-card">
          <div class="section-title-row">
            <span>线</span>
            <span class="section-muted">{{ walls.length }}</span>
          </div>

          <el-scrollbar class="wall-scroll">
            <div v-if="!walls.length" class="empty-lite">还没有线</div>
            <button
              v-for="(wall, index) in walls"
              :key="wall.id"
              class="wall-row"
              :class="{ 'is-active': wall.id === selectedWallId }"
              @click="selectedWallId = wall.id === selectedWallId ? null : wall.id"
            >
              <span class="wall-row-index">L{{ index + 1 }}</span>
              <span class="wall-row-meta">{{ wall.points.length }} 点</span>
              <span class="wall-row-width">{{ wall.widthPx }} px</span>
            </button>
          </el-scrollbar>
        </section>

        <section class="panel-surface current-card" v-if="selectedWall">
          <div class="section-title-row">
            <span>当前</span>
          </div>
          <div class="current-grid">
            <div class="current-item">
              <span class="chip-label">点</span>
              <span class="chip-value">{{ selectedWall.points.length }}</span>
            </div>
            <div class="current-item">
              <span class="chip-label">宽</span>
              <span class="chip-value">{{ selectedWall.widthPx }} px</span>
            </div>
          </div>
          <el-button round type="danger" plain class="delete-button" @click="deleteSelectedWall">
            删除
          </el-button>
        </section>
      </aside>
    </main>
  </div>
</template>
