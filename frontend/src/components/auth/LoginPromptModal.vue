<template>
  <ion-modal
    :is-open="open"
    :initial-breakpoint="0.6"
    :breakpoints="[0, 0.6]"
    handle="true"
    @did-dismiss="onDismiss"
  >
    <div class="lp-sheet">
      <div class="lp-header">
        <div class="lp-icon">
          <ion-icon :icon="lockClosedOutline" class="ic-28" />
        </div>
        <h2>로그인이 필요해요</h2>
        <p v-if="reason">{{ reason }}</p>
        <p v-else>좋아요·저장·인증샷 업로드 등은 로그인 후 이용할 수 있어요.</p>
      </div>

      <div class="lp-actions">
        <button class="lp-btn google" type="button" @click="onGoogle">
          <ion-icon :icon="logoGoogle" class="ic-20" />Google로 계속하기
        </button>
        <button class="lp-btn kakao" type="button" @click="onKakao">
          <ion-icon :icon="chatbubbleOutline" class="ic-20" />카카오로 계속하기
        </button>
        <button class="lp-btn cancel" type="button" @click="onClose">
          다음에 하기
        </button>
      </div>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonModal, IonIcon } from '@ionic/vue';
import { logoGoogle, chatbubbleOutline, lockClosedOutline } from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';

const uiStore = useUiStore();
const { loginPromptOpen, loginPromptReason } = storeToRefs(uiStore);

const open = computed(() => loginPromptOpen.value);
const reason = computed(() => loginPromptReason.value);

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
}

function onGoogle(): void {
  window.location.href = `${apiBase()}/oauth2/authorization/google`;
}

function onKakao(): void {
  window.location.href = `${apiBase()}/oauth2/authorization/kakao`;
}

function onClose(): void {
  uiStore.closeLoginPrompt();
}

function onDismiss(): void {
  if (loginPromptOpen.value) {
    uiStore.closeLoginPrompt();
  }
}
</script>

<style scoped>
.lp-sheet {
  padding: 28px 24px calc(28px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.lp-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.lp-icon {
  width: 52px; height: 52px;
  border-radius: 16px;
  background: var(--fr-primary-soft);
  color: var(--fr-primary);
  display: flex; align-items: center; justify-content: center;
}
.lp-header h2 {
  font-size: 20px; font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--fr-ink);
}
.lp-header p {
  font-size: 13px;
  color: var(--fr-ink-3);
  line-height: 1.5;
  margin: 0;
  white-space: pre-line;
}
.lp-actions {
  display: flex; flex-direction: column; gap: 10px;
}
.lp-btn {
  height: 50px;
  border-radius: 14px;
  border: none;
  font-size: 14.5px; font-weight: 800;
  letter-spacing: -0.01em;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: pointer;
}
.lp-btn.google { background: #ffffff; color: #0f172a; border: 1px solid var(--fr-line); }
.lp-btn.kakao { background: #FEE500; color: #191919; }
.lp-btn.cancel {
  background: transparent;
  color: var(--fr-ink-3);
  border: 1px solid var(--fr-line);
}
</style>
