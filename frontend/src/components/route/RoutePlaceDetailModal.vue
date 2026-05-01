<template>
  <!-- 82% 높이 bottom sheet — 디자인의 PlaceDetail. 사진 hero(scene/cover 우선,
       없으면 그라데이션 폴백) + 정보/내 메모 두 탭. CTA "인증하기" 는 PlaceDetailPage
       의 onCapture 와 동일 — uploadStore.beginCapture 후 /camera 로 점프.

       task #19 — Teleport(to body) + Transition 으로 mount/unmount race 차단.
       부모 컴포넌트 트리 안에서 v-if 토글하면 sibling vnode 와 patching 순서가
       엇갈리며 `__vnode = null` runtime 에러가 보고됨. body 로 끌어내고 fade
       transition 으로 한 프레임 분리. -->
  <Teleport to="body">
    <Transition name="rt-detail">
      <div
        v-if="open && place"
        class="rt-detail-overlay"
        role="dialog"
        aria-modal="true"
        data-testid="rt-detail-overlay"
        @click.self="emit('close')"
      >
        <div class="rt-detail-sheet">
          <header class="rt-detail-hero">
            <img
              v-if="heroImage"
              :src="heroImage"
              :alt="`${place.name} 장면`"
              class="rt-detail-hero-img"
              draggable="false"
            />
            <div v-else class="rt-detail-hero-fallback" aria-hidden="true" />

            <button
              type="button"
              class="rt-detail-close"
              aria-label="닫기"
              data-testid="rt-detail-close"
              @click="emit('close')"
            >
              <ion-icon :icon="closeOutline" class="ic-20" />
            </button>

            <div class="rt-detail-caption">
              <FrChip variant="primary">{{ place.contentTitle }}</FrChip>
              <h2 class="rt-detail-name">{{ place.name }}</h2>
              <div class="rt-detail-region">{{ place.regionLabel }}</div>
            </div>
          </header>

          <nav class="rt-detail-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              :class="['rt-detail-tab', tab === 'info' ? 'is-active' : '']"
              :aria-selected="tab === 'info'"
              data-testid="rt-detail-tab-info"
              @click="tab = 'info'"
            >
              정보
            </button>
            <button
              type="button"
              role="tab"
              :class="['rt-detail-tab', tab === 'note' ? 'is-active' : '']"
              :aria-selected="tab === 'note'"
              data-testid="rt-detail-tab-note"
              @click="tab = 'note'"
            >
              내 메모
            </button>
          </nav>

          <div class="rt-detail-body">
            <template v-if="tab === 'info'">
              <RoutePlaceInfoRow v-if="place.rating" icon="⭐" label="평점" :value="`${place.rating.toFixed(1)} / 5.0`" />
              <RoutePlaceInfoRow v-if="place.address" icon="📍" label="주소" :value="place.address" />
              <RoutePlaceInfoRow v-if="place.openHours" icon="🕐" label="운영시간" :value="place.openHours" />
              <RoutePlaceInfoRow v-if="place.price" icon="💵" label="가격" :value="place.price" />
              <RoutePlaceInfoRow icon="⏱" label="추천 체류" :value="`${place.durationMin}분`" />
              <RoutePlaceInfoRow
                v-if="place.visited"
                icon="✓"
                label="방문 인증"
                :value="visitedLabel"
              />

              <!-- 혼잡도 — 한국관광공사 응답 (오늘/내일/주말 3 카드).
                   PlaceDetailPage 의 '언제 가면 좋을까?' 섹션과 동일 패턴.
                   available=false 또는 fetch 전이면 v-if 로 통째 숨김. -->
              <section
                v-if="congestion?.available && congestion.forecasts.length > 0"
                class="rt-detail-crowd"
                data-testid="rt-detail-crowd"
              >
                <div class="rt-detail-crowd-head">
                  <span class="rt-detail-crowd-ttl">언제 가면 좋을까?</span>
                </div>
                <p class="rt-detail-crowd-sub">
                  {{ congestion.source ?? '한국관광공사' }} 관광지 집중률 · 실시간 예측
                </p>
                <div class="rt-detail-crowd-chips">
                  <div
                    v-for="f in congestion.forecasts"
                    :key="f.key"
                    :class="['rt-detail-crowd-chip', `crowd-tx-${stateLowerClass(f.state)}`]"
                    :data-testid="`rt-detail-crowd-${f.key.toLowerCase()}`"
                  >
                    <div class="lbl">
                      {{ f.label }}
                      <span class="sub">· {{ f.dateLabel }}</span>
                    </div>
                    <div class="row">
                      <span class="pct">
                        {{ f.percent }}<span class="pct-unit">%</span>
                      </span>
                      <span class="state">{{ stateLabel(f.state) }}</span>
                    </div>
                    <div class="meter">
                      <i
                        :class="`crowd-bg-${stateLowerClass(f.state)}`"
                        :style="{ width: `${f.percent}%` }"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <button
                type="button"
                class="rt-detail-cta"
                data-testid="rt-detail-capture"
                @click="onCapture"
              >
                <ion-icon :icon="cameraOutline" class="ic-18" />
                {{ place.visited ? '다시 인증하기' : '인증하기' }}
              </button>
            </template>

            <template v-else>
              <textarea
                v-model="noteDraft"
                class="rt-detail-note"
                placeholder="여기에 메모를 남겨보세요…"
                data-testid="rt-detail-note"
                @blur="onSaveNote"
              />
              <button
                type="button"
                class="rt-detail-note-save"
                data-testid="rt-detail-note-save"
                :disabled="!noteDirty"
                @click="onSaveNoteExplicit"
              >
                <ion-icon :icon="saveOutline" class="ic-18" />저장하기
              </button>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { cameraOutline, closeOutline, saveOutline } from 'ionicons/icons';
