<script setup lang="ts">
import type { SelectedWallModel } from '@/types/editor';

defineProps<{
  selection: SelectedWallModel;
}>();

defineEmits<{
  deleteWall: [];
}>();
</script>

<template>
  <section class="panel-surface current-card">
    <div class="section-title-row">
      <span>当前</span>
    </div>
    <div class="current-grid">
      <div class="current-item">
        <span class="chip-label">点</span>
        <span class="chip-value">{{ selection.wall.points.length }}</span>
      </div>
      <div class="current-item">
        <span class="chip-label">宽</span>
        <span class="chip-value">{{ selection.wall.widthPx }} px</span>
      </div>
    </div>
    <el-button round type="danger" plain class="delete-button" @click="$emit('deleteWall')">
      删除
    </el-button>
  </section>
</template>
