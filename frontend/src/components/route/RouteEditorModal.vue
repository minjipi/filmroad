<template>
  <!-- 88% 높이 bottom sheet. 디자인의 RouteEditor 와 동일 — 출발 시간 카드 +
       드래그 가능 리스트(재정렬) + 삭제 버튼. HTML5 DnD 는 모바일 webview 에서
       시그널이 약해, 여기는 pointerdown / pointermove / pointerup 으로 직접 구현 —
       handle 을 잡고 위/아래 카드 절반을 넘기면 그 위치로 placeIds 가 즉시 reorder. -->
  <div
    v-if="open"
    class="rt-editor-overlay"
    role="dialog"
    aria-modal="true"
    data-testid="rt-editor-overlay"
    @click.self="emit('close')"
  >
    <div class="rt-editor-sheet">
      <span class="rt-grabber" aria-hidden="true" />
      <header class="rt-editor-head">
        <button
          type="button"
          class="rt-editor-close"
          data-testid="rt-editor-close"
          @click="emit('close')"
        >
          닫기
        </button>
        <h2 class="rt-editor-title">루트 편집</h2>
        <button
          type="button"
          class="rt-editor-done"
          data-testid="rt-editor-done"
          @click="emit('close')"
        >
          완료
        </button>
      </header>

      <div class="rt-editor-time">
        <div class="rt-editor-time-ic" aria-hidden="true">🕘</div>
        <div class="rt-editor-time-body">
          <div class="rt-editor-time-label">출발 시간</div>
          <div class="rt-editor-time-value">{{ formattedStartTime }}</div>
        </div>
        <button
          type="button"
          class="rt-editor-time-change"
          data-testid="rt-editor-time-change"
          @click="onChangeStartTime"
        >
          변경
        </button>
      </div>

      <ul
        ref="listEl"
        class="rt-editor-list"
        data-testid="rt-editor-list"
      >
        <li
          v-for="(p, i) in places"
          :key="p.id"
          :class="['rt-editor-item', draggingId === p.id ? 'is-dragging' : '']"
          :data-testid="`rt-editor-item-${p.id}`"
          :style="draggingId === p.id ? { transform: `translateY(${dragOffsetY}px)`, zIndex: 10 } : undefined"
        >
          <button
            type="button"
            class="rt-editor-handle"
            aria-label="드래그하여 순서 변경"
            data-testid="rt-editor-handle"
            @pointerdown="(e) => onHandleDown(e, p.id, i)"
            @pointermove="onHandleMove"
            @pointerup="onHandleUp"
            @pointercancel="onHandleUp"
          >
            <ion-icon :icon="reorderTwoOutline" class="ic-18" />
          </button>
          <span class="rt-editor-order" :data-role="roleClass(i, places.length)">
            {{ i + 1 }}
          </span>
          <div class="rt-editor-item-body">
            <div class="rt-editor-item-name">{{ p.name }}</div>
            <div class="rt-editor-item-sub">
              {{ arrivalTime(i) }} · {{ p.durationMin }}분
            </div>
          </div>
          <button
            type="button"
            class="rt-editor-remove"
            :aria-label="`${p.name} 삭제`"
            data-testid="rt-editor-remove"
            @click="emit('remove', p.id)"
          >
            −
          </button>
        </li>
        <li v-if="places.length === 0" class="rt-editor-empty">
          코스에 장소를 추가해 보세요
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { reorderTwoOutline } from 'ionicons/icons';
import type { TripPlace } from '@/stores/tripRoute';

const props = defineProps<{
  open: boolean;
  places: TripPlace[];
  startTime: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'reorder', payload: { fromIdx: number; toIdx: number }): void;
  (e: 'remove', id: number): void;
  (e: 'changeStartTime', hhmm: string): void;
}>();

function roleClass(i: number, total: number): 'start' | 'end' | 'via' {
  if (i === 0) return 'start';
  if (i === total - 1) return 'end';
  return 'via';
}

