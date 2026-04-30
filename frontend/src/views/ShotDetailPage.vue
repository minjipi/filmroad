<template>
  <ion-page>
    <ion-content :fullscreen="true" class="sd-content">
      <!-- task #16: .sd-top is now inside the scroll container so its
           `position: sticky` actually sticks. The wrapper is always rendered
           (loading/error/loaded) so the back/more buttons work even when the
           fetch fails. The `data-testid="sd-loaded"` slot moved one level
           inward to a dedicated wrapper that's still gated on `shot`. -->
      <div class="sd-scroll no-scrollbar">
        <header class="sd-top">
          <button type="button" class="ic-btn" aria-label="back" @click="onBack">
            <ion-icon :icon="chevronBack" class="ic-22" />
          </button>
          <!-- task #26: 우측 more 버튼 제거 — 카드별 .card-more 가 자리 대체.
               중복된 진입점 회피. 헤더는 back 만 남는 minimal 형태. -->
        </header>

        <!-- Loading placeholder — shown while the first /api/photos/:id fetch
             is in flight. Error placeholder handles 404/network failure. -->
        <div
          v-if="loading && !shot"
          class="sd-placeholder"
          data-testid="sd-loading"
        >
          불러오는 중…
        </div>
        <div
          v-else-if="!shot && error"
          class="sd-placeholder error"
          data-testid="sd-error"
        >
          {{ error }}
        </div>

        <div v-else-if="shot" class="sd-loaded" data-testid="sd-loaded">
        <!-- Primary card — /feed/detail 와 동일한 .post 마크업. 디자인 통일을
             위해 이전의 carousel / compare-toggle / inline cmt-input / comments
             preview / labeled sd-stats 는 모두 제거. 다중 이미지 게시물은
             첫 이미지만 노출됨에 주의 (multi-image 표시는 향후 별도 PR). -->
        <article class="post" data-testid="sd-primary-card">
          <div class="post-head">
            <div
              :class="['avatar', shot.author.id != null ? 'clickable' : '']"
              data-testid="sd-avatar"
              @click="onOpenAuthor"
            >
              <img
                v-if="shot.author.avatarUrl"
                :src="shot.author.avatarUrl"
                :alt="shot.author.nickname"
              />
            </div>
            <div
              :class="['meta', shot.author.id != null ? 'clickable' : '']"
              @click="onOpenAuthor"
            >
              <div class="nm" data-testid="sd-author-nickname">
                <span class="nm-text">{{ shot.author.handle }}</span>
                <ion-icon v-if="shot.author.verified" :icon="checkmarkCircle" class="ic-16 verified" />
              </div>
              <div class="loc">
                <span class="drama">{{ shot.content.title }}</span>·{{ shot.place.name }}
              </div>
            </div>
            <button
              v-if="!shot.author.isMe"
              type="button"
              :class="['author-follow', shot.author.following ? 'on' : '']"
              data-testid="sd-author-action"
              @click="onAuthorAction"
            >{{ authorActionLabel }}</button>
            <button
              type="button"
              class="more"
              aria-label="more"
              data-testid="sd-card-more"
              @click="onCardMore"
            >
              <ion-icon :icon="ellipsisHorizontal" class="ic-20" />
            </button>
          </div>

          <div class="post-image">
            <div v-if="sceneImageUrl" class="compare-wrap">
              <img :src="sceneImageUrl" class="compare-top" alt="드라마 원본 장면" />
              <img :src="shot.imageUrl" :alt="shot.place.name" />
              <div class="compare-divider" />
              <div class="compare-lbl-top">드라마 원본</div>
              <div class="compare-lbl-bot">내 인증샷</div>
              <div class="drama-badge">
                <ion-icon :icon="filmOutline" class="ic-16" />
                <template v-if="shot.content.episode">{{ shot.content.episode }}</template>
                <template v-if="shot.content.sceneTimestamp"> {{ shot.content.sceneTimestamp }}</template>
              </div>
            </div>
            <div v-else class="single-img">
              <img :src="shot.imageUrl" :alt="shot.place.name" />
              <div class="drama-badge dark">
                <ion-icon :icon="locationOutline" class="ic-16" />{{ shot.place.regionLabel }}
              </div>
            </div>
          </div>

          <div class="post-actions">
            <span
              :class="['a', shot.liked ? 'on' : '']"
              data-testid="sd-like-btn"
              @click="onToggleLike"
            >
              <ion-icon :icon="shot.liked ? heart : heartOutline" class="ic-22" />
              {{ formatCount(shot.likeCount) }}
            </span>
            <span class="a" @click="onOpenComments">
              <ion-icon :icon="chatbubbleOutline" class="ic-22" />
              {{ formatCount(shot.commentCount) }}
            </span>
            <span class="a" data-testid="feed-share" @click="onShare">
              <ion-icon :icon="paperPlaneOutline" class="ic-22" />
            </span>
            <span class="spacer" />
            <span
              class="a"
              data-testid="sd-save-btn"
              @click="onToggleBookmark"
            >
              <ion-icon :icon="placeSaved ? bookmark : bookmarkOutline" class="ic-22" />
            </span>
          </div>

          <div class="post-caption">
            <div v-if="shot.caption" class="caption-text">
              <b>{{ shot.author.handle }}</b> {{ shot.caption }}
            </div>
          </div>
          <div class="post-time">{{ takenAtFullLabel }}</div>
        </article>

        <!-- task #17: 무한 스크롤 피드 — 추가 카드는 primary shot 과 동일한
             5-section 구조 (compare → sd-user → sd-stats → sd-caption →
             cmt-input). primary 와 같은 CSS 클래스를 그대로 사용해 시각 일관.
             데이터는 FeedPost (필드 이름이 ShotDetail 과 살짝 다르므로 카드별
             바인딩 조정). 좋아요/저장/팔로우/댓글 버튼은 read-only 표시
             (disabled) — primary 만 인터랙티브 (task #17 재량 결정).
             내부 testid 는 primary 와 충돌하지 않도록 외곽 sd-feed-card 만
             부여, 셀렉터 스코프는 querySelectorAll 또는 카드별 .find 로. -->
        <section
          v-if="appendedShots.length > 0"
          class="sd-feed"
          data-testid="sd-feed"
        >
          <!-- /feed/detail 와 동일한 카드 마크업 (디자인 통일). primary 카드는
               carousel + inline cmt-input + sticky compare-toggle 같은 detail
               화면 정체성이 있어 그대로 유지하고, append 되는 피드만 통일 톤. -->
          <article
            v-for="s in appendedShots"
            :key="s.id"
            class="post"
            data-testid="sd-feed-card"
          >
            <div class="post-head">
              <div class="avatar clickable" @click="onOpenAppendedAuthor(s)">
                <img
                  v-if="s.author.avatarUrl"
                  :src="s.author.avatarUrl"
                  :alt="s.author.nickname"
                />
              </div>
              <div class="meta clickable" @click="onOpenAppendedAuthor(s)">
                <div class="nm">
                  <span class="nm-text">{{ s.author.handle }}</span>
                  <ion-icon v-if="s.author.verified" :icon="checkmarkCircle" class="ic-16 verified" />
                </div>
                <div class="loc">
                  <span class="drama">{{ s.content.title }}</span>·{{ s.place.name }}
                </div>
              </div>
              <button
                v-if="!isAppendedOwn(s)"
                type="button"
                :class="['author-follow', s.author.following ? 'on' : '']"
                @click="onToggleAppendedFollow(s)"
              >{{ s.author.following ? '팔로잉' : '팔로우' }}</button>
              <button
                type="button"
                class="more"
                aria-label="more"
                @click="onAppendedCardMore(s)"
              >
                <ion-icon :icon="ellipsisHorizontal" class="ic-20" />
              </button>
            </div>

            <div class="post-image">
              <div v-if="s.dramaSceneImageUrl" class="compare-wrap">
                <img :src="s.dramaSceneImageUrl" class="compare-top" alt="드라마 원본 장면" />
                <img :src="s.imageUrl" :alt="s.place.name" />
                <div class="compare-divider" />
                <div class="compare-lbl-top">드라마 원본</div>
                <div class="compare-lbl-bot">내 인증샷</div>
                <div class="drama-badge">
                  <ion-icon :icon="filmOutline" class="ic-16" />
                  <template v-if="s.content.contentEpisode">{{ s.content.contentEpisode }}</template>
                  <template v-if="s.content.sceneTimestamp"> {{ s.content.sceneTimestamp }}</template>
                </div>
              </div>
              <div v-else class="single-img">
                <img :src="s.imageUrl" :alt="s.place.name" />
                <div class="drama-badge dark">
                  <ion-icon :icon="locationOutline" class="ic-16" />{{ s.place.regionLabel }}
                </div>
              </div>
            </div>

            <div class="post-actions">
              <span
                :class="['a', s.liked ? 'on' : '']"
                @click="onToggleAppendedLike(s)"
              >
                <ion-icon :icon="s.liked ? heart : heartOutline" class="ic-22" />
                {{ formatCount(s.likeCount) }}
              </span>
              <span class="a" @click="onOpenAppendedComments(s)">
                <ion-icon :icon="chatbubbleOutline" class="ic-22" />
                {{ formatCount(s.commentCount) }}
              </span>
              <span class="a" data-testid="feed-share">
                <ion-icon :icon="paperPlaneOutline" class="ic-22" />
              </span>
              <span class="spacer" />
              <span
                class="a"
                data-testid="feed-save"
                @click="onToggleAppendedSave(s)"
              >
                <ion-icon
                  :icon="feedCardSaved(s) ? bookmark : bookmarkOutline"
                  class="ic-22"
                />
              </span>
            </div>

            <div class="post-caption">
              <div v-if="s.caption" class="caption-text">
                <b>{{ s.author.handle }}</b> {{ s.caption }}
              </div>
            </div>
            <div class="post-time">{{ formatRelativeTime(s.createdAt) }}</div>
          </article>
        </section>

        <!-- IntersectionObserver sentinel + 상태 안내. nextEndReached 가 true 면
             observer 가 disconnect 되어 더 이상 fetch 가 일어나지 않음. -->
        <div
          ref="sentinelEl"
          class="sd-infinite-sentinel"
          data-testid="sd-infinite-sentinel"
          aria-hidden="true"
        />
        <div
          v-if="nextLoading"
          class="sd-infinite-status"
          data-testid="sd-infinite-loading"
        >
          더 불러오는 중…
        </div>
        <div
          v-else-if="nextEndReached && appendedShots.length > 0"
          class="sd-infinite-status muted"
          data-testid="sd-infinite-end"
        >
          마지막 인증샷이에요
        </div>
        </div><!-- /.sd-loaded -->
      </div><!-- /.sd-scroll (task #16) -->
    </ion-content>
    <CommentSheet
      :photo-id="commentSheetOpen ? commentSheetPhotoId : null"
      :open="commentSheetOpen"
      @close="commentSheetOpen = false"
      @created="onCommentCreated"
    />

    <!-- Primary 카드 더보기 시트 — 본인이면 수정/삭제, 타인이면 placeholder. -->
    <PostMoreSheet
      :open="primaryMoreOpen"
      :is-own="primaryMoreIsOwn"
      @close="onClosePrimaryMoreSheet"
      @edit="onPrimaryEditFromSheet"
      @delete="onPrimaryDeleteFromSheet"
    />
    <!-- Appended 카드 더보기 시트. 수정 → /shot/:id 라우팅. -->
    <PostMoreSheet
      :open="appendedMoreOpen"
      :is-own="appendedMoreIsOwn"
      @close="onCloseAppendedMoreSheet"
      @edit="onAppendedEditFromSheet"
      @delete="onAppendedDeleteFromSheet"
    />

    <!-- 인증샷 수정 모달 — Teleport 로 body 에 띄워 ion-page 레이아웃 영향 없이
         iOS 시트 톤. 닫기 X 는 헤더 우상단, 저장은 footer primary. -->
    <Teleport to="body">
      <Transition name="sd-edit-backdrop-fade">
        <div
          v-if="editModalOpen"
          class="sd-edit-backdrop"
          data-testid="sd-edit-backdrop"
          @click="closeEditModal"
        />
      </Transition>
      <Transition name="sd-edit-sheet-slide">
        <div
          v-if="editModalOpen"
          class="sd-edit-sheet"
          role="dialog"
          aria-label="인증샷 수정"
          data-testid="sd-edit-sheet"
        >
          <header class="sd-edit-head">
            <h2>인증샷 수정</h2>
            <button
              type="button"
              class="sd-edit-close"
              aria-label="닫기"
              data-testid="sd-edit-close"
              @click="closeEditModal"
            >
              <ion-icon :icon="closeOutline" class="ic-22" />
            </button>
          </header>

          <div class="sd-edit-body">
            <label class="sd-edit-label">캡션</label>
            <textarea
              v-model="editCaption"
              class="sd-edit-textarea"
              data-testid="sd-edit-caption"
              maxlength="1000"
              rows="4"
              placeholder="이 사진에 대한 한 줄을 적어보세요"
            />

            <label class="sd-edit-label">공개범위</label>
            <div class="sd-edit-radios">
              <label
                v-for="opt in visibilityOptions"
                :key="opt.value"
                class="sd-edit-radio"
              >
                <input
                  type="radio"
                  :value="opt.value"
                  v-model="editVisibility"
                  :data-testid="`sd-edit-visibility-${opt.value}`"
                />
                <div class="sd-edit-radio-text">
                  <span class="lbl">{{ opt.label }}</span>
                  <span class="hint">{{ opt.hint }}</span>
                </div>
              </label>
            </div>
          </div>

          <footer class="sd-edit-foot">
            <button
              type="button"
              class="sd-edit-save"
              data-testid="sd-edit-save"
              :disabled="editSaving"
              @click="onSaveEdit"
            >
              {{ editSaving ? '저장 중…' : '저장' }}
            </button>
          </footer>
        </div>
      </Transition>
    </Teleport>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  IonPage,
  IonContent,
  IonIcon,
  alertController,
} from '@ionic/vue';
import {
  chevronBack,
  ellipsisHorizontal,
  checkmarkCircle,
  filmOutline,
  locationOutline,
  heart,
  heartOutline,
  chatbubbleOutline,
  bookmark,
  bookmarkOutline,
  paperPlaneOutline,
  closeOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useShotDetailStore, type PhotoVisibility } from '@/stores/shotDetail';
import { useSavedStore } from '@/stores/saved';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import CommentSheet from '@/components/comment/CommentSheet.vue';
import PostMoreSheet from '@/components/post/PostMoreSheet.vue';
import { formatRelativeTime } from '@/utils/formatRelativeTime';

const props = defineProps<{ id: string | number }>();

const router = useRouter();
const { showInfo, showError } = useToast();
const shotStore = useShotDetailStore();
const savedStore = useSavedStore();
const uiStore = useUiStore();
const authStore = useAuthStore();
const { shot, loading, error, appendedShots, nextLoading, nextEndReached } = storeToRefs(shotStore);

const commentSheetOpen = ref(false);
// task #18: 댓글 시트가 어떤 post 의 댓글을 보여주는지 트래킹. primary 의
// shot.id 또는 appendedShots 의 한 항목 id. null = 미오픈 / 미선택.
const commentSheetPhotoId = ref<number | null>(null);

// IntersectionObserver-driven infinite scroll. The sentinel sits below
// the comment input; when it scrolls into view, ask the store for the
// next page. Observer is set up after the primary shot lands and
// disconnected on unmount / on `nextEndReached`.
const sentinelEl = ref<HTMLElement | null>(null);
let infiniteObserver: IntersectionObserver | null = null;

function teardownInfiniteObserver(): void {
  if (infiniteObserver) {
    infiniteObserver.disconnect();
    infiniteObserver = null;
  }
}

function setupInfiniteObserver(): void {
  teardownInfiniteObserver();
  if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
    // jsdom 환경 또는 매우 오래된 브라우저 — observer 없이 조용히 스킵.
    return;
  }
  if (!sentinelEl.value) return;
  infiniteObserver = new window.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (shotStore.nextEndReached || shotStore.nextLoading) continue;
        void shotStore.loadNext();
      }
    },
    { rootMargin: '300px 0px' },
  );
  infiniteObserver.observe(sentinelEl.value);
}