import FrChip from '@/components/ui/FrChip.vue';
import RoutePlaceInfoRow from './RoutePlaceInfoRow.vue';
import { useUploadStore } from '@/stores/upload';
import type { TripPlace } from '@/stores/tripRoute';
import { useCongestionStore, type CongestionState } from '@/stores/congestion';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  open: boolean;
  place: TripPlace | null;
  /** 사용자가 이 place 에 작성한 기존 메모. 닫고 다시 열어도 유지. */
  note: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save-note', payload: { placeId: number; note: string }): void;
}>();

type Tab = 'info' | 'note';
const tab = ref<Tab>('info');
const noteDraft = ref('');

const congestionStore = useCongestionStore();

/** 모달이 새로 열릴 때마다 store note 로 동기화. 같은 place 에 재진입해도 깔끔. */
watch(
  () => [props.open, props.place?.id] as const,
  ([isOpen, id]) => {
    if (!isOpen) return;
    tab.value = 'info';
    noteDraft.value = props.note ?? '';
    // 부모(TripRoutePage)가 mount 시 모든 placeId 의 congestion 을 prefetch
    // 하지만, 사용자가 search 로 새 place 를 추가하고 바로 모달을 열면 부모의
    // watch 가 아직 트리거 안 됐을 수 있음. 모달 열릴 때 한 번 더 fetch — store
    // 의 hasOwnProperty 가드가 동일 id 재호출을 자동 skip 하므로 중복 안전.
    if (typeof id === 'number') void congestionStore.fetch(id);
  },
);

const congestion = computed(() => {
  const id = props.place?.id;
  return id == null ? null : congestionStore.infoFor(id);
});

function stateLowerClass(state: CongestionState | undefined): string {
  return (state ?? 'OK').toLowerCase();
}
function stateLabel(state: CongestionState | undefined): string {
  if (state === 'PACK') return '매우혼잡';
  if (state === 'BUSY') return '혼잡';
  return '보통';
}

const heroImage = computed<string | null>(
  () => props.place?.sceneImageUrl ?? props.place?.coverImageUrl ?? null,
);