function arrivalTime(idx: number): string {
  const [hh, mm] = props.startTime.split(':').map((v) => Number(v) || 0);
  let total = hh * 60 + mm;
  for (let i = 0; i < idx; i++) total += (props.places[i]?.durationMin ?? 0) + 30;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const formattedStartTime = computed(() => {
  const [hhStr, mmStr] = props.startTime.split(':');
  const hh = Number(hhStr) || 0;
  const mm = Number(mmStr) || 0;
  const isAM = hh < 12;
  const display = hh % 12 === 0 ? 12 : hh % 12;
  return `${String(display).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${isAM ? 'AM' : 'PM'}`;
});

/**
 * 모바일 / 데스크톱 모두 동작하는 reorder. 드래그 중인 카드는 손가락/커서 위치
 * 를 따라 inline `translateY` 로 즉시 이동하고, 인접 카드의 절반 (stepH/2) 을
 * 넘어가면 placeIds 를 한 칸씩 swap 한다. swap 직후엔 anchor(dragStartY) 와
 * dragOffsetY 를 stepH 만큼 재조정해 카드는 손가락 아래에 그대로 머문다. while
 * 루프로 한 번의 큰 move 에 여러 칸 swap 도 누적 처리.
 *
 * swap 결과는 emit('reorder') 로 부모(TripRoutePage → store)에 보내고, 부모가
 * splice 한 새 배열을 props.places 로 다시 흘려보낸다 — 이 컴포넌트는 stateless
 * reorder 트리거 + 시각적 follow-cursor 만 담당.
 */
const draggingId = ref<number | null>(null);
const dragOffsetY = ref(0);
const listEl = ref<HTMLElement | null>(null);
let dragStartY = 0;
let pointerCaptureEl: Element | null = null;
let activeIdx = -1;

function onHandleDown(e: PointerEvent, id: number, idx: number): void {
  draggingId.value = id;
  dragOffsetY.value = 0;
  activeIdx = idx;
  dragStartY = e.clientY;
  const target = e.currentTarget as Element | null;
  pointerCaptureEl = target;
  try {
    target?.setPointerCapture?.(e.pointerId);
  } catch {
    /* jsdom — silent */
  }
  if (typeof e.preventDefault === 'function') e.preventDefault();
}

function onHandleMove(e: PointerEvent): void {
  if (draggingId.value == null || activeIdx < 0) return;
  const list = listEl.value;
  if (!list) return;
  const item = list.children[activeIdx] as HTMLElement | undefined;
  if (!item) return;
  // gap 8px 포함한 step. jsdom 에서 offsetHeight 가 0 일 수 있어 64 폴백.
  const stepH = (item.offsetHeight || 64) + 8;

  // 손가락 따라가기 — translateY 즉시 반영.
  dragOffsetY.value = e.clientY - dragStartY;

  // 한 번의 move 에 여러 칸 swap 가능. swap 직후 anchor/offset 을 stepH 만큼
  // 재조정해 카드는 손가락 아래에 그대로 머묾. didSwap 플래그로 누적 처리.
  let didSwap = true;
  while (didSwap) {
    didSwap = false;
    if (dragOffsetY.value > stepH * 0.5 && activeIdx + 1 < props.places.length) {
      emit('reorder', { fromIdx: activeIdx, toIdx: activeIdx + 1 });
      activeIdx += 1;
      dragStartY += stepH;
      dragOffsetY.value -= stepH;
      didSwap = true;
    } else if (dragOffsetY.value < -stepH * 0.5 && activeIdx - 1 >= 0) {
      emit('reorder', { fromIdx: activeIdx, toIdx: activeIdx - 1 });
      activeIdx -= 1;
      dragStartY -= stepH;
      dragOffsetY.value += stepH;
      didSwap = true;
    }
  }
}

function onHandleUp(e: PointerEvent): void {
  draggingId.value = null;
  dragOffsetY.value = 0;
  activeIdx = -1;
  try {
    pointerCaptureEl?.releasePointerCapture?.(e.pointerId);
  } catch {
    /* silent */
  }
  pointerCaptureEl = null;
}

/**
 * 출발 시간 변경 — picker 가 별도 컴포넌트로 빠질 예정이라 지금은 prompt() 폴백.
 * iOS Safari 도 prompt 지원, jsdom 도 OK. 사용자가 빈/잘못된 형식 입력하면 무시.
 */
function onChangeStartTime(): void {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') return;
  const next = window.prompt('출발 시간 (HH:MM, 24h)', props.startTime);
  if (!next) return;
  const m = next.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return;
  emit('changeStartTime', `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
}
</script>

<style scoped>
.rt-editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 110;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: stretch;
}
.rt-editor-sheet {
  width: 100%;
  max-height: 88vh;
  background: var(--fr-bg-soft, #f8fafc);
  border-radius: 28px 28px 0 0;
  display: flex;
  flex-direction: column;
}
.rt-grabber {
  width: 40px;
  height: 5px;
  border-radius: 999px;
  background: #e5e7eb;
  margin: 8px auto 4px;
}
.rt-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 8px;
}
.rt-editor-close,
.rt-editor-done {
  border: 0;
  background: transparent;
  font-size: 15px;
  cursor: pointer;
  padding: 4px 0;
}
.rt-editor-close {
  color: var(--fr-ink-3);
}
.rt-editor-done {
  color: var(--fr-primary);
  font-weight: 700;
}
.rt-editor-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--fr-ink);
  letter-spacing: -0.2px;
}

.rt-editor-time {
  margin: 8px 16px 12px;
  padding: 14px;
  border-radius: 16px;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--fr-line);
}
.rt-editor-time-ic {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--fr-primary-soft, rgba(20, 188, 237, 0.14));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.rt-editor-time-body {
  flex: 1;
}
.rt-editor-time-label {
  font-size: 12px;
  color: var(--fr-ink-3);
  font-weight: 500;
}
.rt-editor-time-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--fr-ink);
  letter-spacing: -0.3px;
}
.rt-editor-time-change {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--fr-bg-muted);
  border: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--fr-ink-2);
  cursor: pointer;
}

.rt-editor-list {
  list-style: none;
  margin: 0;
  padding: 0 16px 24px;
  flex: 1;
  overflow-y: auto;
}
.rt-editor-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid var(--fr-line);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  /* 드롭 시점에 inline transform 이 제거되면서 0 으로 부드럽게 settle 되게
     transform 도 transition 에 포함. */
  transition: opacity 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}
/* 드래그 중인 카드 — inline translateY 가 손가락을 즉시 따라가야 하므로 transition
   에서 transform 만 빼고, lift 느낌은 box-shadow 로 표현. opacity 는 살짝만. */
.rt-editor-item.is-dragging {
  opacity: 0.95;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
  transition: opacity 160ms ease, box-shadow 160ms ease;
}
.rt-editor-handle {
  width: 28px;
  height: 32px;
  border: 0;
  background: transparent;
  color: var(--fr-ink-4);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}
.rt-editor-handle:active {
  cursor: grabbing;
}
.rt-editor-order {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--fr-primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
}
.rt-editor-order[data-role='end'] {
  background: var(--fr-coral, #f04438);
}
.rt-editor-order[data-role='via'] {
  background: #fdb022;
}
.rt-editor-item-body {
  flex: 1;
  min-width: 0;
}
.rt-editor-item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--fr-ink);
  letter-spacing: -0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rt-editor-item-sub {
  font-size: 11px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}
.rt-editor-remove {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #fef2f2;
  border: 0;
  color: #ef4444;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}
.rt-editor-empty {
  padding: 24px 0;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}
</style>
