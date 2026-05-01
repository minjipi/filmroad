<template>
  <ion-page>
    <ion-content :fullscreen="true" class="map-content">
      <KakaoMap
        :center="center"
        :zoom="zoom"
        :markers="visibleMarkers"
        :selected-id="selected?.id ?? null"
        :selected-crowd-state="selectedCrowdState"
        :visited-ids="visitedIds"
        :user-location="userLocation"
        @marker-click="onSelect"
        @cluster-click="onClusterClick"
        @bounds-change="onBoundsChange"
        @zoom-change="onKakaoZoomChange"
      />

      <div class="top-bar">
        <!-- task #23: ShotDetail 의 sub 클릭 등 컨텍스트 진입 시(query.selectedId
             존재) 만 뒤로가기 버튼 노출. 일반 /map 진입은 미렌더. -->
        <button
          v-if="showBackButton"
          class="back-btn"
          type="button"
          aria-label="뒤로 가기"
          data-testid="map-back-btn"
          @click="onMapBack"
        >
          <ion-icon :icon="chevronBack" class="ic-22" />
        </button>
        <button
          class="search-box"
          type="button"
          aria-label="search"
          @click="onSearch"
        >
          <ion-icon :icon="searchOutline" class="ic-18 search-ic" />
          <span class="search-placeholder">강릉 · 도깨비 촬영지</span>
        </button>
        <button
          class="icon-btn"
          type="button"
          aria-label="필터"
          data-testid="filters-btn"
          @click="filterSheetOpen = true"
        >
          <ion-icon :icon="optionsOutline" class="ic-20" />
          <span
            v-if="activeSheetFilterCount > 0"
            class="filter-badge"
            data-testid="filter-badge"
          >{{ activeSheetFilterCount }}</span>
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

      <!--
        지도 컨트롤 — 카카오/네이버 지도와 같은 우측 세로 스택 FAB. 위에서부터
        + / − / 📍. 시트가 peek/full 로 떠 있으면 시트 위로 가도록
        bottom 을 sheet height + 여유로 잡아 올린다(JS 로 측정해 ${variant}로
        반영하면 너무 무거우니 시트 모드별 정적 단계만 사용).
      -->
      <div :class="['map-controls', `sheet-${sheetMode}`]" data-testid="map-controls">
        <button
          type="button"
          class="ctrl-btn"
          aria-label="확대"
          data-testid="map-zoom-in"
          :disabled="zoom <= 1"
          @click="onZoomIn"
        >
          <ion-icon :icon="add" class="ic-22" />
        </button>
        <button
          type="button"
          class="ctrl-btn"
          aria-label="축소"
          data-testid="map-zoom-out"
          :disabled="zoom >= 14"
          @click="onZoomOut"
        >
          <ion-icon :icon="remove" class="ic-22" />
        </button>
        <button
          type="button"
          :class="['ctrl-btn', 'locate', locating ? 'busy' : '']"
          aria-label="내 위치"
          data-testid="map-locate"
          :disabled="locating"
          @click="onLocateMe"
        >
          <ion-icon :icon="locate" class="ic-22" />
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
          <!-- 1) Primary info — 시트 헤더(작품칩 + 장소명 + 지역) + 썸네일/스탯
               + 인증하러 가기 CTA 까지 한 묶음으로 sheet 의 첫 섹션. 두 row
               (title-row, sheet-thumb) 모두 /place/:id 로 진입하는 클릭 영역
               (큰 타깃). role=button + Enter 키 핸들러로 a11y 보강. -->
          <section class="map-sheet-section primary-section">
            <div
              class="title-row clickable"
              role="button"
              tabindex="0"
              data-testid="map-sheet-title"
              @click="onOpenDetail"
              @keydown.enter="onOpenDetail"
              @keydown.space.prevent="onOpenDetail"
            >
              <div>
                <FrChip variant="soft">{{ workBadge }}</FrChip>
                <div class="t1">{{ selected.name }}</div>
                <div class="t2">
                  {{ selected.regionLabel }}<span v-if="distanceLabel"> · {{ distanceLabel }}</span>
                </div>
              </div>
            </div>

            <div class="sheet-preview">
              <div
                class="sheet-thumb clickable"
                role="button"
                tabindex="0"
                data-testid="map-sheet-thumb"
                :aria-label="`${selected.name} 상세 보기`"
                @click="onOpenDetail"
                @keydown.enter="onOpenDetail"
                @keydown.space.prevent="onOpenDetail"
              >
                <img
                  v-if="selected.sceneImageUrl"
                  :src="selected.sceneImageUrl"
                  :alt="selected.name"
                />
              </div>
              <div class="sheet-meta">
                <div class="stat-row">
                  <button
                    type="button"
                    class="s"
                    data-testid="sheet-photo-stat"
                    aria-label="인증샷 갤러리 보기"
                    @click="onOpenGallery"
                  >
                    <ion-icon :icon="cameraOutline" class="ic-16" />{{ formatCount(selected.photoCount) }}
                  </button>
                  <button
                    type="button"
                    :class="['s', selected.liked ? 'liked' : '']"
                    data-testid="sheet-like-stat"
                    :aria-label="selected.liked ? '좋아요 취소' : '좋아요'"
                    @click="onToggleLike"
                  >
                    <ion-icon :icon="selected.liked ? heart : heartOutline" class="ic-16" />{{ formatCount(selected.likeCount) }}
                  </button>
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
          </section>

          <!-- 2) 혼잡도 예측 — 한국관광공사 TatsCnctrRateService 기반.
               PlaceDetailPage 와 동일한 backend (/api/places/:id/congestion)
               응답 사용하지만 map sheet 라 더 컴팩트하게: 헤더 + 3 chips만.
               PlaceDetailPage 의 풀 섹션 ('언제 가면 좋을까?' + '10일 보기'
               링크 + 추천 hint) 보다 가벼운 변형. -->
          <section
            v-if="congestion?.available && congestion.forecasts.length > 0"
            class="map-sheet-section crowd-section"
            data-testid="map-crowd-section"
          >
            <div class="crowd-head">
              <span class="crowd-title">
                <ion-icon :icon="peopleOutline" class="ic-16" />혼잡도 예측
              </span>
              <span class="crowd-source">{{ congestion.source ?? '한국관광공사' }}</span>
            </div>
            <div class="crowd-chips">
              <div
                v-for="f in congestion.forecasts"
                :key="f.key"
                :class="['crowd-chip', `crowd-tx-${f.state.toLowerCase()}`]"
                :data-testid="`map-crowd-${f.key.toLowerCase()}`"
              >
                <div class="lbl">
                  {{ f.label }}
                  <span class="sub">· {{ f.dateLabel }}</span>
                </div>
                <div class="row">
                  <span class="pct">
                    {{ f.percent }}<span class="pct-unit">%</span>
                  </span>
                  <span class="state">{{ congestionStateLabel(f.state) }}</span>
                </div>
                <div class="meter">
                  <i
                    :class="`crowd-bg-${f.state.toLowerCase()}`"
                    :style="{ width: `${f.percent}%` }"
                  />
                </div>
              </div>
            </div>
          </section>

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

            <!-- task #29: 카카오 nearby → 한국관광공사 TourAPI 기반.
                 PlaceDetailPage 와 동일 store / 카드 마크업 / 빈응답 hide. -->
            <div v-if="tourNearbyItems.length > 0" class="k-nearby" data-testid="map-nearby">
              <h4>주변 맛집</h4>
              <div class="k-nearby-row no-scrollbar">
                <a
                  v-for="n in tourNearbyItems"
                  :key="n.contentId"
                  :href="tourNearbyHref(n)"
                  target="_blank"
                  rel="noopener"
                  class="k-nearby-card"
                  data-testid="map-nearby-card"
                >
                  <div class="th" :class="{ 'th-icon': !n.imageUrl }">
                    <img v-if="n.imageUrl" :src="n.imageUrl" :alt="n.title" />
                    <ion-icon v-else :icon="restaurantOutline" class="ic-22" />
                  </div>
                  <div class="nm">{{ n.title }}</div>
                  <div class="d">{{ formatTourNearby(n) }}</div>
                </a>
              </div>
            </div>

            <div class="kakao-footer">카카오맵 정보 제공 · 실시간 동기화</div>
          </section>
        </div>
      </section>
    </ion-content>
    <FrTabBar :model-value="'map'" />
    <!--
      필터 시트 — top-bar 의 필터 버튼이 트리거. ion-modal 자체를 page-level
      에 두어 ion-content 의 scroll / safe-area 와 안 부딪히게.
    -->
    <MapFilterSheet :open="filterSheetOpen" @close="filterSheetOpen = false" />
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
  chevronBack,
  cameraOutline,
  heart,
  heartOutline,
  bookmark,
  bookmarkOutline,
  star,
  arrowForward,
  locationOutline,
  close,
  callOutline,
  globeOutline,
  navigateOutline,
  shareSocialOutline,
  refreshOutline,
  add,
  remove,
  locate,
  openOutline,
  restaurantOutline,
  peopleOutline,
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
} from '@/stores/kakaoInfo';
// task #29: 카카오 nearby → 한국관광공사 TourAPI 기반 신규 store.
import { useTourNearbyStore, type TourNearbyRestaurant } from '@/stores/tourNearby';
import { useCongestionStore, type CongestionState } from '@/stores/congestion';
import FrChip from '@/components/ui/FrChip.vue';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import MapFilterSheet from '@/components/map/MapFilterSheet.vue';
import KakaoMap from '@/components/map/KakaoMap.vue';
import { useToast } from '@/composables/useToast';
import { useDraggableSheet } from '@/composables/useDraggableSheet';
import {
  requestLocation,
  type LocationFailReason,
} from '@/composables/useGeolocation';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { buildPlaceShareData } from '@/utils/share';

