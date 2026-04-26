import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

// Matches backend `PhotoDetailResponse` (task #39 final shape).
export type PhotoVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

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
  /** Full street address — optional. Used by the loc-card when present. */
  address: string | null;
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
}

export const useShotDetailStore = defineStore('shotDetail', {
  state: (): State => ({
    shot: null,
    loading: false,
    error: null,
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
    reset(): void {
      this.shot = null;
      this.loading = false;
      this.error = null;
    },
  },
});
