import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

// Matches backend `PhotoDetailResponse` (task #39).
export type PhotoVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

export interface ShotAuthor {
  id: number;
  nickname: string;
  handle: string;
  avatarUrl: string | null;
  verified: boolean;
  isMe: boolean;
}

export interface ShotPlace {
  id: number;
  name: string;
  regionLabel: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ShotWork {
  id: number;
  title: string;
  type: string;
  episode: string | null;
  sceneTimestamp: string | null;
  posterUrl: string | null;
  network: string | null;
}

export interface ShotTopComment {
  id: number;
  authorHandle: string;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  isReply: boolean;
}

export interface ShotDetail {
  id: number;
  imageUrl: string;
  dramaSceneImageUrl: string | null;
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
  topComments: ShotTopComment[];
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