// 첫 shot 이 도착한 다음 sentinel DOM 이 마운트되므로, shot 변화에 맞춰
// observer 재설정. shot.id 가 바뀌면 (예: route 파라미터 변경) 새 시드로
// 다시 시작. immediate=true 로 두어, store 가 prepopulated (테스트 / 캐시
// 시드) 상태로 마운트되는 케이스에서도 첫 렌더 직후 observer 가 설치되게.
watch(
  () => shot.value?.id,
  async (id) => {
    if (id == null) return;
    // DOM mount 까지 한 tick 기다림 — sentinel ref 가 아직 null 일 수 있음.
    await nextTick();
    setupInfiniteObserver();
  },
  { immediate: true },
);

// 끝 도달 시 observer 더 이상 필요 없음 — 즉시 disconnect.
watch(
  () => shotStore.nextEndReached,
  (done) => {
    if (done) teardownInfiniteObserver();
  },
);

// 드라마 원본 씬은 scenes[0] (primary). compare-wrap 위 절반에 깔리는 이미지.
// 다중 씬은 사용하지 않음 (PlaceDetailPage 의 multi-scene carousel 과 무관).
const sceneImageUrl = computed<string | null>(
  () => shot.value?.scenes[0]?.imageUrl ?? null,
);

// Place-level save reuses the global savedStore contract so the bookmark
// state stays in sync with every other bookmark site (Feed / Place detail /
// Map / Saved). No dedicated "photo bookmark" concept.
const placeSaved = computed(() =>
  shot.value ? savedStore.isSaved(shot.value.place.id) : false,
);

