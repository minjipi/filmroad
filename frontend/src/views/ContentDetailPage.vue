<template>
  <ion-page>
    <ion-content :fullscreen="true" class="wd-content">
      <div class="hero-bg">
        <img v-if="content" :src="content.posterUrl" :alt="content.title" />
      </div>

      <header class="top">
        <button type="button" aria-label="back" @click="onBack">
          <ion-icon :icon="chevronBack" class="ic-22" />
        </button>
        <button type="button" aria-label="bookmark" @click="onBookmark">
          <ion-icon :icon="bookmarkOutline" class="ic-20" />
        </button>
      </header>

      <div v-if="content" class="head">
        <div class="poster"><img :src="content.posterUrl" :alt="content.title" /></div>
        <div class="head-info">
          <span class="kind">{{ kindLabel }}</span>
          <h1>{{ content.subtitle ?? '' }}<br v-if="content.subtitle" />{{ content.title }}</h1>
          <div class="meta">
            <ion-icon :icon="star" class="ic-16 star-ic" />
            <b>{{ content.ratingAverage != null ? content.ratingAverage.toFixed(1) : '—' }}</b>
            <span v-if="episodeLabel"> · {{ episodeLabel }}</span>
            <span v-if="content.network"> · {{ content.network }}</span>
          </div>
        </div>
      </div>
      <div
        v-else-if="loading"
        class="head head--skeleton"
        data-testid="cd-head-skeleton"
      >
        <ion-skeleton-text :animated="true" class="sk-poster" />
        <div class="head-info">
          <ion-skeleton-text :animated="true" class="sk-kind" />
          <ion-skeleton-text :animated="true" class="sk-title" />
          <ion-skeleton-text :animated="true" class="sk-meta" />
        </div>
      </div>

      <div class="card-sheet">
        <section v-if="progress" class="progress-card">
          <div class="ring" :style="ringStyle">
            <span class="pct">{{ progress.percent }}%</span>
          </div>
          <div class="mid">
            <div class="t">{{ progress.collectedCount }} / {{ progress.totalCount }} 성지 수집 중</div>
            <div v-if="progress.nextBadgeText" class="s">{{ progress.nextBadgeText }}</div>
          </div>
          <button class="go" type="button" @click="onOpenRoute">루트 짜기</button>
        </section>
        <section
          v-else-if="loading"
          class="progress-card progress-card--skeleton"
          data-testid="cd-progress-skeleton"
        >
          <ion-skeleton-text :animated="true" class="sk-ring" />
          <div class="mid">
            <ion-skeleton-text :animated="true" class="sk-t" />
            <ion-skeleton-text :animated="true" class="sk-s" />
          </div>
          <ion-skeleton-text :animated="true" class="sk-go" />
        </section>

        <nav class="chips no-scrollbar">
          <div
            v-for="c in chipList"
            :key="c.key"
            :class="['chip-i', activeChip === c.key ? 'on' : '']"
            @click="onSelectChip(c.key)"
          >{{ c.label }}</div>
        </nav>

        <section v-if="activeChip === 'SPOTS'" class="section">
          <div class="section-h">
            <h2>촬영지 {{ spots.length }}곳</h2>
            <span class="s sort-trigger" data-testid="spots-sort">
              회차순<ion-icon :icon="chevronDownOutline" class="ic-16" />
            </span>
          </div>
          <div class="view-toggle" data-testid="spots-view-toggle">
            <button
              type="button"
              :class="['vt', spotsView === 'list' ? 'on' : '']"
              data-testid="spots-view-list"
              @click="spotsView = 'list'"
            >
              <ion-icon :icon="listOutline" class="ic-16" />목록
            </button>
            <button
              type="button"
              :class="['vt', spotsView === 'map' ? 'on' : '']"
              data-testid="spots-view-map"
              @click="spotsView = 'map'"
            >
              <ion-icon :icon="mapOutline" class="ic-16" />지도
            </button>
          </div>
          <div
            v-if="spotsView === 'map'"
            class="spots-map"
            data-testid="spots-map"
          >
            <!-- task #27: fit-to 로 모든 성지 마커가 한 viewport 에 보이게.
                 center/zoom 은 마운트 직후 KakaoMap 이 fitTo 로 재조정하므로
                 single-source 가 아니라 fallback 역할 (지도 마운트 직후 한 frame). -->
            <KakaoMap
              v-if="mapMarkers.length > 0"
              :center="mapCenter"
              :zoom="8"
              :markers="mapMarkers"
              :selected-id="null"
              :visited-ids="visitedPlaceIds"
              :fit-to="mapFitPoints"
              @marker-click="onOpenSpot"
            />
            <p v-else class="empty-note">좌표 정보가 없어 지도를 표시할 수 없어요</p>
          </div>
          <div v-else class="spots">
            <div
              v-for="s in spots"
              :key="s.placeId"
              :class="['spot', s.visited ? 'done' : '']"
              @click="onOpenSpot(s.placeId)"
            >
              <div class="spot-thumb">
                <img
                  v-if="s.scenes[0]?.imageUrl"
                  :src="s.scenes[0].imageUrl"
                  :alt="s.name"
                />
              </div>
              <div class="spot-info">
                <div class="t">{{ s.name }}</div>
                <div class="s2">
                  <ion-icon :icon="locationOutline" class="ic-16" />
                  {{ s.regionShort }}<template v-if="s.scenes[0]?.contentEpisode"> · {{ s.scenes[0].contentEpisode }}</template><template v-if="s.scenes[0]?.sceneTimestamp"> · {{ s.scenes[0].sceneTimestamp }}</template>
                </div>
                <div
                  v-if="s.visited && s.visitedAt"
                  class="e mint"
                  data-testid="spot-visited"
                >
                  {{ formatVisited(s.visitedAt) }} 인증완료
                  <ion-icon :icon="checkmark" class="ic-14" />
                </div>
                <div v-else-if="s.scenes[0]?.sceneDescription" class="e">{{ s.scenes[0].sceneDescription }}</div>
              </div>
              <div class="spot-action">
                <ion-icon :icon="s.visited ? checkmark : chevronForwardOutline" class="ic-20" />
              </div>
            </div>
            <p v-if="spots.length === 0" class="empty-note">등록된 촬영지가 없어요</p>
          </div>
        </section>

        <section v-else class="section">
          <FrEmptyState :icon="sparklesOutline" :message="chipPlaceholderMessage" />
        </section>

        <div class="bottom-space" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { IonPage, IonContent, IonIcon, IonSkeletonText } from '@ionic/vue';
