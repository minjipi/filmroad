import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import type { FeedPost } from '@/stores/feed';

// Matches backend `PhotoDetailResponse` (task #39 final shape).
export type PhotoVisibility = 'PUBLIC' | 'PRIVATE';

export interface ShotAuthor {
  id: number;
  nickname: string;
  handle: string;
  avatarUrl: string | null;
  verified: boolean;
  isMe: boolean;
  /** viewer 가 author 를 follow 중인지. isMe / fallback 작성자 면 false. */
  following: boolean;
}

export interface ShotPlace {
  id: number;
  name: string;
  regionLabel: string;
  latitude: number;
  longitude: number;
}

export interface ShotWork {
  id: number;
  title: string;
  network: string | null;
  episode: string | null;
  sceneTimestamp: string | null;
}

// A single frame inside a multi-image post (task #45a/b 1:N model). The lead
// frame's fields still live at the top of ShotDetail; `images` lists the
// whole batch so the hero can render a carousel when length > 1. `id` here
// is the PlacePhotoImage row id, separate from the post's `id`.
export interface ShotImage {
  id: number;
  imageUrl: string;
  imageOrderIndex: number;
}

// Matches backend `PhotoDetailCommentDto` — flat author shape on purpose
// (backend DTO comment: "프론트 ShotDetailPage 가 flat shape 을 쓰므로
// author 는 nested 하지 않고 authorHandle / authorAvatarUrl 로 펼침").
// Distinct from `Comment` in @/stores/comment, which uses the nested
// CommentAuthor shape returned by /api/photos/:id/comments.
export interface ShotComment {
  id: number;
  content: string;
  createdAt: string;
  authorHandle: string | null;
  authorAvatarUrl: string | null;
  /** Currently stub=0 on the backend (PostComment has no like field yet). */
  likeCount: number;
  /** Currently stub=false. */
  liked: boolean;
  /** Currently stub=false (no reply entity yet). */
  isReply: boolean;
}

export interface ShotDetail {
  id: number;
  imageUrl: string;
  /** Drama scene reference frame — null for non-scene shots. */
  sceneImageUrl: string | null;
  caption: string | null;
  tags: string[];
  createdAt: string;
  visibility: PhotoVisibility;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  saved: boolean;
  author: ShotAuthor;
  place: ShotPlace;
  work: ShotWork;
  /** All photos uploaded in this batch — length 1 for a single-image post. */
  images: ShotImage[];
  topComments: ShotComment[];
  moreCommentsCount: number;
}

interface State {
  shot: ShotDetail | null;
  loading: boolean;
  error: string | null;
  // ---- Infinite scroll (task #15) ----
  // Subsequent shots loaded after the primary `shot`. Backend (task #14)
  // reuses the existing `/api/feed?tab=RECENT&cursor=<id>&limit=N` endpoint
  // — same cursor-based pagination + visibility filter + ID-DESC ordering
  // that the main feed uses. The seed cursor is the primary shot id; the
  // server auto-dedupes that shot from the response so we don't have to.
  // Driven by an IntersectionObserver in ShotDetailPage. On endpoint
  // failure the catch block sets `nextEndReached=true` so the observer
  // stops firing instead of spam-retrying.
  appendedShots: FeedPost[];
  nextLoading: boolean;
  /** True once the cursor pagination is exhausted or the endpoint failed. */
  nextEndReached: boolean;
  nextError: string | null;
  /** Last-seen cursor (server-side opaque string); null until first load. */
  nextCursor: string | null;
}

interface FeedNextResponse {
  posts: FeedPost[];
  hasMore: boolean;
  nextCursor: string | null;
}

// 무한 스크롤 페이지 사이즈 — backend-dev 가이드(`/api/feed` 재사용, task
// #14 회신) 의 권장 limit=10 그대로. 메인 feed store 의 DEFAULT_LIMIT 와도
// 정렬되어 캐시/트래픽 패턴이 일관.
const NEXT_PAGE_SIZE = 10;

