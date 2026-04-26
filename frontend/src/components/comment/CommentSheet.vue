<template>
  <!--
    Sheet sizing 메모: 5% top 갭은 디자인 요구사항. 이전엔 breakpoint=0.95 로
    표현했는데, 이 모드는 panel 을 100% 높이로 잡되 5% 만큼 아래로 슬라이드해
    숨기는 방식이라 panel 의 하단 5% (= footer) 가 viewport 밖으로 떨어졌다.
    initial-breakpoint=1 + --height:95% 조합으로 panel 자체를 viewport 의 95%
    로 만들어, breakpoint 1 에서 panel 전체가 viewport 안에 들어오게 했다.
  -->
  <ion-modal
    :is-open="open"
    :breakpoints="[0, 0.5, 1]"
    :initial-breakpoint="1"
    style="--height: 95%; --max-height: 95%;"
    handle-behavior="cycle"
    @did-dismiss="onDismiss"
    @did-present="onDidPresent"
  >
    <div class="cs-root" :style="rootStyle">
      <header class="cs-head">
        <div class="title">댓글 {{ items.length }}</div>
        <button type="button" aria-label="close" class="close" @click="close">
          <ion-icon :icon="closeOutline" class="ic-22" />
        </button>
      </header>

      <div class="cs-body no-scrollbar">
        <p v-if="parentComments.length === 0 && !loading" class="empty-note">첫 댓글을 남겨보세요</p>

        <!--
          댓글 + 답글 — 평면 items 배열을 parent / replies 로 분류해 부모를
          순회하며 답글을 인접하게 렌더. 답글은 "답글 N개 보기" 토글로 펴고
          접을 수 있고, 깊이는 1 (Instagram / KakaoTalk 패턴) 이라 답글의 답글
          은 없다 (백엔드에서도 거부).
        -->
        <template v-for="parent in parentComments" :key="parent.id">
          <div class="cs-item" data-testid="sd-comment">
            <div
              class="ava"
              data-testid="cs-author"
              @click="onOpenAuthor(parent.author.userId)"
            >
              <img v-if="parent.author.avatarUrl" :src="parent.author.avatarUrl" :alt="parent.author.handle" />
            </div>
            <div class="body">
              <div class="row">
                <span
                  class="handle"
                  data-testid="cs-author-handle"
                  @click="onOpenAuthor(parent.author.userId)"
                >{{ parent.author.handle }}</span>
                <ion-icon v-if="parent.author.verified" :icon="checkmarkCircle" class="ic-16 verify" />
                <span class="time">{{ formatRelativeTime(parent.createdAt) }}</span>
              </div>
              <div class="content">{{ parent.content }}</div>
              <button
                v-if="parent.imageUrl"
                type="button"
                class="cs-attach"
                data-testid="cs-attach-thumb"
                :aria-label="`인증샷 보기 — ${parent.author.handle}`"
                @click="onOpenAttach(parent.imageUrl)"
              >
                <img :src="parent.imageUrl" :alt="`${parent.author.handle} 인증샷`" />
              </button>
              <div class="act-row">
                <button
                  type="button"
                  class="reply-btn"
                  data-testid="cs-reply-btn"
                  :disabled="!authReady"
                  @click="onStartReply(parent)"
                >답글 달기</button>
              </div>
              <button
                v-if="repliesFor(parent.id).length > 0"
                type="button"
                class="toggle-replies"
                data-testid="cs-toggle-replies"
                @click="toggleReplies(parent.id)"
              >── 답글 {{ repliesFor(parent.id).length }}개 {{ isExpanded(parent.id) ? '숨기기' : '보기' }}</button>
            </div>
            <button
              v-if="isOwn(parent)"
              class="del"
              type="button"
              aria-label="delete"
              @click="onDelete(parent)"
            >
              <ion-icon :icon="trashOutline" class="ic-16" />
            </button>
          </div>

          <div
            v-for="r in (isExpanded(parent.id) ? repliesFor(parent.id) : [])"
            :key="r.id"
            class="cs-item is-reply"
            data-testid="sd-comment"
          >
            <div
              class="ava"
              data-testid="cs-author"
              @click="onOpenAuthor(r.author.userId)"
            >
              <img v-if="r.author.avatarUrl" :src="r.author.avatarUrl" :alt="r.author.handle" />
            </div>
            <div class="body">
              <div class="row">
                <span
                  class="handle"
                  data-testid="cs-author-handle"
                  @click="onOpenAuthor(r.author.userId)"
                >{{ r.author.handle }}</span>
                <ion-icon v-if="r.author.verified" :icon="checkmarkCircle" class="ic-16 verify" />
                <span class="time">{{ formatRelativeTime(r.createdAt) }}</span>
              </div>
              <div class="content">{{ r.content }}</div>
              <button
                v-if="r.imageUrl"
                type="button"
                class="cs-attach"
                data-testid="cs-attach-thumb"
                :aria-label="`인증샷 보기 — ${r.author.handle}`"
                @click="onOpenAttach(r.imageUrl)"
              >
                <img :src="r.imageUrl" :alt="`${r.author.handle} 인증샷`" />
              </button>
              <!-- 답글의 답글은 깊이 정책상 불가 — 버튼 노출 안 함. -->
            </div>
            <button
              v-if="isOwn(r)"
              class="del"
              type="button"
              aria-label="delete"
              @click="onDelete(r)"
            >
              <ion-icon :icon="trashOutline" class="ic-16" />
            </button>
          </div>
        </template>

        <button
          v-if="hasMore"
          class="load-more"
          type="button"
          :disabled="loading"
          @click="onLoadMore"
        >더 보기</button>
      </div>

      <footer class="cs-foot">
        <!--
          답글 모드 컨텍스트 배너. 사용자가 "답글 달기" 를 누른 시점부터
          전송/취소 전까지 노출. input 자체는 그대로 두고 (placeholder 도
          유지) 컨텍스트만 별도 행으로 보여준다 — Instagram 의 @prefix 자동
          삽입보다 명시적이라 실수로 답글이 일반 댓글로 가지 않는다.
        -->
        <div v-if="replyTarget" class="cs-reply-banner" data-testid="cs-reply-banner">
          <span class="cs-reply-text">
            <b>{{ replyTarget.handle }}</b>에게 답글 작성 중
          </span>
          <button
            type="button"
            class="cs-reply-cancel"
            data-testid="cs-reply-cancel"
            aria-label="답글 취소"
            @click="onCancelReply"
          >
            <ion-icon :icon="closeOutline" class="ic-16" />
          </button>
        </div>

        <!--
          첨부 프리뷰: input 위에 행으로 노출. 첨부가 없으면 통째로 숨겨서
          기본 푸터 높이가 변하지 않게 한다(키보드 인터랙션 깨지면 안 됨).
        -->
        <div v-if="attachPreview" class="cs-attach-preview" data-testid="cs-attach-preview">
          <img :src="attachPreview" alt="attach preview" />
          <button
            type="button"
            class="cs-attach-clear"
            data-testid="cs-attach-clear"
            aria-label="첨부 취소"
            @click="onClearAttach"
          >
            <ion-icon :icon="closeOutline" class="ic-16" />
          </button>
        </div>

        <div v-if="authReady" class="cs-foot-row">
          <button
            type="button"
            class="cs-attach-btn"
            data-testid="cs-attach-btn"
            :disabled="submitting"
            aria-label="이미지 첨부"
            @click="onPickImage"
          >
            <ion-icon :icon="imageOutline" class="ic-22" />
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="cs-file-input"
            data-testid="cs-file-input"
            @change="onFilePicked"
          />
          <input
            ref="textInput"
            v-model="draft"
            class="cs-input"
            type="text"
            placeholder="댓글을 입력하세요..."
            :disabled="submitting"
            enterkeyhint="send"
            @keyup.enter="onSubmit"
          />
          <button
            class="cs-send"
            type="button"
            :disabled="!canSend || submitting"
            @click="onSubmit"
          >
            <ion-icon :icon="paperPlaneOutline" class="ic-20" />
          </button>
        </div>
        <button
          v-else
          type="button"
          class="cs-foot-login"
          data-testid="cs-login-cta"
          @click="onGoLogin"
        >로그인 후 댓글을 작성할 수 있어요</button>
      </footer>
    </div>
  </ion-modal>

  <!--
    첨부 이미지 풀스크린 뷰어. 별도 라우트 없이 같은 컴포넌트에서 ion-modal
    하나 더 띄우는 패턴(UploadPage 의 picker 처럼). 백드롭 탭으로 닫힌다.
  -->
  <ion-modal
    :is-open="viewerSrc !== null"
    @did-dismiss="onCloseViewer"
  >
    <div
      v-if="viewerSrc"
      class="cs-viewer"
      role="dialog"
      aria-label="인증샷 보기"
      @click.self="onCloseViewer"
    >
      <button
        type="button"
        class="cs-viewer-close"
        aria-label="닫기"
        data-testid="cs-viewer-close"
        @click="onCloseViewer"
      >
        <ion-icon :icon="closeOutline" class="ic-22" />
      </button>
      <img :src="viewerSrc" alt="인증샷 원본" />
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IonModal, IonIcon } from '@ionic/vue';
import {
  closeOutline,
  checkmarkCircle,
  trashOutline,
  paperPlaneOutline,
  imageOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
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
const attachFile = ref<File | null>(null);
const attachPreview = ref<string | null>(null);
const submitting = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const textInput = ref<HTMLInputElement | null>(null);
const viewerSrc = ref<string | null>(null);
// 답글 컨텍스트 — 사용자가 "답글 달기" 를 누른 댓글의 id + handle. null 이면 일반 댓글.
const replyTarget = ref<{ id: number; handle: string } | null>(null);
// 어떤 부모 댓글의 답글 리스트가 펼쳐져 있는지. Set 자체는 Vue 가 deep 추적
// 하지만 add/delete 만으론 trigger 가 안 잡히는 케이스가 있어 매번 새 Set 으로
// 교체한다.
const expandedParents = ref<Set<number>>(new Set());

function focusTextInput(): void {
  // 키보드 자동 호출은 OS/디바이스마다 다르게 동작하므로 강제하지 않고
  // focus() 만 위임. 비로그인 상태 등 input 이 disabled 일 땐 focus() 호출 자체가
  // 무시되므로 별도 가드 불필요.
  textInput.value?.focus();
}

// OS 키보드가 input 을 가리지 않도록 visualViewport 로 보정한 키보드 높이를
// CSS 커스텀 프로퍼티로 노출. .cs-foot padding-bottom 에 더해 input 이 키보드
// 위로 떠 있게 한다. 이전 버전은 ion-modal --height 까지 vv.height 로 강제했는데,
// breakpoint 0.95 와 곱해지며 cs-root 가 visible 영역보다 길어져 foot 이 화면
// 밖으로 잘리는 부작용 — Ionic native sheet sizing 에 맡기는 게 안전.
const keyboardOffset = ref(0);

function recomputeKeyboardOffset(): void {
  if (typeof window === 'undefined') return;
  const vv = window.visualViewport;
  if (!vv) {
    keyboardOffset.value = 0;
    return;
  }
  // pinch-zoom 케이스에서 visualViewport 가 위로 올라가 있을 수 있어 offsetTop
  // 도 차감 — 그냥 innerHeight - height 로만 잡으면 zoom 상황에서 오버보정.
  const diff = window.innerHeight - vv.height - vv.offsetTop;
  keyboardOffset.value = Math.max(0, Math.round(diff));
}

const rootStyle = computed<Record<string, string>>(() => ({
  '--cs-keyboard-offset': `${keyboardOffset.value}px`,
}));

function onViewportChange(): void {
  recomputeKeyboardOffset();
}

onMounted(() => {
  if (typeof window === 'undefined') return;
  const vv = window.visualViewport;
  if (!vv) return;
  vv.addEventListener('resize', onViewportChange);
  vv.addEventListener('scroll', onViewportChange);
  recomputeKeyboardOffset();
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return;
  const vv = window.visualViewport;
  if (!vv) return;
  vv.removeEventListener('resize', onViewportChange);
  vv.removeEventListener('scroll', onViewportChange);
});

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_ATTACH_BYTES = 10 * 1024 * 1024;

// Pinia getter 가 함수를 리턴하는 패턴(`itemsFor(id)`)은 외부 closure 가
// state.commentsByPhoto[id] 를 한 번만 capture 하면서 반응성이 끊기는 케이스가
// 있다 (실제로 modal 첫 mount 시 items 가 [] 로 머무르는 회귀가 있었음).
// store 의 reactive state 객체에 직접 access 하면 Vue 의 proxy tracking 이
// computed 안에서 바로 잡혀서 안전하다. 동작은 동일.
const items = computed<Comment[]>(() => {
  if (props.photoId == null) return [];
  return commentStore.commentsByPhoto[props.photoId]?.items ?? [];
});

// 평면 items 를 부모 / 답글로 분리. 한 번 계산해서 부모 순회 + 답글 lookup
// 양쪽에 재사용. items 가 바뀌면 자동 재계산.
const parentComments = computed<Comment[]>(() =>
  items.value.filter((c) => c.parentId == null),
);
const repliesByParent = computed<Map<number, Comment[]>>(() => {
  const map = new Map<number, Comment[]>();
  for (const c of items.value) {
    if (c.parentId == null) continue;
    const arr = map.get(c.parentId) ?? [];
    arr.push(c);
    map.set(c.parentId, arr);
  }
  return map;
});

function repliesFor(parentId: number): Comment[] {
  return repliesByParent.value.get(parentId) ?? [];
}
function isExpanded(parentId: number): boolean {
  return expandedParents.value.has(parentId);
}
function toggleReplies(parentId: number): void {
  const next = new Set(expandedParents.value);
  if (next.has(parentId)) next.delete(parentId);
  else next.add(parentId);
  expandedParents.value = next;
}
const hasMore = computed<boolean>(() => {
  if (props.photoId == null) return false;
  return commentStore.commentsByPhoto[props.photoId]?.hasMore ?? false;
});
const loading = computed<boolean>(() => {
  if (props.photoId == null) return false;
  return commentStore.commentsByPhoto[props.photoId]?.loading ?? false;
});
const authReady = computed<boolean>(() => user.value !== null);
// 텍스트가 있을 때만 전송 가능. 이미지만 첨부하고 텍스트 비어있는 케이스는
// 백엔드가 NotBlank 로 reject 하므로 클라에서도 같이 막는다.
const canSend = computed<boolean>(() => draft.value.trim().length > 0);

function isOwn(c: Comment): boolean {
  return user.value !== null && c.author.userId === user.value.id;
}

const router = useRouter();
async function onOpenAuthor(userId: number): Promise<void> {
  // sheet 가 DOM 에 남아 navigation 과 충돌하는 걸 막기 위해 먼저 close.
  emit('close');
  if (user.value?.id === userId) {
    await router.push('/profile');
    return;
  }
  await router.push(`/user/${userId}`);
}

async function onGoLogin(): Promise<void> {
  // sheet 가 DOM 에 남아 navigation 과 충돌하는 걸 막기 위해 먼저 close.
  emit('close');
  // 로그인 후 원래 보던 페이지로 돌아오도록 redirect 쿼리에 현재 경로 보존.
  // router-guard 가 requiresAuth 라우트에서 쓰는 형식과 동일.
  const redirect =
    typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
  await router.push({ path: '/onboarding', query: { redirect } });
}

function close(): void {
  emit('close');
}

function onDismiss(): void {
  if (props.open) emit('close');
}

// Real Ionic ion-modal 이 시트를 펼친 직후 호출. swiper transition 이 끝난
// 시점이라 input 이 화면 안에 있으니 그때 focus 를 준다.
function onDidPresent(): void {
  focusTextInput();
}

async function onLoadMore(): Promise<void> {
  if (props.photoId == null) return;
  await commentStore.loadMore(props.photoId);
  const err = commentStore.errorFor(props.photoId);
  if (err) await showError(err);
}

function revokePreview(): void {
  if (attachPreview.value && attachPreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(attachPreview.value);
  }
  attachPreview.value = null;
}

function onPickImage(): void {
  if (!authReady.value || submitting.value) return;
  fileInput.value?.click();
}

async function onFilePicked(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  // 같은 파일 다시 고르는 케이스 대비해서 input value 는 항상 reset.
  input.value = '';
  if (!file) return;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    await showError('jpg, png, webp 형식만 첨부할 수 있어요');
    return;
  }
  if (file.size > MAX_ATTACH_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    await showError(`이미지가 너무 커요 (${mb}MB). 10MB 이하 파일만 첨부할 수 있어요.`);
    return;
  }
  revokePreview();
  attachFile.value = file;
  attachPreview.value = URL.createObjectURL(file);
}

