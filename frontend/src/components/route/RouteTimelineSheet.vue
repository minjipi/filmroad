<template>
  <!-- 화면 하단 absolute 시트. 헤더(이름/메타/편집 버튼) + 가로 스크롤 카드(스냅)
       + 추가 카드. grabber 는 task #4 에서 제거 — 시트 자체가 fixed height 라
       세로 드래그 affordance 가 의미 없었다. -->
  <section class="rt-sheet" data-testid="rt-timeline-sheet">
    <header class="rt-sheet-head">
      <div class="rt-sheet-title-block">
        <h1 class="rt-sheet-title">{{ name }}</h1>
        <p class="rt-sheet-meta">
          <span>📍 {{ places.length }}개 장소</span>
          <span class="rt-sep" aria-hidden="true">·</span>
          <span>⏱ 약 {{ totalDurationLabel }}</span>
          <template v-if="totalDistanceKm > 0">
            <span class="rt-sep" aria-hidden="true">·</span>
            <span>🚗 {{ totalDistanceKm.toFixed(1) }}km</span>
          </template>
        </p>
      </div>
      <div class="rt-head-actions">
        <button
          type="button"
          class="rt-edit-btn"
          aria-label="루트 편집"
          data-testid="rt-edit-btn"
          @click="emit('editRoute')"
        >
          <ion-icon :icon="optionsOutline" class="ic-20" />
        </button>
        <button
          type="button"
          class="rt-edit-btn rt-share-btn"
          aria-label="저장 / 공유"
          data-testid="rt-share-btn"
          @click="emit('share')"
        >
          <ion-icon :icon="shareOutline" class="ic-20" />
        </button>
      </div>
    </header>

    <div
      ref="scrollEl"
      :class="['rt-cards', isDragging ? 'is-dragging' : '']"
      data-testid="rt-cards"
      @scroll="onScroll"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <article
        v-for="(p, i) in places"
        :key="p.id"
        :class="['rt-card', activeId === p.id ? 'is-active' : '', roleClass(i, places.length)]"
        :data-testid="`rt-card-${p.id}`"
        @click="onCardClick(p.id)"
      >
        <div class="rt-card-thumb">
          <img v-if="p.sceneImageUrl" :src="p.sceneImageUrl" :alt="`${p.name} 장면`" />
          <img v-else-if="p.coverImageUrl" :src="p.coverImageUrl" :alt="`${p.name} 인증샷`" />
          <div v-else class="rt-card-thumb-fallback" aria-hidden="true">
            <ion-icon :icon="mapOutline" class="ic-22" />
          </div>
          <span class="rt-role-badge" :data-role="roleClass(i, places.length)">
            <span class="rt-role-dot" aria-hidden="true" />
            {{ roleLabel(i, places.length) }} · {{ i + 1 }}/{{ places.length }}
          </span>
          <span class="rt-arrive-badge">{{ arrivalTime(i) }}</span>
          <span
            v-if="p.visited"
            class="rt-visited-badge"
            :data-testid="`rt-visited-badge-${p.id}`"
            aria-label="인증 완료"
          >
            <ion-icon :icon="checkmarkOutline" class="ic-12" />
            인증
          </span>
        </div>
        <div class="rt-card-body">
          <FrChip variant="primary">{{ p.contentTitle }}</FrChip>
          <h2 class="rt-card-name">{{ p.name }}</h2>
          <div class="rt-card-stats">
            <span v-if="p.rating" class="rt-rating">
              <ion-icon :icon="star" class="ic-14 rt-star" />
              {{ p.rating.toFixed(1) }}
            </span>
            <span class="rt-duration">{{ p.durationMin }}분</span>
          </div>
        </div>
      </article>

      <button
        type="button"
        class="rt-add-card"
        data-testid="rt-add-card"
        @click="onAddClick"
      >
        <span class="rt-add-circle" aria-hidden="true">＋</span>
        <span class="rt-add-label">장소 추가</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { checkmarkOutline, mapOutline, optionsOutline, shareOutline, star } from 'ionicons/icons';
