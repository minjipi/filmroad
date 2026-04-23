<template>
  <ion-modal
    :is-open="open"
    :initial-breakpoint="0.55"
    :breakpoints="[0, 0.55]"
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
        <button class="lp-btn primary" type="button" @click="onStart">
          시작하기
        </button>
        <button class="lp-btn email" type="button" @click="onEmail">
          이메일로 로그인 / 가입
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
import { lockClosedOutline } from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useUiStore } from '@/stores/ui';

const uiStore = useUiStore();
const router = useRouter();
const { loginPromptOpen, loginPromptReason } = storeToRefs(uiStore);

const open = computed(() => loginPromptOpen.value);
const reason = computed(() => loginPromptReason.value);

// All gated-action triggers now funnel users through /onboarding (the central
// auth hub), where Google/Kakao OAuth and email signup/login are offered side
// by side. The dedicated email flow lives at /email-auth for a direct jump.
async function onStart(): Promise<void> {
  uiStore.closeLoginPrompt();
  await router.push('/onboarding');
}

async function onEmail(): Promise<void> {
  uiStore.closeLoginPrompt();
  await router.push('/email-auth');
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
.lp-btn.primary {
  background: var(--fr-primary);
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(20, 188, 237, 0.35);
}
.lp-btn.email {
  background: #ffffff;
  color: var(--fr-ink);
  border: 1px solid var(--fr-line);
}
.lp-btn.cancel {
  background: transparent;
  color: var(--fr-ink-3);
  border: 1px solid var(--fr-line);
}
</style>