// 본인 사진일 땐 버튼 자체가 v-if 로 숨겨지므로 isMe 분기를 두지 않는다.
const authorActionLabel = computed(() => {
  const a = shot.value?.author;
  if (!a) return '';
  return a.following ? '팔로잉' : '팔로우';
});

// post-time 에 들어가는 상대 시간("45분 전", "어제" 등). feed-detail 카드와 동일.
const takenAtFullLabel = computed(() =>
  shot.value ? formatRelativeTime(shot.value.createdAt) : '',
);

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return n.toLocaleString('ko-KR');
  return String(n);
}

function onBack(): void {
  router.back();
}

function onShare(): void {
  const s = shot.value;
  if (!s) return;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  uiStore.openShareSheet({
    title: `${s.author.nickname}의 인증샷`,
    description: `${s.content.title} · ${s.place.name}`,
    imageUrl: s.imageUrl,
    url: `${origin}/shot/${s.id}`,
  });
}

// 인증샷 수정 모달 — primary shot 더보기 → 수정 행을 누르면 열린다. caption /
// 공개범위 두 필드만 작성자 본인이 변경 가능. 모달 닫힘 시 working 값을 그대로
// 두어 사용자가 실수로 닫아도 다시 열면 입력이 살아 있음 — 명시적 저장이나
// 갱신 후에만 reset.
const editModalOpen = ref(false);
const editCaption = ref('');
const editVisibility = ref<PhotoVisibility>('PUBLIC');
const editSaving = ref(false);

