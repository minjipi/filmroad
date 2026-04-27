<template>
  <!--
    지도 상단 필터 버튼 → 본 시트. 4그룹(작품 / 지역 / 거리 / 방문 상태) 의
    advanced filter 를 한 자리에 모아 chip-row 의 1차 단축 필터와 stacked
    AND 로 결합. 평점은 MapMarkerDto 에 rating 추가 후 다음 PR 에 들어감.
    Apply 시 mapStore.setSheetFilters 로 confirm — 닫기/초기화로는 적용 안 함.
  -->
  <ion-modal
    :is-open="open"
    :initial-breakpoint="1"
    :breakpoints="[0, 1]"
    handle-behavior="cycle"
    class="mfs-modal"
    @did-dismiss="onDismiss"
  >
    <div class="mfs-root" data-testid="map-filter-sheet">
      <header class="mfs-head">
        <h2>필터</h2>
        <button
          type="button"
          class="mfs-close"
          aria-label="닫기"
          data-testid="mfs-close"
          @click="$emit('close')"
        >
          <ion-icon :icon="closeOutline" class="ic-22" />
        </button>
      </header>

      <div class="mfs-body no-scrollbar">
        <!-- 작품 — 다중 선택 chip. 빈 선택 = 전체. -->
        <section class="mfs-group" data-testid="mfs-group-works">
          <h3>작품</h3>
          <div class="mfs-chips">
            <button
              v-for="w in availableWorks"
              :key="w.id"
              type="button"
              :class="['mfs-chip', draft.workIds.includes(w.id) ? 'on' : '']"
              data-testid="mfs-work-chip"
              @click="toggleWork(w.id)"
            >{{ w.title }}</button>
            <p v-if="availableWorks.length === 0" class="mfs-empty">
              아직 표시할 작품이 없어요
            </p>
          </div>
        </section>

        <!-- 지역 — 다중 선택. 빈 = 전국. -->
        <section class="mfs-group" data-testid="mfs-group-regions">
          <h3>지역</h3>
          <div class="mfs-chips">
            <button
              v-for="r in availableRegions"
              :key="r"
              type="button"
              :class="['mfs-chip', draft.regions.includes(r) ? 'on' : '']"
              data-testid="mfs-region-chip"
              @click="toggleRegion(r)"
            >{{ r }}</button>
            <p v-if="availableRegions.length === 0" class="mfs-empty">
              지역 데이터가 없어요
            </p>
          </div>
        </section>

        <!-- 거리 — single 선택 pill row. null = 전체. -->
        <section class="mfs-group" data-testid="mfs-group-distance">
          <h3>거리</h3>
          <div class="mfs-pills">
            <button
              v-for="opt in DISTANCE_OPTIONS"
              :key="opt.label"
              type="button"
              :class="['mfs-pill', draft.maxDistanceKm === opt.value ? 'on' : '']"
              data-testid="mfs-distance-pill"
              @click="draft.maxDistanceKm = opt.value"
            >{{ opt.label }}</button>
          </div>
        </section>

        <!-- 방문 상태 — single 선택. -->
        <section class="mfs-group" data-testid="mfs-group-visit">
          <h3>방문 상태</h3>
          <div class="mfs-pills">
            <button
              v-for="opt in VISIT_OPTIONS"
              :key="opt.value"
              type="button"
              :class="['mfs-pill', draft.visitStatus === opt.value ? 'on' : '']"
              data-testid="mfs-visit-pill"
              @click="draft.visitStatus = opt.value"
            >{{ opt.label }}</button>
          </div>
        </section>
      </div>

      <footer class="mfs-foot">
        <button
          type="button"
          class="mfs-reset"
          data-testid="mfs-reset"
          @click="onReset"
        >초기화</button>
        <button
          type="button"
          class="mfs-apply"
          :disabled="matchCount === 0"
          data-testid="mfs-apply"
          @click="onApply"
        >적용 ({{ matchCount }}곳)</button>
      </footer>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { IonModal, IonIcon } from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import {
  useMapStore,
  firstRegionToken,
  type MapMarker,
  type MapSheetFilters,
  type VisitStatus,
} from '@/stores/map';
import { useSavedStore } from '@/stores/saved';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const mapStore = useMapStore();
const savedStore = useSavedStore();
const { sheetFilters, markers, visitedIds, filter } = storeToRefs(mapStore);

// 시트 안에서 사용자가 만지는 동안 store 는 건들지 않고 local draft 에만
// 누적. 적용/초기화 누를 때만 store 에 반영. iOS 표준 패턴.
const draft = reactive<MapSheetFilters>({ ...sheetFilters.value });

// 시트가 열릴 때마다 store 의 현재 값으로 draft 동기화 — 닫고 다시 열면
// 직전 적용 값에서 시작.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) Object.assign(draft, sheetFilters.value);
  },
);

const availableWorks = computed(() => mapStore.availableWorks);
const availableRegions = computed(() => mapStore.availableRegions);

