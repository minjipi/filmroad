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
        @cluster-click="onClusterClick"
        @bounds-change="onBoundsChange"
        @zoom-change="onKakaoZoomChange"
      />

      <div class="top-bar">
        <button
          class="search-box"
          type="button"
          aria-label="search"
          @click="onSearch"
        >
          <ion-icon :icon="searchOutline" class="ic-18 search-ic" />
          <span class="search-placeholder">강릉 · 도깨비 촬영지</span>
        </button>
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

      <button
        v-if="selected && sheetMode === 'closed'"
        class="reopen"
        type="button"
        aria-label="reopen sheet"
        @click="onReopen"
      >
        <ion-icon :icon="locationOutline" class="ic-18" />장소 정보 열기
      </button>

      <section
        v-if="selected && sheetMode !== 'closed'"
        class="sheet"
        :class="{ dragging: isDragging }"
        :style="{ height: sheetHeightPx + 'px' }"
      >
        <div
          class="handle-area"
          data-testid="sheet-handle"
          @pointerdown="onHandlePointerDown"
        >
          <div class="handle" />
          <button
            class="close-btn"
            type="button"
            aria-label="닫기"
            @pointerdown.stop
            @click.stop="onClose"
          >
            <ion-icon :icon="close" class="ic-18" />
          </button>
        </div>

        <div class="sheet-body no-scrollbar">
          <div class="title-row">
            <div>
              <FrChip variant="soft">{{ workBadge }}</FrChip>
              <div class="t1">{{ selected.name }}</div>
              <div class="t2">
                {{ selected.regionLabel }}<span v-if="distanceLabel"> · {{ distanceLabel }}</span>
              </div>
            </div>
          </div>

          <div class="sheet-preview">
            <div class="sheet-thumb">
              <img
                v-if="selected.coverImageUrls.length > 0"
                :src="selected.coverImageUrls[0]"
                :alt="selected.name"
              />
            </div>
            <div class="sheet-meta">
              <div class="stat-row">
                <span class="s">
                  <ion-icon :icon="cameraOutline" class="ic-16" />{{ formatCount(selected.photoCount) }}
                </span>
                <span class="s">
                  <ion-icon :icon="heartOutline" class="ic-16" />{{ formatCount(selected.likeCount) }}
                </span>
                <span class="s star">
                  <ion-icon :icon="star" class="ic-16" />{{ selected.rating.toFixed(1) }}
                </span>
              </div>
              <div v-if="workBadge" class="preview-sub">
                이 곳에서 {{ workBadge }} 촬영
              </div>
            </div>
          </div>

          <div class="cta-row">
            <button
              class="save-inline"
              :class="{ on: isSaved(selected.id) }"
              type="button"
              aria-label="save"
              @click="onToggleSave"
            >
              <ion-icon
                :icon="isSaved(selected.id) ? bookmark : bookmarkOutline"
                class="ic-20"
              />
            </button>
            <button class="go-btn" type="button" @click="onOpenDetail">
              인증하러 가기 <ion-icon :icon="arrowForward" class="ic-16" />
            </button>
          </div>

          <!-- 카카오 정보 — sheet 가 FULL 로 펼쳐질 때 노출. 백엔드
               /api/places/:id/kakao-info 가 available=true 일 때만 그린다.
               PlaceDetailPage 의 .kakao-section 과 동일 contract: 영업시간/리뷰는
               공식 카카오 Local API 에 없어서 "카카오맵에서 확인" CTA 로 대체. -->
          <section
            v-if="kakaoInfo?.available"
            class="kakao-section"
            data-testid="map-kakao-section"
          >
            <div class="kakao-head">
              <span class="kakao-badge">
                <span class="k">K</span>카카오맵
              </span>
              <span v-if="kakaoInfo.lastSyncedAt" class="sync">
                <ion-icon :icon="refreshOutline" class="ic-16" />{{ syncLabel }}
              </span>
            </div>

            <div v-if="kakaoInfo.kakaoPlaceUrl" class="k-hours">
              <span class="open-chip">
                <span class="dot-open" />카카오맵 정보
              </span>
              <span class="time">영업시간 / 리뷰는 카카오맵에서 확인</span>
            </div>

            <div
              v-if="kakaoInfo.roadAddress || kakaoInfo.jibunAddress"
              class="k-info-row"
            >
              <ion-icon :icon="locationOutline" class="ic-20 ico" />
              <div class="txt">
                {{ kakaoInfo.roadAddress ?? kakaoInfo.jibunAddress }}
                <div
                  v-if="kakaoInfo.jibunAddress && kakaoInfo.roadAddress"
                  class="sub"
                >
                  지번 · {{ kakaoInfo.jibunAddress }}
                </div>
              </div>
              <button type="button" class="act" @click="onCopyAddress">복사</button>
            </div>
            <div v-if="kakaoInfo.phone" class="k-info-row">
              <ion-icon :icon="callOutline" class="ic-20 ico" />
              <div class="txt">
                {{ kakaoInfo.phone }}
                <div v-if="kakaoInfo.category" class="sub">
                  {{ kakaoInfo.category }}
                </div>
              </div>
              <a :href="`tel:${kakaoInfo.phone}`" class="act">전화</a>
            </div>
            <div v-if="kakaoInfo.kakaoPlaceUrl" class="k-info-row">
              <ion-icon :icon="globeOutline" class="ic-20 ico" />
              <div class="txt">
                카카오맵에서 보기
                <div class="sub">영업시간 · 리뷰 · 메뉴</div>
              </div>
              <a
                :href="kakaoInfo.kakaoPlaceUrl"
                target="_blank"
                rel="noopener"
                class="act"
              >열기</a>
            </div>

            <div class="k-actions">
              <button type="button" class="k-act-btn" @click="onRoute">
                <ion-icon :icon="navigateOutline" class="ic-22" />길찾기
              </button>
              <button
                type="button"
                class="k-act-btn"
                :class="{ on: isSaved(selected.id) }"
                @click="onToggleSave"
              >
                <ion-icon
                  :icon="isSaved(selected.id) ? bookmark : bookmarkOutline"
                  class="ic-22"
                />{{ isSaved(selected.id) ? '저장됨' : '저장' }}
              </button>
              <button type="button" class="k-act-btn" @click="onShare">
                <ion-icon :icon="shareSocialOutline" class="ic-22" />공유
              </button>
              <a
                :href="kakaoInfo.kakaoPlaceUrl ?? '#'"
                target="_blank"
                rel="noopener"
                class="k-act-btn"
              >
                <ion-icon :icon="openOutline" class="ic-22" />카카오맵
              </a>
            </div>

            <div v-if="kakaoInfo.nearby.length > 0" class="k-nearby">
              <h4>주변 맛집 · 카페</h4>
              <div class="k-nearby-row no-scrollbar">
                <a
                  v-for="(n, i) in kakaoInfo.nearby"
                  :key="i"
                  :href="n.kakaoPlaceUrl"
                  target="_blank"
                  rel="noopener"
                  class="k-nearby-card"
                >
                  <div class="th th-icon">
                    <ion-icon
                      :icon="n.categoryGroupCode === 'CE7' ? cafeOutline : restaurantOutline"
                      class="ic-22"
                    />
                  </div>
                  <div class="nm">{{ n.name }}</div>
                  <div class="d">{{ formatNearby(n) }}</div>
                </a>
              </div>
            </div>

            <div class="kakao-footer">카카오맵 정보 제공 · 실시간 동기화</div>
          </section>
        </div>
      </section>
    </ion-content>
    <FrTabBar :model-value="'map'" />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import {
  searchOutline,
  optionsOutline,
  checkmark,
  cameraOutline,
  heartOutline,
  bookmark,
  bookmarkOutline,
  star,
  arrowForward,
  locationOutline,
  filmOutline,
  close,
  callOutline,
  globeOutline,
  navigateOutline,
  shareSocialOutline,
  refreshOutline,
  openOutline,
  cafeOutline,
  restaurantOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import {
  useMapStore,
  type MapMarker,
  type MapFilter,
  KOREA_CENTER,
  COUNTRY_ZOOM,
  DETAIL_ZOOM,
} from '@/stores/map';
import { useSavedStore } from '@/stores/saved';
import { useUiStore } from '@/stores/ui';
import {
  useKakaoInfoStore,
  type KakaoNearbyDto,
} from '@/stores/kakaoInfo';
import FrChip from '@/components/ui/FrChip.vue';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import KakaoMap from '@/components/map/KakaoMap.vue';
import { useToast } from '@/composables/useToast';
import { useDraggableSheet } from '@/composables/useDraggableSheet';
import { formatRelativeTime } from '@/utils/formatRelativeTime';

const mapStore = useMapStore();
const { selected, error, filter, center, zoom, workId, sheetMode } = storeToRefs(mapStore);
const { showError, showInfo } = useToast();
const route = useRoute();
const router = useRouter();
const visibleMarkers = computed<MapMarker[]>(() => mapStore.visibleMarkers);
const visitedIds = computed<number[]>(() => mapStore.visitedIds);
const savedStore = useSavedStore();
const uiStore = useUiStore();
const kakaoInfoStore = useKakaoInfoStore();
const isSaved = (id: number): boolean => savedStore.isSaved(id);

// 현재 선택된 marker(=place) 의 카카오 정보. selected 가 바뀌면 watch 가
// fetch 를 트리거하고, 응답이 오면 store 에 캐시되어 이 computed 가 갱신된다.
// available=false 또는 아직 fetch 전이면 null → 섹션 자체가 v-if 로 숨겨짐.
const kakaoInfo = computed(() => {
  const id = selected.value?.id;
  return id == null ? null : kakaoInfoStore.infoFor(id);
});

const syncLabel = computed(() => {
  const at = kakaoInfo.value?.lastSyncedAt;
  if (!at) return '';
  const rel = formatRelativeTime(at);
  if (!rel) return '';
  if (rel === '방금 전') return '방금 동기화';
  if (rel === '어제') return '어제 동기화';
  return `${rel} 동기화`;
});

// 카카오 카테고리는 "한식 > 해물,생선" 식으로 깊이 표기 — 카드에서는 첫 토큰만
// 짧게 노출해서 정보 밀도를 낮춘다. 빈 문자열이면 "주변" 으로 폴백.
function shortCategoryLabel(categoryName: string): string {
  const head = categoryName.split('>')[0]?.trim();
  return head && head.length > 0 ? head : '주변';
}

// 도보 환산은 80m/min 기준 (네이버지도/카카오맵 표기와 동일). 0 분이 떨어지는
// 매우 가까운 케이스는 "0 분" 이 어색하니 1 분으로 round-up.
function formatNearby(n: KakaoNearbyDto): string {
  const minutes = Math.max(1, Math.round(n.distanceMeters / 80));
  return `${shortCategoryLabel(n.categoryName)} · 도보 ${minutes}분`;
}

// Draggable sheet — the composable owns the live drag height + pointer
// handlers; snap endpoints push the resulting mode back into the store so
// everyone reads the same source of truth.
const { displayHeight, isDragging, onPointerDown } = useDraggableSheet({
  mode: sheetMode,
  onModeChange: (next) => mapStore.setSheetMode(next),
});

const sheetHeightPx = computed(() => displayHeight.value);

function onHandlePointerDown(ev: PointerEvent): void {
  onPointerDown(ev);
}

function onClose(): void {
  mapStore.setSheetMode('closed');
}

function onReopen(): void {
  mapStore.setSheetMode('peek');
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

// Debounced viewport fetch — Kakao fires bounds_changed on every pan frame,
// so we wait ~350ms of quiet before hitting the server.
interface Bounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}
let boundsFetchTimer: ReturnType<typeof setTimeout> | null = null;
let lastBounds: Bounds | null = null;
const BOUNDS_DEBOUNCE_MS = 350;

// After a country-view fetch, Kakao emits a flurry of bounds_changed events
// while the map settles (center set, tile load, initial render). Those emits
// report the literal 390×viewport bbox — e.g. Seoul-only at KOREA_CENTER +
// zoom 13 — which, if fetched, would overwrite the country-wide marker set
// with a narrow one. Hold off on the debounced fetch for a window long
// enough to cover the settle, then resume so real user pans still work.
const COUNTRY_BOUNDS_SUPPRESS_MS = 1200;
let suppressBoundsUntil = 0;

function suppressBoundsFetchForCountryView(): void {
  suppressBoundsUntil = Date.now() + COUNTRY_BOUNDS_SUPPRESS_MS;
}

function onBoundsChange(b: Bounds): void {
  lastBounds = b;
  if (Date.now() < suppressBoundsUntil) {
    // Still in the country-view settle window; don't re-arm the debounce.
    return;
  }
  if (boundsFetchTimer) clearTimeout(boundsFetchTimer);
  boundsFetchTimer = setTimeout(() => {
    boundsFetchTimer = null;
    if (!lastBounds) return;
    void mapStore.fetchMap({
      swLat: lastBounds.sw.lat,
      swLng: lastBounds.sw.lng,
      neLat: lastBounds.ne.lat,
      neLng: lastBounds.ne.lng,
    });
  }, BOUNDS_DEBOUNCE_MS);
}

// Keep the store's zoom in sync with whatever the user does on the map
// directly (pinch, wheel, double-tap). The guard against equal values breaks
// the setLevel → zoom_changed → setZoom → setLevel loop.
function onKakaoZoomChange(level: number): void {
  if (level === zoom.value) return;
  mapStore.setZoom(level);
}

function onClusterClick(payload: {
  latitude: number;
  longitude: number;
  markerIds: number[];
}): void {
  // Zoom the user into the cluster. Kakao levels: smaller = closer, so we
  // step down by 2 (bounded) and recenter on the cluster's centroid. The
  // subsequent bounds_changed event will refetch.
  const nextLevel = Math.max(1, zoom.value - 2);
  mapStore.setZoom(nextLevel);
  void mapStore.setCenter(payload.latitude, payload.longitude);
}

// The map's search pill delegates to the global /search page — Map's own
// `q` store field stays for in-map filter hooks (filter chips etc.) but
// isn't typed into directly anymore.
async function onSearch(): Promise<void> {
  await router.push('/search');
}

async function onToggleSave(): Promise<void> {
  if (!selected.value) return;
  const pid = selected.value.id;
  if (savedStore.isSaved(pid)) {
    await savedStore.toggleSave(pid);
    if (savedStore.error) await showError(savedStore.error);
    return;
  }
  uiStore.openCollectionPicker(pid);
}

async function onOpenDetail(): Promise<void> {
  if (!selected.value) return;
  await router.push(`/place/${selected.value.id}`);
}

// roadAddress 우선, 없으면 jibun. clipboard 가 막힌 환경(HTTP 페이지 / 권한
// 거부) 은 catch 로 떨어져 사용자에게 안내. PlaceDetailPage 와 동일 동작.
async function onCopyAddress(): Promise<void> {
  const k = kakaoInfo.value;
  if (!k) return;
  const addr = k.roadAddress ?? k.jibunAddress ?? '';
  if (!addr) return;
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      throw new Error('clipboard unavailable');
    }
    await navigator.clipboard.writeText(addr);
    await showInfo('주소를 복사했어요');
  } catch {
    await showError('주소 복사에 실패했어요');
  }
}

