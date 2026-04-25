<template>
  <ion-page>
    <ion-content :fullscreen="true" class="cd-content">
      <!-- Hero. detail 로드 전엔 fallback 그라디언트가 보이도록 클래스 분기 —
           이전엔 빈 영역 + 다크 그라디언트 ::after 가 흰 배경 위에 떠서 진입
           transition 중 이전 페이지가 비쳐 보이는 듯한 인상을 줬다. -->
      <header :class="['coll-hero', !detail?.coverImageUrl ? 'coll-hero--placeholder' : '']">
        <img
          v-if="detail?.coverImageUrl"
          :src="detail.coverImageUrl"
          :alt="detail?.name ?? ''"
        />
        <div class="coll-top">
          <button
            type="button"
            aria-label="뒤로"
            data-testid="cd-back"
            @click="onBack"
          >
            <ion-icon :icon="chevronBackOutline" class="ic-22" />
          </button>
          <div class="right">
            <button type="button" aria-label="공유" @click="onShare">
              <ion-icon :icon="shareSocialOutline" class="ic-20" />
            </button>
            <button type="button" aria-label="more" @click="onMore">
              <ion-icon :icon="ellipsisHorizontal" class="ic-20" />
            </button>
          </div>
        </div>
        <div v-if="detail" class="coll-info" data-testid="cd-hero-info">
          <span v-if="detail.kind === 'WORK'" class="coll-tag">
            <ion-icon :icon="filmOutline" class="ic-16" />작품 기반 컬렉션
          </span>
          <span v-else class="coll-tag custom">
            <ion-icon :icon="bookmark" class="ic-16" />내 컬렉션
          </span>
          <h1 class="coll-title">{{ detail.name }}</h1>
          <div v-if="detail.subtitle" class="coll-sub">{{ detail.subtitle }}</div>
          <div class="coll-meta-row">
            <span class="m">
              <ion-icon :icon="locationOutline" class="ic-16" />{{ detail.totalPlaces }}곳
            </span>
            <span v-if="detail.totalDistanceKm != null" class="sep" />
            <span v-if="detail.totalDistanceKm != null" class="m">
              <ion-icon :icon="trailSignOutline" class="ic-16" />약 {{ formatDistance(detail.totalDistanceKm) }}
            </span>
            <span v-if="detail.likeCount != null" class="sep" />
            <span v-if="detail.likeCount != null" class="m">
              <ion-icon :icon="heartOutline" class="ic-16" />{{ formatCount(detail.likeCount) }}
            </span>
          </div>
        </div>
      </header>

      <div v-if="detail" class="cd-scroll no-scrollbar">
        <!-- Progress card -->
        <section class="progress-card" data-testid="cd-progress">
          <div class="prog-row">
            <span class="lbl">완주 진행률</span>
            <span class="pct">
              {{ detail.visitedPlaces }} / {{ detail.totalPlaces }} · {{ progressPercent }}%
            </span>
          </div>
          <div class="bar">
            <div class="fill" :style="{ width: progressPercent + '%' }" />
          </div>
          <div class="prog-badges">
            <span class="pb">
              <ion-icon :icon="checkmarkCircle" class="ic-16 mint" />
              <b>{{ detail.visitedPlaces }}</b> 방문
            </span>
            <span class="pb">
              <ion-icon :icon="bookmark" class="ic-16 primary" />
              <b>{{ remainingCount }}</b> 남음
            </span>
            <span class="pb">
              <ion-icon :icon="cameraOutline" class="ic-16 coral" />
              <b>{{ detail.certifiedPlaces }}</b> 인증
            </span>
          </div>
        </section>

        <!-- Action row -->
        <section class="action-row">
          <button
            type="button"
            class="btn-a primary"
            data-testid="cd-optimal-route"
            @click="onOptimalRoute"
          >
            <ion-icon :icon="navigateOutline" class="ic-20" />최적 루트 보기
          </button>
          <button
            type="button"
            class="btn-a"
            data-testid="cd-share"
            @click="onShare"
          >
            <ion-icon :icon="shareSocialOutline" class="ic-20" />공유
          </button>
        </section>

        <!-- Owner strip -->
        <section class="owner-strip" data-testid="cd-owner">
          <div class="av">
            <img
              v-if="detail.owner.avatarUrl"
              :src="detail.owner.avatarUrl"
              :alt="detail.owner.nickname"
            />
          </div>
          <div class="owner-text">
            <span class="nm">{{ detail.owner.nickname }}</span>
            <span class="tt">
              · {{ ownershipLabel }} · {{ createdAtLabel }}
            </span>
          </div>
          <ion-icon
            :icon="detail.privacy === 'PRIVATE' ? lockClosedOutline : globeOutline"
            class="ic-16 privacy"
          />
        </section>

        <!-- Route map (actual Kakao map + polyline through places in order). -->
        <section class="mini-map" data-testid="cd-minimap">
          <KakaoMap
            v-if="mapMarkers.length > 0"
            :center="mapCenter"
            :zoom="mapZoom"
            :markers="mapMarkers"
            :selected-id="null"
            :visited-ids="visitedPlaceIds"
            :route-path="routeLatLngs"
            @marker-click="onOpenPlace"
          />
          <div v-else class="mini-map-empty">
            좌표 정보가 없어 루트를 표시할 수 없어요
          </div>
          <button
            type="button"
            class="exp"
            data-testid="cd-open-full-map"
            @click="onOpenFullMap"
          >
            <ion-icon :icon="expand" class="ic-16" />전체보기
          </button>
        </section>

        <!-- Upcoming places -->
        <div v-if="detail.upcomingPlaces.length > 0">
          <div class="sec-h">다음 방문 추천</div>
          <div class="place-list" data-testid="cd-upcoming-list">
            <div
              v-for="p in detail.upcomingPlaces"
              :key="p.placeId"
              class="place-item"
              data-testid="cd-upcoming-item"
              @click="onOpenPlace(p.placeId)"
            >
              <div class="place-idx">{{ p.orderIndex }}</div>
              <div class="place-thumb">
                <img :src="p.coverImageUrl" :alt="p.name" />
              </div>
              <div class="place-body">
                <div class="chips">
                  <span v-if="p.workTitle" class="c">{{ p.workTitle }}</span>
                  <span v-if="p.workEpisode || p.sceneTimestamp" class="ep">
                    · {{ [p.workEpisode, p.sceneTimestamp].filter(Boolean).join(' ') }}
                  </span>
                </div>
                <div class="nm">{{ p.name }}</div>
                <div class="loc">
                  <ion-icon :icon="locationOutline" class="ic-16" />{{ p.regionLabel }}
                </div>
                <div class="meta">
                  <span v-if="p.distanceKm != null" class="m dist">
                    <ion-icon :icon="navigateOutline" class="ic-16" />{{ formatDistance(p.distanceKm) }}
                  </span>
                  <span class="m">
                    <ion-icon :icon="heartOutline" class="ic-16" />{{ formatCount(p.likeCount) }}
                  </span>
                  <span class="m">
                    <ion-icon :icon="cameraOutline" class="ic-16" />{{ formatCount(p.photoCount) }}
                  </span>
                </div>
              </div>
              <button
                type="button"
                class="place-cta"
                aria-label="인증하기"
                @click.stop="onCapture(p)"
              >
                <ion-icon :icon="cameraOutline" class="ic-18" />
              </button>
            </div>
          </div>
        </div>

        <!-- Visited places -->
        <div v-if="detail.visitedPlacesList.length > 0">
          <div class="sec-h">방문 완료 · {{ detail.visitedPlaces }}곳</div>
          <div class="place-list" data-testid="cd-visited-list">
            <div
              v-for="p in detail.visitedPlacesList"
              :key="p.placeId"
              class="place-item done"
              data-testid="cd-visited-item"
              @click="onOpenPlace(p.placeId)"
            >
              <div class="place-idx">{{ p.orderIndex }}</div>
              <div class="place-thumb">
                <img :src="p.coverImageUrl" :alt="p.name" />
                <div class="done-ov">
                  <span class="chk">
                    <ion-icon :icon="checkmark" class="ic-18" />
                  </span>
                </div>
              </div>
              <div class="place-body">
                <div class="chips">
                  <span v-if="p.workTitle" class="c">{{ p.workTitle }}</span>
                  <span v-if="p.workEpisode || p.sceneTimestamp" class="ep">
                    · {{ [p.workEpisode, p.sceneTimestamp].filter(Boolean).join(' ') }}
                  </span>
                </div>
                <div class="nm">{{ p.name }}</div>
                <div class="loc">
                  <ion-icon :icon="locationOutline" class="ic-16" />{{ p.regionLabel }}
                </div>
                <div class="meta">
                  <span v-if="p.visited" class="m">
                    <ion-icon :icon="checkmark" class="ic-16 mint" />여기 다녀왔어요
                  </span>
                  <span v-if="p.certified" class="m">
                    <ion-icon :icon="cameraOutline" class="ic-16" />인증 완료
                  </span>
                  <span v-else class="m ink-4">
                    <ion-icon :icon="cameraReverseOutline" class="ic-16" />인증 미완
                  </span>
                </div>
              </div>
              <button
                v-if="p.certified"
                type="button"
                class="place-cta done-cta"
                aria-label="상세"
              >
                <ion-icon :icon="chevronForwardOutline" class="ic-18" />
              </button>
              <button
                v-else
                type="button"
                class="place-cta"
                aria-label="인증하기"
                @click.stop="onCapture(p)"
              >
                <ion-icon :icon="cameraOutline" class="ic-18" />
              </button>
            </div>
          </div>
        </div>

        <!-- Empty state — neither upcoming nor visited -->
        <div
          v-if="detail.upcomingPlaces.length === 0 && detail.visitedPlacesList.length === 0"
          class="empty-note"
          data-testid="cd-empty"
        >
          아직 이 컬렉션에 담긴 장소가 없어요
        </div>
      </div>

      <!-- Loading placeholder -->
      <div v-else-if="loading" class="cd-loading" data-testid="cd-loading">
        컬렉션을 불러오는 중…
      </div>

      <!-- Error placeholder -->
      <div v-else-if="error" class="cd-error" data-testid="cd-error">
        {{ error }}
      </div>
    </ion-content>
    <FrTabBar :model-value="'me'" />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  chevronBackOutline,
  chevronForwardOutline,
  shareSocialOutline,
  ellipsisHorizontal,
  filmOutline,
  locationOutline,
  trailSignOutline,
  heartOutline,
  checkmarkCircle,
  checkmark,
  bookmark,
  cameraOutline,
  cameraReverseOutline,
  navigateOutline,
  expand,
  lockClosedOutline,
  globeOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useCollectionStore, type CollectionPlace } from '@/stores/collection';
