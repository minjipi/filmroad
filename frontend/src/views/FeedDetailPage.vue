<template>
  <ion-page>
    <ion-content :fullscreen="true" class="feed-content">
      <header class="feed-head">
        <h1>탐색</h1>
        <div class="head-actions">
          <button class="icon-btn" type="button" aria-label="notifications" @click="onNotifs">
            <ion-icon :icon="heartOutline" class="ic-20" />
            <span class="dot" />
          </button>
          <button class="icon-btn" type="button" aria-label="messages" @click="onMessages">
            <ion-icon :icon="paperPlaneOutline" class="ic-20" />
          </button>
        </div>
      </header>

      <div class="search-row" @click="onSearch">
        <div class="search-bar">
          <ion-icon :icon="searchOutline" class="ic-16" />
          <span>작품, 장소, 사용자 검색</span>
        </div>
      </div>

      <nav class="feed-tabs">
        <div
          v-for="t in tabs"
          :key="t.key"
          :class="['t', tab === t.key ? 'on' : '']"
          @click="onSelectTab(t.key)"
        >{{ t.label }}</div>
      </nav>

      <div class="feed-scroll no-scrollbar">
        <template v-for="(p, idx) in posts" :key="p.id">
          <article class="post">
            <div class="post-head">
              <div class="avatar">
                <img v-if="p.author.avatarUrl" :src="p.author.avatarUrl" :alt="p.author.handle" />
              </div>
              <div class="meta">
                <div class="nm">
                  {{ p.author.handle }}
                  <ion-icon v-if="p.author.verified" :icon="checkmarkCircle" class="ic-16 verified" />
                </div>
                <div class="loc">
                  <span class="drama">{{ p.content.title }}</span>·{{ p.place.name }}
                </div>
              </div>
              <button
                v-if="!isOwnAuthor(p)"
                type="button"
                :class="['author-follow', p.author.following ? 'on' : '']"
                data-testid="post-author-follow"
                @click="onFollowAuthor(p)"
              >{{ p.author.following ? '팔로잉' : '팔로우' }}</button>
              <button class="more" type="button" aria-label="more" @click="onMore(p)">
                <ion-icon :icon="ellipsisHorizontal" class="ic-20" />
              </button>
            </div>

            <div class="post-image">
              <div v-if="p.sceneCompare && p.dramaSceneImageUrl" class="compare-wrap">
                <img :src="p.dramaSceneImageUrl" class="compare-top" alt="drama scene" />
                <img :src="p.imageUrl" :alt="p.place.name" />
                <div class="compare-divider" />
                <div class="compare-lbl-top">드라마 원본</div>
                <div class="compare-lbl-bot">내 인증샷</div>
                <div class="drama-badge">
                  <ion-icon :icon="filmOutline" class="ic-16" />
                  <template v-if="p.content.contentEpisode">{{ p.content.contentEpisode }}</template>
                  <template v-if="p.content.sceneTimestamp"> {{ p.content.sceneTimestamp }}</template>
                </div>
              </div>
              <div v-else class="single-img">
                <img :src="p.imageUrl" :alt="p.place.name" />
                <div class="drama-badge dark">
                  <ion-icon :icon="locationOutline" class="ic-16" />{{ p.place.regionLabel }}
                </div>
              </div>
            </div>

            <div class="post-actions">
              <span :class="['a', p.liked ? 'on' : '']" @click="onToggleLike(p)">
                <ion-icon :icon="p.liked ? heart : heartOutline" class="ic-22" />
                {{ formatCount(p.likeCount) }}
              </span>
              <span class="a" @click="onComment(p)">
                <ion-icon :icon="chatbubbleOutline" class="ic-22" />
                {{ formatCount(p.commentCount) }}
              </span>
              <span class="a" data-testid="feed-share" @click="onShare(p)">
                <ion-icon :icon="paperPlaneOutline" class="ic-22" />
              </span>
              <span class="spacer" />
              <span class="a" data-testid="feed-save" @click="onToggleSave(p)">
                <ion-icon
                  :icon="isSaved(p.place.id) ? bookmark : bookmarkOutline"
                  class="ic-22"
                />
              </span>
            </div>

            <div class="post-caption">
              <div v-if="p.caption" class="caption-text">
                <b>{{ p.author.handle }}</b> {{ p.caption }}
              </div>
              <div v-if="p.visitedAt" class="visit-chip">
                <ion-icon :icon="checkmarkCircle" class="ic-16" />여기 다녀왔어요
              </div>
            </div>
            <div class="post-time">{{ formatRelativeTime(p.createdAt) }}</div>
          </article>

          <section
            v-if="idx === 0 && recommendedUsers.length > 0"
            class="reco-strip"
          >
            <h3><span class="sp">추천</span> 같은 작품 인증 중인 사람들</h3>
            <div class="reco-row no-scrollbar">
              <div
                v-for="u in recommendedUsers"
                :key="u.userId"
                class="reco-card"
              >
                <div class="th">
                  <img v-if="u.avatarUrl" :src="u.avatarUrl" :alt="u.handle" />
                </div>
                <div class="body">
                  <div class="t">{{ u.handle }}</div>
                  <div class="s">{{ recoProgressText(u) }}</div>
                  <button
                    :class="['follow', u.following ? 'followed' : '']"
                    type="button"
                    @click="onFollow(u)"
                  >{{ u.following ? '팔로잉' : '팔로우' }}</button>
                </div>
              </div>
            </div>
          </section>
        </template>

        <p v-if="posts.length === 0 && !loading && tab === 'FOLLOWING'" class="empty-note">
          아직 팔로우한 사용자가 없어요<br />추천에서 팔로우해보세요
        </p>
        <p v-else-if="posts.length === 0 && !loading" class="empty-note">표시할 게시물이 없어요</p>

        <ion-infinite-scroll
          v-if="hasMore"
          :disabled="loading"
          threshold="200px"
          @ionInfinite="onInfinite"
        >
          <ion-infinite-scroll-content loading-spinner="dots" />
        </ion-infinite-scroll>

        <div class="tail" />
      </div>
    </ion-content>
    <FrTabBar :model-value="'feed'" />
    <CommentSheet
      :photo-id="activeCommentPhotoId"
      :open="activeCommentPhotoId !== null"
      @close="activeCommentPhotoId = null"
      @created="onCommentCreated"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  IonPage,
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  actionSheetController,
  alertController,
} from '@ionic/vue';
import {
  heart,
  heartOutline,
  paperPlaneOutline,
  searchOutline,
  checkmarkCircle,
  ellipsisHorizontal,
  filmOutline,
  locationOutline,
  chatbubbleOutline,
  bookmark,
  bookmarkOutline,
  createOutline,
  trashOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useFeedStore, type FeedPost, type FeedTab, type FeedUser } from '@/stores/feed';