import FrChip from '@/components/ui/FrChip.vue';
import type { TripPlace } from '@/stores/tripRoute';

const props = defineProps<{
  places: TripPlace[];
  activeId: number | null;
  name: string;
  /** 출발 시간(HH:MM) — 카드별 도착시간 계산의 기점. */
  startTime: string;
}>();

const emit = defineEmits<{
  (e: 'activate', id: number): void;
  (e: 'openDetail', id: number): void;
  (e: 'addPlace'): void;
  (e: 'editRoute'): void;
  (e: 'share'): void;
}>();

/**
 * 디자인의 getArrivalTime — 시작시간 + 누적 체류 + 이동 30분(고정). 정밀한
 * 도로 ETA 가 아니어서 mock 단계에선 충분. 24h 자정 wrap 만 modulo 로 처리.
 */
function arrivalTime(idx: number): string {
  const [hh, mm] = props.startTime.split(':').map((v) => Number(v) || 0);
  let total = hh * 60 + mm;
  for (let i = 0; i < idx; i++) total += (props.places[i]?.durationMin ?? 0) + 30;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const totalDurationLabel = computed(() => {
  const sum = props.places.reduce((s, p) => s + (p.durationMin || 0), 0);
  const h = Math.floor(sum / 60);
  const m = sum % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
});

const totalDistanceKm = computed(() => {
  if (props.places.length < 2) return 0;
  const R = 6371;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  let sum = 0;
  for (let i = 0; i < props.places.length - 1; i++) {
    const a = props.places[i];
    const b = props.places[i + 1];
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    sum += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return Math.round(sum * 10) / 10;
});

function roleClass(i: number, total: number): 'start' | 'end' | 'via' {
  if (i === 0) return 'start';
  if (i === total - 1) return 'end';
  return 'via';
}

function roleLabel(i: number, total: number): string {
  if (i === 0) return '출발';
  if (i === total - 1) return '도착';
  return '경유';
}

const scrollEl = ref<HTMLElement | null>(null);

/**
 * onScroll 이 closest 카드 기반으로 activate 를 emit → 부모가 activeId prop 을
 * 갱신 → watcher 가 다시 smooth scrollTo 로 끌어오는 자기-자석 루프를 끊기 위한
 * "내부 발 activate" 표식. true 면 직후 들어오는 watcher 콜백 한 번을 NOP 처리.
 */
const internalActivate = ref(false);

/**
 * activeId 가 외부에서 바뀌면 (예: 마커 탭) 해당 카드로 부드럽게 스크롤.
 * 드래그 중 / onScroll 이 self-trigger 한 변경은 무시 — 사용자 손과 싸우지 않게.
 * scrollTo 타겟은 scroll-snap-align: center 와 정합하도록 카드 중앙이 컨테이너
 * 중앙에 오도록 계산. jsdom 은 scrollTo 미지원이라 try/catch.
 */
watch(
  () => props.activeId,
  async (next) => {
    if (next == null) return;
    if (isDragging.value) return;
    if (internalActivate.value) {
      internalActivate.value = false;
      return;
    }
    await nextTick();
    const container = scrollEl.value;
    if (!container) return;
    const idx = props.places.findIndex((p) => p.id === next);
    if (idx < 0) return;
    const card = container.children[idx] as HTMLElement | undefined;
    if (!card) return;
    const target = card.offsetLeft + card.offsetWidth / 2 - container.clientWidth / 2;
    try {
      container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    } catch {
      /* jsdom or older Safari without smooth scroll — ignore */
    }
  },
);

/**
 * 데스크톱 마우스 드래그 가로 스크롤. 터치/펜은 브라우저 기본 동작에 그대로
 * 맡기고(pointerType==='mouse' 만 가로챔), 5px 넘게 끌고난 직후의 click 은
 * 카드 detail 모달이 뜨지 않도록 onCardClick / onAddClick 가드에서 한 번 무시.
 * is-dragging 클래스가 활성화된 동안엔 scroll-snap 을 풀어 자연스럽게 끌리고,
 * 드롭 시점에 클래스가 빠지면 snap 이 다시 들어가 가장 가까운 카드로 정렬된다.
 */
const isDragging = ref(false);
const dragMoved = ref(false);
let dragStartX = 0;
let dragStartScroll = 0;
let dragPointerId: number | null = null;

function onPointerDown(e: PointerEvent): void {
  if (e.pointerType !== 'mouse') return;
  const c = scrollEl.value;
  if (!c) return;
  dragPointerId = e.pointerId;
  dragStartX = e.clientX;
  dragStartScroll = c.scrollLeft;
  dragMoved.value = false;
  isDragging.value = true;
  // pointer capture 를 잡아두면 카드 위에서 빠르게 빠져나가도 move/up 이 계속 들어옴.
  try { c.setPointerCapture(e.pointerId); } catch { /* jsdom / 미지원 — 무시 */ }
}

function onPointerMove(e: PointerEvent): void {
  if (!isDragging.value || dragPointerId !== e.pointerId) return;
  const c = scrollEl.value;
  if (!c) return;
  const dx = e.clientX - dragStartX;
  if (Math.abs(dx) > 5) dragMoved.value = true;
  c.scrollLeft = dragStartScroll - dx;
}

function endDrag(e: PointerEvent): void {
  if (dragPointerId !== e.pointerId) return;
  const c = scrollEl.value;
  if (c) {
    try { c.releasePointerCapture(e.pointerId); } catch { /* 무시 */ }
  }
  isDragging.value = false;
  dragPointerId = null;
  // dragMoved 는 직후 발생할 click 이 한 번 가드한 뒤 reset 한다 (onCardClick 안에서).
}

function onPointerUp(e: PointerEvent): void { endDrag(e); }
function onPointerCancel(e: PointerEvent): void { endDrag(e); }

function onCardClick(id: number): void {
  if (dragMoved.value) {
    dragMoved.value = false;
    return;
  }
  // task #19 — pointer capture release 가 같은 task 안에서 끝나도록 한 microtask
  // 양보. emit 은 다음 microtask 에 발사되어 부모의 modal 마운트가 stale element
  // 참조 race 와 안 부딪힘.
  void Promise.resolve().then(() => emit('openDetail', id));
}

function onAddClick(): void {
  if (dragMoved.value) {
    dragMoved.value = false;
    return;
  }
  emit('addPlace');
}

/**
 * 사용자가 가로 스크롤로 카드를 옮기면, 가장 가까운 카드로 activeId 를 동기화.
 * 마지막 "+" 추가 카드는 무시. 디자인의 동작 그대로.
 */
function onScroll(e: Event): void {
  const c = e.target as HTMLElement;
  if (c.clientWidth === 0) return;
  if (props.places.length === 0) return;

  // wide viewport(데스크톱) 에서는 카드 폭 + container padding 합이 viewport 보다
  // 작아 "closest to container center" 만으로는 좌측 끝(scrollLeft=0) 시점에도
  // 첫 카드가 closest 가 아닌 상황이 생긴다. boundary 시점은 명시적으로 분기 —
  // 좌측 끝이면 첫 카드, 우측 끝이면 마지막 place 카드(`+` 추가 카드는 무시).
  const EDGE_PX = 4;
  let chosenIdx = -1;
  if (c.scrollLeft <= EDGE_PX) {
    chosenIdx = 0;
  } else if (c.scrollLeft >= c.scrollWidth - c.clientWidth - EDGE_PX) {
    chosenIdx = props.places.length - 1;
  } else {
    const center = c.scrollLeft + c.clientWidth / 2;
    let closestDist = Infinity;
    for (let i = 0; i < props.places.length; i++) {
      const card = c.children[i] as HTMLElement | undefined;
      if (!card) continue;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(center - cardCenter);
      if (dist < closestDist) {
        closestDist = dist;
        chosenIdx = i;
      }
    }
  }

  const id = props.places[chosenIdx]?.id;
  if (id != null && id !== props.activeId) {
    // 내부 발 변경임을 watcher 에 알림 — 직후 들어오는 watcher 콜백 한 번을 NOP
    // 처리해 자기-자석 루프(scrollTo ↔ user scroll) 를 끊는다.
    internalActivate.value = true;
    emit('activate', id);
  }
}
</script>

<style scoped>
.rt-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 4;
  background: #ffffff;
  border-radius: 28px 28px 0 0;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.08), 0 -1px 0 rgba(0, 0, 0, 0.04);
  /* grabber 제거 후 헤더가 모서리에 붙지 않도록 보존하던 시각 여백(8+5+12=25px)을
     padding-top 으로 대체. */
  padding-top: 16px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
}

