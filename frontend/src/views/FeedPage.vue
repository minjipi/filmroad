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
                  <span class="drama">{{ p.work.title }}</span>·{{ p.place.name }}
                </div>
              </div>
              <button class="more" type="button" aria-label="more" @click="onMore">
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
                  <template v-if="p.work.workEpisode">{{ p.work.workEpisode }}</template>
                  <template v-if="p.work.sceneTimestamp"> {{ p.work.sceneTimestamp }}</template>
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
              <span class="a" @click="onShare(p)">
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
              <template v-if="p.caption">
                <b>{{ p.author.handle }}</b> {{ p.caption }}
              </template>
              <div v-if="p.visitedAt" class="visit-chip">
                <ion-icon :icon="checkmarkCircle" class="ic-16" />여기 다녀왔어요 · {{ formatVisitDate(p.visitedAt) }}
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

    <Teleport to="body">
      <div
        v-if="shareTarget"
        class="share-backdrop"
        role="dialog"
        aria-label="공유"
        @click.self="closeShareSheet"
      >
        <div class="share-sheet">
          <button
            type="button"
            class="close"
            aria-label="닫기"
            @click="closeShareSheet"
          >
            <ion-icon :icon="closeOutline" class="ic-22" />
          </button>

          <!-- Preview card -->
          <div class="preview">
            <div class="pv-thumb">
              <img :src="shareTarget.imageUrl" :alt="shareTarget.place.name" />
            </div>
            <div class="pv-meta">
              <div class="pv-t">{{ shareTarget.work.title }} · {{ shareTarget.place.name }}</div>
              <div class="pv-s" v-if="shareTarget.caption">{{ shareTarget.caption }}</div>
              <div class="pv-url">filmroad.app/shot/{{ shareTarget.id }}</div>
            </div>
          </div>

          <!-- Kakao contacts row -->
          <div class="row-scroll no-scrollbar">
            <button
              v-for="c in shareContacts"
              :key="c.id"
              type="button"
              class="contact"
              @click="onShareKakao"
            >
              <span class="avatar">
                <img v-if="c.avatarUrl" :src="c.avatarUrl" :alt="c.name" />
                <span class="kakao-badge" aria-label="KakaoTalk">
                  <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
                    <path fill="currentColor" d="M12 3C6.48 3 2 6.58 2 11c0 2.87 1.93 5.4 4.82 6.82-.2.75-.73 2.68-.84 3.09-.14.52.19.52.4.38.17-.1 2.7-1.83 3.78-2.56.6.09 1.21.14 1.84.14 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
                  </svg>
                </span>
              </span>
              <span class="nm">{{ c.name }}</span>
            </button>
          </div>

          <!-- Apps row -->
          <div class="row-scroll apps no-scrollbar">
            <button type="button" class="app" @click="onShareKakao">
              <span class="sqr kakao-sqr">
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                  <path fill="#181600" d="M12 3C6.48 3 2 6.58 2 11c0 2.87 1.93 5.4 4.82 6.82-.2.75-.73 2.68-.84 3.09-.14.52.19.52.4.38.17-.1 2.7-1.83 3.78-2.56.6.09 1.21.14 1.84.14 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
                </svg>
              </span>
              <span class="nm">카카오톡</span>
            </button>
            <button type="button" class="app" @click="() => onShareApp('메시지')">
              <span class="sqr msg-sqr">
                <ion-icon :icon="chatbubbleOutline" class="ic-24" />
              </span>
              <span class="nm">메시지</span>
            </button>
            <button type="button" class="app" @click="() => onShareApp('메일')">
              <span class="sqr mail-sqr">
                <ion-icon :icon="mailOutline" class="ic-24" />
              </span>
              <span class="nm">메일</span>
            </button>
            <button type="button" class="app" @click="() => onShareApp('Instagram')">
              <span class="sqr ig-sqr">
                <ion-icon :icon="logoInstagram" class="ic-24" />
              </span>
              <span class="nm">Instagram</span>
            </button>
          </div>

          <!-- System actions list (iOS-style vertical list) -->
          <div class="action-list">
            <button type="button" class="list-row" @click="onCopyLink">
              <span class="row-lbl">링크 복사</span>
              <span class="row-ic"><ion-icon :icon="copyOutline" class="ic-20" /></span>
            </button>
            <button type="button" class="list-row" @click="onBookmarkTarget">
              <span class="row-lbl">저장</span>
              <span class="row-ic"><ion-icon :icon="bookmarkOutline" class="ic-20" /></span>
            </button>
            <button type="button" class="list-row" @click="onSaveToFiles">
              <span class="row-lbl">파일에 저장</span>
              <span class="row-ic"><ion-icon :icon="folderOpenOutline" class="ic-20" /></span>
            </button>
            <button type="button" class="list-row" @click="onOpenInBrowser">
              <span class="row-lbl">브라우저에서 열기</span>
              <span class="row-ic"><ion-icon :icon="compassOutline" class="ic-20" /></span>
            </button>
            <button type="button" class="list-row danger" @click="onReport">
              <span class="row-lbl">문제 신고</span>
              <span class="row-ic"><ion-icon :icon="flagOutline" class="ic-20" /></span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  IonPage,
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
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
  closeOutline,
  copyOutline,
  folderOpenOutline,
  compassOutline,
  flagOutline,
  mailOutline,
  logoInstagram,
  bookmark,
  bookmarkOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useFeedStore, type FeedPost, type FeedTab, type FeedUser } from '@/stores/feed';