const mapStore = useMapStore();
const { selected, error, filter, center, zoom, contentId, sheetMode, userLocation } =
  storeToRefs(mapStore);
const { showError, showInfo } = useToast();
const route = useRoute();
const router = useRouter();
const visibleMarkers = computed<MapMarker[]>(() => mapStore.visibleMarkers);
const visitedIds = computed<number[]>(() => mapStore.visitedIds);
// 필터 시트 — top-bar 옆 필터 버튼이 토글. 활성 그룹 수가 1+ 면 버튼에
// 작은 카운트 뱃지 표시.
const filterSheetOpen = ref(false);
const activeSheetFilterCount = computed(() => mapStore.activeSheetFilterCount);
const savedStore = useSavedStore();
const uiStore = useUiStore();
const kakaoInfoStore = useKakaoInfoStore();
const tourNearbyStore = useTourNearbyStore();
const congestionStore = useCongestionStore();
const isSaved = (id: number): boolean => savedStore.isSaved(id);

// 현재 선택된 marker(=place) 의 카카오 정보. selected 가 바뀌면 watch 가
// fetch 를 트리거하고, 응답이 오면 store 에 캐시되어 이 computed 가 갱신된다.
// available=false 또는 아직 fetch 전이면 null → 섹션 자체가 v-if 로 숨겨짐.
const kakaoInfo = computed(() => {
  const id = selected.value?.id;
  return id == null ? null : kakaoInfoStore.infoFor(id);
});