import { useSavedStore } from '@/stores/saved';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import CommentSheet from '@/components/comment/CommentSheet.vue';
import { useToast } from '@/composables/useToast';
import { formatRelativeTime } from '@/utils/formatRelativeTime';

const feedStore = useFeedStore();
const savedStore = useSavedStore();
const uiStore = useUiStore();
const authStore = useAuthStore();
const router = useRouter();
const { posts, recommendedUsers, tab, hasMore, loading, error } = storeToRefs(feedStore);
const { showError, showInfo } = useToast();

/** post 의 author 가 viewer 본인인지 — follow 버튼 숨김 판정용. */
function isOwnAuthor(p: FeedPost): boolean {
  const me = authStore.user?.id;
  return me != null && p.author.userId === me;
}

const isSaved = (id: number): boolean => savedStore.isSaved(id);

const activeCommentPhotoId = ref<number | null>(null);

// Tab order places 최신 first (task #33 — RECENT is the new default), then
// 인기, 팔로잉, 내 주변, 작품별. 13-feed.html shows "팔로잉 · 인기 · 내 주변 ·
// 작품별" — the design predates the RECENT addition; we prepend here rather
// than reshuffle the rest.
const tabs: Array<{ key: FeedTab; label: string }> = [
  { key: 'RECENT', label: '최신' },
  { key: 'POPULAR', label: '인기' },
  { key: 'FOLLOWING', label: '팔로잉' },
  { key: 'NEARBY', label: '내 주변' },
  { key: 'BY_CONTENT', label: '작품별' },
];

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

async function onSelectTab(t: FeedTab): Promise<void> {
  await feedStore.setTab(t);
  if (error.value) await showError(error.value);
}

