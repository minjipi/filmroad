<template>
  <ion-modal
    :is-open="open"
    :breakpoints="[0, 0.5, 0.95]"
    :initial-breakpoint="0.95"
    :style="modalStyle"
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
        <p v-if="items.length === 0 && !loading" class="empty-note">첫 댓글을 남겨보세요</p>
        <div v-for="c in items" :key="c.id" class="cs-item">
          <div
            class="ava"
            data-testid="cs-author"
            @click="onOpenAuthor(c.author.userId)"
          >
            <img v-if="c.author.avatarUrl" :src="c.author.avatarUrl" :alt="c.author.handle" />
          </div>
          <div class="body">
            <div class="row">
              <span
                class="handle"
                data-testid="cs-author-handle"
                @click="onOpenAuthor(c.author.userId)"
              >{{ c.author.handle }}</span>
              <ion-icon v-if="c.author.verified" :icon="checkmarkCircle" class="ic-16 verify" />
              <span class="time">{{ formatRelativeTime(c.createdAt) }}</span>
            </div>
            <div class="content">{{ c.content }}</div>
            <button
              v-if="c.imageUrl"
              type="button"
              class="cs-attach"
              data-testid="cs-attach-thumb"
              :aria-label="`인증샷 보기 — ${c.author.handle}`"
              @click="onOpenAttach(c.imageUrl)"
            >
              <img :src="c.imageUrl" :alt="`${c.author.handle} 인증샷`" />
            </button>
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

        <div class="cs-foot-row">
          <button
            type="button"
            class="cs-attach-btn"
            data-testid="cs-attach-btn"
            :disabled="!authReady || submitting"
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
            :placeholder="authReady ? '댓글을 입력하세요...' : '로그인 후 댓글을 작성할 수 있어요'"
            :disabled="!authReady || submitting"
            enterkeyhint="send"
            @keyup.enter="onSubmit"
          />
          <button
            class="cs-send"
            type="button"
            :disabled="!authReady || !canSend || submitting"
            @click="onSubmit"
          >
            <ion-icon :icon="paperPlaneOutline" class="ic-20" />
          </button>
        </div>
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

function focusTextInput(): void {
  // 키보드 자동 호출은 OS/디바이스마다 다르게 동작하므로 강제하지 않고
  // focus() 만 위임. 비로그인 상태 등 input 이 disabled 일 땐 focus() 호출 자체가
  // 무시되므로 별도 가드 불필요.
  textInput.value?.focus();
}

// OS 키보드 / 모바일 브라우저 URL bar 가 footer 를 가리지 않도록 visualViewport
// 를 따라간다. 두 값을 노출:
//  1) keyboardOffset — innerHeight - vv.height - vv.offsetTop. .cs-foot 의
//     padding-bottom 에 더해 input 을 키보드 위로 띄운다.
//  2) sheetMaxHeight — vv.height. .cs-root 의 max-height 에 박아 layout
//     viewport 가 visual viewport 보다 길어 패널 하단이 화면 밖으로 잘리는
//     케이스(iOS Safari URL bar 등)에서 foot 이 visible 영역 안에 들어오게.
// CSS 커스텀 프로퍼티로 노출하므로 scoped style 에서 그대로 받아 쓴다.
const keyboardOffset = ref(0);
const sheetMaxHeight = ref<string>('100%');

function recomputeKeyboardOffset(): void {
  if (typeof window === 'undefined') return;
  const vv = window.visualViewport;
  if (!vv) {
    keyboardOffset.value = 0;
    sheetMaxHeight.value = '100%';
    return;
  }
  // pinch-zoom 케이스에서 visualViewport 가 위로 올라가 있을 수 있어 offsetTop
  // 도 차감 — 그냥 innerHeight - height 로만 잡으면 zoom 상황에서 오버보정.
  const diff = window.innerHeight - vv.height - vv.offsetTop;
  keyboardOffset.value = Math.max(0, Math.round(diff));
  sheetMaxHeight.value = `${Math.round(vv.height)}px`;
}

const rootStyle = computed<Record<string, string>>(() => ({
  '--cs-keyboard-offset': `${keyboardOffset.value}px`,
  '--cs-sheet-max-height': sheetMaxHeight.value,
}));

// ion-modal 호스트의 --height / --max-height 를 visual viewport 높이로 묶는다.
// sheet 모드는 패널 높이를 layout viewport (`100%` = innerHeight) 기준으로
// 잡기 때문에, layout > visual 인 모바일 브라우저(URL bar 가시 시 iOS Safari,
// Android Chrome 등) 에서는 패널 하단(=foot 위치) 이 visible 영역 밖으로
// 떨어진다. 호스트의 --height 를 visualViewport.height 로 강제해서 패널
// 자체가 visible 영역 안에 들어오게 한다.
const modalStyle = computed<Record<string, string>>(() => ({
  '--height': sheetMaxHeight.value,
  '--max-height': sheetMaxHeight.value,
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
    const created = await commentStore.create(
      props.photoId,
      text,
      attachFile.value ?? undefined,
    );
    if (!created) {
      const err = commentStore.errorFor(props.photoId);
      if (err) await showError(err);
      return;
    }
    draft.value = '';
    attachFile.value = null;
    revokePreview();
    emit('created');
  } finally {
    submitting.value = false;
  }
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
      sheetMaxHeight.value = '100%';
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
  /* layout viewport 가 visual viewport 보다 길 때(iOS Safari address bar
     visible, Android Chrome 등) ion-modal 패널의 하단이 화면 밖으로 잘리고
     foot 이 보이지 않는 문제를 막는다. JS 가 visualViewport.height 를
     --cs-sheet-max-height 로 박아 .cs-root 가 visible 영역까지로 줄어들면
     foot 이 자동으로 visible bottom 위에 붙는다. visualViewport 미지원
     환경은 100% 폴백으로 기존 동작 유지. */
  max-height: var(--cs-sheet-max-height, 100%);
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
