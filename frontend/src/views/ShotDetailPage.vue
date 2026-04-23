<template>
  <ion-page>
    <ion-content :fullscreen="true" class="sd-content">
      <header class="sd-top">
        <button type="button" class="ic-btn" aria-label="back" @click="onBack">
          <ion-icon :icon="chevronBack" class="ic-22" />
        </button>
        <div class="right">
          <button type="button" class="ic-btn" aria-label="share" @click="onShare">
            <ion-icon :icon="shareSocialOutline" class="ic-20" />
          </button>
          <button type="button" class="ic-btn" aria-label="more" @click="onMore">
            <ion-icon :icon="ellipsisHorizontal" class="ic-20" />
          </button>
        </div>
      </header>

      <div class="sd-scroll no-scrollbar">
        <section class="compare">
          <img :src="shot.originalImageUrl" alt="드라마 원본" />
          <img :src="shot.userImageUrl" class="top-img" alt="내 인증샷" />
          <div class="divider">
            <span class="divider-handle">
              <ion-icon :icon="swapHorizontal" class="ic-16" />
            </span>
          </div>
          <span class="lbl-chip l">드라마 원본</span>
          <span class="lbl-chip r">
            <ion-icon :icon="checkmark" class="ic-16" />내 인증샷
          </span>
          <div class="scene-meta">
            <ion-icon :icon="filmOutline" class="ic-16" />{{ shot.sceneWork }} · {{ shot.sceneEpisode }}
            <span class="sep" />
            <ion-icon :icon="timeOutline" class="ic-16" />{{ shot.sceneTimestamp }}
          </div>
        </section>

        <section class="sd-user">
          <div class="avatar"><img :src="shot.authorAvatarUrl" :alt="shot.authorName" /></div>
          <div class="meta">
            <div class="nm">
              {{ shot.authorName }}
              <ion-icon v-if="shot.authorVerified" :icon="checkmarkCircle" class="verified" />
            </div>
            <div class="sub">
              <ion-icon :icon="locationOutline" class="ic-16" />
              {{ shot.placeName }} · {{ shot.takenAtLabel }}
            </div>
          </div>
          <button type="button" class="follow" @click="onAuthorAction">{{ authorActionLabel }}</button>
        </section>

        <section class="sd-stats">
          <button
            type="button"
            :class="['sd-stat-btn', liked ? 'liked' : '']"
            @click="onToggleLike"
          >
            <span class="stat-inner">
              <ion-icon :icon="liked ? heart : heartOutline" class="ic-22" />
              <span class="n">{{ formatCount(likeCount) }}</span>
              <span class="l">좋아요</span>
            </span>
          </button>
          <button type="button" class="sd-stat-btn" @click="onScrollToComments">
            <span class="stat-inner">
              <ion-icon :icon="chatbubbleOutline" class="ic-22" />
              <span class="n">{{ formatCount(shot.commentCount) }}</span>
              <span class="l">댓글</span>
            </span>
          </button>
          <button
            type="button"
            :class="['sd-stat-btn', bookmarked ? 'saved' : '']"
            @click="onToggleBookmark"
          >
            <span class="stat-inner">
              <ion-icon :icon="bookmarked ? bookmark : bookmarkOutline" class="ic-22" />
              <span class="n">{{ formatCount(bookmarkCount) }}</span>
              <span class="l">저장</span>
            </span>
          </button>
          <button type="button" class="sd-stat-btn" @click="onShare">
            <span class="stat-inner">
              <ion-icon :icon="paperPlaneOutline" class="ic-22" />
              <span class="n">{{ formatCount(shot.shareCount) }}</span>
              <span class="l">공유</span>
            </span>
          </button>
        </section>

        <section class="sd-caption">
          <p class="body" v-html="shot.captionHtml" />
          <div class="tags">
            <span v-for="t in shot.tags" :key="t" class="tag">#{{ t }}</span>
          </div>
          <div class="date">{{ shot.takenAtFullLabel }}</div>
        </section>

        <section class="loc-card" @click="onOpenPlace">
          <div class="loc-map-thumb" />
          <div class="meta">
            <div class="pl">{{ shot.placeName }}</div>
            <div class="ad">{{ shot.placeAddress }}</div>
          </div>
          <button type="button" class="go" aria-label="open-place">
            <ion-icon :icon="arrowForward" class="ic-20" />
          </button>
        </section>

        <section class="scene-card" @click="onOpenScene">
          <div class="head">
            <span class="drama-ic">
              <ion-icon :icon="filmOutline" class="ic-18" />
            </span>
            <div class="title-block">
              <div class="t">원본 장면 보기</div>
              <div class="s">{{ shot.sceneWork }} {{ shot.sceneEpisode }} · {{ shot.sceneTimestamp }} · {{ shot.sceneNetwork }}</div>
            </div>
            <ion-icon :icon="chevronForwardOutline" class="ic-18 chev" />
          </div>
          <div class="body play">
            <img :src="shot.originalImageUrl" :alt="shot.sceneWork" />
            <button type="button" class="play-btn" aria-label="play">
              <ion-icon :icon="play" class="ic-20" />
            </button>
            <span class="play-time">{{ shot.sceneTimestamp }}</span>
          </div>
        </section>

        <section class="comments" ref="commentsRef">
          <h4>
            댓글 <span class="cnt">{{ formatCount(shot.commentCount) }}개</span>
          </h4>
          <div
            v-for="c in shot.comments"
            :key="c.id"
            :class="['cmt', c.isReply ? 'is-reply' : '']"
          >
            <div class="av"><img :src="c.avatarUrl" :alt="c.handle" /></div>
            <div class="body">
              <div class="top">
                <span class="nm">{{ c.handle }}</span>
                <span class="dt">· {{ c.timeLabel }}</span>
              </div>
              <div class="txt">{{ c.text }}</div>
              <div class="act-row">
                <span :class="['like-btn', c.liked ? 'on' : '']">
                  <ion-icon :icon="heart" class="ic-16" />{{ c.likeCount }}
                </span>
                <span>답글 달기</span>
              </div>
            </div>
          </div>
          <div v-if="shot.moreCommentsCount > 0" class="see-more">
            댓글 {{ shot.moreCommentsCount }}개 더 보기
          </div>
        </section>
      </div>

      <div class="cmt-input-wrap">
        <div class="me-av"><img :src="shot.meAvatarUrl" alt="me" /></div>
        <div class="box">댓글을 남겨보세요…</div>
        <button type="button" class="send" aria-label="send">
          <ion-icon :icon="paperPlaneOutline" class="ic-18" />
        </button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  chevronBack,
  chevronForwardOutline,
  shareSocialOutline,
  ellipsisHorizontal,
  swapHorizontal,
  checkmark,
  checkmarkCircle,
  filmOutline,
  timeOutline,
  locationOutline,
  heart,
  heartOutline,
  chatbubbleOutline,
  bookmark,
  bookmarkOutline,
  paperPlaneOutline,
  arrowForward,
  play,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useToast } from '@/composables/useToast';