function onClearAttach(): void {
  attachFile.value = null;
  revokePreview();
}

async function onSubmit(): Promise<void> {
  if (props.photoId == null) return;
  if (submitting.value) return;
  const text = draft.value.trim();
  if (text.length === 0) {
    if (attachFile.value) {
      // 이미지만 첨부하고 텍스트 비운 케이스 — 백엔드는 NotBlank 로 reject 하니
      // 사용자에게 명확히 안내.
      await showError('내용을 입력해 주세요');
    }
    return;
  }
  submitting.value = true;
  try {
    const replyParentId = replyTarget.value?.id ?? null;
    const created = await commentStore.create(
      props.photoId,
      text,
      attachFile.value ?? undefined,
      replyParentId,
    );
    if (!created) {
      const err = commentStore.errorFor(props.photoId);
      if (err) await showError(err);
      return;
    }
    draft.value = '';
    attachFile.value = null;
    revokePreview();
    // 답글이 작성됐으면 사용자가 자기 답글이 어디 들어갔는지 볼 수 있게 부모를
    // 자동 펼침. 한 부모에 여러 답글을 연달아 달 수도 있으니 replyTarget 은
    // 유지하지 말고 명시적으로 비운다 (다음 답글 의도는 다시 명시해야 함).
    if (replyParentId != null) {
      const next = new Set(expandedParents.value);
      next.add(replyParentId);
      expandedParents.value = next;
    }
    replyTarget.value = null;
    emit('created');
  } finally {
    submitting.value = false;
  }
}