import { useSavedStore } from '@/stores/saved';
import { useUiStore } from '@/stores/ui';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import CommentSheet from '@/components/comment/CommentSheet.vue';
import { useToast } from '@/composables/useToast';
import { shareKakao, KakaoShareError } from '@/services/kakaoShare';
import { formatRelativeTime, formatVisitDate } from '@/utils/formatRelativeTime';

const feedStore = useFeedStore();
const savedStore = useSavedStore();
const uiStore = useUiStore();
const router = useRouter();
const { posts, recommendedUsers, tab, hasMore, loading, error } = storeToRefs(feedStore);
const { showError, showInfo, showCenter } = useToast();

const isSaved = (id: number): boolean => savedStore.isSaved(id);

const activeCommentPhotoId = ref<number | null>(null);
const shareTarget = ref<FeedPost | null>(null);

// 바텀시트 상단의 "친구에게 카톡으로 보내기" 가로줄은 추천 팔로우를
// 프록시로 사용 — 실제 카톡 친구 리스트가 없어도 시각적으로 채워 준다.
// 탭하면 일반 Kakao 공유 다이얼로그가 뜬다 (개별 친구 지정은 Kakao API
// 한도 밖).
const shareContacts = computed<Array<{ id: number | string; name: string; avatarUrl: string | null }>>(() => {
  const list = recommendedUsers.value.slice(0, 6).map((u) => ({
    id: u.userId,
    name: u.handle,
    avatarUrl: u.avatarUrl,
  }));
  if (list.length > 0) return list;
  return [
    { id: 'mock-1', name: '지민', avatarUrl: 'https://i.pravatar.cc/100?img=47' },
    { id: 'mock-2', name: '소연', avatarUrl: 'https://i.pravatar.cc/100?img=32' },
    { id: 'mock-3', name: '서윤', avatarUrl: 'https://i.pravatar.cc/100?img=5' },
    { id: 'mock-4', name: '민재', avatarUrl: 'https://i.pravatar.cc/100?img=12' },
    { id: 'mock-5', name: '다은', avatarUrl: 'https://i.pravatar.cc/100?img=23' },
  ];
});

const tabs: Array<{ key: FeedTab; label: string }> = [
  { key: 'FOLLOWING', label: '팔로잉' },
  { key: 'POPULAR', label: '인기' },
  { key: 'NEARBY', label: '내 주변' },
  { key: 'BY_WORK', label: '작품별' },
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
  shareTarget.value = p;
}

function closeShareSheet(): void {
  shareTarget.value = null;
}

function postShareUrl(p: FeedPost): string {
  return `${window.location.origin}/shot/${p.id}`;
}