const visibilityOptions: Array<{ value: PhotoVisibility; label: string; hint: string }> = [
  { value: 'PUBLIC', label: '전체 공개', hint: '누구나 볼 수 있어요' },
  { value: 'FOLLOWERS', label: '팔로워만', hint: '내 팔로워에게만 보여요' },
  { value: 'PRIVATE', label: '나만 보기', hint: '나만 볼 수 있어요' },
];

function openEditModal(): void {
  const s = shot.value;
  if (!s) return;
  editCaption.value = s.caption ?? '';
  editVisibility.value = s.visibility;
  editModalOpen.value = true;
}

function closeEditModal(): void {
  editModalOpen.value = false;
}

async function onSaveEdit(): Promise<void> {
  if (editSaving.value) return;
  editSaving.value = true;
  try {
    const ok = await shotStore.updateContent({
      caption: editCaption.value.trim().length > 0 ? editCaption.value : null,
      visibility: editVisibility.value,
    });
    if (ok) {
      closeEditModal();
      await showInfo('인증샷이 수정됐어요');
    } else if (error.value) {
      await showError(error.value);
    }
  } finally {
    editSaving.value = false;
  }
}

// 작성자 더보기 메뉴: 본인 인증샷에는 수정 / 삭제 행 노출, 남 인증샷에는
// 아직 부여할 메뉴가 없어 placeholder 토스트 유지(추후 신고 등이 들어갈 자리).
// Primary 카드 더보기 — Teleport 기반 PostMoreSheet 통일 (헤더 우상단 X 아이콘).
// 본인이면 수정/삭제 행, 타인이면 placeholder. 수정 → inline edit modal,
// 삭제 → confirm alert → DELETE → router.back.
const primaryMoreOpen = ref(false);
const primaryMoreIsOwn = computed<boolean>(() => shot.value?.author.isMe === true);

