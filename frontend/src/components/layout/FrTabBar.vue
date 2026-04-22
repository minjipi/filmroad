<template>
  <nav class="fr-nav">
    <div class="fr-nav-row">
      <div
        v-for="item in items"
        :key="item.key"
        :class="[
          item.isCta ? 'fr-nav-cta' : 'fr-nav-item',
          !item.isCta && modelValue === item.key ? 'is-active' : '',
        ]"
        @click="onTap(item.key)"
      >
        <ion-icon :icon="item.icon" class="ic-24" />
        <span v-if="!item.isCta" class="lbl">{{ item.label }}</span>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { home, map, camera, bookmark, person } from 'ionicons/icons';

export type TabKey = 'home' | 'map' | 'camera' | 'saved' | 'me';

interface TabItem {
  key: TabKey;
  label: string;
  icon: string;
  isCta?: boolean;
}

const props = defineProps<{ modelValue: TabKey }>();
const emit = defineEmits<{ (e: 'change', key: TabKey): void }>();

const items: TabItem[] = [
  { key: 'home', label: '홈', icon: home },
  { key: 'map', label: '지도', icon: map },
  { key: 'camera', label: '', icon: camera, isCta: true },
  { key: 'saved', label: '저장', icon: bookmark },
  { key: 'me', label: '나', icon: person },
];

const ROUTES: Record<TabKey, string> = {
  home: '/home',
  map: '/map',
  camera: '/camera',
  saved: '/saved',
  me: '/profile',
};

const router = useRouter();

function onTap(key: TabKey): void {
  emit('change', key);
  if (key === props.modelValue) return;
  router.push(ROUTES[key]);
}
</script>

<style scoped>
.fr-nav {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: calc(84px + env(safe-area-inset-bottom));
  padding: 0 24px calc(18px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(18px);
  border-top: 1px solid var(--fr-line);
  z-index: 50;
  overflow: visible;
}
.fr-nav-row {
  height: 66px;
  display: flex;
  align-items: center;
  position: relative;
}
.fr-nav-item {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  color: var(--fr-ink-4);
  cursor: pointer;
  user-select: none;
}
.fr-nav-item.is-active { color: var(--fr-primary); }
.fr-nav-item .lbl { font-size: 10px; font-weight: 600; letter-spacing: 0; white-space: nowrap; }
.fr-nav-cta {
  flex: 1;
  position: relative;
  display: flex; align-items: center; justify-content: center;
  height: 100%;
  cursor: pointer;
}
.fr-nav-cta::before {
  content: "";
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  width: 52px; height: 52px; border-radius: 50%;
  background: var(--fr-primary);
  box-shadow: 0 8px 20px rgba(20, 188, 237, 0.4);
  z-index: 0;
}
.fr-nav-cta ion-icon {
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  color: #ffffff;
  z-index: 1;
  width: 24px; height: 24px;
}
</style>