.rt-sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px 12px;
}
.rt-sheet-title-block {
  min-width: 0;
}
.rt-sheet-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: var(--fr-ink);
  letter-spacing: -0.02em;
}
.rt-sheet-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--fr-ink-3);
  font-weight: 500;
}
.rt-sheet-meta .rt-sep {
  color: var(--fr-line);
}
.rt-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.rt-edit-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: var(--fr-bg-muted);
  border: 0;
  color: var(--fr-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.rt-share-btn {
  background: var(--fr-primary);
  color: #fff;
}

.rt-cards {
  display: flex;
  gap: 10px;
  padding: 4px 16px 14px;
  overflow-x: auto;
  overflow-y: visible;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  cursor: grab;
}
.rt-cards.is-dragging {
  cursor: grabbing;
  /* drag 중에는 snap 을 풀어 자유롭게 끌리고, 드롭 시 클래스가 빠지면서
     mandatory snap 이 가장 가까운 카드로 자동 정렬한다. */
  scroll-snap-type: none;
  scroll-behavior: auto;
  user-select: none;
}
.rt-cards::-webkit-scrollbar {
  display: none;
}

.rt-card {
  flex-shrink: 0;
  width: 200px;
  scroll-snap-align: center;
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid var(--fr-line);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  overflow: hidden;
  transform: translateY(0);
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 200ms ease, border-color 200ms ease;
}
.rt-card.is-active {
  border-color: var(--fr-primary);
  box-shadow: 0 8px 24px rgba(20, 188, 237, 0.2), 0 2px 6px rgba(0, 0, 0, 0.06);
  transform: translateY(-4px);
}
.rt-card-thumb {
  position: relative;
  height: 90px;
  background: linear-gradient(135deg, var(--fr-primary) 0%, #0ea5d2 100%);
  overflow: hidden;
}
.rt-card.end .rt-card-thumb {
  background: linear-gradient(135deg, var(--fr-coral, #f04438) 0%, #c0382c 100%);
}
.rt-card.via .rt-card-thumb {
  background: linear-gradient(135deg, #fdb022 0%, #d28710 100%);
}
.rt-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.rt-card-thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.85);
}
.rt-role-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--fr-primary);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
}
.rt-role-badge[data-role='end'] {
  background: var(--fr-coral, #f04438);
}
.rt-role-badge[data-role='via'] {
  background: #fdb022;
}
.rt-role-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #ffffff;
}
.rt-arrive-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #ffffff;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
/* 인증 완료 배지 — arrive-badge 좌측에 mint 톤. visited 인 카드에만 노출. */
.rt-visited-badge {
  position: absolute;
  bottom: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--fr-mint, #10b981);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.2px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
}

.rt-card-body {
  padding: 10px 12px 12px;
}
.rt-card-name {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--fr-ink);
  letter-spacing: -0.4px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rt-card-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: var(--fr-ink-3);
  font-weight: 500;
}
.rt-rating {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.rt-star {
  color: #fbbf24;
}

.rt-add-card {
  flex-shrink: 0;
  width: 90px;
  scroll-snap-align: center;
  background: var(--fr-bg-muted);
  border: 2px dashed rgba(20, 188, 237, 0.4);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  color: var(--fr-primary);
  font-family: inherit;
}
.rt-add-circle {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--fr-primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}
.rt-add-label {
  font-size: 11px;
  font-weight: 600;
}
</style>
