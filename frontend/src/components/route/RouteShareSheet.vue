<template>
  <!-- 작은 bottom sheet — "내 여행에 저장" CTA + 공유 4-grid. 디자인은 PDF 옵션이
       있지만 실제 PDF 변환 파이프가 없어 mock 단계에선 비활성/추후 표시로 둠. -->
  <div
    v-if="open"
    class="rt-share-overlay"
    role="dialog"
    aria-modal="true"
    data-testid="rt-share-overlay"
    @click.self="emit('close')"
  >
    <div class="rt-share-sheet">
      <span class="rt-grabber" aria-hidden="true" />
      <h2 class="rt-share-title">루트 저장 & 공유</h2>
      <p class="rt-share-sub">{{ name }} · {{ placeCount }}개 장소</p>

      <button
        type="button"
        class="rt-share-save-cta"
        data-testid="rt-share-save"
        @click="emit('save')"
      >
        <span class="rt-share-save-ic" aria-hidden="true">💾</span>
        <span class="rt-share-save-body">
          <span class="rt-share-save-title">내 여행에 저장</span>
          <span class="rt-share-save-sub">나중에 다시 보거나 편집할 수 있어요</span>
        </span>
        <ion-icon :icon="chevronForwardOutline" class="ic-18" />
      </button>

      <div class="rt-share-grid" data-testid="rt-share-grid">
        <button
          type="button"
          class="rt-share-action"
          data-testid="rt-share-link"
          @click="onCopyLink"
        >
          <span class="rt-share-action-ic">🔗</span>
          <span class="rt-share-action-label">링크 복사</span>
        </button>
        <button
          type="button"
          class="rt-share-action"
          data-testid="rt-share-kakao"
          @click="onShareKakao"
        >
          <span class="rt-share-action-ic">💬</span>
          <span class="rt-share-action-label">카카오톡</span>
        </button>
        <button
          type="button"
          class="rt-share-action"
          data-testid="rt-share-system"
          @click="onShareSystem"
        >
          <span class="rt-share-action-ic">📱</span>
          <span class="rt-share-action-label">시스템 공유</span>
        </button>
        <button
          type="button"
          class="rt-share-action is-disabled"
          data-testid="rt-share-pdf"
          disabled
        >
          <span class="rt-share-action-ic">⬇</span>
          <span class="rt-share-action-label">PDF (예정)</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { chevronForwardOutline } from 'ionicons/icons';
import { useShare } from '@/composables/useShare';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  open: boolean;
  name: string;
  placeCount: number;
}>();

const emit = defineEmits<{ (e: 'close'): void; (e: 'save'): void }>();

const { shareToKakao, copyLink, shareSystem } = useShare();
const { showInfo, showError } = useToast();

const shareUrl = computed<string>(() => {
  if (typeof window === 'undefined') return '';
  return window.location.href;
});

const shareDescription = computed<string>(() => `${props.placeCount}개 장소로 구성된 코스`);

async function onCopyLink(): Promise<void> {
  try {
    await copyLink(shareUrl.value);
    await showInfo('링크를 복사했어요');
  } catch {
    await showError('링크 복사에 실패했어요');
  }
}

async function onShareKakao(): Promise<void> {
  try {
    await shareToKakao({
      title: props.name,
      description: shareDescription.value,
      imageUrl: '',
      url: shareUrl.value,
    });
  } catch {
    await showError('카카오톡 공유에 실패했어요');
  }
}

async function onShareSystem(): Promise<void> {
  try {
    await shareSystem({
      title: props.name,
      description: shareDescription.value,
      imageUrl: '',
      url: shareUrl.value,
    });
  } catch {
    await showError('공유에 실패했어요');
  }
}
</script>

<style scoped>
.rt-share-overlay {
  position: fixed;
  inset: 0;
  z-index: 130;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: flex-end;
}
.rt-share-sheet {
  width: 100%;
  background: var(--fr-bg-soft, #f8fafc);
  border-radius: 28px 28px 0 0;
  padding: 16px 16px calc(env(safe-area-inset-bottom) + 24px);
}
.rt-grabber {
  display: block;
  width: 40px;
  height: 5px;
  border-radius: 999px;
  background: #e5e7eb;
  margin: 0 auto 16px;
}

.rt-share-title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 800;
  color: var(--fr-ink);
  letter-spacing: -0.4px;
}
.rt-share-sub {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--fr-ink-3);
}

.rt-share-save-cta {
  width: 100%;
  padding: 14px;
  border-radius: 16px;
  background: var(--fr-primary);
  border: 0;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(20, 188, 237, 0.3);
  margin-bottom: 10px;
}
.rt-share-save-ic {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.rt-share-save-body {
  flex: 1;
  text-align: left;
}
.rt-share-save-title {
  display: block;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.rt-share-save-sub {
  display: block;
  font-size: 12px;
  opacity: 0.85;
  margin-top: 2px;
}

.rt-share-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid var(--fr-line);
}
.rt-share-action {
  padding: 10px 4px;
  border-radius: 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-family: inherit;
}
.rt-share-action.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rt-share-action-ic {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--fr-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.rt-share-action-label {
  font-size: 11px;
  color: var(--fr-ink-2);
  font-weight: 600;
}
</style>
