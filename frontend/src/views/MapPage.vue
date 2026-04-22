<template>
  <ion-page>
    <ion-content :fullscreen="true" class="map-content">
      <KakaoMap
        :center="center"
        :zoom="zoom"
        :markers="visibleMarkers"
        :selected-id="selected?.id ?? null"
        :visited-ids="visitedIds"
        @marker-click="onSelect"
      />

      <div class="top-bar">
        <div class="search-box" @click="onSearchFocus">
          <ion-icon :icon="searchOutline" class="ic-18 search-ic" />
          <input
            v-model="query"
            class="search-input"
            type="search"
            enterkeyhint="search"
            :placeholder="'강릉 · 도깨비 촬영지'"
            @keyup.enter="onSearchSubmit"
          />
        </div>
        <button class="icon-btn" type="button" aria-label="filters">
          <ion-icon :icon="optionsOutline" class="ic-20" />
        </button>
      </div>

      <div class="chip-row no-scrollbar">
        <button
          v-for="c in filterChips"
          :key="c.key"
          :class="['filter-chip', c.active ? 'on' : '']"
          type="button"
          @click="c.onClick"
        >
          <ion-icon :icon="c.icon" class="ic-16" />{{ c.label }}
        </button>
      </div>

      <button class="locate" type="button" aria-label="locate" @click="onLocate">
        <ion-icon :icon="locateOutline" class="ic-24" />
      </button>
      <div class="zoom">
        <button type="button" aria-label="zoom-in" @click="zoomIn"><ion-icon :icon="add" class="ic-18" /></button>
        <button type="button" aria-label="zoom-out" @click="zoomOut"><ion-icon :icon="remove" class="ic-18" /></button>
      </div>

      <section v-if="selected" class="sheet">
        <div class="handle" />
        <div class="title-row">
          <div>
            <FrChip variant="soft">{{ workBadge }}</FrChip>
            <div class="t1">{{ selected.name }}</div>
            <div class="t2">{{ selected.regionLabel }}<span v-if="distanceLabel"> · {{ distanceLabel }}</span></div>
          </div>
          <button
            class="bookmark"
            :class="{ on: isSaved(selected.id) }"
            type="button"
            aria-label="save"
            @click="onToggleSave"
          >
            <ion-icon :icon="isSaved(selected.id) ? bookmark : bookmarkOutline" class="ic-18" />
          </button>
        </div>
        <div class="sheet-preview">
          <div class="sheet-thumb"><img :src="selected.coverImageUrl" :alt="selected.name" /></div>
          <div class="sheet-meta">
            <div class="stat-row">
              <span class="s"><ion-icon :icon="cameraOutline" class="ic-16" />{{ formatCount(selected.photoCount) }}</span>
              <span class="s"><ion-icon :icon="heartOutline" class="ic-16" />{{ formatCount(selected.likeCount) }}</span>
              <span class="s star"><ion-icon :icon="star" class="ic-16" />{{ selected.rating.toFixed(1) }}</span>
            </div>
            <button class="go-btn" type="button" @click="onOpenDetail">
              자세히 보기 <ion-icon :icon="arrowForward" class="ic-16" />
            </button>
          </div>
        </div>
      </section>

    </ion-content>
    <FrTabBar :model-value="'map'" />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import {
  searchOutline,
  optionsOutline,
  locateOutline,
  add,
  remove,
  checkmark,
  cameraOutline,
  heartOutline,
  bookmark,
  bookmarkOutline,
  star,
  arrowForward,
  locationOutline,
  filmOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useMapStore, type MapMarker, type MapFilter } from '@/stores/map';
import FrChip from '@/components/ui/FrChip.vue';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import KakaoMap from '@/components/map/KakaoMap.vue';
import { useToast } from '@/composables/useToast';

const mapStore = useMapStore();
const { selected, error, filter, center, workId } = storeToRefs(mapStore);
const { showError } = useToast();
const route = useRoute();
const router = useRouter();
const visibleMarkers = computed<MapMarker[]>(() => mapStore.visibleMarkers);
const visitedIds = computed<number[]>(() => mapStore.visitedIds);
const isSaved = (id: number) => mapStore.isSaved(id);

const query = ref('');
const zoom = ref(5);

function zoomIn(): void {
  zoom.value = Math.max(1, zoom.value - 1);
}
function zoomOut(): void {
  zoom.value = Math.min(14, zoom.value + 1);
}

interface ChipSpec {
  key: string;
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}

const filterChips = computed<ChipSpec[]>(() => {
  const f = filter.value;
  return [
    {
      key: 'SPOTS',
      label: '성지',
      icon: locationOutline,
      active: f === 'SPOTS' && workId.value === null,
      onClick: async () => {
        mapStore.setFilter('SPOTS');
        if (workId.value !== null) await mapStore.setWork(null);
      },
    },
    {
      key: 'VISITED',
      label: '방문완료',
      icon: checkmark,
      active: f === 'VISITED',
      onClick: () => mapStore.setFilter('VISITED' as MapFilter),
    },
    {
      key: 'SAVED',
      label: '저장한 곳',
      icon: bookmarkOutline,
      active: f === 'SAVED',
      onClick: () => mapStore.setFilter('SAVED' as MapFilter),
    },
    {
      key: 'WORK_1',
      label: '도깨비',
      icon: filmOutline,
      active: workId.value === 1,
      onClick: async () => {
        mapStore.setFilter('SPOTS');
        await mapStore.setWork(workId.value === 1 ? null : 1);
      },
    },
  ];
});

