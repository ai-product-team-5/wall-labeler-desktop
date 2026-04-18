<script setup lang="ts">
import { computed } from 'vue';
import type { EditorSettingsModel } from '@/types/editor';

const props = defineProps<{
  settings: EditorSettingsModel;
}>();

const wallWidth = computed({
  get: () => props.settings.wallWidthPx,
  set: (value: number) => props.settings.setWallWidthPx(value)
});

const snapRadius = computed({
  get: () => props.settings.snapRadiusPx,
  set: (value: number) => props.settings.setSnapRadiusPx(value)
});

const cornerSnap = computed({
  get: () => props.settings.snapToCorners,
  set: (value: boolean) => props.settings.setSnapToCorners(value)
});

const cornerVisibility = computed({
  get: () => props.settings.showCorners,
  set: (value: boolean) => props.settings.setShowCorners(value)
});
</script>

<template>
  <section class="panel-surface settings-card">
    <div class="section-title-row">
      <span>设置</span>
      <span class="section-muted" v-if="settings.image">
        {{ settings.image.width }} × {{ settings.image.height }}
      </span>
    </div>

    <div class="field-row">
      <div class="field-head">
        <span>宽</span>
        <span class="value-pill">{{ settings.wallWidthPx }} px</span>
      </div>
      <el-slider v-model="wallWidth" :min="1" :max="40" :step="1" />
    </div>

    <div class="field-row">
      <div class="field-head">
        <span>吸附</span>
        <span class="value-pill">{{ settings.snapRadiusPx }} px</span>
      </div>
      <el-slider v-model="snapRadius" :min="4" :max="32" :step="1" />
    </div>

    <div class="switch-row">
      <span>角点吸附</span>
      <el-switch v-model="cornerSnap" size="small" :disabled="!settings.image" />
    </div>

    <div class="switch-row">
      <span>角点显示</span>
      <el-switch v-model="cornerVisibility" size="small" :disabled="!settings.image" />
    </div>
  </section>
</template>