function onCardMore(): void {
  if (!shot.value) return;
  primaryMoreOpen.value = true;
}

function onClosePrimaryMoreSheet(): void {
  primaryMoreOpen.value = false;
}

function onPrimaryEditFromSheet(): void {
  primaryMoreOpen.value = false;
  openEditModal();
}

function onPrimaryDeleteFromSheet(): void {
  primaryMoreOpen.value = false;
  void confirmDelete();
}

// 삭제 확인 → API 호출 → 성공 시 ShotDetail 자체가 의미 없으므로 router.back.
// 백엔드가 자식 행(좋아요/댓글) cascade 정리, 프런트는 별도 invalidation
// 필요 없음 (다른 페이지가 재진입할 때 어차피 fetch 다시 함).
async function confirmDelete(): Promise<void> {
  const alert = await alertController.create({
    header: '인증샷을 삭제할까요?',
    message: '삭제한 인증샷은 다시 복구할 수 없어요.',
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '삭제',
        role: 'destructive',
        handler: () => {
          void performDelete();
        },
      },
    ],
  });
  await alert.present();
}

async function performDelete(): Promise<void> {
  const ok = await shotStore.deleteShot();
  if (!ok) {
    if (error.value) await showError(error.value);
    return;
  }
  await showInfo('인증샷이 삭제됐어요');
  router.back();
}

// /feed/detail 의 follow 버튼과 동일 — 작성자가 본인이면 follow 버튼 자체를
// 숨김. author.userId 가 viewer.id 와 같으면 본인.
function isAppendedOwn(post: { author: { userId: number } }): boolean {
  const myId = authStore.user?.id ?? null;
  return myId != null && post.author.userId === myId;
}

// Appended 카드 더보기 — primary 와 동일한 PostMoreSheet 사용. 수정은 별도
// 모달을 띄우는 대신 해당 카드의 detail 로 라우팅 — 거기서 primary 가 되어
// 기존 edit 모달 플로우 재사용. 본인 아니면 placeholder.
const appendedMoreOpen = ref(false);
const appendedMoreTarget = ref<{
  id: number;
  author: { userId: number };
} | null>(null);
const appendedMoreIsOwn = computed<boolean>(() => {
  const myId = authStore.user?.id ?? null;
  const t = appendedMoreTarget.value;
  return myId != null && t != null && t.author.userId === myId;
});

