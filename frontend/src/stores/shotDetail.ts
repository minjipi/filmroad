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
}

// Nested comment author — same shape as the post author minus `isMe`.
export interface ShotCommentAuthor {
  id: number;
  nickname: string;
  handle: string;
  avatarUrl: string | null;
  verified: boolean;
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

export interface ShotComment {
  id: number;
  content: string;
  author: ShotCommentAuthor;
  createdAt: string;
  /** Currently stub=0 on the backend (PostComment has no like field yet). */
  likeCount: number;
  /** Currently stub=false. */
  liked: boolean;
  /**
   * Thread parent id — `null` means top-level, non-null means a reply.
   * Backend currently always emits null (no reply entity yet).
   */
  parentId: number | null;
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
    reset(): void {
      this.shot = null;
      this.loading = false;
      this.error = null;
    },
  },
});
