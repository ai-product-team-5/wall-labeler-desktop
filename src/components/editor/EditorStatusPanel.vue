<script setup lang="ts">
import type { EditorStatusModel } from '@/types/editor';

defineProps<{
  status: EditorStatusModel;
}>();
</script>

<template>
  <section class="panel-surface stat-card">
    <div class="section-title-row">
      <span>状态</span>
    </div>
    <div class="state-grid">
      <div class="state-chip">
        <span class="chip-label">模式</span>
        <span class="chip-value">{{ status.canvasStatus }}</span>
      </div>
      <div class="state-chip">
        <span class="chip-label">角点吸附</span>
        <span class="chip-value">{{ status.cornerSnapStatus }}</span>
      </div>
      <div class="state-chip">
        <span class="chip-label">角点显示</span>
        <span class="chip-value">{{ status.cornerDisplayStatus }}</span>
      </div>
      <div class="state-chip">
        <span class="chip-label">候选角点</span>
        <span class="chip-value">{{ status.candidateCornerCount }}</span>
      </div>
      <div class="state-chip">
        <span class="chip-label">线</span>
        <span class="chip-value">{{ status.wallCount }}</span>
      </div>
      <div class="state-chip" v-if="status.draftActive">
        <span class="chip-label">草稿</span>
        <span class="chip-value">{{ status.draftPointCount }} 点</span>
      </div>
    </div>
  </section>
</template>
