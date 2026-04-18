<script setup lang="ts">
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
import ToolIconButton from '@/components/ToolIconButton.vue';
import type { ToolbarActions, ToolbarState } from '@/types/editor';

defineProps<{
  state: ToolbarState;
  actions: ToolbarActions;
}>();
</script>

<template>
  <div class="toolbar-strip">
    <div class="toolbar-group">
      <ToolIconButton :icon="PictureFilled" label="导入图片" @click="actions.importImage()" />
      <ToolIconButton :icon="FolderOpened" label="打开项目" @click="actions.openProject()" />
      <ToolIconButton :icon="Document" label="保存" :disabled="!state.imageReady" @click="actions.saveProject()" />
      <ToolIconButton
        :icon="Download"
        label="导出 Mask"
        :disabled="!state.imageReady"
        @click="actions.exportMask()"
      />
    </div>

    <div class="toolbar-separator" />

    <div class="toolbar-group">
      <ToolIconButton
        :icon="EditPen"
        label="画墙"
        :active="!state.hasSelection"
        :disabled="!state.imageReady"
        @click="actions.focusDrawing()"
      />
      <ToolIconButton
        :icon="Check"
        label="完成"
        :disabled="!state.draftActive"
        @click="actions.finishDraft()"
      />
      <ToolIconButton
        :icon="Close"
        label="取消"
        :disabled="!state.draftActive"
        @click="actions.cancelDraft()"
      />
      <ToolIconButton
        :icon="Delete"
        label="删除线"
        danger
        :disabled="!state.hasSelection"
        @click="actions.deleteWall()"
      />
    </div>

    <div class="toolbar-separator" />

    <div class="toolbar-group">
      <ToolIconButton
        :icon="RefreshRight"
        label="重识别角点"
        :disabled="!state.imageReady || state.detectingCorners"
        @click="actions.detectCorners()"
      />
      <ToolIconButton
        :icon="Aim"
        :label="state.cornerSnapToolLabel"
        :active="state.snapToCorners"
        :disabled="!state.imageReady"
        @click="actions.toggleCornerSnap()"
      />
      <ToolIconButton
        :icon="state.showCorners ? View : Hide"
        :label="state.cornerDisplayToolLabel"
        :active="state.showCorners"
        :disabled="!state.imageReady"
        @click="actions.toggleShowCorners()"
      />
      <ToolIconButton :icon="FullScreen" label="适配" :disabled="!state.imageReady" @click="actions.fitCanvas()" />
      <ToolIconButton
        :icon="state.theme === 'light' ? Moon : Sunny"
        :label="state.theme === 'light' ? '夜间' : '日间'"
        @click="actions.toggleTheme()"
      />
    </div>
  </div>
</template>
