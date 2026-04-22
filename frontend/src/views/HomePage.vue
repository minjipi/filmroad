<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <!-- Status bar is the device's; we don't mock it in-app. -->
      <header class="home-head">
        <div class="logo">
          <div class="logo-badge">
            <ion-icon :icon="locationOutline" class="ic-18" />
          </div>
          <span class="logo-name">필름로드</span>
        </div>
        <div class="head-actions">
          <button class="icon-btn" type="button" aria-label="search">
            <ion-icon :icon="searchOutline" class="ic-20" />
          </button>
          <button class="icon-btn" type="button" aria-label="notifications">
            <ion-icon :icon="notificationsOutline" class="ic-20" />
            <span class="dot" />
          </button>
        </div>
      </header>

      <div class="home-scroll no-scrollbar">
        <section v-if="hero" class="home-hero">
          <div class="deco" />
          <div class="deco2" />
          <div class="label">{{ hero.monthLabel }} · {{ hero.tag }}</div>
          <h1>{{ hero.title }}</h1>
          <div class="sub">{{ hero.subtitle }}</div>
        </section>
        <section v-else-if="loading" class="home-hero home-hero--skeleton" />

        <nav class="home-tabs">
          <div
            :class="['tab', selectedWorkId === null ? 'active' : '']"
            @click="onSelectWork(null)"
          >
            모두
          </div>
          <div
            v-for="w in works"
            :key="w.id"
            :class="['tab', selectedWorkId === w.id ? 'active' : '']"
            @click="onSelectWork(w.id)"
          >
            {{ w.title }}
          </div>
        </nav>

        <div class="home-segmented">
          <span
            :class="['seg', scope === 'NEAR' ? 'active' : '']"
            @click="onSelectScope('NEAR')"
          >내 위치 근처</span>
          <span
            :class="['seg', scope === 'TRENDING' ? 'active' : '']"
            @click="onSelectScope('TRENDING')"
          >전국 트렌드</span>
        </div>

        <div class="home-grid">
          <div
            v-for="p in places"
            :key="p.id"
            class="photo-card"
            @click="onOpenDetail(p.id)"
          >
            <img :src="p.coverImageUrl" :alt="p.name" />
            <div class="grad" />
            <div
              :class="['like', p.liked ? 'on' : '']"
              @click.stop="onToggleLike(p.id)"
            >
              <ion-icon :icon="p.liked ? heart : heartOutline" class="ic-16" />
            </div>
            <div class="cap">
              <div class="chip-wrap">
                <FrChip variant="primary">{{ p.workTitle }}</FrChip>
              </div>
              <div class="t">{{ p.name }}</div>
              <div class="loc">
                <ion-icon :icon="locationOutline" class="ic-16" />{{ p.regionLabel }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div slot="fixed" class="home-tabbar-slot">
        <FrTabBar :model-value="'home'" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  locationOutline,
  searchOutline,
  notificationsOutline,
  heart,
  heartOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useHomeStore, type HomeScope } from '@/stores/home';
import FrChip from '@/components/ui/FrChip.vue';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import { useToast } from '@/composables/useToast';

const homeStore = useHomeStore();
const { hero, works, places, loading, error, selectedWorkId, scope } = storeToRefs(homeStore);
const { showError } = useToast();
const router = useRouter();

async function onSelectWork(id: number | null): Promise<void> {
  await homeStore.setWork(id);
  if (error.value) await showError(error.value);
}

async function onSelectScope(s: HomeScope): Promise<void> {
  await homeStore.setScope(s);
  if (error.value) await showError(error.value);
}

function onToggleLike(id: number): void {
  homeStore.toggleLikeLocal(id);
}

async function onOpenDetail(id: number): Promise<void> {
  await router.push(`/place/${id}`);
}

onMounted(async () => {
  await homeStore.fetchHome();
  if (error.value) await showError(error.value);
});
</script>

<style scoped>
ion-content {
  --background: #ffffff;
}

.home-head {
  padding: 12px 20px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo { display: flex; align-items: center; gap: 8px; }
.logo-badge {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: var(--fr-primary);
  display: flex; align-items: center; justify-content: center;
  color: #ffffff;
}
.logo-name { font-weight: 900; font-size: 18px; letter-spacing: -0.04em; color: var(--fr-ink); }
.head-actions { display: flex; gap: 4px; }
.icon-btn {
  width: 40px; height: 40px;
  border: none;
  background: var(--fr-bg-muted);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  color: var(--fr-ink-2);
  position: relative;
  cursor: pointer;
}
.icon-btn .dot {
  position: absolute; top: 9px; right: 9px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--fr-coral);
  border: 2px solid var(--fr-bg-muted);
}

.home-scroll {
  padding-bottom: calc(110px + env(safe-area-inset-bottom));
}

.home-hero {
  margin: 4px 20px 16px;
  padding: 18px 20px;
  background: linear-gradient(135deg, #14BCED 0%, #0ea5d4 100%);
  border-radius: 22px;
  color: #ffffff;
  position: relative;
  overflow: hidden;
}
.home-hero .label {
  font-size: 11px; font-weight: 700; opacity: 0.9;
  letter-spacing: 0.04em; text-transform: uppercase;
}
.home-hero h1 {
  font-size: 22px; font-weight: 800;
  margin: 6px 0 2px;
  letter-spacing: -0.03em; line-height: 1.3;
  white-space: pre-line;
}
.home-hero .sub { font-size: 13px; opacity: 0.9; }
.home-hero .deco {
  position: absolute; right: -18px; top: -18px;
  width: 120px; height: 120px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}
.home-hero .deco2 {
  position: absolute; right: 20px; bottom: -40px;
  width: 80px; height: 80px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}
.home-hero--skeleton {
  min-height: 110px;
  background: linear-gradient(135deg, #cbe8f2 0%, #b8dbe8 100%);
  opacity: 0.6;
}

.home-tabs {
  display: flex; gap: 18px;
  padding: 4px 20px 0;
  border-bottom: 1px solid var(--fr-line);
  margin: 0 0 16px;
  overflow-x: auto;
}
.home-tabs::-webkit-scrollbar { display: none; }
.tab {
  font-weight: 700; font-size: 15px;
  color: var(--fr-ink-4);
  padding: 10px 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  letter-spacing: -0.02em;
  white-space: nowrap;
}
.tab.active { color: var(--fr-ink); border-bottom-color: var(--fr-ink); }

.home-segmented {
  display: flex; gap: 16px;
  padding: 0 20px 14px;
}
.seg {
  font-size: 20px; font-weight: 800;
  color: var(--fr-ink-4);
  letter-spacing: -0.03em;
  cursor: pointer;
}
.seg.active { color: var(--fr-ink); }

.home-grid {
  padding: 0 20px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.photo-card {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: 16px;
  overflow: hidden;
  background: #eef2f6;
  cursor: pointer;
}
.photo-card img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.photo-card .grad {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0) 55%);
}
.photo-card .like {
  position: absolute; top: 10px; right: 10px;
  width: 28px; height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  color: #ffffff;
  cursor: pointer;
}
.photo-card .like.on { color: var(--fr-coral); }
.photo-card .cap {
  position: absolute; left: 12px; right: 12px; bottom: 10px;
  color: #ffffff;
}
.photo-card .cap .chip-wrap { margin-bottom: 6px; display: inline-flex; }
.photo-card .t {
  font-size: 13px; font-weight: 800;
  line-height: 1.25; letter-spacing: -0.02em;
}
.photo-card .loc {
  display: flex; align-items: center; gap: 3px;
  font-size: 10px; opacity: 0.85; margin-top: 3px;
}
</style>