import {
  chevronBack,
  chevronForwardOutline,
  chevronDownOutline,
  bookmarkOutline,
  star,
  locationOutline,
  checkmark,
  sparklesOutline,
  listOutline,
  mapOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useContentDetailStore, type ContentDetailChip, type ContentDetailSpot } from '@/stores/contentDetail';
import FrEmptyState from '@/components/ui/FrEmptyState.vue';
import KakaoMap from '@/components/map/KakaoMap.vue';
import type { MapMarker } from '@/stores/map';
import { useToast } from '@/composables/useToast';

const props = defineProps<{ id: string | number }>();

const router = useRouter();
const contentStore = useContentDetailStore();
const { content, progress, spots, activeChip, error, loading } = storeToRefs(contentStore);
const { showError, showInfo } = useToast();

const contentIdNum = computed(() => Number(props.id));

const chipList: Array<{ key: ContentDetailChip; label: string }> = [
  { key: 'SPOTS', label: '성지 목록' },
  { key: 'INFO', label: '정보' },
  { key: 'CAST', label: '출연진' },
  { key: 'FANS', label: '다른 팬들' },
];

const spotsView = ref<'list' | 'map'>('list');

function hasCoords(s: ContentDetailSpot): boolean {
  return typeof s.latitude === 'number' && typeof s.longitude === 'number';
}

const mapMarkers = computed<MapMarker[]>(() =>
  spots.value.filter(hasCoords).map((s) => ({
    id: s.placeId,
    name: s.name,
    latitude: s.latitude as number,
    longitude: s.longitude as number,
    contentId: contentIdNum.value,
    contentTitle: content.value?.title ?? '',
    regionLabel: s.regionShort,
    distanceKm: null,
  })),
);

const mapCenter = computed<{ lat: number; lng: number }>(() => {
  const pts = mapMarkers.value;
  if (pts.length === 0) return { lat: 36.0, lng: 127.8 };
  const lat = pts.reduce((a, p) => a + p.latitude, 0) / pts.length;
  const lng = pts.reduce((a, p) => a + p.longitude, 0) / pts.length;
  return { lat, lng };
});

// task #27: KakaoMap.fitTo 로 넘길 점 좌표 — markers 와 1:1. 비어있으면 fit
// 동작 안 하고 KakaoMap 이 기본 center/zoom 사용. 이 페이지의 KakaoMap 은
// `v-if="mapMarkers.length > 0"` 가드로 0 케이스에서 마운트 자체 안 됨.
const mapFitPoints = computed<{ lat: number; lng: number }[]>(() =>
  mapMarkers.value.map((m) => ({ lat: m.latitude, lng: m.longitude })),
);

const visitedPlaceIds = computed<number[]>(() =>
  spots.value.filter((s) => s.visited).map((s) => s.placeId),
);

const kindLabel = computed(() => {
  const w = content.value;
  if (!w) return '';
  if (w.yearStart) return `${w.kind} · ${w.yearStart}`;
  return w.kind;
});