function onStartReply(c: Comment): void {
  if (!authReady.value) return;
  replyTarget.value = { id: c.id, handle: c.author.handle };
  // 답글 모드 진입 시 그 부모의 기존 답글들도 자동으로 펼침 — 컨텍스트 보면서
  // 작성하게.
  if (!expandedParents.value.has(c.id)) {
    const next = new Set(expandedParents.value);
    next.add(c.id);
    expandedParents.value = next;
  }
  void nextTick().then(() => focusTextInput());
}

function onCancelReply(): void {
  replyTarget.value = null;
}

async function onDelete(c: Comment): Promise<void> {
  if (props.photoId == null) return;
  const ok = await commentStore.remove(c.id, props.photoId);
  if (!ok) {
    const err = commentStore.errorFor(props.photoId);
    if (err) await showError(err);
  }
}

function onOpenAttach(src: string): void {
  viewerSrc.value = src;
}

function onCloseViewer(): void {
  viewerSrc.value = null;
}

watch(
  () => [props.open, props.photoId] as const,
  async ([isOpen, id]) => {
    if (isOpen && typeof id === 'number') {
      // 시트가 열리는 첫 프레임에 visual viewport 값을 잡아두지 않으면 sheet
      // 패널이 default 100% (layout viewport) 로 한 번 그려졌다가 늦게 줄어들어
      // 깜빡인다. 열기 직전에 한 번 동기 recompute.
      recomputeKeyboardOffset();
      await commentStore.fetch(id);
      const err = commentStore.errorFor(id);
      if (err) await showError(err);
      // Fallback focus — real Ionic ion-modal 도 did-present 에서 한 번 더
      // 잡지만, 그 이벤트가 뜨지 않는 환경(vitest stub 등)에서도 input 에
      // 포커스가 들어가도록 watch 시점에 nextTick 후 시도한다.
      await nextTick();
      focusTextInput();
    } else if (!isOpen) {
      draft.value = '';
      attachFile.value = null;
      revokePreview();
      viewerSrc.value = null;
      keyboardOffset.value = 0;
      replyTarget.value = null;
      expandedParents.value = new Set();
    }
  },
  { immediate: true },
);