import { useUploadStore } from '@/stores/upload';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import KakaoMap from '@/components/map/KakaoMap.vue';
import type { MapMarker } from '@/stores/map';
import { useToast } from '@/composables/useToast';
import { formatVisitDate } from '@/utils/formatRelativeTime';

// Route param comes via `props: true` on the router record.
const props = defineProps<{ id: string | number }>();

const router = useRouter();
const collectionStore = useCollectionStore();
const uploadStore = useUploadStore();
const authStore = useAuthStore();
const uiStore = useUiStore();
const { detail, loading, error } = storeToRefs(collectionStore);
const progressPercent = computed(() => collectionStore.progressPercent);
const remainingCount = computed(() => collectionStore.remainingCount);
const { showError, showInfo } = useToast();

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km >= 100) return `${Math.round(km)}km`;
  return `${km.toFixed(1)}km`;
}

// Local formatter removed in task #34 — uses the shared
// `formatVisitDate` utility so the "YYYY.MM.DD" format stays consistent
// with FeedPage visit chips and other callers.

const ownershipLabel = computed(() => {
  if (!detail.value) return '';
  return authStore.user?.id === detail.value.owner.id ? '내 컬렉션' : '공유 컬렉션';
});

const createdAtLabel = computed(() => {
  if (!detail.value) return '';
  return `${formatVisitDate(detail.value.createdAt)} 생성`;
});