async function onCopyLink(): Promise<void> {
  const p = shareTarget.value;
  closeShareSheet();
  if (!p) return;
  const url = postShareUrl(p);
  try {
    await navigator.clipboard.writeText(url);
    await showCenter('링크가 복사되었습니다');
  } catch {
    await showError('링크를 복사할 수 없어요');
  }
}

async function onShareKakao(): Promise<void> {
  const p = shareTarget.value;
  closeShareSheet();
  if (!p) return;

  // 콘솔에서 발급받은 커스텀 템플릿이 있으면 .env 에 주입 — 없으면
  // 기본 feed 템플릿으로 폴백.
  const rawTpl = import.meta.env.VITE_KAKAO_SHARE_TEMPLATE_ID as string | undefined;
  const templateId = rawTpl ? Number(rawTpl) : undefined;

  try {
    await shareKakao({
      title: `${p.work.title} · ${p.place.name}`,
      description: p.caption?.trim()
        ? p.caption
        : `${p.author.handle}의 성지 인증샷`,
      imageUrl: p.imageUrl,
      linkUrl: postShareUrl(p),
      templateId: Number.isFinite(templateId) ? templateId : undefined,
      serverCallbackArgs: { post_id: String(p.id), source: 'feed' },
    });
    // 성공 경로 — 분석용 로그 (백엔드 연결 시 analytics.track 으로 교체).
    console.debug('[share] kakao dispatched', { postId: p.id });
  } catch (e) {
    const url = postShareUrl(p);
    const code = e instanceof KakaoShareError ? e.code : 'UNKNOWN';
    console.warn('[share] kakao failed', code, e);

    if (code === 'MISSING_KEY') {
      await copyWithFallback(url, '카카오 앱 키가 설정되지 않아 링크를 복사했어요');
      return;
    }
    if (code === 'SDK_LOAD_FAILED' || code === 'SDK_MISSING') {
      await copyWithFallback(url, '카카오 SDK 로드 실패 · 링크를 복사했어요');
      return;
    }
    await copyWithFallback(url, '카카오 공유가 차단되어 링크를 복사했어요');
  }
}

async function copyWithFallback(url: string, fallbackMsg: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    await showCenter(fallbackMsg);
  } catch {
    await showError('공유할 수 없어요');
  }
}

async function onShareApp(appName: string): Promise<void> {
  closeShareSheet();
  await showInfo(`${appName} 공유는 곧 공개됩니다`);
}

async function onSaveToFiles(): Promise<void> {
  closeShareSheet();
  await showInfo('파일에 저장은 곧 공개됩니다');
}

async function onOpenInBrowser(): Promise<void> {
  const p = shareTarget.value;
  closeShareSheet();
  if (!p) return;
  window.open(postShareUrl(p), '_blank', 'noopener,noreferrer');
}

async function onBookmarkTarget(): Promise<void> {
  const p = shareTarget.value;
  closeShareSheet();
  if (!p) return;
  await savedStore.toggleSave(p.place.id);
  if (savedStore.error) {
    await showError(savedStore.error);
    return;
  }
  await showCenter(savedStore.isSaved(p.place.id) ? '저장되었습니다' : '저장이 해제되었습니다');
}

async function onReport(): Promise<void> {
  closeShareSheet();
  await showInfo('문제 신고는 곧 공개됩니다');
}

async function onMore(): Promise<void> {
  await showInfo('메뉴는 곧 공개됩니다');
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

function recoProgressText(u: FeedUser): string {
  if (u.stampCountForWork <= 0) return '';
  if (u.workTitle) return `${u.workTitle} ${u.stampCountForWork}곳 수집`;
  return `${u.stampCountForWork}곳 수집`;
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
  padding-bottom: calc(100px + env(safe-area-inset-bottom));
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

<!-- Teleport 된 바텀시트는 body 로 올라가므로 scoped 밖에서 스타일링. -->
<style>
.share-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.38);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: share-fade-in 0.18s ease-out;
  padding: 0 8px calc(8px + env(safe-area-inset-bottom));
  overflow-y: auto;
}
.share-sheet {
  position: relative;
  width: 100%;
  max-width: 480px;
  background: rgba(245, 245, 250, 0.82);
  backdrop-filter: saturate(180%) blur(28px);
  -webkit-backdrop-filter: saturate(180%) blur(28px);
  border-radius: 13px;
  border: 0.5px solid rgba(255, 255, 255, 0.6);
  padding: 0;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.22);
  animation: share-slide-up 0.22s cubic-bezier(0.2, 0.7, 0.2, 1);
  color: var(--fr-ink);
  overflow: hidden;
}
.share-sheet .close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(118, 118, 128, 0.22);
  color: rgba(60, 60, 67, 0.72);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  z-index: 2;
}