// 카카오맵 길찾기 딥링크 — 모바일에서 카카오맵 앱이 깔려있으면 앱이 catch,
// 없으면 모바일 웹/데스크톱 카카오맵으로 폴백. 좌표를 함께 보내야 동명 장소가
// 임의로 매칭되지 않고 정확한 핀이 찍힌다.
async function onRoute(): Promise<void> {
  const s = selected.value;
  if (!s) return;
  const name = encodeURIComponent(s.name);
  const url = `https://map.kakao.com/link/to/${name},${s.latitude},${s.longitude}`;
  window.open(url, '_blank', 'noopener');
}

async function onShare(): Promise<void> {
  const s = selected.value;
  if (!s) return;
  const url = `${window.location.origin}/place/${s.id}`;
  try {
    if (navigator.share) await navigator.share({ title: s.name, url });
    else {
      await navigator.clipboard?.writeText(url);
      await showInfo('링크를 복사했어요');
    }
  } catch {
    /* user cancelled */
  }
}


function pickQueryNumber(v: unknown): number | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// When the user picks a new marker, force the sheet back to a useful height
// in case they had previously closed it — otherwise the selection is silent.
// Also kick off the kakao-info fetch for the newly selected place so the
// bottom section hydrates with that place's data instead of staying empty
// (or, before the fix, instead of staying on the previous mock fixture).
watch(selected, (next, prev) => {
  if (next && next.id !== prev?.id) {
    if (sheetMode.value === 'closed') {
      mapStore.setSheetMode('peek');
    }
    void kakaoInfoStore.fetch(next.id);
  }
});