// Ordered places across visited + upcoming, filtered to those with coords —
// drives the route polyline and marker layout on the Kakao minimap.
const orderedPlaces = computed<CollectionPlace[]>(() => {
  if (!detail.value) return [];
  return [...detail.value.visitedPlacesList, ...detail.value.upcomingPlaces]
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .filter((p) => p.latitude != null && p.longitude != null);
});

const mapMarkers = computed<MapMarker[]>(() =>
  orderedPlaces.value.map((p) => ({
    id: p.placeId,
    name: p.name,
    latitude: p.latitude as number,
    longitude: p.longitude as number,
    workId: 0,
    workTitle: p.workTitle ?? '',
    regionLabel: p.regionLabel,
    distanceKm: p.distanceKm ?? null,
  })),
);

const mapCenter = computed<{ lat: number; lng: number }>(() => {
  const pts = orderedPlaces.value;
  if (pts.length === 0) return { lat: 36.0, lng: 127.8 };
  const lat = pts.reduce((a, p) => a + (p.latitude as number), 0) / pts.length;
  const lng = pts.reduce((a, p) => a + (p.longitude as number), 0) / pts.length;
  return { lat, lng };
});

const mapZoom = computed<number>(() => {
  const pts = orderedPlaces.value;
  if (pts.length < 2) return 7;
  const lats = pts.map((p) => p.latitude as number);
  const lngs = pts.map((p) => p.longitude as number);
  const span = Math.max(
    Math.max(...lats) - Math.min(...lats),
    Math.max(...lngs) - Math.min(...lngs),
  );
  // Rough mapping: wider span ⇒ higher Kakao zoom level (zoomed further out).
  if (span > 3) return 12;
  if (span > 1.5) return 10;
  if (span > 0.5) return 8;
  if (span > 0.1) return 6;
  return 5;
});

