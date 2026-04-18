<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import CanvasBoard from '@/components/CanvasBoard.vue';
import AppToolbar from '@/components/editor/AppToolbar.vue';
import CanvasHud from '@/components/editor/CanvasHud.vue';
import EditorSettingsPanel from '@/components/editor/EditorSettingsPanel.vue';
import EditorStatusPanel from '@/components/editor/EditorStatusPanel.vue';
import SelectedWallPanel from '@/components/editor/SelectedWallPanel.vue';
import WallListPanel from '@/components/editor/WallListPanel.vue';
import { useProjectEditor } from '@/composables/useProjectEditor';
import { useProjectKeyboardShortcuts } from '@/composables/useProjectKeyboardShortcuts';
import type { CanvasBoardHandle } from '@/types/canvas';
import type {
  CanvasBoardBindings,
  CanvasHudModel,
  EditorSettingsModel,
  EditorStatusModel,
  SelectedWallModel,
  ToolbarActions,
  ToolbarState,
  WallListModel
} from '@/types/editor';

const canvasRef = ref<CanvasBoardHandle | null>(null);
const editor = useProjectEditor(canvasRef);

useProjectKeyboardShortcuts(editor);

const panels = reactive({
  toolbar: {
    state: computed<ToolbarState>(() => ({
      imageReady: editor.view.hasImage,
      detectingCorners: editor.state.detectingCorners,
      draftActive: editor.state.draftState.active,
      hasSelection: editor.view.hasSelectedWall,
      snapToCorners: editor.state.snapToCorners,
      showCorners: editor.state.showCorners,
      cornerSnapToolLabel: editor.view.cornerSnapToolLabel,
      cornerDisplayToolLabel: editor.view.cornerDisplayToolLabel,
      theme: editor.state.theme
    })),
    actions: {
      importImage: editor.actions.importImage,
      openProject: editor.actions.openProject,
      saveProject: () => {
        void editor.actions.saveProject(false);
      },
      exportMask: editor.actions.exportMask,
      focusDrawing: editor.controls.focusDrawing,
      finishDraft: editor.controls.finishDraft,
      cancelDraft: editor.controls.cancelDraft,
      deleteWall: editor.actions.deleteSelectedWall,
      detectCorners: editor.actions.detectCorners,
      toggleCornerSnap: editor.controls.toggleCornerSnap,
      toggleShowCorners: editor.controls.toggleShowCorners,
      fitCanvas: editor.controls.fitCanvas,
      toggleTheme: editor.controls.toggleTheme
    } as ToolbarActions
  },
  settings: computed<EditorSettingsModel>(() => ({
    image: editor.state.image,
    wallWidthPx: editor.state.defaultWallWidthPx,
    snapRadiusPx: editor.state.snapRadiusPx,
    snapToCorners: editor.state.snapToCorners,
    showCorners: editor.state.showCorners,
    setWallWidthPx: editor.controls.setDefaultWallWidthPx,
    setSnapRadiusPx: editor.controls.setSnapRadiusPx,
    setSnapToCorners: editor.controls.setSnapToCorners,
    setShowCorners: editor.controls.setShowCorners
  })),
  status: computed<EditorStatusModel>(() => ({
    canvasStatus: editor.view.canvasStatus,
    cornerSnapStatus: editor.view.cornerSnapStatus,
    cornerDisplayStatus: editor.view.cornerDisplayStatus,
    candidateCornerCount: editor.state.candidateCorners.length,
    wallCount: editor.state.walls.length,
    draftActive: editor.state.draftState.active,
    draftPointCount: editor.state.draftState.points
  })),
  canvas: {
    board: computed<CanvasBoardBindings>(() => ({
      image: editor.state.image,
      walls: editor.state.walls,
      candidateCorners: editor.state.candidateCorners,
      selectedWallId: editor.state.selectedWallId,
      wallWidthPx: editor.state.defaultWallWidthPx,
      snapRadiusPx: editor.state.snapRadiusPx,
      snapToCorners: editor.state.snapToCorners,
      showCorners: editor.state.showCorners,
      theme: editor.state.theme
    })),
    status: computed<CanvasHudModel>(() => ({
      canvasStatus: editor.view.canvasStatus,
      draftState: editor.state.draftState
    }))
  },
  walls: {
    list: computed<WallListModel>(() => ({
      walls: editor.state.walls,
      selectedWallId: editor.state.selectedWallId
    })),
    selection: computed<SelectedWallModel | null>(() => {
      if (!editor.view.selectedWall) {
        return null;
      }

      return {
        wall: editor.view.selectedWall
      };
    })
  }
});
</script>

<template>
  <div class="app-root" :class="editor.view.appThemeClass">
    <header class="topbar panel-surface">
      <div class="brand-block">
        <div class="brand-mark">W</div>
        <div class="brand-copy">
          <div class="brand-title">wall-labeler-desktop</div>
          <div class="brand-subtitle">
            {{ editor.view.activeName }}
            <span class="brand-badge">{{ editor.view.projectBadge }}</span>
            <span v-if="editor.state.dirty" class="dirty-dot" />
          </div>
        </div>
      </div>

      <AppToolbar :state="panels.toolbar.state" :actions="panels.toolbar.actions" />
    </header>

    <main class="workspace">
      <aside class="side-column left-column">
        <EditorSettingsPanel :settings="panels.settings" />
        <EditorStatusPanel :status="panels.status" />
      </aside>

      <section class="canvas-shell panel-surface">
        <CanvasBoard
          ref="canvasRef"
          v-bind="panels.canvas.board"
          @create-wall="editor.actions.onCreateWall"
          @select-wall="editor.controls.setSelectedWallId"
          @draft-state="editor.controls.updateDraftState"
        />

        <CanvasHud :status="panels.canvas.status" />
      </section>

      <aside class="side-column right-column">
        <WallListPanel
          :list="panels.walls.list"
          @select-wall="editor.controls.toggleWallSelection"
        />

        <SelectedWallPanel
          v-if="panels.walls.selection"
          :selection="panels.walls.selection"
          @delete-wall="editor.actions.deleteSelectedWall"
        />
      </aside>
    </main>
  </div>
</template>
