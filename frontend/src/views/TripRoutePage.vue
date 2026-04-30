<template>
  <ion-page>
    <ion-content :fullscreen="true" class="tr-content">
      <div class="tr-stage" data-testid="trip-route-stage">
        <RouteMapLayer
          :places="orderedPlaces"
          :active-id="activeId"
          :zoom="zoom"
          :center="viewportCenter"
          :user-location="userLocation"
          :route-path="routePath"
          :route-sections="routeSections"
          @marker-click="onMarkerClick"
        />

        <header class="tr-topbar">
          <button
            type="button"
            class="tr-icon-btn"
            aria-label="뒤로"
            data-testid="tr-back"
            @click="onBack"
          >
            <ion-icon :icon="chevronBack" class="ic-22" />
          </button>
          <button
            type="button"
            class="tr-search-btn"
            data-testid="tr-search-trigger"
            @click="onOpenSearch"
          >
            <ion-icon :icon="searchOutline" class="ic-18 tr-search-ic" />
            <span class="tr-search-placeholder">장소 추가하기</span>
            <FrChip v-if="seedContentTitle" variant="primary">
              {{ seedContentTitle }}
            </FrChip>
          </button>
        </header>

        <!-- 우측 세로 스택 컨트롤 — MapPage 와 동일한 패턴(±/내위치). 시트가 시각적으로
             하단 fixed 라 sheet-mode 분기는 필요 없다. -->
        <div class="map-controls" data-testid="tr-map-controls">
          <button
            type="button"
            class="ctrl-btn"
            aria-label="확대"
            data-testid="tr-zoom-in"
            :disabled="zoom <= 1"
            @click="onZoomIn"
          >
            <ion-icon :icon="add" class="ic-22" />
          </button>
          <button
            type="button"
            class="ctrl-btn"
            aria-label="축소"
            data-testid="tr-zoom-out"
            :disabled="zoom >= 14"
            @click="onZoomOut"
          >
            <ion-icon :icon="remove" class="ic-22" />
          </button>
          <button
            type="button"
            :class="['ctrl-btn', 'locate', locating ? 'busy' : '']"
            aria-label="내 위치"
            data-testid="tr-locate"
            :disabled="locating"
            @click="onLocateMe"
          >
            <ion-icon :icon="locate" class="ic-22" />
          </button>
        </div>

        <RouteTimelineSheet
          :places="orderedPlaces"
          :active-id="activeId"
          :name="name"
          :start-time="startTime"
          @activate="onActivate"
          @open-detail="onOpenDetail"
          @add-place="onOpenSearch"
          @edit-route="editorOpen = true"
          @share="shareOpen = true"
        />

        <SearchPlaceModal
          :open="searchOpen"
          @close="searchOpen = false"
          @select="onSelectFromSearch"
        />

        <RouteEditorModal
          :open="editorOpen"
          :places="orderedPlaces"
          :start-time="startTime"
          @close="editorOpen = false"
          @reorder="onReorder"
          @remove="onRemove"
          @change-start-time="(v) => tripRouteStore.setStartTime(v)"
        />

        <RoutePlaceDetailModal
          :open="detailOpen"
          :place="detailPlace"
          :note="detailNote"
          @close="onCloseDetail"
          @save-note="(p) => tripRouteStore.updateNote(p.placeId, p.note)"
        />

        <RouteShareSheet
          :open="shareOpen"
          :name="name"
          :place-count="orderedPlaces.length"
          @close="shareOpen = false"
          @save="onSaveTrip"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IonPage, IonContent, IonIcon, onIonViewDidEnter } from '@ionic/vue';
import {
  add,
  chevronBack,
  locate,
  remove,
  searchOutline,
} from 'ionicons/icons';
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import FrChip from '@/components/ui/FrChip.vue';
import RouteMapLayer from '@/components/route/RouteMapLayer.vue';
import RouteTimelineSheet from '@/components/route/RouteTimelineSheet.vue';
import SearchPlaceModal from '@/components/route/SearchPlaceModal.vue';
import RouteEditorModal from '@/components/route/RouteEditorModal.vue';
import RoutePlaceDetailModal from '@/components/route/RoutePlaceDetailModal.vue';
import RouteShareSheet from '@/components/route/RouteShareSheet.vue';
import { useTripRouteStore, type TripPlace } from '@/stores/tripRoute';
import { useToast } from '@/composables/useToast';
import {
  requestLocation,
  type LocationFailReason,
} from '@/composables/useGeolocation';
import { DETAIL_ZOOM } from '@/stores/map';

defineProps<{ collectionId?: string }>();