onMounted(async () => {
  const qLat = pickQueryNumber(route.query.lat);
  const qLng = pickQueryNumber(route.query.lng);
  const qSelected = pickQueryNumber(route.query.selectedId);

  // Deep-link from PlaceDetail ("지도 보기") — force the detail view centered
  // on the requested coordinates regardless of session state. Reset the sheet
  // to peek since the user arrived on this tab via a fresh place context.
  if (qLat !== null && qLng !== null) {
    mapStore.setZoom(DETAIL_ZOOM);
    mapStore.setSheetMode('peek');
    await mapStore.setCenter(qLat, qLng);
  } else if (!mapStore.hasBeenViewed && mapStore.selected === null) {
    // First entry this session: country-wide view so the user sees all regions.
    // Center/zoom may already be the defaults, but explicit re-set protects
    // against leftover state from an earlier resetToCountryView() toggle.
    // The sheet stays hidden (selected stays null, sheetMode closed) until
    // the user picks a marker or lands here via a place-aware deep-link.
    mapStore.center = { ...KOREA_CENTER };
    mapStore.setZoom(COUNTRY_ZOOM);
    mapStore.setSheetMode('closed');
    // Ignore the post-mount bounds_changed flurry so the country marker set
    // isn't immediately overwritten by a viewport-scoped refetch.
    suppressBoundsFetchForCountryView();
    await mapStore.fetchMap({ countryView: true });
  } else {
    // Re-entry: keep whatever center/zoom the store already holds (restored
    // via markLastViewed() from PlaceDetailPage, or a previous selectMarker).
    await mapStore.fetchMap();
  }

  if (qSelected !== null) await mapStore.selectMarker(qSelected);
  if (error.value) await showError(error.value);
});
</script>