const episodeLabel = computed(() => {
  const n = content.value?.episodeCount;
  if (n == null) return '';
  return `${n}부작`;
});

const ringStyle = computed(() => {
  const p = progress.value?.percent ?? 0;
  return {
    background: `conic-gradient(white 0% ${p}%, rgba(255, 255, 255, 0.3) ${p}% 100%)`,
  };
});

const chipPlaceholderMessage = computed(() => {
  if (activeChip.value === 'INFO') return '작품 정보는 곧 공개됩니다';
  if (activeChip.value === 'CAST') return '출연진 정보는 곧 공개됩니다';
  return '다른 팬들 활동은 곧 공개됩니다';
});

function formatVisited(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diffDays = Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  return new Date(t).toLocaleDateString('ko-KR');
}

function onBack(): void {
  router.back();
}

async function onBookmark(): Promise<void> {
  await showInfo('작품 북마크는 곧 공개됩니다');
}

async function onOpenRoute(): Promise<void> {
  // 작품 컨텍스트(시드 작품 + 제목) 를 query 로 실어 보내 TripRoutePage 가
  // 신규 코스의 default 시드로 사용. 기존 컬렉션이 있으면 :collectionId 경로
  // 로 진입하는 별도 흐름. 백엔드 task #6 완료되면 TripRoutePage 가 query
  // 를 읽어 해당 작품의 성지를 자동 채움.
  const c = content.value;
  await router.push({
    path: '/route',
    query: {
      contentId: String(contentIdNum.value),
      ...(c?.title ? { contentTitle: c.title } : {}),
    },
  });
}

async function onSelectChip(c: ContentDetailChip): Promise<void> {
  contentStore.setChip(c);
  if (c !== 'SPOTS') await showInfo(chipPlaceholderMessage.value);
}

async function onOpenSpot(id: number): Promise<void> {
  await router.push(`/place/${id}`);
}

async function load(): Promise<void> {
  await contentStore.fetch(contentIdNum.value);
  if (error.value) await showError(error.value);
}

onMounted(load);
// task #25: stale-data 가드 — 다른 contentId 진입 시 이전 work / spots /
// progress 가 잠시 잔류하지 않도록 store 초기화.
onUnmounted(() => contentStore.reset());
watch(contentIdNum, (next, prev) => {
  if (next !== prev) {
    // Ionic 의 페이지 캐싱 + Vue Router 의 컴포넌트 재사용 때문에 onUnmounted
    // 가 발동하지 않은 채 contentId 만 바뀌는 케이스. fetch 직전에 명시적으로
    // 비워야 직전 작품 데이터가 새 응답 전까지 화면에 남지 않음.
    contentStore.reset();
    void load();
  }
});
</script>

<style scoped>
ion-content.wd-content {
  --background: #ffffff;
}

.hero-bg {
  position: absolute;
  top: 0; left: 0; right: 0;
  /* PlaceDetail 의 .hero(440px) 와 동일한 톤. 320 은 .head + card-sheet 가 너무
     일찍 흰 영역으로 가려져 답답함. */
  height: 440px;
  overflow: hidden;
  z-index: 0;
}
.hero-bg img {
  width: 100%; height: 100%;
  object-fit: cover;
  filter: blur(1px);
  display: block;
}
.hero-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(15, 23, 42, 0.3), rgba(15, 23, 42, 0.8) 60%, #ffffff 100%);
}