/** "방문 인증 — YYYY-MM-DD" 우측 값. visitedAt 이 ISO 가 아닐 때 fallback "기록됨". */
const visitedLabel = computed<string>(() => {
  const at = props.place?.visitedAt;
  if (!at) return '기록됨';
  const t = Date.parse(at);
  if (Number.isNaN(t)) return '기록됨';
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
});

/** 입력값이 props.note 와 달라졌는지 — 저장하기 버튼 disabled 토글에 사용. */
const noteDirty = computed<boolean>(
  () => noteDraft.value.trim() !== (props.note ?? '').trim(),
);

function onSaveNote(): void {
  const p = props.place;
  if (!p) return;
  const trimmed = noteDraft.value.trim();
  if (trimmed === (props.note ?? '').trim()) return;
  emit('save-note', { placeId: p.id, note: trimmed });
}

const { showInfo } = useToast();

/** 저장하기 버튼 핸들러 — onSaveNote 와 동일하게 emit 하되 사용자에게 명시
 *  토스트로 피드백. blur 자동 저장은 silent 인 게 자연스럽지만 명시 클릭은
 *  "저장됐어요" 안내가 있어야 의도가 반영됐다는 확신을 줌. */
async function onSaveNoteExplicit(): Promise<void> {
  if (!noteDirty.value) return;
  onSaveNote();
  await showInfo('메모를 저장했어요');
}

const router = useRouter();
const uploadStore = useUploadStore();

/**
 * 인증샷 진입 — PlaceDetailPage 의 onCapture 와 동일 패턴. uploadStore 에 캡처
 * 컨텍스트(placeId / contentId / contentTitle / sceneImageUrl) 를 채우고 /camera
 * 로 이동. 라우트 코스의 TripPlace 는 contentEpisode 를 별도로 들고 있지 않으므로
 * null 로 둔다(채점은 sceneImageUrl 기준).
 */
async function onCapture(): Promise<void> {
  const p = props.place;
  if (!p) return;
  uploadStore.beginCapture({
    placeId: p.id,
    contentId: p.contentId,
    contentTitle: p.contentTitle,
    contentEpisode: null,
    placeName: p.name,
    sceneImageUrl: p.sceneImageUrl,
  });
  emit('close');
  await router.push('/camera');
}
</script>

<style scoped>
/* Teleport 된 overlay 의 enter/leave fade — mount/unmount 가 한 프레임 분리되어
   patching race 회피. scoped 도 Transition 클래스에는 잘 적용된다. */
.rt-detail-enter-active,
.rt-detail-leave-active {
  transition: opacity 200ms ease;
}
.rt-detail-enter-from,
.rt-detail-leave-to {
  opacity: 0;
}

.rt-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: flex-end;
}
.rt-detail-sheet {
  width: 100%;
  max-height: 82vh;
  background: #ffffff;
  border-radius: 28px 28px 0 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.rt-detail-hero {
  position: relative;
  height: 200px;
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--fr-primary) 0%, #0ea5d2 100%);
  overflow: hidden;
}
.rt-detail-hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.rt-detail-hero-fallback {
  width: 100%;
  height: 100%;
}
.rt-detail-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  border: 0;
  cursor: pointer;
  color: var(--fr-ink);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.rt-detail-caption {
  position: absolute;
  left: 16px;
  bottom: 14px;
  color: #ffffff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.rt-detail-name {
  margin: 8px 0 4px;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.6px;
  line-height: 1.1;
}
.rt-detail-region {
  font-size: 12px;
  opacity: 0.92;
  font-weight: 500;
}