defineProps<{ id: string | number }>();

const router = useRouter();
const { showInfo } = useToast();

interface ShotComment {
  id: number;
  handle: string;
  avatarUrl: string;
  timeLabel: string;
  text: string;
  likeCount: number;
  liked: boolean;
  isReply: boolean;
}

interface ShotDetail {
  originalImageUrl: string;
  userImageUrl: string;
  sceneWork: string;
  sceneEpisode: string;
  sceneTimestamp: string;
  sceneNetwork: string;
  authorName: string;
  authorVerified: boolean;
  authorAvatarUrl: string;
  isMine: boolean;
  placeName: string;
  placeAddress: string;
  takenAtLabel: string;
  takenAtFullLabel: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  shareCount: number;
  captionHtml: string;
  tags: string[];
  comments: ShotComment[];
  moreCommentsCount: number;
  meAvatarUrl: string;
}

const shot: ShotDetail = {
  originalImageUrl:
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
  userImageUrl:
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=900&q=80',
  sceneWork: '도깨비',
  sceneEpisode: '1회',
  sceneTimestamp: '00:15:24',
  sceneNetwork: 'tvN',
  authorName: '김소연',
  authorVerified: true,
  authorAvatarUrl:
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
  isMine: true,
  placeName: '주문진 영진해변 방파제',
  placeAddress: '강원 강릉시 주문진읍 교항리 산51-2',
  takenAtLabel: '2025.10.14',
  takenAtFullLabel: '2025.10.14 · 오후 6시 24분',
  likeCount: 1248,
  commentCount: 89,
  bookmarkCount: 264,
  shareCount: 42,
  captionHtml:
    '메밀꽃 한 다발 들고 기다렸어요 🌾<br/>진짜 김신 나올 뻔... 석양 지는 타이밍 완벽했던 날.',
  tags: ['도깨비', '성지순례', '주문진', '메밀꽃'],
  comments: [
    {
      id: 1,
      handle: 'trip_hj',
      avatarUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      timeLabel: '1시간 전',
      text: '와 이 구도 대박… 저도 다음주에 가려고요! 메밀꽃은 어디서 샀어요?',
      likeCount: 24,
      liked: true,
      isReply: false,
    },
    {
      id: 2,
      handle: 'soyeon_film',
      avatarUrl:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
      timeLabel: '42분 전',
      text: '@trip_hj 영진해변 편의점에 3천원에 팔아요! 해 지기 30분 전이 베스트 🌅',
      likeCount: 12,
      liked: false,
      isReply: true,
    },
    {
      id: 3,
      handle: 'dokkaebi.love',
      avatarUrl:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
      timeLabel: '3시간 전',
      text: '원본 장면이랑 나란히 보니까 소름 돋아요… 사진 진짜 잘 찍으셨어요 🥹',
      likeCount: 18,
      liked: false,
      isReply: false,
    },
    {
      id: 4,
      handle: 'eunbyul_',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      timeLabel: '5시간 전',
      text: '저장해둘게요! 이번 강릉 여행 루트에 추가 📍',
      likeCount: 7,
      liked: false,
      isReply: false,
    },
  ],
  moreCommentsCount: 85,
  meAvatarUrl:
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
};