// 컴포넌트 언마운트 시 blob: URL 누수 방지.
onBeforeUnmount(() => {
  revokePreview();
});
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
  flex-shrink: 0;
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
/* 인증샷 첨부 썸네일 — content 아래에 정사각 ~120px. 라운드 + 테두리로
   본문과 시각적으로 분리. 탭 시 풀스크린 viewer 띄움. */
.cs-attach {
  margin-top: 6px;
  width: 120px;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--fr-line);
  background: var(--fr-bg-muted);
  padding: 0;
  cursor: pointer;
  display: block;
}
.cs-attach img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cs-item .del {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--fr-ink-4);
  padding: 4px;
  cursor: pointer;
}

/* 답글 — 부모 아바타 폭(34px) + gap(10px) 만큼 들여쓰기. 시각적으로 부모와
   같은 컬럼에 콘텐츠가 정렬되어 트리 구조가 자연스럽게 읽힌다. */
.cs-item.is-reply { margin-left: 44px; }
.cs-item.is-reply .ava { width: 28px; height: 28px; }

.cs-item .act-row {
  margin-top: 4px;
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--fr-ink-3);
}
.cs-item .reply-btn {
  background: none;
  border: none;
  padding: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--fr-ink-3);
  letter-spacing: -0.01em;
  cursor: pointer;
}
.cs-item .reply-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.cs-item .reply-btn:hover:not(:disabled) {
  color: var(--fr-ink);
}