async function onInfinite(ev: Event): Promise<void> {
  await feedStore.loadMore();
  const target = ev.target as HTMLIonInfiniteScrollElement | null;
  if (target) await target.complete();
}

async function onToggleLike(p: FeedPost): Promise<void> {
  await feedStore.toggleLikePost(p.id);
  if (error.value) await showError(error.value);
}

async function onToggleSave(p: FeedPost): Promise<void> {
  const pid = p.place.id;
  if (savedStore.isSaved(pid)) {
    await savedStore.toggleSave(pid);
    if (savedStore.error) await showError(savedStore.error);
    return;
  }
  uiStore.openCollectionPicker(pid);
}

function onComment(p: FeedPost): void {
  activeCommentPhotoId.value = p.id;
}

function onCommentCreated(): void {
  const id = activeCommentPhotoId.value;
  if (id == null) return;
  const post = posts.value.find((x) => x.id === id);
  if (post) post.commentCount += 1;
}

function onShare(p: FeedPost): void {
  // 인증샷 공유 — 사진 + 장소 + 작품을 카드 콘텐츠로. URL 은 deep link 가능한
  // /shot/{id} 로 보내 외부에서 열어도 같은 사진을 볼 수 있게.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  uiStore.openShareSheet({
    title: `${p.author.nickname}의 인증샷`,
    description: `${p.content.title} · ${p.place.name}`,
    imageUrl: p.imageUrl,
    url: `${origin}/shot/${p.id}`,
  });
}

// 카드 더보기 — /shot/:id 의 onCardMore 와 동일 contract. 본인 인증샷이면
// 수정/삭제 ActionSheet, 타인이면 placeholder 토스트 (추후 신고/숨기기 자리).
// 수정은 별도 모달 대신 /shot/:id 라우팅 → 거기서 primary 의 edit modal 재사용.
async function onMore(p: FeedPost): Promise<void> {
  const myId = authStore.user?.id ?? null;
  const isMe = myId != null && p.author.userId === myId;
  if (!isMe) {
    await showInfo('더보기 메뉴는 곧 공개됩니다');
    return;
  }
  const sheet = await actionSheetController.create({
    header: '인증샷',
    buttons: [
      {
        text: '수정',
        icon: createOutline,
        handler: () => {
          void router.push(`/shot/${p.id}`);
        },
      },
      {
        text: '삭제',
        role: 'destructive',
        icon: trashOutline,
        handler: () => {
          void confirmDelete(p.id);
        },
      },
      { text: '취소', role: 'cancel' },
    ],
  });
  await sheet.present();
}

async function confirmDelete(postId: number): Promise<void> {
  const alert = await alertController.create({
    header: '인증샷을 삭제할까요?',
    message: '삭제한 인증샷은 다시 복구할 수 없어요.',
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '삭제',
        role: 'destructive',
        handler: () => {
          void performDelete(postId);
        },
      },
    ],
  });
  await alert.present();
}

async function performDelete(postId: number): Promise<void> {
  const ok = await feedStore.deletePost(postId);
  if (!ok) {
    if (error.value) await showError(error.value);
    return;
  }
  await showInfo('인증샷이 삭제됐어요');
}

async function onNotifs(): Promise<void> {
  await showInfo('알림은 곧 공개됩니다');
}

async function onMessages(): Promise<void> {
  await showInfo('메시지는 곧 공개됩니다');
}

async function onSearch(): Promise<void> {
  await router.push('/search');
}

async function onFollow(u: FeedUser): Promise<void> {
  await feedStore.toggleFollow(u.userId);
  if (error.value) await showError(error.value);
}

async function onFollowAuthor(p: FeedPost): Promise<void> {
  if (p.author.userId == null) return;
  await feedStore.toggleFollow(p.author.userId);
  if (error.value) await showError(error.value);
}

function recoProgressText(u: FeedUser): string {
  if (u.stampCountForContent <= 0) return '';
  if (u.contentTitle) return `${u.contentTitle} ${u.stampCountForContent}곳 수집`;
  return `${u.stampCountForContent}곳 수집`;
}

onMounted(async () => {
  await feedStore.fetch();
  if (recommendedUsers.value.length === 0) {
    await feedStore.fetchRecommended();
  }
  if (error.value) await showError(error.value);
});
</script>