const visitedPlaceIds = computed<number[]>(() =>
  orderedPlaces.value.filter((p) => p.visited).map((p) => p.placeId),
);

const routeLatLngs = computed<Array<{ lat: number; lng: number }>>(() =>
  orderedPlaces.value.map((p) => ({
    lat: p.latitude as number,
    lng: p.longitude as number,
  })),
);

function onBack(): void {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
  } else {
    void router.replace('/profile');
  }
}

function onShare(): void {
  const d = detail.value;
  if (!d) return;
  // 4개 공유 진입점 모두 글로벌 ShareSheet 로 위임 — 카카오톡 / 링크복사 /
  // 시스템공유 3채널은 sheet 안에서 분기. 컬렉션은 owner 닉네임 + N곳을 부제로.
  uiStore.openShareSheet({
    title: d.name,
    description: `${d.owner.nickname} · ${d.totalPlaces}곳`,
    imageUrl: d.coverImageUrl,
    url: typeof window !== 'undefined' ? window.location.href : `/collection/${d.id}`,
  });
}

async function onMore(): Promise<void> {
  await showInfo('편집/삭제 메뉴는 곧 공개됩니다');
}

async function onOptimalRoute(): Promise<void> {
  await showInfo('AI 최적 루트는 곧 공개됩니다');
}

async function onOpenFullMap(): Promise<void> {
  if (!detail.value) return;
  await router.push({
    path: '/map',
    query: { collectionId: String(detail.value.id) },
  });
}

async function onOpenPlace(placeId: number): Promise<void> {
  await router.push(`/place/${placeId}`);
}

async function onCapture(p: CollectionPlace): Promise<void> {
  // CaptureTarget requires workId/workTitle as non-null. Collections of
  // kind=CUSTOM carry places without a backing work — fall back to sentinels
  // (0/"") so the upload flow can still run; the Camera/Upload UIs degrade
  // gracefully when workId=0.
  uploadStore.beginCapture({
    placeId: p.placeId,
    workId: p.workId ?? 0,
    workTitle: p.workTitle ?? '',
    workEpisode: p.workEpisode ?? null,
    placeName: p.name,
    sceneImageUrl: null,
  });
  await router.push('/camera');
}