export const useShotDetailStore = defineStore('shotDetail', {
  state: (): State => ({
    shot: null,
    loading: false,
    error: null,
    appendedShots: [],
    nextLoading: false,
    nextEndReached: false,
    nextError: null,
    nextCursor: null,
  }),
  actions: {
    async fetchShot(id: number): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<ShotDetail>(`/api/photos/${id}`);
        this.shot = data;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load shot';
      } finally {
        this.loading = false;
      }
    },
    // Photo-level like — mirrors feedStore.toggleLikePost but scoped to this
    // page's single shot. POSTs to `/api/photos/:id/like`, then updates the
    // in-flight detail in place so the UI reflects the new state immediately.
    async toggleLike(): Promise<void> {
      if (!this.shot) return;
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('좋아요는 로그인 후 이용할 수 있어요.');
        return;
      }
      const photoId = this.shot.id;
      try {
        const { data } = await api.post<{ liked: boolean; likeCount: number }>(
          `/api/photos/${photoId}/like`,
        );
        if (this.shot) {
          this.shot.liked = data.liked;
          this.shot.likeCount = data.likeCount;
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to toggle like';
      }
    },
    /**
     * Author 의 follow 상태 토글. optimistic — 즉시 flip + rollback. isMe 또는
     * author 자체가 fallback (id 없음) 이면 noop.
     */
    async toggleAuthorFollow(): Promise<void> {
      if (!this.shot) return;
      const author = this.shot.author;
      if (author.isMe || author.id == null) return;
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('팔로우는 로그인 후 이용할 수 있어요.');
        return;
      }
      const wasFollowing = author.following;
      author.following = !wasFollowing;
      try {
        const { data } = await api.post<{
          following: boolean;
          followersCount: number;
          followingCount: number;
        }>(`/api/users/${author.id}/follow`);
        if (this.shot) this.shot.author.following = data.following;
      } catch (e) {
        if (this.shot) this.shot.author.following = wasFollowing;
        this.error = e instanceof Error ? e.message : 'Failed to toggle follow';
      }
    },
    /**
     * Like toggle for a card in the infinite-scroll feed (task #18).
     * Same wire format as primary `toggleLike` (`POST /api/photos/:id/like`)
     * but optimistic-mutates the matching `appendedShots` entry. Rollback on
     * any failure restores both `liked` and `likeCount` to their pre-flip
     * values so the UI never settles on a wrong state.
     */
    async toggleAppendedLike(postId: number): Promise<void> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('좋아요는 로그인 후 이용할 수 있어요.');
        return;
      }
      const target = this.appendedShots.find((p) => p.id === postId);
      if (!target) return;
      const originalLiked = target.liked;
      const originalCount = target.likeCount;
      target.liked = !originalLiked;
      target.likeCount = originalCount + (originalLiked ? -1 : 1);
      try {
        const { data } = await api.post<{ liked: boolean; likeCount: number }>(
          `/api/photos/${postId}/like`,
        );
        target.liked = data.liked;
        target.likeCount = data.likeCount;
      } catch (e) {
        target.liked = originalLiked;
        target.likeCount = originalCount;
        this.error = e instanceof Error ? e.message : 'Failed to toggle like';
      }
    },

    /**
     * Author follow toggle for a feed card (task #18). Same endpoint as
     * primary `toggleAuthorFollow`. One viewer can have multiple cards from
     * the same author in the feed, so the optimistic flip applies to ALL
     * matching `appendedShots` entries — and rollback unwinds them all.
     */
    async toggleAppendedFollow(userId: number): Promise<void> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('팔로우는 로그인 후 이용할 수 있어요.');
        return;
      }
      const targets = this.appendedShots.filter((p) => p.author.userId === userId);
      if (targets.length === 0) return;
      const wasFollowing = targets[0].author.following;
      for (const t of targets) t.author.following = !wasFollowing;
      try {
        const { data } = await api.post<{
          following: boolean;
          followersCount: number;
          followingCount: number;
        }>(`/api/users/${userId}/follow`);
        for (const t of targets) t.author.following = data.following;
      } catch (e) {
        for (const t of targets) t.author.following = wasFollowing;
        this.error = e instanceof Error ? e.message : 'Failed to toggle follow';
      }
    },

    /**
     * Load the next page of shots after the current cursor (task #15).
     * Reuses the main `/api/feed?tab=RECENT&cursor=...&limit=...` endpoint.
     * Guards: silently no-ops when already loading, when the end has been
     * reached, or when there's no cursor seed (primary `shot` not loaded).
     * Endpoint failure (network, 5xx, etc.) sets `nextEndReached=true` so
     * the observer disconnects rather than spam-retrying.
     */
    async loadNext(): Promise<void> {
      if (this.nextLoading || this.nextEndReached) return;
      // First call uses the primary shot id as the cursor seed (server
      // dedupes the seed itself from the response). Subsequent calls reuse
      // the server-issued nextCursor.
      const seed: string | number | null =
        this.nextCursor ?? this.shot?.id ?? null;
      if (seed == null) return;

      this.nextLoading = true;
      this.nextError = null;
      try {
        const { data } = await api.get<FeedNextResponse>('/api/feed', {
          params: { tab: 'RECENT', cursor: seed, limit: NEXT_PAGE_SIZE },
        });
        const posts = data?.posts ?? [];
        if (posts.length > 0) {
          this.appendedShots.push(...posts);
        }
        this.nextCursor = data?.nextCursor ?? null;
        // hasMore=false OR cursor=null → end-of-feed.
        if (data?.hasMore === false || this.nextCursor == null) {
          this.nextEndReached = true;
        }
      } catch (e) {
        // Network failure or 5xx — treat any failure as end-of-feed so the
        // trigger stops firing. nextError is kept for optional banner UI.
        this.nextError = e instanceof Error ? e.message : 'Failed to load next shots';
        this.nextEndReached = true;
      } finally {
        this.nextLoading = false;
      }
    },
    reset(): void {
      this.shot = null;
      this.loading = false;
      this.error = null;
      this.appendedShots = [];
      this.nextLoading = false;
      this.nextEndReached = false;
      this.nextError = null;
      this.nextCursor = null;
    },
  },
});