<style scoped>
ion-content.feed-content {
  --background: #ffffff;
}

.feed-scroll {
  overflow-y: auto;
  /* FrTabBar occupies 84px + sab at the bottom; 120px leaves ~36px of
     breathing room so the last post card's border-bottom + visit-chip
     aren't covered by the nav. (task #32) */
  padding-bottom: calc(120px + env(safe-area-inset-bottom));
}

.feed-head {
  padding: calc(8px + env(safe-area-inset-top)) 20px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.feed-head h1 {
  margin: 0;
  font-size: 24px; font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--fr-ink);
}
.head-actions { display: flex; gap: 6px; }
.icon-btn {
  width: 40px; height: 40px;
  border-radius: 12px;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}
.icon-btn .dot {
  position: absolute;
  top: 10px; right: 10px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--fr-coral);
  border: 2px solid var(--fr-bg-muted);
}

.search-row {
  padding: 4px 20px 12px;
  cursor: pointer;
}
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--fr-bg-muted);
  border-radius: 14px;
  padding: 11px 14px;
  color: var(--fr-ink-3);
  font-size: 14px;
}

.feed-tabs {
  display: flex;
  gap: 22px;
  padding: 0 20px;
  border-bottom: 1px solid var(--fr-line);
}
.feed-tabs .t {
  padding: 10px 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--fr-ink-4);
  border-bottom: 2px solid transparent;
  letter-spacing: -0.02em;
  cursor: pointer;
  user-select: none;
}
.feed-tabs .t.on {
  color: var(--fr-ink);
  border-bottom-color: var(--fr-ink);
}

.post {
  padding: 18px 0 16px;
  border-bottom: 8px solid var(--fr-line-soft);
}
.post-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 12px;
}
.avatar {
  width: 38px; height: 38px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #eee;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.post-head .meta { flex: 1; min-width: 0; }
.post-head .nm {
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--fr-ink);
}
.post-head .verified { color: var(--fr-primary); }
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
/* 작성자 팔로우 버튼 — Instagram 스타일. 평상시 강조색, 팔로잉이면 약하게. */
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
.compare-top {
  clip-path: inset(0 0 50% 0);
}
.compare-divider {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  background: #ffffff;
  z-index: 2;
}
.compare-divider::before,
.compare-divider::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 24px;
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
  top: 12px;
  right: 12px;
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
.drama-badge.dark {
  background: rgba(15, 23, 42, 0.85);
}

.single-img {
  aspect-ratio: 4 / 5;
  position: relative;
}
.single-img img {
  width: 100%;
  height: 100%;
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

.visit-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
  padding: 7px 11px;
  background: var(--fr-primary-soft);
  color: var(--fr-primary);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.reco-strip {
  padding: 18px 0;
  border-bottom: 8px solid var(--fr-line-soft);
  background: #fafbfc;
}
.reco-strip h3 {
  padding: 0 20px;
  font-size: 14px;
  font-weight: 800;
  margin: 0 0 12px;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fr-ink);
}
.reco-strip h3 .sp {
  font-size: 10px;
  color: #ffffff;
  background: var(--fr-violet);
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 800;
  letter-spacing: 0;
}
.reco-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 0 20px;
}
.reco-card {
  flex-shrink: 0;
  width: 128px;
  background: #ffffff;
  border: 1px solid var(--fr-line);
  border-radius: 14px;
  overflow: hidden;
}
.reco-card .th {
  width: 100%;
  height: 128px;
  background: #eef2f6;
  overflow: hidden;
}
.reco-card .th img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.reco-card .body { padding: 10px; }
.reco-card .t {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--fr-ink);
}
.reco-card .s {
  font-size: 10.5px;
  color: var(--fr-ink-3);
  margin-top: 3px;
}
.reco-card .follow {
  margin-top: 8px;
  height: 28px;
  border-radius: 8px;
  background: var(--fr-primary);
  color: #ffffff;
  border: none;
  font-weight: 700;
  font-size: 11.5px;
  width: 100%;
  cursor: pointer;
}
.reco-card .follow.followed {
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
}

.empty-note {
  padding: 48px 8px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}

.tail { height: 20px; }
</style>