const liked = ref(true);
const bookmarked = ref(false);
const likeCount = ref(shot.likeCount);
const bookmarkCount = ref(shot.bookmarkCount);
const commentsRef = ref<HTMLElement | null>(null);

const authorActionLabel = computed(() => (shot.isMine ? '내 기록' : '팔로우'));

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return n.toLocaleString('ko-KR');
  return String(n);
}

function onBack(): void {
  router.back();
}

async function onShare(): Promise<void> {
  await showInfo('공유는 곧 공개됩니다');
}

async function onMore(): Promise<void> {
  await showInfo('메뉴는 곧 공개됩니다');
}

async function onAuthorAction(): Promise<void> {
  await showInfo(shot.isMine ? '내 기록 화면은 곧 공개됩니다' : '팔로우는 곧 공개됩니다');
}

function onToggleLike(): void {
  if (liked.value) {
    liked.value = false;
    likeCount.value -= 1;
  } else {
    liked.value = true;
    likeCount.value += 1;
  }
}

function onToggleBookmark(): void {
  if (bookmarked.value) {
    bookmarked.value = false;
    bookmarkCount.value -= 1;
  } else {
    bookmarked.value = true;
    bookmarkCount.value += 1;
  }
}

function onScrollToComments(): void {
  commentsRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function onOpenPlace(): Promise<void> {
  await showInfo('촬영지 상세는 곧 공개됩니다');
}

async function onOpenScene(): Promise<void> {
  await showInfo('원본 장면 재생은 곧 공개됩니다');
}
</script>

<style scoped>
ion-content.sd-content {
  --background: #ffffff;
}

.sd-scroll {
  overflow-y: auto;
  padding-bottom: calc(140px + env(safe-area-inset-bottom));
}

.sd-top {
  position: absolute;
  top: calc(8px + env(safe-area-inset-top));
  left: 0;
  right: 0;
  z-index: 30;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}
.sd-top .ic-btn {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(10px);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: pointer;
}
.sd-top .right { display: flex; gap: 8px; }

/* Compare hero */
.compare {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 5;
  background: #000000;
  overflow: hidden;
}
.compare img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.compare .top-img {
  clip-path: inset(0 50% 0 0);
}
.divider {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  background: #ffffff;
  transform: translateX(-50%);
  z-index: 3;
}
.divider-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-ink);
}