/* "── 답글 N개 보기" 토글 — Instagram 스타일. 좌측 작은 라인이 시각적으로
   "이 댓글 아래 자식이 있다" 를 표시한다. */
.cs-item .toggle-replies {
  margin-top: 8px;
  background: none;
  border: none;
  padding: 4px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--fr-ink-3);
  letter-spacing: -0.01em;
  cursor: pointer;
  text-align: left;
}
.cs-item .toggle-replies:hover { color: var(--fr-ink-2); }

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
  /* --cs-keyboard-offset 은 visualViewport 가 줄어들 때 컴포넌트가 채워주는
     키보드 높이. 0 이면 기존 동작과 동일. */
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom) + var(--cs-keyboard-offset, 0px));
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #ffffff;
  /* body 가 콘텐츠로 가득 찼을 때 foot 이 줄어들어 버튼/input 이 잘리는
     케이스를 막는다. body(flex:1) 가 먼저 줄어들고 foot 은 자연 높이 유지. */
  flex-shrink: 0;
}
.cs-foot-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* 비로그인 상태에서 input 행 자리에 들어가는 단일 CTA. 입력란과 같은
   라운드/높이/폰트로 disabled input 처럼 보이지만 탭하면 /onboarding 으로
   이동한다 — disabled <input> 은 클릭 자체가 안 잡혀서 명시적인 button 으로 교체. */
