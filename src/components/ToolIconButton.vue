<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  icon: Component;
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}>();

defineEmits<{
  click: [];
}>();
</script>

<template>
  <el-tooltip :content="label" placement="bottom">
    <el-button
      circle
      class="tool-icon-button"
      :class="{
        'is-active': active,
        'is-danger': danger
      }"
      :disabled="disabled"
      @click="$emit('click')"
    >
      <el-icon>
        <component :is="icon" />
      </el-icon>
    </el-button>
  </el-tooltip>
</template>

<style scoped>
.tool-icon-button {
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  color: var(--ink-1);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.tool-icon-button:hover {
  color: var(--accent-strong);
  border-color: rgba(74, 125, 255, 0.35);
  transform: translateY(-1px);
}

.tool-icon-button.is-active {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  box-shadow: 0 12px 26px rgba(74, 125, 255, 0.24);
}

.tool-icon-button.is-danger:not(:disabled) {
  color: var(--danger);
}
</style>
