<script setup lang="ts">
import type { CanvasHudModel } from '@/types/editor';

defineProps<{
  status: CanvasHudModel;
}>();
</script>

<template>
  <div class="canvas-hud panel-surface hud-surface">
    <span>{{ status.canvasStatus }}</span>
    <span v-if="status.draftState.active">{{ status.draftState.points }} 点</span>
    <span>C 切换角点吸附</span>
    <span>V 切换角点显示</span>
    <span>中键/右键拖动 · 滚轮缩放</span>
  </div>
</template>