function onAppendedCardMore(post: {
  id: number;
  author: { userId: number };
}): void {
  appendedMoreTarget.value = post;
  appendedMoreOpen.value = true;
}

function onCloseAppendedMoreSheet(): void {
  appendedMoreOpen.value = false;
}

async function onAppendedEditFromSheet(): Promise<void> {
  const t = appendedMoreTarget.value;
  appendedMoreOpen.value = false;
  if (!t) return;
  await router.push(`/shot/${t.id}`);
}

function onAppendedDeleteFromSheet(): void {
  const t = appendedMoreTarget.value;
  appendedMoreOpen.value = false;
  if (!t) return;
  void confirmDeleteAppended(t.id);
}

async function confirmDeleteAppended(postId: number): Promise<void> {
  const alert = await alertController.create({
    header: '인증샷을 삭제할까요?',
    message: '삭제한 인증샷은 다시 복구할 수 없어요.',
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '삭제',
        role: 'destructive',
        handler: () => {
          void performDeleteAppended(postId);
        },
      },
    ],
  });
  await alert.present();
}

async function performDeleteAppended(postId: number): Promise<void> {
  const ok = await shotStore.deleteAppendedShot(postId);
  if (!ok) {
    if (error.value) await showError(error.value);
    return;
  }
  await showInfo('인증샷이 삭제됐어요');
}

async function onOpenAuthor(): Promise<void> {
  const a = shot.value?.author;
  if (!a || a.id == null) return;
  // /user/:id 페이지가 isMe 인 경우 내부에서 /profile 로 리다이렉트하므로
  // 여기서 별도 분기 없이 같은 라우트로 보낸다.
  await router.push(`/user/${a.id}`);
}

async function onAuthorAction(): Promise<void> {
  // 본인 사진은 v-if 로 버튼 자체가 안 보여 호출되지 않는 경로지만, 안전망으로
  // shot 미로드 가드만 두고 팔로우 토글로 직진.
  if (!shot.value?.author) return;
  await shotStore.toggleAuthorFollow();
  if (error.value) await showError(error.value);
}

async function onToggleLike(): Promise<void> {
  await shotStore.toggleLike();
}

async function onToggleBookmark(): Promise<void> {
  if (!shot.value) return;
  const placeId = shot.value.place.id;
  // Save flow mirrors Feed/Place/Map: unsaved → collection picker; already
  // saved → one-shot unsave via savedStore.
  if (savedStore.isSaved(placeId)) {
    await savedStore.toggleSave(placeId);
    return;
  }
  uiStore.openCollectionPicker(placeId);
}

function onOpenComments(): void {
  if (!shot.value) return;
  commentSheetPhotoId.value = shot.value.id;
  commentSheetOpen.value = true;
}

function onCommentCreated(): void {
  // task #18: 시트가 어떤 post 의 것인지에 따라 그 항목의 commentCount 만 +1.
  const id = commentSheetPhotoId.value;
  if (id == null) return;
  if (shot.value && shot.value.id === id) {
    shot.value.commentCount += 1;
    return;
  }
  const found = shotStore.appendedShots.find((p) => p.id === id);
  if (found) found.commentCount += 1;
}

// ---------- task #18: appended-card interaction handlers ----------
async function onToggleAppendedLike(post: { id: number }): Promise<void> {
  await shotStore.toggleAppendedLike(post.id);
}

async function onToggleAppendedSave(post: { place: { id: number } }): Promise<void> {
  // primary 와 동일 정책 — saved → toggleSave (즉시 unsave), unsaved →
  // collection picker 시트 열기. Place id 기반.
  const placeId = post.place.id;
  if (savedStore.isSaved(placeId)) {
    await savedStore.toggleSave(placeId);
    return;
  }
  uiStore.openCollectionPicker(placeId);
}

async function onToggleAppendedFollow(post: { author: { userId: number } }): Promise<void> {
  await shotStore.toggleAppendedFollow(post.author.userId);
}

function onOpenAppendedComments(post: { id: number }): void {
  commentSheetPhotoId.value = post.id;
  commentSheetOpen.value = true;
}

async function onOpenAppendedAuthor(post: { author: { userId: number } }): Promise<void> {
  await router.push(`/user/${post.author.userId}`);
}