.cs-foot-login {
  width: 100%;
  height: 40px;
  border-radius: 999px;
  border: 1px solid var(--fr-line);
  background: var(--fr-bg-muted);
  color: var(--fr-ink-3);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
  letter-spacing: -0.01em;
}
.cs-foot-login:active { background: var(--fr-line-soft); }
/* 답글 컨텍스트 배너 — 푸터 input 위에 한 줄. 답글 모드 진입 시에만 노출. */
.cs-reply-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  background: var(--fr-bg-muted);
  border-radius: 8px;
  font-size: 12px;
  color: var(--fr-ink-2);
}
.cs-reply-banner .cs-reply-text { flex: 1; min-width: 0; }
.cs-reply-banner b {
  font-weight: 800;
  color: var(--fr-ink);
}
.cs-reply-banner .cs-reply-cancel {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--fr-ink-3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

/* 첨부 프리뷰 — 푸터 input 위 행. 썸네일 + 우상단 X. */
.cs-attach-preview {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--fr-bg-muted);
  border: 1px solid var(--fr-line);
}
.cs-attach-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cs-attach-clear {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.7);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}
.cs-attach-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.cs-attach-btn[disabled] { opacity: 0.4; cursor: default; }
.cs-file-input {
  display: none;
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
  min-width: 0;
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
  flex-shrink: 0;
}
.cs-send[disabled] { opacity: 0.4; cursor: default; }

/* 풀스크린 인증샷 뷰어 — 별도 라우트 없이 같은 sheet 위에 띄운다. */
.cs-viewer {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: env(safe-area-inset-top) 16px env(safe-area-inset-bottom);
}
.cs-viewer img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}
.cs-viewer-close {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top));
  right: 12px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1;
}
</style>