<style scoped>
ion-content.map-content {
  --background: #ffffff;
}

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
  border: none;
  border-radius: 16px;
  display: flex; align-items: center;
  padding: 0 16px; gap: 10px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04);
  font-size: 14px;
  color: var(--fr-ink);
  text-align: left;
  cursor: pointer;
}
.search-ic { color: var(--fr-ink-4); }
.search-placeholder {
  flex: 1;
  color: var(--fr-ink-3);
  font: inherit;
  letter-spacing: -0.01em;
}
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

.reopen {
  position: absolute;
  left: 50%;
  bottom: calc(100px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 30;
  height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  background: var(--fr-ink);
  color: #ffffff;
  border: none;
  font-weight: 800;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.25);
  cursor: pointer;
}

.sheet {
  position: absolute;
  left: 0; right: 0;
  bottom: calc(84px + env(safe-area-inset-bottom));
  z-index: 25;
  background: #ffffff;
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -10px 40px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: height 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sheet.dragging { transition: none; }

.handle-area {
  position: relative;
  padding: 8px 20px 4px;
  cursor: grab;
  touch-action: none;
  flex-shrink: 0;
}
.handle-area:active { cursor: grabbing; }
.handle {
  width: 44px; height: 5px;
  background: #cbd5e1;
  border-radius: 3px;
  margin: 0 auto;
}
.close-btn {
  position: absolute;
  top: 6px; right: 14px;
  width: 30px; height: 30px;
  border: none;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}

.sheet-body {
  overflow-y: auto;
  padding: 6px 20px 20px;
  flex: 1;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.t1 {
  font-size: 17px; font-weight: 800;
  letter-spacing: -0.02em;
  margin-top: 6px;
}
.t2 {
  font-size: 12px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}

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
.stat-row .s.star ion-icon { color: var(--fr-amber); }
.preview-sub {
  font-size: 11.5px;
  color: var(--fr-ink-3);
}

.cta-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
}
.save-inline {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: var(--fr-bg-muted);
  border: 1.5px solid var(--fr-line);
  color: var(--fr-ink-2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  cursor: pointer;
}
.save-inline.on {
  background: var(--fr-primary-soft);
  border-color: var(--fr-primary);
  color: var(--fr-primary);
}
.go-btn {
  flex: 1;
  height: 42px;
  border-radius: 12px;
  background: var(--fr-primary);
  color: #ffffff;
  font-weight: 700;
  font-size: 13px;
  border: none;
  display: flex; align-items: center; justify-content: center;
  gap: 6px;
  padding: 0 14px;
  cursor: pointer;
}

/* ---------- Kakao info (full mode) ---------- */
.kakao-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--fr-line);
}
.kakao-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.kakao-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: #fee500;
  color: #3c1e1e;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.kakao-badge .k {
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #3c1e1e;
  color: #fee500;
  display: flex; align-items: center; justify-content: center;
  font-weight: 900;
  font-size: 10px;
}
.kakao-head .sync {
  margin-left: auto;
  font-size: 11px;
  color: var(--fr-ink-4);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.k-hours {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}
.open-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: #dcfce7;
  color: #166534;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 800;
}
.dot-open {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #16a34a;
  display: inline-block;
}
.k-hours .sep { color: var(--fr-ink-4); }
.k-hours .time { color: var(--fr-ink-2); font-weight: 600; }

