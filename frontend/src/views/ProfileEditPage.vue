<template>
  <ion-page>
    <ion-content class="edit-content" :fullscreen="true">
      <div class="edit-root">
        <header class="edit-top">
          <button class="icon-btn" aria-label="back" type="button" @click="onCancel">
            <ion-icon :icon="chevronBack" class="ic-22" />
          </button>
          <h1>프로필 편집</h1>
          <button
            class="save-btn"
            :disabled="!canSubmit || submitting"
            type="button"
            data-testid="profile-save"
            @click="onSubmit"
          >
            {{ submitting ? '저장 중…' : '저장' }}
          </button>
        </header>

        <div class="edit-body">
          <div class="avatar-row">
            <div class="avatar">
              <img v-if="avatarPreview" :src="avatarPreview" :alt="nickname" />
              <span v-else class="avatar-fallback">{{ initial }}</span>
            </div>
          </div>

          <label class="field">
            <span class="lbl">닉네임</span>
            <input
              v-model="nickname"
              type="text"
              maxlength="120"
              placeholder="닉네임"
              data-testid="profile-nickname"
            />
            <span class="help">1~120자</span>
          </label>

          <label class="field">
            <span class="lbl">소개</span>
            <textarea
              v-model="bio"
              maxlength="300"
              rows="3"
              placeholder="자기소개를 입력해 주세요"
              data-testid="profile-bio"
            />
            <span class="help">{{ bio.length }} / 300</span>
          </label>

          <label class="field">
            <span class="lbl">프로필 이미지 URL</span>
            <input
              v-model="avatarUrl"
              type="url"
              maxlength="500"
              placeholder="https://..."
              data-testid="profile-avatar"
            />
            <span class="help">비워두면 기본 아바타가 사용돼요</span>
          </label>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import { chevronBack } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const authStore = useAuthStore();
const { showError, showInfo } = useToast();

const seed = authStore.user;
const nickname = ref(seed?.nickname ?? '');
const bio = ref(seed?.bio ?? '');
const avatarUrl = ref(seed?.avatarUrl ?? '');
const submitting = ref(false);

const avatarPreview = computed(() => (avatarUrl.value.trim() ? avatarUrl.value.trim() : null));
const initial = computed(() => (nickname.value.trim()[0] ?? '?'));

const canSubmit = computed(() => {
  if (nickname.value.trim().length === 0) return false;
  if (nickname.value.trim().length > 120) return false;
  if (bio.value.length > 300) return false;
  if (avatarUrl.value.length > 500) return false;
  return true;
});

async function onCancel(): Promise<void> {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
  } else {
    await router.replace('/profile');
  }
}

async function onSubmit(): Promise<void> {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    const ok = await authStore.updateProfile({
      nickname: nickname.value.trim(),
      bio: bio.value,
      avatarUrl: avatarUrl.value.trim(),
    });
    if (!ok) {
      await showError(authStore.error ?? '프로필을 저장하지 못했어요');
      return;
    }
    await showInfo('프로필이 저장되었어요');
    await router.replace('/profile');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.edit-content {
  --background: var(--fr-bg);
}
.edit-root {
  padding-bottom: 40px;
}
.edit-top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #ffffff;
  border-bottom: 1px solid var(--fr-line-soft);
  position: sticky;
  top: 0;
  z-index: 10;
}
.edit-top h1 {
  flex: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0;
}
.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--fr-bg-muted);
  border: none;
  color: var(--fr-ink-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.save-btn {
  min-width: 56px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  background: var(--fr-primary);
  color: #ffffff;
  font-weight: 800;
  font-size: 13px;
  border: none;
  cursor: pointer;
}
.save-btn:disabled {
  background: var(--fr-line);
  color: var(--fr-ink-4);
  cursor: default;
}
.edit-body {
  padding: 24px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.avatar-row {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}
.avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--fr-primary-soft);
  color: var(--fr-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 800;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field .lbl {
  font-size: 12px;
  font-weight: 800;
  color: var(--fr-ink-2);
  letter-spacing: -0.01em;
}
.field input,
.field textarea {
  border: 1px solid var(--fr-line);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  font-family: inherit;
  background: #ffffff;
  color: var(--fr-ink);
  resize: none;
}
.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--fr-primary);
}
.field .help {
  font-size: 11.5px;
  color: var(--fr-ink-4);
  padding-left: 4px;
}
</style>
