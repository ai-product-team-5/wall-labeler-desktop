<script setup lang="ts">
import type { WallListModel } from '@/types/editor';

defineProps<{
  list: WallListModel;
}>();

defineEmits<{
  selectWall: [wallId: string];
}>();
</script>

<template>
  <section class="panel-surface list-card">
    <div class="section-title-row">
      <span>线</span>
      <span class="section-muted">{{ list.walls.length }}</span>
    </div>

    <el-scrollbar class="wall-scroll">
      <div v-if="!list.walls.length" class="empty-lite">还没有线</div>
      <button
        v-for="(wall, index) in list.walls"
        :key="wall.id"
        class="wall-row"
        :class="{ 'is-active': wall.id === list.selectedWallId }"
        @click="$emit('selectWall', wall.id)"
      >
        <span class="wall-row-index">L{{ index + 1 }}</span>
        <span class="wall-row-meta">{{ wall.points.length }} 点</span>
        <span class="wall-row-width">{{ wall.widthPx }} px</span>
      </button>
    </el-scrollbar>
  </section>
</template>
