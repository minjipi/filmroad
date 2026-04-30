<template>
  <!-- 82% 높이 bottom sheet — 디자인의 PlaceDetail. 사진 hero(scene/cover 우선,
       없으면 그라데이션 폴백) + 정보/내 메모 두 탭. "길찾기 시작" 은 카카오맵
       deeplink 로 바로 점프(PlaceDetailPage 의 onKakaoNavigate 와 동일 패턴).

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
              <button
                type="button"
                class="rt-detail-cta"
                data-testid="rt-detail-navigate"
                @click="onKakaoNavigate"
              >
                길찾기 시작
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
              <p class="rt-detail-note-hint">
                메모는 입력 칸에서 벗어나는 순간 자동 저장돼요.
              </p>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import FrChip from '@/components/ui/FrChip.vue';
import RoutePlaceInfoRow from './RoutePlaceInfoRow.vue';
import type { TripPlace } from '@/stores/tripRoute';

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

/** 모달이 새로 열릴 때마다 store note 로 동기화. 같은 place 에 재진입해도 깔끔. */
watch(
  () => [props.open, props.place?.id] as const,
  ([isOpen, id]) => {
    if (!isOpen) return;
    tab.value = 'info';
    noteDraft.value = props.note ?? '';
    void id;
  },
);

const heroImage = computed<string | null>(
  () => props.place?.sceneImageUrl ?? props.place?.coverImageUrl ?? null,
);

function onSaveNote(): void {
  const p = props.place;
  if (!p) return;
  const trimmed = noteDraft.value.trim();
  if (trimmed === (props.note ?? '').trim()) return;
  emit('save-note', { placeId: p.id, note: trimmed });
}

/**
 * 카카오맵 길찾기 deeplink — PlaceDetailPage 의 onKakaoNavigate 와 동일 포맷.
 * 모바일 카카오맵 앱 설치 시 앱이 catch, 미설치면 모바일/데스크톱 웹으로 폴백.
 */
function onKakaoNavigate(): void {
  const p = props.place;
  if (!p) return;
  if (typeof window === 'undefined') return;
  const name = encodeURIComponent(p.name);
  const url = `https://map.kakao.com/link/to/${name},${p.latitude},${p.longitude}`;
  window.open(url, '_blank', 'noopener');
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
}
.rt-detail-cta {
  width: 100%;
  margin-top: 16px;
  padding: 14px;
  border-radius: 14px;
  background: var(--fr-primary);
  border: 0;
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(20, 188, 237, 0.4);
}

.rt-detail-note {
  width: 100%;
  min-height: 140px;
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
.rt-detail-note-hint {
  margin: 8px 4px 0;
  font-size: 11px;
  color: var(--fr-ink-4);
}
</style>