// task #29: 한국관광공사 nearby — 선택 marker 의 placeId 가 있을 때만.
const tourNearbyItems = computed<TourNearbyRestaurant[]>(() => {
  const id = selected.value?.id;
  if (id == null) return [];
  return tourNearbyStore.itemsFor(id);
});

// 한국관광공사 혼잡도 예측 — selected 가 바뀌면 watch 가 fetch 트리거,
// 응답 도착 시 store 캐시에서 자동 갱신. available=false 또는 fetch 전이면
// null → 섹션 v-if 로 숨김.
const congestion = computed(() => {
  const id = selected.value?.id;
  return id == null ? null : congestionStore.infoFor(id);
});
function congestionStateLabel(s: CongestionState): string {
  if (s === 'PACK') return '매우혼잡';
  if (s === 'BUSY') return '혼잡';
  return '보통';
}
// 선택된 마커 bubble 색 — 오늘(TODAY) forecast 의 state 를 KakaoMap 으로
// 흘려보낸다. 응답이 아직이면 null → 마커는 기존 다크 네이비 active 톤 유지.
const selectedCrowdState = computed<CongestionState | null>(() => {
  const today = congestion.value?.forecasts.find((f) => f.key === 'TODAY');
  return today?.state ?? null;
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

// task #29: 한국관광공사 TourAPI 기반 카드 라벨 — 카테고리 + 도보 분.
// PlaceDetailPage 와 동일 helper (DRY 위해 별도 utils 분리는 양쪽 1회씩만
// 쓰여 over-engineering — 인라인 유지).
function formatTourNearby(n: TourNearbyRestaurant): string {
  const cat = n.categoryName?.trim() || null;
  if (typeof n.distanceM === 'number') {
    const minutes = Math.max(1, Math.round(n.distanceM / 80));
    return cat ? `${cat} · 도보 ${minutes}분` : `도보 ${minutes}분`;
  }
  return cat ?? '주변 맛집';
}

function tourNearbyHref(n: TourNearbyRestaurant): string {
  const q = n.title.trim();
  if (!q) return 'javascript:void(0)';
  return `https://map.kakao.com/?q=${encodeURIComponent(q)}`;
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
  // chip-row 는 "내 진행상황 / 즐겨찾는 모드" 성격의 1차 단축 필터로 통일.
  // 작품 단축은 새 필터 시트의 작품 그룹(multi-select)이 더 잘 다루므로
  // 하드코딩된 단일 작품(도깨비) chip 은 제거. 방문완료는 발견-지향 chip
  // (성지/저장)과 시각적으로 분리되도록 끝에 위치.
  return [
    {
      key: 'SPOTS',
      label: '성지',
      icon: locationOutline,
      active: f === 'SPOTS' && contentId.value === null,
      onClick: async () => {
        mapStore.setFilter('SPOTS');
        if (contentId.value !== null) await mapStore.setContent(null);
      },
    },
    {
      key: 'SAVED',
      label: '저장한 곳',
      icon: bookmarkOutline,
      active: f === 'SAVED',
      onClick: () => mapStore.setFilter('SAVED' as MapFilter),
    },
    {
      key: 'VISITED',
      label: '방문완료',
      icon: checkmark,
      active: f === 'VISITED',
      onClick: () => mapStore.setFilter('VISITED' as MapFilter),
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
  const ep = s.contentEpisode ? ` · ${s.contentEpisode}` : '';
  return `${s.contentTitle}${ep}`;
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

// 우측 컨트롤 핸들러 — Kakao 의 level 은 작을수록 확대. setZoom 안에서
// 이미 1..14 로 클램프하므로 여기선 단순 ±1 만. setZoom 은 동기 — store 의
// reactive zoom 이 KakaoMap 의 watch 를 트리거해 실제 줌이 일어난다.
function onZoomIn(): void {
  mapStore.setZoom(zoom.value - 1);
}

function onZoomOut(): void {
  mapStore.setZoom(zoom.value + 1);
}

// 내 위치 — one-shot 리센터. requestLocation() 은 권한 거부 / 타임아웃 /
// 사용 불가를 reason 으로 구분해 돌려주므로 그에 맞춰 한국어 안내 토스트만
// 띄운다. 성공하면 setCenter() 가 fetchMap 까지 같이 호출하므로 marker 도
// 새 viewport 기준으로 갱신된다.
const locating = ref(false);

function locationFailMessage(reason: LocationFailReason): string {
  switch (reason) {
    case 'denied':
      return '위치 권한이 차단되어 있어요. 주소창 자물쇠 → 권한 설정에서 허용해 주세요';
    case 'timeout':
      return '위치 확인이 지연됐어요. 잠시 후 다시 시도해 주세요';
    case 'unavailable':
    default:
      return 'GPS 또는 네트워크를 사용할 수 없어요';
  }
}

async function onLocateMe(): Promise<void> {
  if (locating.value) return;
  locating.value = true;
  try {
    const result = await requestLocation();
    if (!result.ok) {
      await showError(locationFailMessage(result.reason));
      return;
    }
    // viewport 와 me 점을 동시에 갱신. setUserLocation 은 center 와 분리된
    // 채널이라 이후 마커 선택/검색으로 viewport 가 옮겨져도 me 점은 여기서 잡은
    // 좌표에 그대로 머문다.
    mapStore.setUserLocation({ lat: result.coords.lat, lng: result.coords.lng });
    mapStore.setZoom(DETAIL_ZOOM);
    await mapStore.setCenter(result.coords.lat, result.coords.lng);
  } finally {
    locating.value = false;
  }
}

// 마운트 시 한 번 GPS 를 prompt-less / 거부 friendly 하게 시도해 store 에
// 저장. 성공 → me 점 표시. 거부/타임아웃/사용 불가 → null 유지 → 점 미표시.
// 토스트는 띄우지 않는다(사용자가 명시적으로 누른 onLocateMe 와 달리,
// 마운트 시 자동 시도이므로 실패 메시지는 시끄럽다). jsdom 등 navigator.
// geolocation 부재 환경은 requestLocation() 내부 가드가 unavailable 로 처리.
async function primeUserLocation(): Promise<void> {
  try {
    const result = await requestLocation();
    if (result.ok) {
      mapStore.setUserLocation({ lat: result.coords.lat, lng: result.coords.lng });
    }
  } catch {
    // 어떤 이유로든 실패하면 me 점 없이 진행 — 마운트 흐름 자체는 막지 않는다.
  }
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

// task #23: ShotDetail 의 sub(place) 클릭으로 진입한 경우만 search-box 좌측에
// 뒤로가기 버튼 노출. 일반 /map 진입(query 없이)은 미렌더 — 사용자 의도
// 컨텍스트 와 일치. URL 의 selectedId 존재 여부가 가장 단순한 진입-경로 신호.
const showBackButton = computed<boolean>(() => route.query.selectedId != null);

function onMapBack(): void {
  // history 가 있으면 router.back() — 직전의 ShotDetail 페이지로 자연스러운
  // 복귀. 없으면 fallback 으로 /home (직접 URL / 새 탭 등 엣지). 실제로
  // selectedId 가 query 에 있을 땐 거의 항상 history 가 존재하지만 안전망.
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
  } else {
    void router.replace('/home');
  }
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

async function onOpenGallery(): Promise<void> {
  if (!selected.value) return;
  await router.push(`/feed/detail?placeId=${selected.value.id}`);
}

async function onToggleLike(): Promise<void> {
  if (!selected.value) return;
  await mapStore.toggleLike(selected.value.id);
  if (mapStore.error) await showError(mapStore.error);
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

function onShare(): void {
  const s = selected.value;
  if (!s) return;
  uiStore.openShareSheet(buildPlaceShareData(s));
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
    // task #29: 한국관광공사 nearby 도 같이 로드 — 보조 정보 병렬 fetch.
    void tourNearbyStore.fetch(next.id);
    // 혼잡도 예측 — 선택한 place 의 오늘/내일/주말 카드를 받아온다. 매핑
    // 실패 / 외부 API 실패 시 store 가 null 박고 섹션 자체가 v-if 로 숨겨짐.
    void congestionStore.fetch(next.id);
  }
});

// task #25: 같은 MapPage 가 이미 마운트된 상태에서 query 만 바뀌는 케이스
// (예: ShotDetail #A 의 sub → /map?selectedId=10, 그 후 ShotDetail #B 의 sub
// → /map?selectedId=20) 에 대응. 첫 mount 의 onMounted 가 처리하지 못하는
// 후속 변경을 catch-up 한다. Deep-link 좌표 또는 selected marker 만 다시
// 적용 — country-view / hasBeenViewed 같은 first-entry 분기는 대상 아님.
async function applyQueryEntry(): Promise<void> {
  const qLat = pickQueryNumber(route.query.lat);
  const qLng = pickQueryNumber(route.query.lng);
  const qSelected = pickQueryNumber(route.query.selectedId);
  if (qLat !== null && qLng !== null) {
    mapStore.setZoom(DETAIL_ZOOM);
    mapStore.setSheetMode('peek');
    await mapStore.setCenter(qLat, qLng);
  }
  if (qSelected !== null) await mapStore.selectMarker(qSelected);
}

watch(
  () => [route.query.selectedId, route.query.lat, route.query.lng, route.query.collectionId],
  (next, prev) => {
    // Initial value of `watch` doesn't fire by default; this watcher only runs
    // on actual changes — onMounted seeds the first state. Skip when both
    // arrays are deep-equal (Vue's array compare uses reference, so the
    // watcher fires whenever the route object updates even without value
    // change → guard with explicit string compare).
    if (JSON.stringify(next) === JSON.stringify(prev)) return;
    void applyQueryEntry();
  },
);

onMounted(async () => {
  // 마커 / viewport 와 무관한 GPS prime — 결과는 store.userLocation 으로
  // 흘러 KakaoMap 의 me 점에만 반영. await 하지 않아 마운트 흐름과 병렬로
  // 수행 (권한 프롬프트가 떠도 지도 fetch 는 그대로 진행).
  void primeUserLocation();

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
/* task #23: shot → map 진입 컨텍스트 전용 뒤로가기 버튼. search-box 와
   동일한 그림자/높이로 시각 무게 일관, 정사각 형태로 search-box 옆에 부착. */
.back-btn {
  width: 48px;
  height: 48px;
  background: #ffffff;
  border: none;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-ink);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  flex-shrink: 0;
}
.back-btn:active { transform: translateY(1px); }

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
  position: relative;
}
/* 활성 시트 필터 그룹 수 뱃지 — 인스타 "필터 N개" 패턴. 0 이면 노출 안 함. */
.filter-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--fr-coral);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: -0.02em;
  border: 1.5px solid #ffffff;
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

/* 지도 컨트롤 — 카카오/네이버 지도 패턴: 우측 세로 스택 FAB.
   bottom 은 tab bar(84px) 위 + safe-area + 시트 모드별 추가 오프셋.
   peek 시 시트 위로 잠시 올라가고, full 시는 시트가 화면을 거의 덮으니
   접근성을 위해 화면 상단쪽으로 빠져 있는다(top 으로 anchor 변경).
   sheetMode 클래스로 분기하면 transition 도 자연스럽게 따라옴. */
.map-controls {
  position: absolute;
  right: 12px;
  bottom: calc(100px + env(safe-area-inset-bottom));
  z-index: 22;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: bottom 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}
/* 시트 peek(약 220px) 위로 올림 — 시트 높이는 useDraggableSheet 가 결정하지만
   실측 의존하면 transition 이 거칠어져 정적 단계만 둠. closed 는 peek 보다 낮게. */
.map-controls.sheet-peek {
  bottom: calc(330px + env(safe-area-inset-bottom));
}
/* full 시는 화면 거의 전체가 시트라 컨트롤을 상단으로 옮김 — chip-row 아래. */
.map-controls.sheet-full {
  top: calc(132px + env(safe-area-inset-top));
  bottom: auto;
}
.ctrl-btn {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: none;
  background: #ffffff;
  color: var(--fr-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: transform 0.1s;
}
.ctrl-btn:active { transform: scale(0.94); }
.ctrl-btn:disabled { opacity: 0.4; cursor: default; }
.ctrl-btn:disabled:active { transform: none; }
.ctrl-btn.locate { color: var(--fr-primary); }
.ctrl-btn.locate.busy { animation: locate-pulse 0.9s ease-in-out infinite; }
@keyframes locate-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

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
/* title-row + sheet-thumb 모두 /place/:id 진입 트리거. cursor + focus ring 으로
   클릭 가능 신호. */
.title-row.clickable,
.sheet-thumb.clickable { cursor: pointer; }
.title-row.clickable:focus-visible,
.sheet-thumb.clickable:focus-visible {
  outline: 2px solid var(--fr-primary);
  outline-offset: 2px;
  border-radius: 6px;
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
/* photoCount / liked 셀은 button 으로 바뀌어 클릭 가능. 시각적으로는 기존
   span 과 동일해야 해서 background/border 를 모두 0 으로 두고 span.s 와
   같은 inline-flex 배치만 유지. */
.stat-row .s {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: transparent;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.stat-row button.s:focus-visible { outline: 2px solid var(--fr-primary); outline-offset: 2px; border-radius: 4px; }
.stat-row .s.liked { color: var(--fr-primary); }
.stat-row .s.liked ion-icon { color: var(--fr-primary); }
.stat-row .s.star { cursor: default; }
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

/* ---------- 혼잡도 예측 (한국관광공사 TatsCnctrRateService) ----------
   sheet 안의 보조 섹션. PlaceDetailPage 의 풀 섹션 ('언제 가면 좋을까?') 보다
   컴팩트한 변형 — 헤더 + 3 chips. kakao-section 과 동일 톤의 border-top
   분리자로 시각적 구분. */
.crowd-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--fr-line);
}
.crowd-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}
.crowd-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--fr-ink);
}
.crowd-title .ic-16 {
  color: var(--fr-ink-3);
}
.crowd-source {
  font-size: 10.5px;
  color: var(--fr-ink-4);
}
.crowd-chips {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.crowd-chip {
  border: 1px solid var(--fr-line);
  border-radius: 12px;
  padding: 10px 11px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.crowd-chip .lbl {
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
  display: flex;
  align-items: baseline;
  gap: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.crowd-chip .lbl .sub {
  font-size: 10px;
  font-weight: 600;
  color: var(--fr-ink-4);
  opacity: 0.85;
}
.crowd-chip .row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  margin-top: 2px;
}
.crowd-chip .pct {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
}
.crowd-chip .pct-unit {
  font-size: 10px;
  font-weight: 700;
  margin-left: 1px;
  opacity: 0.7;
}
.crowd-chip .state {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.crowd-chip .meter {
  margin-top: 4px;
  height: 4px;
  border-radius: 999px;
  background: var(--fr-bg-muted);
  overflow: hidden;
}
.crowd-chip .meter > i {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}
.crowd-tx-ok .pct,
.crowd-tx-ok .state {
  color: #16a34a;
}
.crowd-tx-busy .pct,
.crowd-tx-busy .state {
  color: #f59e0b;
}
.crowd-tx-pack .pct,
.crowd-tx-pack .state {
  color: #ef4444;
}
.crowd-bg-ok {
  background: linear-gradient(90deg, #4ade80, #16a34a);
}
.crowd-bg-busy {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
}
.crowd-bg-pack {
  background: linear-gradient(90deg, #f87171, #ef4444);
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
