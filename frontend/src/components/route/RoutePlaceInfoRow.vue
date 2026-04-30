<template>
  <!-- 정보 탭의 한 줄. 디자인의 InfoRow 와 동일 구조 — 좌측 emoji 박스 + label/value. -->
  <div class="rt-info-row">
    <span class="rt-info-icon" aria-hidden="true">{{ icon }}</span>
    <div class="rt-info-body">
      <div class="rt-info-label">{{ label }}</div>
      <div class="rt-info-value">{{ value }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  label: string;
  value: string;
}>();
</script>

<style scoped>
.rt-info-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--fr-line-soft, #f3f4f6);
}
.rt-info-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--fr-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.rt-info-body {
  flex: 1;
  min-width: 0;
}
.rt-info-label {
  font-size: 11px;
  color: var(--fr-ink-3);
  font-weight: 500;
}
.rt-info-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--fr-ink);
  margin-top: 2px;
}
</style>