async function loadDetail(): Promise<void> {
  const id = Number(props.id);
  if (!Number.isFinite(id)) return;
  await collectionStore.fetchDetail(id);
  if (error.value) await showError(error.value);
}

onMounted(loadDetail);

// Clear stale detail when navigating away so the next open starts from a
// loading state rather than flashing the previous collection.
onUnmounted(() => {
  collectionStore.reset();
});

// Re-fetch on param change (e.g. user taps another collection while this
// page is already mounted via ion-router's cache).
watch(
  () => props.id,
  (newId, oldId) => {
    if (newId !== oldId) void loadDetail();
  },
);
</script>

<style scoped>
ion-content.cd-content {
  --background: #ffffff;
}

/* ---------- Hero ---------- */
.coll-hero {
  position: relative;
  height: 260px;
  overflow: hidden;
  /* 기본 솔리드 배경 — 이미지 로드 전이나 cover 가 없을 때도 헤더가 시각적으로
     "고정"돼야 transition 중 이전 페이지가 비쳐 보이지 않는다. 이미지가 들어오면
     그 위로 가려진다. */
  background: var(--fr-ink);
}
.coll-hero img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.coll-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(15, 23, 42, 0.15) 0%,
    rgba(15, 23, 42, 0.35) 55%,
    rgba(15, 23, 42, 0.9) 100%
  );
}
/* coverImageUrl 이 없는 컬렉션 (또는 로딩 중) 용 placeholder — 다크 그라디언트로
   기본 톤을 채워 빈 헤더처럼 보이지 않게 한다. */
.coll-hero--placeholder {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #14213d 100%);
}
.coll-hero--placeholder::after {
  background: linear-gradient(
    180deg,
    rgba(15, 23, 42, 0.0) 0%,
    rgba(15, 23, 42, 0.4) 60%,
    rgba(15, 23, 42, 0.85) 100%
  );
}
.coll-top {
  position: absolute;
  top: calc(8px + env(safe-area-inset-top));
  left: 0;
  right: 0;
  z-index: 5;
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
}
.coll-top button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(10px);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.coll-top .right {
  display: flex;
  gap: 8px;
}
.coll-info {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px 20px 18px;
  color: #ffffff;
  z-index: 4;
}
.coll-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(20, 188, 237, 0.95);
  margin-bottom: 10px;
  letter-spacing: -0.01em;
}
.coll-tag.custom {
  background: rgba(124, 58, 237, 0.95);
}
.coll-title {
  font-size: 26px;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin: 0 0 6px;
}
.coll-sub {
  font-size: 13px;
  opacity: 0.92;
  letter-spacing: -0.01em;
}
.coll-meta-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 12px;
  font-size: 11.5px;
  font-weight: 700;
}
.coll-meta-row .m {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0.95;
}
.coll-meta-row .sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #ffffff;
  opacity: 0.5;
}

/* ---------- Scroll container ---------- */
.cd-scroll {
  overflow-y: auto;
  padding-bottom: calc(110px + env(safe-area-inset-bottom));
}

