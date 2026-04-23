<template>
  <ion-modal
    :is-open="open"
    :breakpoints="[0, 0.5, 0.95]"
    :initial-breakpoint="0.7"
    handle-behavior="cycle"
    @did-dismiss="onDismiss"
  >
    <div class="cs-root">
      <header class="cs-head">
        <div class="title">댓글 {{ items.length }}</div>
        <button type="button" aria-label="close" class="close" @click="close">
          <ion-icon :icon="closeOutline" class="ic-22" />
        </button>
      </header>

      <div class="cs-body no-scrollbar">
        <p v-if="items.length === 0 && !loading" class="empty-note">첫 댓글을 남겨보세요</p>
        <div v-for="c in items" :key="c.id" class="cs-item">
          <div class="ava">
            <img v-if="c.author.avatarUrl" :src="c.author.avatarUrl" :alt="c.author.handle" />
          </div>
          <div class="body">
            <div class="row">
              <span class="handle">{{ c.author.handle }}</span>
              <ion-icon v-if="c.author.verified" :icon="checkmarkCircle" class="ic-16 verify" />
              <span class="time">{{ formatRelativeTime(c.createdAt) }}</span>
            </div>
            <div class="content">{{ c.content }}</div>
          </div>
          <button
            v-if="isOwn(c)"
            class="del"
            type="button"
            aria-label="delete"
            @click="onDelete(c)"
          >
            <ion-icon :icon="trashOutline" class="ic-16" />
          </button>
        </div>

        <button
          v-if="hasMore"
          class="load-more"
          type="button"
          :disabled="loading"
          @click="onLoadMore"
        >더 보기</button>
      </div>

      <footer class="cs-foot">
        <input
          v-model="draft"
          class="cs-input"
          type="text"
          :placeholder="authReady ? '댓글을 입력하세요...' : '로그인 후 댓글을 작성할 수 있어요'"
          :disabled="!authReady"
          enterkeyhint="send"
          @keyup.enter="onSubmit"
        />
        <button
          class="cs-send"
          type="button"
          :disabled="!authReady || draft.trim().length === 0"
          @click="onSubmit"
        >
          <ion-icon :icon="paperPlaneOutline" class="ic-20" />
        </button>
      </footer>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonModal, IonIcon } from '@ionic/vue';
import {
  closeOutline,
  checkmarkCircle,
  trashOutline,
  paperPlaneOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useCommentStore, type Comment } from '@/stores/comment';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { formatRelativeTime } from '@/utils/formatRelativeTime';

const props = defineProps<{ photoId: number | null; open: boolean }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created'): void;
}>();

const commentStore = useCommentStore();
const authStore = useAuthStore();
const { user } = storeToRefs(authStore);
const { showError } = useToast();

const draft = ref('');

const items = computed<Comment[]>(() =>
  props.photoId != null ? commentStore.itemsFor(props.photoId) : [],
);
const hasMore = computed<boolean>(() =>
  props.photoId != null ? commentStore.hasMoreFor(props.photoId) : false,
);
const loading = computed<boolean>(() =>
  props.photoId != null ? commentStore.loadingFor(props.photoId) : false,
);
const authReady = computed<boolean>(() => user.value !== null);

function isOwn(c: Comment): boolean {
  return user.value !== null && c.author.userId === user.value.id;
}

function close(): void {
  emit('close');
}

function onDismiss(): void {
  if (props.open) emit('close');
}

async function onLoadMore(): Promise<void> {
  if (props.photoId == null) return;
  await commentStore.loadMore(props.photoId);
  const err = commentStore.errorFor(props.photoId);
  if (err) await showError(err);
}

async function onSubmit(): Promise<void> {
  if (props.photoId == null) return;
  const text = draft.value.trim();
  if (text.length === 0) return;
  const created = await commentStore.create(props.photoId, text);
  if (!created) {
    const err = commentStore.errorFor(props.photoId);
    if (err) await showError(err);
    return;
  }
  draft.value = '';
  emit('created');
}

async function onDelete(c: Comment): Promise<void> {
  if (props.photoId == null) return;
  const ok = await commentStore.remove(c.id, props.photoId);
  if (!ok) {
    const err = commentStore.errorFor(props.photoId);
    if (err) await showError(err);
  }
}

watch(
  () => [props.open, props.photoId] as const,
  async ([isOpen, id]) => {
    if (isOpen && typeof id === 'number') {
      await commentStore.fetch(id);
      const err = commentStore.errorFor(id);
      if (err) await showError(err);
    } else if (!isOpen) {
      draft.value = '';
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.cs-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
}

.cs-head {
  padding: 14px 20px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--fr-line);
}
.cs-head .title {
  font-size: 15px;
  font-weight: 800;
  color: var(--fr-ink);
  letter-spacing: -0.02em;
}
.cs-head .close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--fr-ink-3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.cs-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cs-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.ava {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--fr-bg-muted);
}
.ava img { width: 100%; height: 100%; object-fit: cover; display: block; }

.cs-item .body { flex: 1; min-width: 0; }
.cs-item .row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.cs-item .handle {
  font-weight: 800;
  color: var(--fr-ink);
  letter-spacing: -0.02em;
}
.cs-item .verify { color: var(--fr-primary); }
.cs-item .time {
  font-size: 11px;
  color: var(--fr-ink-4);
  margin-left: auto;
}
.cs-item .content {
  margin-top: 3px;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--fr-ink-2);
  letter-spacing: -0.01em;
  word-break: break-word;
}
.cs-item .del {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--fr-ink-4);
  padding: 4px;
  cursor: pointer;
}

.empty-note {
  padding: 40px 8px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}
.load-more {
  padding: 10px;
  background: transparent;
  border: none;
  color: var(--fr-primary);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.load-more[disabled] { opacity: 0.5; cursor: default; }

.cs-foot {
  border-top: 1px solid var(--fr-line);
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
}
.cs-input {
  flex: 1;
  height: 40px;
  background: var(--fr-bg-muted);
  border-radius: 12px;
  border: none;
  outline: none;
  padding: 0 14px;
  font: inherit;
  font-size: 14px;
  color: var(--fr-ink);
}
.cs-input::placeholder { color: var(--fr-ink-3); }
.cs-input[disabled] { opacity: 0.6; }
.cs-send {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--fr-primary);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.cs-send[disabled] { opacity: 0.4; cursor: default; }
</style>
