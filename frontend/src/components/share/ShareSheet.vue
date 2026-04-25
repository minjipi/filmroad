<template>
  <Teleport to="body">
    <Transition name="backdrop-fade">
      <div
        v-if="open"
        class="ss-backdrop"
        data-testid="share-sheet-backdrop"
        @click="onClose"
      />
    </Transition>
    <Transition name="sheet-slide">
      <div
        v-if="open"
        class="ss-sheet"
        role="dialog"
        aria-label="공유하기"
        data-testid="share-sheet"
      >
        <header class="ss-head">
          <span class="ss-grip" aria-hidden="true" />
          <h2>공유하기</h2>
        </header>

        <div class="ss-body">
          <button
            type="button"
            class="ss-row kakao"
            data-testid="share-kakao"
            @click="onKakao"
          >
            <span class="ss-ico kakao-ico">
              <ion-icon :icon="chatbubbleEllipses" class="ic-22" />
            </span>
            <span class="ss-label">카카오톡</span>
          </button>

          <button
            type="button"
            class="ss-row"
            data-testid="share-copy"
            @click="onCopy"
          >
            <span class="ss-ico">
              <ion-icon :icon="linkOutline" class="ic-22" />
            </span>
            <span class="ss-label">링크 복사</span>
          </button>

          <button
            type="button"
            class="ss-row"
            data-testid="share-system"
            @click="onSystem"
          >
            <span class="ss-ico">
              <ion-icon :icon="shareOutline" class="ic-22" />
            </span>
            <span class="ss-label">다른 앱으로</span>
          </button>
        </div>

        <button
          type="button"
          class="ss-cancel"
          data-testid="share-cancel"
          @click="onClose"
        >
          취소
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import {
  chatbubbleEllipses,
  linkOutline,
  shareOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';
import { useShare } from '@/composables/useShare';

const uiStore = useUiStore();
const { shareSheetOpen, shareData } = storeToRefs(uiStore);
const { shareToKakao, copyLink, shareSystem } = useShare();

const open = computed(() => shareSheetOpen.value);

function onClose(): void {
  uiStore.closeShareSheet();
}

// 각 채널 핸들러는 시트를 먼저 닫고 → 백그라운드로 채널 동작 호출.
// 카카오톡은 외부 앱으로 빠지고, 시스템 공유는 OS 시트가 뜨고, 복사는
// 토스트로 끝나서 — 시트가 떠 있는 채로 두면 다 가려진다.
async function onKakao(): Promise<void> {
  const data = shareData.value;
  uiStore.closeShareSheet();
  if (data) await shareToKakao(data);
}

async function onCopy(): Promise<void> {
  const data = shareData.value;
  uiStore.closeShareSheet();
  if (data) await copyLink(data.url);
}

async function onSystem(): Promise<void> {
  const data = shareData.value;
  uiStore.closeShareSheet();
  if (data) await shareSystem(data);
}
</script>

<style scoped>
.ss-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(15, 23, 42, 0.5);
}

.ss-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
  background: #ffffff;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 8px 16px calc(20px + env(safe-area-inset-bottom));
  box-shadow: 0 -12px 32px rgba(15, 23, 42, 0.18);
}

.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
}
.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}
.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 0.2s ease;
}

.ss-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0 12px;
}
.ss-grip {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--fr-line);
  margin-bottom: 12px;
}
.ss-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fr-ink-3);
}

.ss-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.ss-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  height: 56px;
  padding: 0 12px;
  border: none;
  border-radius: 14px;
  background: transparent;
  cursor: pointer;
  transition: background 0.12s ease;
}
.ss-row:hover,
.ss-row:active {
  background: var(--fr-bg-muted);
}

.ss-ico {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--fr-bg-muted);
  color: var(--fr-ink);
}
/* 카카오톡 브랜드 컬러 — 인지 잘 되는 노랑 + 어두운 말풍선 색. */
.ss-row.kakao .kakao-ico {
  background: #FEE500;
  color: #3A1D1D;
}

.ss-label {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}

.ss-cancel {
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 14px;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  font: inherit;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
  cursor: pointer;
}
</style>