/* ---------- Progress card ---------- */
.progress-card {
  margin: -24px 16px 0;
  background: #ffffff;
  border-radius: 18px;
  padding: 14px 16px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  position: relative;
  z-index: 6;
}
.prog-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.prog-row .lbl {
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.prog-row .pct {
  font-size: 12.5px;
  font-weight: 800;
  color: var(--fr-primary);
}
.bar {
  height: 8px;
  border-radius: 999px;
  background: var(--fr-line-soft, #eef2f6);
  overflow: hidden;
}
.bar .fill {
  height: 100%;
  background: linear-gradient(90deg, #14bced, #7c3aed);
  border-radius: 999px;
  transition: width 0.3s ease;
}
.prog-badges {
  display: flex;
  gap: 14px;
  margin-top: 12px;
  font-size: 11.5px;
  color: var(--fr-ink-3);
  font-weight: 700;
}
.prog-badges .pb {
  display: flex;
  align-items: center;
  gap: 4px;
}
.prog-badges .pb b {
  color: var(--fr-ink);
  font-weight: 800;
}
.prog-badges .mint {
  color: var(--fr-mint);
}
.prog-badges .primary {
  color: var(--fr-primary);
}
.prog-badges .coral {
  color: var(--fr-coral);
}

/* ---------- Action row ---------- */
.action-row {
  display: flex;
  gap: 8px;
  padding: 14px 16px 0;
}
.action-row .btn-a {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--fr-line);
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 800;
  font-size: 13px;
  color: var(--fr-ink);
  cursor: pointer;
}
.action-row .btn-a.primary {
  flex: 1.4;
  background: var(--fr-primary);
  color: #ffffff;
  border-color: var(--fr-primary);
  box-shadow: 0 6px 14px rgba(20, 188, 237, 0.3);
}

/* ---------- Owner strip ---------- */
.owner-strip {
  margin: 16px 16px 10px;
  padding: 10px 12px;
  background: var(--fr-bg-muted);
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}
.owner-strip .av {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  background: #eee;
  flex-shrink: 0;
}
.owner-strip .av img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.owner-strip .owner-text {
  flex: 1;
}
.owner-strip .nm {
  font-weight: 800;
  color: var(--fr-ink);
}
.owner-strip .tt {
  color: var(--fr-ink-3);
}
.owner-strip .privacy {
  color: var(--fr-ink-4);
}

/* ---------- Route map ---------- */
.mini-map {
  margin: 0 16px 14px;
  height: 320px;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  background: var(--fr-bg-muted);
}
.mini-map-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-ink-3);
  font-size: 13px;
  text-align: center;
  padding: 24px;
}
.mini-map .exp {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.95);
  color: var(--fr-ink);
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  cursor: pointer;
  z-index: 2;
}

/* ---------- Section header ---------- */
.sec-h {
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 800;
  color: var(--fr-ink-3);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* ---------- Place list ---------- */
.place-list {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.place-item {
  display: flex;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--fr-line);
  border-radius: 16px;
  background: #ffffff;
  position: relative;
  cursor: pointer;
}
.place-item.done {
  background: #f6fdf9;
  border-color: #d6f1e3;
}
.place-idx {
  position: absolute;
  left: -8px;
  top: 14px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--fr-ink);
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #ffffff;
}
.place-item.done .place-idx {
  background: var(--fr-mint);
}
.place-thumb {
  width: 78px;
  height: 78px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}
.place-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.place-thumb .done-ov {
  position: absolute;
  inset: 0;
  background: rgba(16, 185, 129, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}
.place-thumb .done-ov .chk {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--fr-mint);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #ffffff;
}
.place-body {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.place-body .chips {
  display: flex;
  gap: 4px;
  align-items: center;
}
.place-body .chips .c {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--fr-primary-soft);
  color: var(--fr-primary);
  letter-spacing: -0.01em;
}
.place-body .chips .ep {
  font-size: 10px;
  font-weight: 700;
  color: var(--fr-ink-3);
}
.place-body .nm {
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--fr-ink);
}
.place-body .loc {
  font-size: 11px;
  color: var(--fr-ink-3);
  display: flex;
  align-items: center;
  gap: 3px;
}
.place-body .meta {
  display: flex;
  gap: 10px;
  font-size: 10.5px;
  color: var(--fr-ink-3);
  font-weight: 700;
  margin-top: 2px;
}
.place-body .meta .m {
  display: flex;
  align-items: center;
  gap: 3px;
}
.place-body .meta .m.dist {
  color: var(--fr-primary);
}
.place-body .meta .m.ink-4 {
  color: var(--fr-ink-4);
}
.place-body .meta .mint {
  color: var(--fr-mint);
}
.place-cta {
  align-self: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--fr-primary);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}
.place-cta.done-cta {
  background: var(--fr-bg-muted);
  color: var(--fr-ink-3);
}

.empty-note,
.cd-loading,
.cd-error {
  padding: 40px 24px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}
.cd-error {
  color: var(--fr-coral);
}
</style>
