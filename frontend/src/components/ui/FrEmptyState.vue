<template>
  <div class="fr-empty">
    <div class="fr-empty-icon">
      <ion-icon :icon="icon" class="ic-48" />
    </div>
    <p class="fr-empty-text">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';

defineProps<{ icon: string; message: string }>();
</script>

<style scoped>
.fr-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 0 24px;
  text-align: center;
  color: var(--fr-ink-3);
  min-height: 60vh;
}
.fr-empty-icon {
  width: 96px; height: 96px;
  border-radius: 50%;
  background: var(--fr-bg-muted);
  display: flex; align-items: center; justify-content: center;
  color: var(--fr-ink-4);
}
.fr-empty-text {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--fr-ink-3);
  letter-spacing: -0.01em;
}
</style>