.lbl-chip {
  position: absolute;
  z-index: 3;
  font-size: 10.5px;
  font-weight: 800;
  padding: 5px 10px;
  border-radius: 999px;
  backdrop-filter: blur(8px);
  letter-spacing: -0.01em;
}
.lbl-chip.l {
  top: calc(60px + env(safe-area-inset-top));
  left: 14px;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
}
.lbl-chip.r {
  top: calc(60px + env(safe-area-inset-top));
  right: 14px;
  background: rgba(20, 188, 237, 0.95);
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 4px;
}

.scene-meta {
  position: absolute;
  left: 14px;
  bottom: 14px;
  z-index: 3;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 11.5px;
  font-weight: 700;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  gap: 8px;
}
.scene-meta .sep {
  width: 1px;
  height: 10px;
  background: rgba(255, 255, 255, 0.3);
}

/* User header */
.sd-user {
  padding: 16px 20px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--fr-line-soft);
}
.avatar {
  width: 44px; height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: #eeeeee;
  flex-shrink: 0;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sd-user .meta { flex: 1; min-width: 0; }
.sd-user .nm {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--fr-ink);
}
.sd-user .verified {
  width: 14px;
  height: 14px;
  color: var(--fr-primary);
}
.sd-user .sub {
  font-size: 11.5px;
  color: var(--fr-ink-3);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.sd-user .follow {
  height: 32px;
  padding: 0 14px;
  border-radius: 10px;
  background: var(--fr-primary-soft);
  color: var(--fr-primary);
  border: none;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
}

/* Stats bar */
.sd-stats {
  display: flex;
  gap: 6px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--fr-line-soft);
}
.sd-stat-btn {
  flex: 1;
  min-width: 0;
  background: var(--fr-bg-muted);
  border: none;
  padding: 10px 4px;
  border-radius: 12px;
  color: var(--fr-ink);
  cursor: pointer;
  /* WebKit <button> elements can't reliably be flex containers, so the
     vertical stack lives on the inner <span>. */
  -webkit-appearance: none;
  appearance: none;
  font: inherit;
}
.sd-stat-btn .stat-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  line-height: 1.2;
}
.sd-stat-btn .stat-inner ion-icon {
  display: block;
  flex-shrink: 0;
}
.sd-stat-btn .n {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.sd-stat-btn .l {
  font-size: 10.5px;
  color: var(--fr-ink-3);
  font-weight: 700;
}
.sd-stat-btn.liked {
  background: #fff1f2;
  color: var(--fr-coral);
}
.sd-stat-btn.liked .l { color: var(--fr-coral); }
.sd-stat-btn.saved {
  background: #fff7e6;
  color: #d97706;
}
.sd-stat-btn.saved .l { color: #d97706; }

/* Caption */
.sd-caption {
  padding: 16px 20px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fr-ink);
}
.sd-caption .body { margin: 0; }
.sd-caption .tags {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sd-caption .tag {
  color: var(--fr-primary);
  font-weight: 700;
}
.sd-caption .date {
  margin-top: 10px;
  font-size: 11px;
  color: var(--fr-ink-4);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Location card */
.loc-card {
  margin: 6px 20px 16px;
  background: var(--fr-bg-muted);
  border-radius: 16px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.loc-map-thumb {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background:
    radial-gradient(circle at 30% 30%, #d9e7f2, transparent 60%),
    linear-gradient(180deg, #eef3f8, #dbe7f0);
  position: relative;
}
.loc-map-thumb::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--fr-coral);
  border: 2px solid #ffffff;
  transform: translate(-50%, -100%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}
.loc-card .meta { flex: 1; min-width: 0; }
.loc-card .pl {
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.loc-card .ad {
  font-size: 11.5px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}
.loc-card .go {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #ffffff;
  color: var(--fr-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
}

/* Scene card */
.scene-card {
  margin: 0 20px 16px;
  border-radius: 16px;
  border: 1px solid var(--fr-line);
  overflow: hidden;
  cursor: pointer;
}
.scene-card .head {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--fr-line-soft);
}
.scene-card .head .drama-ic {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--fr-primary-soft);
  color: var(--fr-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.scene-card .head .title-block { flex: 1; min-width: 0; }
.scene-card .head .t {
  font-size: 12.5px;
  font-weight: 800;
  color: var(--fr-ink);
}
.scene-card .head .s {
  font-size: 11px;
  color: var(--fr-ink-3);
  margin-top: 1px;
}
.scene-card .head .chev { color: var(--fr-ink-4); }
.scene-card .body { display: flex; }
.scene-card .body img { width: 100%; display: block; }
.scene-card .play { position: relative; }
.scene-card .play::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle, rgba(0, 0, 0, 0.4) 0%, transparent 60%),
    linear-gradient(to top, rgba(0, 0, 0, 0.5), transparent 40%);
}
.scene-card .play-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  color: var(--fr-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
}
.scene-card .play-time {
  position: absolute;
  bottom: 10px;
  left: 12px;
  z-index: 2;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.65);
  padding: 3px 8px;
  border-radius: 6px;
}

/* Comments */
.comments { padding: 0 20px 24px; }
.comments h4 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fr-ink);
}
.comments h4 .cnt {
  color: var(--fr-ink-4);
  font-weight: 700;
  font-size: 12px;
}
.cmt { display: flex; gap: 10px; padding: 10px 0; }
.cmt.is-reply { padding-left: 42px; }
.cmt .av {
  width: 32px; height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #eeeeee;
}
.cmt .av img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cmt .body { flex: 1; min-width: 0; }
.cmt .top {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}
.cmt .nm { font-weight: 800; color: var(--fr-ink); }
.cmt .dt { color: var(--fr-ink-4); font-size: 10.5px; }
.cmt .txt {
  font-size: 13px;
  color: var(--fr-ink);
  margin-top: 3px;
  line-height: 1.5;
}
.cmt .act-row {
  margin-top: 6px;
  display: flex;
  gap: 14px;
  font-size: 11px;
  color: var(--fr-ink-3);
  font-weight: 700;
}
.cmt .like-btn {
  display: flex;
  align-items: center;
  gap: 3px;
}
.cmt .like-btn.on { color: var(--fr-coral); }
.see-more {
  text-align: center;
  padding-top: 8px;
  font-size: 12px;
  color: var(--fr-primary);
  font-weight: 700;
  cursor: pointer;
}

/* Sticky comment input */
.cmt-input-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: env(safe-area-inset-bottom);
  z-index: 40;
  padding: 10px 16px calc(14px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(16px);
  border-top: 1px solid var(--fr-line);
  display: flex;
  align-items: center;
  gap: 10px;
}
.cmt-input-wrap .me-av {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: #eeeeee;
  flex-shrink: 0;
}
.cmt-input-wrap .me-av img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cmt-input-wrap .box {
  flex: 1;
  background: var(--fr-bg-muted);
  border-radius: 999px;
  padding: 9px 14px;
  font-size: 13px;
  color: var(--fr-ink-4);
}
.cmt-input-wrap .send {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--fr-primary);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}
</style>