const router = useRouter();
const route = useRoute();
const tripRouteStore = useTripRouteStore();
const { activeId, name, startTime, notes, seedContentTitle, routePath, routeSections } = storeToRefs(tripRouteStore);
const { showInfo, showError } = useToast();

const orderedPlaces = computed<TripPlace[]>(() => tripRouteStore.orderedPlaces);

const searchOpen = ref(false);
const editorOpen = ref(false);
const shareOpen = ref(false);
/** 상세 모달은 placeId 자체로 트래킹 — open=Boolean(detailId). place 가 reorder/remove
 *  에 따라 사라지면 자동으로 닫히도록 detailPlace computed 가 null 폴백을 낸다. */
const detailId = ref<number | null>(null);
const detailOpen = computed(() => detailId.value != null && Boolean(detailPlace.value));
const detailPlace = computed<TripPlace | null>(() => {
  const id = detailId.value;
  if (id == null) return null;
  return tripRouteStore.placesById[id] ?? null;
});
const detailNote = computed<string>(() => {
  const id = detailId.value;
  if (id == null) return '';
  return notes.value[id] ?? '';
});

/**
 * task #19 — detailPlace 가 stale(예: reorder/remove 사이드 이펙트) 로 null 이
 * 되면 detailId 도 비워서 modal v-if 가 일관되게 닫히게. 두 상태를 분리해 두면
 * `open && place` 가 한 쪽만 true 인 microframe 이 생겨 patching race 가 난다.
 */
watch(detailPlace, (p) => {
  if (detailId.value != null && p == null) detailId.value = null;
});

function onBack(): void {
  router.back();
}
function onActivate(id: number): void {
  tripRouteStore.setActive(id);
}
function onMarkerClick(id: number): void {
  tripRouteStore.setActive(id);
}
function onOpenDetail(id: number): void {
  detailId.value = id;
}
function onCloseDetail(): void {
  detailId.value = null;
}
function onOpenSearch(): void {
  searchOpen.value = true;
}
async function onSelectFromSearch(place: TripPlace): Promise<void> {
  const wasIn = tripRouteStore.placeIds.includes(place.id);
  tripRouteStore.addPlace(place);
  searchOpen.value = false;
  if (wasIn) {
    await showInfo(`${place.name} 은(는) 이미 코스에 있어요`);
  } else {
    await showInfo(`${place.name} 을(를) 코스에 추가했어요`);
  }
}
function onReorder(payload: { fromIdx: number; toIdx: number }): void {
  tripRouteStore.reorder(payload.fromIdx, payload.toIdx);
}
async function onRemove(id: number): Promise<void> {
  const target = tripRouteStore.placesById[id];
  tripRouteStore.removePlace(id);
  if (target) await showInfo(`${target.name} 을(를) 코스에서 제거했어요`);
}
// ── 우측 컨트롤 — 줌/내위치. mapStore 와 결합하지 않고 페이지 로컬 ref 로
// 들고, RouteMapLayer 에 단방향 prop 으로 흘려보낸다(다른 페이지로 leak X).
// Kakao zoom 은 작을수록 확대. 1..14 클램프는 핸들러에서 직접 처리.
const zoom = ref(7);
const viewportCenter = ref<{ lat: number; lng: number } | null>(null);
const userLocation = ref<{ lat: number; lng: number } | null>(null);
const locating = ref(false);

function onZoomIn(): void {
  zoom.value = Math.max(1, zoom.value - 1);
}
function onZoomOut(): void {
  zoom.value = Math.min(14, zoom.value + 1);
}

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

// 내 위치 — one-shot. 성공 시 userLocation 점 표기 + viewport 를 GPS 좌표로
// 옮기고 zoom 을 detail 단계로. 실패 사유는 동일한 한국어 토스트 3종으로 분기.
async function onLocateMe(): Promise<void> {
  if (locating.value) return;
  locating.value = true;
  try {
    const result = await requestLocation();
    if (!result.ok) {
      await showError(locationFailMessage(result.reason));
      return;
    }
    userLocation.value = { lat: result.coords.lat, lng: result.coords.lng };
    viewportCenter.value = { lat: result.coords.lat, lng: result.coords.lng };
    zoom.value = DETAIL_ZOOM;
  } finally {
    locating.value = false;
  }
}
async function onSaveTrip(): Promise<void> {
  // 신규 저장이든 기존 갱신이든 store 가 분기. 401 등 실패는 axios 인터셉터
  // 가 LoginPromptModal 띄우고, 일반 에러는 토스트로만 안내.
  try {
    const isUpdate = tripRouteStore.currentSavedRouteId != null;
    await tripRouteStore.saveCurrentRoute();
    shareOpen.value = false;
    await showInfo(isUpdate ? '코스를 갱신했어요' : '내 여행에 저장했어요');
  } catch (e) {
    await showError(e instanceof Error ? e.message : '저장에 실패했어요');
  }
}