interface DistanceOption {
  label: string;
  value: number | null;
}
const DISTANCE_OPTIONS: DistanceOption[] = [
  { label: '전체', value: null },
  { label: '5km', value: 5 },
  { label: '10km', value: 10 },
  { label: '30km', value: 30 },
];

interface VisitOption {
  label: string;
  value: VisitStatus;
}
const VISIT_OPTIONS: VisitOption[] = [
  { label: '전체', value: 'ALL' },
  { label: '미방문만', value: 'UNVISITED' },
  { label: '방문완료만', value: 'VISITED' },
];

function toggleWork(id: number): void {
  const i = draft.workIds.indexOf(id);
  if (i === -1) draft.workIds.push(id);
  else draft.workIds.splice(i, 1);
}

function toggleRegion(r: string): void {
  const i = draft.regions.indexOf(r);
  if (i === -1) draft.regions.push(r);
  else draft.regions.splice(i, 1);
}

// 적용 버튼 라벨에 들어가는 "12곳" 카운트 — store 의 visibleMarkers 로직을
// draft 기준으로 재현해 미리보기. 적용 전이라 store 는 안 건들고 local 계산.
const matchCount = computed(() => {
  let pool: MapMarker[] = markers.value;
  if (filter.value === 'VISITED') {
    const v = new Set(visitedIds.value);
    pool = pool.filter((m) => v.has(m.id));
  } else if (filter.value === 'SAVED') {
    pool = pool.filter((m) => savedStore.isSaved(m.id));
  }
  if (draft.workIds.length > 0) {
    const ids = new Set(draft.workIds);
    pool = pool.filter((m) => ids.has(m.workId));
  }
  if (draft.regions.length > 0) {
    const regions = new Set(draft.regions);
    pool = pool.filter((m) => regions.has(firstRegionToken(m.regionLabel)));
  }
  if (draft.maxDistanceKm !== null) {
    const max = draft.maxDistanceKm;
    pool = pool.filter((m) => m.distanceKm == null || m.distanceKm <= max);
  }
  if (draft.visitStatus !== 'ALL') {
    const v = new Set(visitedIds.value);
    pool = pool.filter((m) => draft.visitStatus === 'VISITED' ? v.has(m.id) : !v.has(m.id));
  }
  return pool.length;
});

function onReset(): void {
  // 초기화는 draft 만 — 실제 store 반영은 적용 누를 때.
  draft.workIds = [];
  draft.regions = [];
  draft.maxDistanceKm = null;
  draft.visitStatus = 'ALL';
}

function onApply(): void {
  // 매칭 0건 조합은 적용 불가 — 빈 결과로 시트 닫히면 사용자가 길을 잃음.
  // 버튼 자체도 disabled 지만, 키보드 이벤트 등 우회 시 가드.
  if (matchCount.value === 0) return;
  mapStore.setSheetFilters({
    workIds: [...draft.workIds],
    regions: [...draft.regions],
    maxDistanceKm: draft.maxDistanceKm,
    visitStatus: draft.visitStatus,
  });
  emit('close');
}

function onDismiss(): void {
  if (props.open) emit('close');
}
</script>

<style scoped>
.mfs-modal {
  --backdrop-opacity: 0.5;
}

.mfs-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  color: var(--fr-ink);
}

.mfs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 8px;
  border-bottom: 1px solid var(--fr-line-soft);
}
.mfs-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.mfs-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.mfs-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px 20px;
}
.mfs-group {
  padding: 16px 0;
  border-bottom: 1px solid var(--fr-line-soft);
}
.mfs-group:last-child { border-bottom: none; }
.mfs-group h3 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 800;
  color: var(--fr-ink-2);
  letter-spacing: -0.01em;
}

/* 다중 선택 chips — 작품 / 지역. */
.mfs-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.mfs-chip {
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--fr-bg-muted);
  border: 1px solid transparent;
  color: var(--fr-ink-2);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
}
.mfs-chip.on {
  background: var(--fr-primary-soft);
  color: var(--fr-primary);
  border-color: var(--fr-primary);
}
.mfs-empty {
  margin: 0;
  font-size: 12px;
  color: var(--fr-ink-4);
}

/* 단일 선택 pill row — 거리 / 방문 상태. segmented control 형태. */
.mfs-pills {
  display: flex;
  gap: 6px;
  background: var(--fr-bg-muted);
  border-radius: 10px;
  padding: 3px;
}
.mfs-pill {
  flex: 1;
  height: 34px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--fr-ink-3);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}
.mfs-pill.on {
  background: #ffffff;
  color: var(--fr-primary);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.mfs-foot {
  display: flex;
  gap: 10px;
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--fr-line-soft);
  background: #ffffff;
}
.mfs-reset {
  flex: 0 0 auto;
  height: 48px;
  padding: 0 18px;
  border-radius: 12px;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  border: none;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
}
.mfs-apply {
  flex: 1;
  height: 48px;
  border-radius: 12px;
  background: var(--fr-primary);
  color: #ffffff;
  border: none;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
  letter-spacing: -0.01em;
}
.mfs-apply:disabled {
  background: var(--fr-line);
  color: var(--fr-ink-4);
  cursor: not-allowed;
}
</style>