.top {
  position: relative;
  padding: calc(4px + env(safe-area-inset-top)) 16px 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 5;
}
.top button {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  border: none;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.head {
  position: relative;
  z-index: 5;
  /* hero-bg(440px) 안쪽에서 포스터+타이틀이 위아래로 숨 쉴 수 있게 padding 확대.
     상단은 .top 헤더(40 + safe-area-top) 와의 사이를 띄우고, 하단은 흰
     card-sheet 가 너무 빨리 올라오지 않도록. */
  padding: 60px 20px 40px;
  display: flex;
  gap: 16px;
  color: #ffffff;
}
.poster {
  width: 104px; height: 152px;
  border-radius: 14px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #1e293b;
}
.poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
.head-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-width: 0;
}
.kind {
  font-size: 11px;
  opacity: 0.8;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.head-info h1 {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin: 6px 0 8px;
}
.head-info .meta {
  font-size: 12px;
  opacity: 0.9;
  display: flex;
  gap: 6px;
  align-items: center;
}
.head-info .meta b { font-size: 14px; font-weight: 800; }
.star-ic { color: #f5a524; }

.head--skeleton .sk-poster {
  width: 104px;
  height: 152px;
  margin: 0;
  border-radius: 14px;
  flex-shrink: 0;
  --background: rgba(255, 255, 255, 0.18);
  --background-rgb: 255, 255, 255;
}
.head--skeleton .head-info {
  gap: 6px;
}
.head--skeleton .sk-kind {
  width: 28%;
  height: 11px;
  margin: 0;
  border-radius: 4px;
  --background: rgba(255, 255, 255, 0.18);
  --background-rgb: 255, 255, 255;
}
.head--skeleton .sk-title {
  width: 65%;
  height: 26px;
  margin: 6px 0 8px;
  border-radius: 6px;
  --background: rgba(255, 255, 255, 0.22);
  --background-rgb: 255, 255, 255;
}
.head--skeleton .sk-meta {
  width: 45%;
  height: 14px;
  margin: 0;
  border-radius: 4px;
  --background: rgba(255, 255, 255, 0.18);
  --background-rgb: 255, 255, 255;
}

.progress-card--skeleton {
  background: var(--fr-bg-muted);
}
.progress-card--skeleton .sk-ring {
  width: 54px;
  height: 54px;
  margin: 0;
  border-radius: 50%;
  flex-shrink: 0;
}
.progress-card--skeleton .mid {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.progress-card--skeleton .sk-t {
  width: 70%;
  height: 14px;
  margin: 0;
  border-radius: 4px;
}
.progress-card--skeleton .sk-s {
  width: 45%;
  height: 11px;
  margin: 0;
  border-radius: 4px;
}
.progress-card--skeleton .sk-go {
  width: 70px;
  height: 32px;
  margin: 0;
  border-radius: 8px;
  flex-shrink: 0;
}

.card-sheet {
  position: relative;
  z-index: 4;
  background: #ffffff;
  border-radius: 26px 26px 0 0;
  margin-top: -20px;
  padding: 20px;
  box-shadow: 0 -10px 30px rgba(15, 23, 42, 0.1);
  min-height: 60vh;
}

.progress-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: linear-gradient(135deg, #14BCED, #7c3aed);
  border-radius: 16px;
  color: #ffffff;
}
.ring {
  width: 54px; height: 54px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}
.ring::before {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  background: linear-gradient(135deg, #14BCED, #7c3aed);
}
.ring .pct {
  position: relative;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.progress-card .mid { flex: 1; min-width: 0; }
.progress-card .mid .t { font-size: 14px; font-weight: 800; }
.progress-card .mid .s { font-size: 11px; opacity: 0.85; margin-top: 1px; }
.progress-card .go {
  background: #ffffff;
  color: #7c3aed;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 800;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
}

.chips {
  display: flex;
  gap: 6px;
  padding: 16px 0 0;
  overflow-x: auto;
}
.chip-i {
  white-space: nowrap;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  cursor: pointer;
  user-select: none;
}
.chip-i.on { background: var(--fr-ink); color: #ffffff; }

.section { padding: 22px 0 0; }
.section-h {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}
.section-h h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.section-h .s {
  font-size: 12px;
  color: var(--fr-ink-3);
  font-weight: 700;
}
.section-h .sort-trigger {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
}

.ic-14 {
  width: 14px;
  height: 14px;
}

.view-toggle {
  display: flex;
  gap: 4px;
  background: var(--fr-bg-muted);
  padding: 4px;
  border-radius: 12px;
  margin: 10px 0 14px;
}
.view-toggle .vt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 0;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--fr-ink-3);
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  cursor: pointer;
}
.view-toggle .vt.on {
  background: #ffffff;
  color: var(--fr-ink);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.spots-map {
  position: relative;
  height: 320px;
  border-radius: 16px;
  overflow: hidden;
  background: var(--fr-bg-muted);
  margin-bottom: 12px;
}

.spots {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.spot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px 8px 8px;
  background: #ffffff;
  border: 1px solid var(--fr-line);
  border-radius: 16px;
  position: relative;
  cursor: pointer;
}
.spot-thumb {
  width: 64px; height: 64px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background: #eef2f6;
  position: relative;
}
.spot-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.spot.done .spot-thumb::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(16, 185, 129, 0.4);
}
.spot-info {
  flex: 1;
  min-width: 0;
}
.spot-info .t {
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.spot-info .s2 {
  font-size: 11px;
  color: var(--fr-ink-3);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.spot-info .e {
  font-size: 10.5px;
  color: var(--fr-primary);
  font-weight: 700;
  margin-top: 2px;
}
.spot-info .e.mint {
  color: var(--fr-mint);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.spot-action {
  width: 34px; height: 34px;
  border-radius: 10px;
  background: var(--fr-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-ink-2);
  flex-shrink: 0;
}
.spot.done .spot-action {
  background: #ecfdf5;
  color: var(--fr-mint);
}

.bottom-space { height: calc(40px + env(safe-area-inset-bottom)); }
.empty-note {
  padding: 24px 8px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}
</style>