/**
 * Query 시드 — 두 가지 진입 흐름 지원:
 *   `/route?contentId=1&contentTitle=겨울연가` (작품 기반 신규 코스)
 *   `/route?routeId=42` (저장된 코스 복원)
 * 두 흐름이 동시에 들어오면 routeId 가 우선.
 */
function readSeed(): {
  routeId: number | null;
  contentId: number | null;
  contentTitle: string | null;
} {
  const rid = route.query.routeId;
  const cid = route.query.contentId;
  const cTitle = route.query.contentTitle;
  const ridStr = typeof rid === 'string' ? rid : Array.isArray(rid) ? rid[0] : null;
  const idStr = typeof cid === 'string' ? cid : Array.isArray(cid) ? cid[0] : null;
  const titleStr = typeof cTitle === 'string' ? cTitle : Array.isArray(cTitle) ? cTitle[0] : null;
  const ridNum = ridStr != null ? Number(ridStr) : null;
  const idNum = idStr != null ? Number(idStr) : null;
  return {
    routeId: ridNum != null && Number.isFinite(ridNum) ? ridNum : null,
    contentId: idNum != null && Number.isFinite(idNum) ? idNum : null,
    contentTitle: titleStr ?? null,
  };
}

onMounted(async () => {
  const { routeId, contentId, contentTitle } = readSeed();
  try {
    if (routeId != null) {
      await tripRouteStore.seedFromSavedRoute(routeId);
    } else {
      await tripRouteStore.seedFromContent(contentId, contentTitle);
    }
  } catch (e) {
    void showError(e instanceof Error ? e.message : '코스를 불러올 수 없어요');
  } finally {
    // hardening — 어떤 경로로 빠지더라도 loading 이 stuck 되지 않게. store action 의
    // finally 에서 이미 false 로 내리지만, 시드 메서드 자체가 외부에서 reject 되면
    // 페이지 컨트롤이 disabled 상태로 남는 사고를 회피.
    if (tripRouteStore.loading) tripRouteStore.$patch({ loading: false });
  }
  // 401 / 권한 없음 / 응답 shape 오류 등으로 store.error 가 세팅됐으면 토스트.
  // 페이지 자체는 빈 코스로 살아있어 사용자가 검색/뒤로/+/-/내위치 모두 사용 가능.
  if (tripRouteStore.error) void showError(tripRouteStore.error);
});

/**
 * task #22 — Ionic stack-preserved page. 카메라/업로드 다녀와 재진입할 때 onMounted
 * 가 다시 안 발동될 수 있어 visited 가 stale 로 남는다. ionViewDidEnter 는 매 진입
 * 마다 발동하므로 saved route 인 경우 visited 만 silent 갱신.
 */
onIonViewDidEnter(() => {
  if (tripRouteStore.currentSavedRouteId != null) {
    void tripRouteStore.refreshVisitedFromBackend();
  }
});

onBeforeUnmount(() => {
  // 페이지 leave 시 모달 상태만 비움. store 의 placeIds 는 같은 작품 재진입 시
  // 보존되도록 store.reset 은 호출하지 않는다 — 사용자 손길이 살아남게.
  searchOpen.value = false;
  editorOpen.value = false;
  shareOpen.value = false;
  detailId.value = null;
});
</script>

<style scoped>
ion-content.tr-content {
  --background: #eaf6fb;
}

.tr-stage {
  position: relative;
  width: 100%;
  height: 100%;
  background: #eaf6fb;
}

.tr-topbar {
  position: absolute;
  top: calc(env(safe-area-inset-top) + 14px);
  left: 16px;
  right: 16px;
  z-index: 30;
  display: flex;
  gap: 10px;
  align-items: center;
}
.tr-icon-btn {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
  color: var(--fr-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.tr-search-btn {
  flex: 1;
  min-width: 0;
  height: 48px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06);
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 10px;
  cursor: pointer;
}
.tr-search-ic {
  color: var(--fr-ink-3);
}
.tr-search-placeholder {
  flex: 1;
  text-align: left;
  font-size: 14px;
  color: var(--fr-ink-3);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 우측 세로 스택 컨트롤 — MapPage 와 동일한 마크업/스타일.
   timeline sheet 가 시각적으로 하단 fixed 영역을 차지하므로 sheet-mode 분기는
   필요 없고, sheet 위로 살짝 떠 있는 280px 가량의 baseline 만 유지. */
.map-controls {
  position: absolute;
  right: 12px;
  bottom: calc(env(safe-area-inset-bottom) + 320px);
  z-index: 25;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
</style>