// task #21: avatar / sub(place) 클릭 라우팅. avatar 는 기존 onOpenAuthor /
// onOpenAppendedAuthor 와 동일 핸들러 재사용. sub 는 신규 — place-id 를
// MapPage 의 selectedId query 로 보내 지도에서 해당 장소 자동 선택되도록.
async function onOpenPlaceMap(): Promise<void> {
  const placeId = shot.value?.place.id;
  if (placeId == null) return;
  await router.push({ path: '/map', query: { selectedId: String(placeId) } });
}

async function onOpenAppendedPlaceMap(post: { place: { id: number } }): Promise<void> {
  await router.push({ path: '/map', query: { selectedId: String(post.place.id) } });
}

// 카드별 saved 상태는 savedStore 가 single source — server snapshot(`s.saved`)
// 보다 client store 가 더 신뢰할 수 있음 (방금 저장/해제한 결과 반영).
function feedCardSaved(post: { place: { id: number } }): boolean {
  return savedStore.isSaved(post.place.id);
}

async function loadDetail(): Promise<void> {
  const id = Number(props.id);
  if (!Number.isFinite(id)) return;
  await shotStore.fetchShot(id);
}

onMounted(loadDetail);
onUnmounted(() => {
  teardownInfiniteObserver();
  shotStore.reset();
});

// Re-fetch on route-level param change — ion-router may reuse the same
// component instance when navigating between /shot/:id URLs.
watch(
  () => props.id,
  (newId, oldId) => {
    if (newId !== oldId) void loadDetail();
  },
);

</script>

<style scoped>
ion-content.sd-content {
  --background: #ffffff;
}

/* task #16: .sd-scroll is the always-rendered scroll container. Bottom
   padding gives breathing room past the last appended shot / sentinel. */
.sd-scroll {
  overflow-y: auto;
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
  height: 100%;
}
.sd-loaded {
  /* No own padding/scroll — it's just a state wrapper inside .sd-scroll. */
}

/* Sticky top header — stays pinned while the user scrolls through the
   primary post + appended feed. Sits above all in-page content (z-index 30)
   but BELOW Ionic modals like CommentSheet (which Ionic places at 1000+). */
.sd-top {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  padding: calc(8px + env(safe-area-inset-top)) 16px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}
/* Feed-detail tone (rounded square neutral chip) instead of the previous
   floating-on-photo dark circle — sticky header reads against any content
   underneath without needing the dark contrast. */
.sd-top .ic-btn {
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
}
/* task #26: sticky header 우측 액션 영역 사라짐 — `.sd-top .right` 룰도 정리. */

/* primary 카드 전용 CSS (sd-carousel / compare data-mode toggle / lbl-chip /
   card-more / compare-toggle / scene-meta) 는 /feed/detail 마크업 통일로
   제거. 새 마크업은 .post 트리(.post-head/.post-image/.post-actions/
   .post-caption/.post-time)만 사용. */

/* legacy primary CSS (sd-user / sd-stats / sd-caption / comments / cmt /
   cmt-input-wrap / standalone .avatar) 도 통일에 맞춰 모두 제거. .post 트리
   하나로 일원화 — 뒤에 정의된 .post-* 룰이 primary + appended 모두 커버. */

/* ====================================================================
   .post 카드 — primary + appended 모두 같은 마크업 (/feed/detail 통일).
   다음 단계는 PostCard.vue 컴포넌트 추출.
   ==================================================================== */
.sd-feed {
  border-top: 8px solid var(--fr-line-soft);
}
.post {
  background: #ffffff;
  padding: 18px 0 16px;
  border-bottom: 8px solid var(--fr-line-soft);
}
.post:last-child { border-bottom: none; }
.post-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 12px;
}
.post-head .avatar {
  width: 38px; height: 38px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #eee;
}
.post-head .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.post-head .avatar.clickable,
.post-head .meta.clickable { cursor: pointer; }
.post-head .meta { flex: 1; min-width: 0; }
.post-head .nm {
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--fr-ink);
  min-width: 0;
}
/* 자동 생성 OAuth handle (예: @ghdalswl9833-b189d4) 처럼 긴 핸들이 카드
   레이아웃을 밀어내지 않도록 ellipsis. 인증 아이콘은 flex-shrink:0 으로 유지. */