const distanceLabel = computed(() => {
  const d = selected.value?.distanceKm;
  if (d == null) return '';
  if (d < 1) return `${Math.round(d * 1000)}m`;
  return `${d.toFixed(1)}km`;
});

const workBadge = computed(() => {
  const s = selected.value;
  if (!s) return '';
  const ep = s.workEpisode ? ` · ${s.workEpisode}` : '';
  return `${s.workTitle}${ep}`;
});

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

async function onSelect(id: number): Promise<void> {
  await mapStore.selectMarker(id);
}

function onSearchFocus(): void {
  // Keep parity with the design: tapping the bar focuses the input; nothing else here.
}

async function onSearchSubmit(): Promise<void> {
  await mapStore.setQuery(query.value);
}

async function onLocate(): Promise<void> {
  if (!('geolocation' in navigator)) {
    await showError('이 기기에서 위치 정보를 사용할 수 없어요');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      await mapStore.setCenter(pos.coords.latitude, pos.coords.longitude);
    },
    async () => showError('위치 정보를 가져오지 못했어요'),
    { enableHighAccuracy: true, timeout: 5000 },
  );
}

function onToggleSave(): void {
  if (!selected.value) return;
  mapStore.toggleSave(selected.value.id);
}

async function onOpenDetail(): Promise<void> {
  if (!selected.value) return;
  await router.push(`/place/${selected.value.id}`);
}

function pickQueryNumber(v: unknown): number | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

onMounted(async () => {
  const qLat = pickQueryNumber(route.query.lat);
  const qLng = pickQueryNumber(route.query.lng);
  const qSelected = pickQueryNumber(route.query.selectedId);
  if (qLat !== null && qLng !== null) {
    await mapStore.setCenter(qLat, qLng);
  } else {
    await mapStore.fetchMap();
  }
  if (qSelected !== null) await mapStore.selectMarker(qSelected);
  if (error.value) await showError(error.value);
});
</script>

<style scoped>
.top-bar {
  position: absolute;
  top: calc(16px + env(safe-area-inset-top));
  left: 16px; right: 16px;
  z-index: 20;
  display: flex; gap: 8px;
}
.search-box {
  flex: 1;
  height: 48px;
  background: #ffffff;
  border-radius: 16px;
  display: flex; align-items: center;
  padding: 0 16px; gap: 10px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04);
  font-size: 14px;
  color: var(--fr-ink);
}
.search-ic { color: var(--fr-ink-4); }
.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  color: var(--fr-ink);
}
.search-input::placeholder { color: var(--fr-ink-3); }
.icon-btn {
  width: 48px; height: 48px;
  background: #ffffff;
  border: none;
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  color: var(--fr-ink);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04);
  cursor: pointer;
}

.chip-row {
  position: absolute;
  top: calc(76px + env(safe-area-inset-top));
  left: 0; right: 0;
  z-index: 20;
  display: flex; gap: 8px;
  padding: 0 16px;
  overflow-x: auto;
}
.filter-chip {
  white-space: nowrap;
  background: #ffffff;
  border: none;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 12px; font-weight: 700;
  color: var(--fr-ink);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.04);
  display: flex; align-items: center; gap: 5px;
  cursor: pointer;
}
.filter-chip.on { background: var(--fr-ink); color: #ffffff; }

.locate {
  position: absolute;
  right: 16px;
  bottom: calc(300px + env(safe-area-inset-bottom));
  z-index: 20;
  width: 48px; height: 48px;
  border: none;
  border-radius: 14px;
  background: #ffffff;
  color: var(--fr-primary);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04);
  cursor: pointer;
}
.zoom {
  position: absolute;
  right: 16px;
  bottom: calc(360px + env(safe-area-inset-bottom));
  z-index: 20;
  display: flex; flex-direction: column;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}
.zoom button {
  width: 44px; height: 44px;
  background: #ffffff;
  border: none;
  color: var(--fr-ink);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.zoom button + button { border-top: 1px solid var(--fr-line); }

.sheet {
  position: absolute;
  left: 0; right: 0;
  bottom: calc(84px + env(safe-area-inset-bottom));
  z-index: 25;
  background: #ffffff;
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -10px 40px rgba(15, 23, 42, 0.12);
  padding: 10px 20px 16px;
}
.sheet .handle {
  width: 38px; height: 5px;
  background: #e2e8f0;
  border-radius: 3px;
  margin: 0 auto 12px;
}
.sheet .title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.sheet .t1 {
  font-size: 17px; font-weight: 800;
  letter-spacing: -0.02em;
  margin-top: 6px;
}
.sheet .t2 {
  font-size: 12px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}
.bookmark {
  width: 36px; height: 36px;
  border: none;
  border-radius: 12px;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-3);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.bookmark.on { color: var(--fr-primary); }
.sheet-preview { display: flex; gap: 10px; }
.sheet-thumb {
  width: 74px; height: 74px;
  border-radius: 14px;
  overflow: hidden;
  flex-shrink: 0;
  background: #eef2f6;
}
.sheet-thumb img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.sheet-meta {
  flex: 1;
  display: flex; flex-direction: column;
  justify-content: space-between;
  gap: 6px;
}
.stat-row {
  display: flex; gap: 14px;
  font-size: 11px;
  color: var(--fr-ink-3);
}
.stat-row .s { display: flex; align-items: center; gap: 3px; }
.stat-row .s.star ion-icon {
  color: var(--fr-amber);
}
.go-btn {
  height: 38px;
  border: none;
  border-radius: 11px;
  background: var(--fr-primary);
  color: #ffffff;
  font-weight: 700; font-size: 13px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 0 14px;
  cursor: pointer;
}
</style>