.rt-detail-tabs {
  display: flex;
  padding: 0 16px;
  border-bottom: 1px solid var(--fr-line-soft, #f3f4f6);
  flex-shrink: 0;
}
.rt-detail-tab {
  flex: 1;
  padding: 14px 0;
  border: 0;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: var(--fr-ink-3);
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.rt-detail-tab.is-active {
  color: var(--fr-primary);
  border-bottom-color: var(--fr-primary);
}

.rt-detail-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  /* 정보 탭 / 메모 탭 모두 같은 vertical 영역 차지 — 탭 전환 시 모달이
     높이를 바꿔 흔들리지 않도록 최소 높이 고정. info 탭의 InfoRow + CTA,
     note 탭의 textarea + 저장하기가 모두 이 안에 자연 정렬. */
  min-height: 240px;
  display: flex;
  flex-direction: column;
}
/* CTA 버튼 (인증하기) 과 저장하기 버튼은 같은 사양으로 통일 — 높이 44px,
   font 14px/800, radius 12px, gap 6px. 두 탭에서 같은 위치(하단)에 같은
   look-and-feel 로 노출되도록. */
.rt-detail-cta {
  width: 100%;
  height: 44px;
  margin-top: auto; /* flex column 안에서 하단 고정. */
  padding: 0 14px;
  border: 0;
  border-radius: 12px;
  background: var(--fr-primary);
  color: #ffffff;
  font: inherit;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  -webkit-appearance: none;
  appearance: none;
}
.rt-detail-cta:active { opacity: 0.88; }

/* ---------- 혼잡도 섹션 (정보 탭) ---------- */
.rt-detail-crowd {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--fr-line);
}
.rt-detail-crowd-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}
.rt-detail-crowd-ttl {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.rt-detail-crowd-sub {
  margin: 0 0 10px;
  font-size: 11.5px;
  color: var(--fr-ink-3);
}
.rt-detail-crowd-chips {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.rt-detail-crowd-chip {
  border: 1px solid var(--fr-line);
  border-radius: 12px;
  padding: 10px 11px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rt-detail-crowd-chip .lbl {
  font-size: 11px;
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
.rt-detail-crowd-chip .lbl .sub {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--fr-ink-4);
  opacity: 0.85;
}
.rt-detail-crowd-chip .row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  margin-top: 2px;
}
.rt-detail-crowd-chip .pct {
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
}
.rt-detail-crowd-chip .pct-unit {
  font-size: 9.5px;
  font-weight: 700;
  margin-left: 1px;
  opacity: 0.7;
}
.rt-detail-crowd-chip .state {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.rt-detail-crowd-chip .meter {
  margin-top: 4px;
  height: 4px;
  border-radius: 999px;
  background: var(--fr-bg-muted);
  overflow: hidden;
}
.rt-detail-crowd-chip .meter > i {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}

/* state 색상 — TimelineSheet / PlaceDetailPage / MapPage 와 통일. */
.rt-detail-crowd .crowd-tx-ok .pct,
.rt-detail-crowd .crowd-tx-ok .state { color: #16a34a; }
.rt-detail-crowd .crowd-tx-busy .pct,
.rt-detail-crowd .crowd-tx-busy .state { color: #f59e0b; }
.rt-detail-crowd .crowd-tx-pack .pct,
.rt-detail-crowd .crowd-tx-pack .state { color: #ef4444; }
.rt-detail-crowd .crowd-bg-ok { background: linear-gradient(90deg, #4ade80, #16a34a); }
.rt-detail-crowd .crowd-bg-busy { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.rt-detail-crowd .crowd-bg-pack { background: linear-gradient(90deg, #f87171, #ef4444); }

.rt-detail-note {
  width: 100%;
  min-height: 140px;
  /* flex column 안에서 남는 vertical 공간을 채워 메모 영역이 시원하게.
     저장하기 버튼은 margin-top: auto 로 하단 고정. */
  flex: 1;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--fr-line);
  resize: none;
  font-family: inherit;
  font-size: 14px;
  color: var(--fr-ink);
  line-height: 1.5;
  outline: 0;
  background: var(--fr-bg-muted);
}
.rt-detail-note:focus {
  border-color: var(--fr-primary);
  background: #ffffff;
}
.rt-detail-note-save {
  margin-top: 10px;
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: var(--fr-primary);
  color: #ffffff;
  font: inherit;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  -webkit-appearance: none;
  appearance: none;
}
.rt-detail-note-save:active { opacity: 0.88; }
.rt-detail-note-save:disabled {
  background: var(--fr-bg-muted);
  color: var(--fr-ink-4);
  cursor: default;
}
</style>