/* Preview card */
.share-sheet .preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 56px 14px 16px;
}
.share-sheet .pv-thumb {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  overflow: hidden;
  background: #e2e8f0;
  flex-shrink: 0;
}
.share-sheet .pv-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.share-sheet .pv-meta { flex: 1; min-width: 0; }
.share-sheet .pv-t {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.share-sheet .pv-s {
  font-size: 12px;
  color: var(--fr-ink-3);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.share-sheet .pv-url {
  font-size: 11px;
  color: var(--fr-ink-4);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Shared row styles */
.share-sheet .row-scroll {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 14px 16px 16px;
  border-top: 0.5px solid rgba(60, 60, 67, 0.18);
}
.share-sheet .row-scroll.apps { gap: 18px; }

/* Contacts */
.share-sheet .contact {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  flex-shrink: 0;
  width: 62px;
}
.share-sheet .contact .avatar {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: visible;
  background: #e2e8f0;
}
.share-sheet .contact .avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}
.share-sheet .kakao-badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fee500;
  color: #181600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 5px rgba(15, 23, 42, 0.18);
}
.share-sheet .contact .nm {
  font-size: 11px;
  font-weight: 600;
  color: var(--fr-ink-2);
  letter-spacing: -0.01em;
  max-width: 62px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Apps */
.share-sheet .app {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  flex-shrink: 0;
  width: 64px;
}
.share-sheet .sqr {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.14);
}
.share-sheet .kakao-sqr { background: #fee500; color: #181600; }
.share-sheet .msg-sqr { background: linear-gradient(180deg, #5de069 0%, #2fb94a 100%); }
.share-sheet .mail-sqr { background: linear-gradient(180deg, #4ea6ff 0%, #1f6fe3 100%); }
.share-sheet .ig-sqr {
  background: linear-gradient(135deg, #feda75 0%, #fa7e1e 18%, #d62976 45%, #962fbf 72%, #4f5bd5 100%);
}
.share-sheet .app .nm {
  font-size: 11px;
  font-weight: 600;
  color: var(--fr-ink-2);
  letter-spacing: -0.01em;
  max-width: 64px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* iOS-style vertical action list */
.share-sheet .action-list {
  border-top: 0.5px solid rgba(60, 60, 67, 0.18);
  background: rgba(255, 255, 255, 0.55);
}
.share-sheet .list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 0 16px;
  height: 52px;
  background: transparent;
  border: none;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.16);
  color: var(--fr-ink);
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  font: inherit;
  text-align: left;
}
.share-sheet .list-row:last-child { border-bottom: none; }
.share-sheet .list-row:active { background: rgba(60, 60, 67, 0.08); }
.share-sheet .list-row .row-lbl {
  flex: 1;
  font-size: 15.5px;
  font-weight: 500;
  letter-spacing: -0.02em;
}
.share-sheet .list-row .row-ic {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: rgba(120, 120, 128, 0.14);
  color: var(--fr-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.share-sheet .list-row.danger { color: var(--fr-coral); }
.share-sheet .list-row.danger .row-ic {
  background: rgba(255, 90, 95, 0.12);
  color: var(--fr-coral);
}

.share-sheet .contact:active .avatar,
.share-sheet .app:active .sqr {
  transform: scale(0.94);
  transition: transform 0.05s ease-out;
}

@keyframes share-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes share-slide-up {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