.k-info-row {
  display: flex;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--fr-line-soft);
  align-items: flex-start;
  font-size: 13px;
}
.k-info-row .ico {
  flex-shrink: 0;
  width: 20px;
  color: var(--fr-ink-3);
  padding-top: 1px;
}
.k-info-row .txt {
  flex: 1;
  color: var(--fr-ink);
  line-height: 1.5;
}
.k-info-row .txt .sub {
  font-size: 11.5px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}
.k-info-row .act {
  font-size: 11.5px;
  color: var(--fr-primary);
  font-weight: 700;
  padding: 4px 8px;
  background: var(--fr-primary-soft);
  border-radius: 7px;
  border: none;
  cursor: pointer;
}

.k-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 14px 0 18px;
}
.k-act-btn {
  background: var(--fr-bg-muted);
  border: none;
  border-radius: 12px;
  padding: 10px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--fr-ink);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.k-act-btn ion-icon { color: var(--fr-primary); }
.k-act-btn.on { color: var(--fr-primary); }
.k-act-btn.on ion-icon { color: var(--fr-primary); }

.k-review {
  padding: 14px 0;
  border-top: 1px solid var(--fr-line-soft);
}
.k-review h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 6px;
}
.k-review h4 .cnt {
  font-size: 11px;
  color: var(--fr-ink-4);
  font-weight: 700;
}
.k-review h4 .rating-num {
  font-weight: 800;
  font-size: 13px;
}
.k-stars {
  display: inline-flex;
  gap: 2px;
  color: var(--fr-amber);
}
.k-rev-item {
  display: flex;
  gap: 10px;
  padding: 10px 0;
}
.k-rev-item .av {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--fr-primary-soft);
  color: var(--fr-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}
.k-rev-item .body {
  flex: 1;
  font-size: 12px;
}
.k-rev-item .meta-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 3px;
}
.k-rev-item .nm { font-weight: 700; font-size: 12px; }
.k-rev-item .dt { font-size: 10.5px; color: var(--fr-ink-4); }
.k-rev-item .body p {
  margin: 0;
  color: var(--fr-ink-2);
  line-height: 1.5;
}

.k-nearby {
  padding: 14px 0;
  border-top: 1px solid var(--fr-line-soft);
}
.k-nearby h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 800;
}
.k-nearby-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
}
.k-nearby-card {
  flex-shrink: 0;
  width: 140px;
}
.k-nearby-card .th {
  width: 100%;
  height: 90px;
  border-radius: 10px;
  background: #eef2f6;
  overflow: hidden;
  margin-bottom: 6px;
}
.k-nearby-card .th img {
  width: 100%; height: 100%;
  object-fit: cover;
}
.k-nearby-card .nm {
  font-size: 12px;
  font-weight: 700;
}
.k-nearby-card .d {
  font-size: 11px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}

.kakao-footer {
  padding: 14px 0 0;
  font-size: 10.5px;
  color: var(--fr-ink-4);
  text-align: center;
}
</style>