.post-head .nm-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.post-head .verified { color: var(--fr-primary); flex-shrink: 0; }
.post-head .loc {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}
.post-head .loc .drama {
  color: var(--fr-primary);
  font-weight: 700;
}
.post-head .more {
  width: 28px; height: 28px;
  color: var(--fr-ink-3);
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
}
.post-head .author-follow {
  flex-shrink: 0;
  height: 28px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: var(--fr-primary);
  color: #ffffff;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
}
.post-head .author-follow.on {
  background: #ffffff;
  border-color: var(--fr-line);
  color: var(--fr-ink-2);
}
.post-image {
  position: relative;
  background: #000;
}
.compare-wrap {
  position: relative;
  aspect-ratio: 4 / 5;
  overflow: hidden;
}
.compare-wrap img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.compare-top { clip-path: inset(0 0 50% 0); }
.compare-divider {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  height: 2px;
  background: #ffffff;
  z-index: 2;
}
.compare-divider::before,
.compare-divider::after {
  content: '';
  position: absolute;
  width: 24px; height: 24px;
  border-radius: 50%;
  background: #ffffff;
  top: 50%;
  transform: translateY(-50%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.compare-divider::before { left: -12px; }
.compare-divider::after { right: -12px; }
.compare-lbl-top,
.compare-lbl-bot {
  position: absolute;
  z-index: 3;
  background: rgba(0, 0, 0, 0.75);
  color: #ffffff;
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  letter-spacing: -0.01em;
  backdrop-filter: blur(6px);
}
.compare-lbl-top { top: 12px; left: 12px; }
.compare-lbl-bot { bottom: 12px; left: 12px; }
.drama-badge {
  position: absolute;
  top: 12px; right: 12px;
  z-index: 3;
  background: rgba(20, 188, 237, 0.95);
  color: #ffffff;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(6px);
}
.drama-badge.dark { background: rgba(15, 23, 42, 0.85); }
.single-img {
  aspect-ratio: 4 / 5;
  position: relative;
}
.single-img img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.post-actions {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 12px 20px 6px;
  color: var(--fr-ink-2);
}
.post-actions .a {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.post-actions .a.on { color: var(--fr-coral); }
.post-actions .spacer { flex: 1; }
.post-caption {
  padding: 6px 20px 4px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--fr-ink-2);
}
.post-caption b {
  font-weight: 800;
  color: var(--fr-ink);
}
.post-time {
  padding: 8px 20px 0;
  font-size: 11px;
  color: var(--fr-ink-4);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sd-infinite-sentinel {
  width: 100%;
  height: 1px;
}
.sd-infinite-status {
  padding: 18px 20px;
  text-align: center;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--fr-ink-3);
  letter-spacing: -0.01em;
}
.sd-infinite-status.muted {
  color: var(--fr-ink-4);
  font-weight: 600;
}

/* Loading / error placeholders (task #39). Kept minimal — the design
   doesn't specify a skeleton shape, so plain centered copy keeps the
   page quiet while the fetch is in flight or fails. */
.sd-placeholder {
  padding: 120px 24px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 14px;
}
.sd-placeholder.error {
  color: var(--fr-coral);
}

/* ---------- 인증샷 수정 모달 (Teleport) ---------- */
.sd-edit-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(15, 23, 42, 0.5);
}
.sd-edit-sheet {
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
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.sd-edit-sheet-slide-enter-from,
.sd-edit-sheet-slide-leave-to { transform: translateY(100%); }
.sd-edit-sheet-slide-enter-active,
.sd-edit-sheet-slide-leave-active {
  transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sd-edit-backdrop-fade-enter-from,
.sd-edit-backdrop-fade-leave-to { opacity: 0; }
.sd-edit-backdrop-fade-enter-active,
.sd-edit-backdrop-fade-leave-active { transition: opacity 0.2s ease; }

.sd-edit-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 0 12px;
  border-bottom: 1px solid var(--fr-line);
}
.sd-edit-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--fr-ink);
}
.sd-edit-close {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--fr-ink-3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.sd-edit-close:hover { background: var(--fr-bg-muted); color: var(--fr-ink); }

.sd-edit-body {
  padding: 14px 4px 4px;
  overflow-y: auto;
}
.sd-edit-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--fr-ink-3);
  margin: 12px 0 6px;
}
.sd-edit-textarea {
  width: 100%;
  resize: none;
  border: 1px solid var(--fr-line);
  border-radius: 12px;
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
  color: var(--fr-ink);
  background: var(--fr-bg-muted, #f5f7fa);
}
.sd-edit-textarea:focus { outline: 2px solid var(--fr-primary); outline-offset: 1px; }

.sd-edit-radios {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sd-edit-radio {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--fr-line);
  border-radius: 12px;
  cursor: pointer;
}
.sd-edit-radio input[type='radio'] { accent-color: var(--fr-primary); }
.sd-edit-radio-text { display: flex; flex-direction: column; }
.sd-edit-radio-text .lbl { font-size: 14px; font-weight: 700; color: var(--fr-ink); }
.sd-edit-radio-text .hint { font-size: 12px; color: var(--fr-ink-3); }

.sd-edit-foot { padding: 12px 0 0; }
.sd-edit-save {
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 14px;
  background: var(--fr-primary);
  color: #ffffff;
  font: inherit;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}
.sd-edit-save:disabled { background: var(--fr-line); cursor: not-allowed; }
</style>
