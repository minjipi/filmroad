import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

export type GallerySort = 'RECENT' | 'POPULAR' | 'SCENE_COMPARE';
export type GalleryViewMode = 'FEED' | 'GRID';

export interface GalleryPlaceHeader {
  placeId: number;
  name: string;
  contentTitle: string;
  contentEpisode: string | null;
  totalPhotoCount: number;
  contentId: number | null;
}

export interface GalleryPhoto {
  id: number;
  imageUrl: string;
  caption: string | null;
  // 작성자 user numeric id. anonymous 시드 사진은 null — 클릭이 disable 된다.
  authorUserId: number | null;
  authorNickname: string;
  authorHandle: string;
  authorAvatarUrl: string | null;
  authorVerified: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  sceneCompare: boolean;
  /** 뷰어 기준 좋아요 여부. 비로그인은 항상 false (backend task #24). */
  liked: boolean;
}

export interface GalleryResponse {
  place: GalleryPlaceHeader;
  photos: GalleryPhoto[];
  total: number;
  page: number;
  size: number;
  sort: GallerySort;
}

interface State {
  placeHeader: GalleryPlaceHeader | null;
  photos: GalleryPhoto[];
  total: number;
  sort: GallerySort;
  viewMode: GalleryViewMode;
  page: number;
  size: number;
  loading: boolean;
  error: string | null;
}

export const useGalleryStore = defineStore('gallery', {
  state: (): State => ({
    placeHeader: null,
    photos: [],
    total: 0,
    sort: 'RECENT',
    viewMode: 'FEED',
    page: 0,
    size: 20,
    loading: false,
    error: null,
  }),
  actions: {
    async fetch(placeId: number): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const params = { sort: this.sort, page: 0, size: this.size };
        const { data } = await api.get<GalleryResponse>(
          `/api/places/${placeId}/photos`,
          { params },
        );
        this.placeHeader = data.place;
        this.photos = data.photos;
        this.total = data.total;
        this.page = data.page;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load gallery';
      } finally {
        this.loading = false;
      }
    },
    async setSort(s: GallerySort): Promise<void> {
      if (this.sort === s) return;
      this.sort = s;
      if (this.placeHeader) await this.fetch(this.placeHeader.placeId);
    },
    setViewMode(m: GalleryViewMode): void {
      this.viewMode = m;
    },
    async loadMore(): Promise<void> {
      if (!this.placeHeader) return;
      if (this.photos.length >= this.total) return;
      this.loading = true;
      try {
        const params = { sort: this.sort, page: this.page + 1, size: this.size };
        const { data } = await api.get<GalleryResponse>(
          `/api/places/${this.placeHeader.placeId}/photos`,
          { params },
        );
        this.photos = [...this.photos, ...data.photos];
        this.page = data.page;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load more';
      } finally {
        this.loading = false;
      }
    },
    /**
     * task #25: clear stale state when leaving the page so a re-entry to a
     * different `/gallery/:placeId` doesn't briefly flash the previous
     * place's photos. Mirrors the pattern in shotDetail / userProfile.
     */
    reset(): void {
      this.placeHeader = null;
      this.photos = [];
      this.total = 0;
      this.sort = 'RECENT';
      this.viewMode = 'FEED';
      this.page = 0;
      this.size = 20;
      this.loading = false;
      this.error = null;
    },

    /**
     * 인증샷 좋아요 토글 — feedStore.toggleLikePost 의 동등 짝. place 모드의
     * FeedDetailPage 가 galleryStore.photos 를 source 로 쓰는데, feedStore 의
     * 토글은 자기 posts 만 갱신하므로 이 store 자체에 토글 액션이 필요하다.
     * 비로그인이면 LoginPrompt 를 띄우고 noop. 응답의 {liked, likeCount} 로
     * 해당 photo state 즉시 반영.
     */
    async toggleLike(photoId: number): Promise<void> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('좋아요는 로그인 후 이용할 수 있어요.');
        return;
      }
      try {
        const { data } = await api.post<{ liked: boolean; likeCount: number }>(
          `/api/photos/${photoId}/like`,
        );
        const photo = this.photos.find((p) => p.id === photoId);
        if (photo) {
          photo.liked = data.liked;
          photo.likeCount = data.likeCount;
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to toggle like';
      }
    },

    /**
     * 본인 인증샷 hard delete — DELETE /api/photos/:id 후 photos 에서 splice +
     * placeHeader.totalPhotoCount 감소. shotDetail.deleteAppendedShot 와 동일
     * contract. 권한 검사는 백엔드가 PHOTO_UNAUTHORIZED 로 차단.
     */
    async deletePhoto(photoId: number): Promise<boolean> {
      try {
        await api.delete(`/api/photos/${photoId}`);
        this.photos = this.photos.filter((p) => p.id !== photoId);
        this.total = Math.max(0, this.total - 1);
        if (this.placeHeader) {
          this.placeHeader = {
            ...this.placeHeader,
            totalPhotoCount: Math.max(0, this.placeHeader.totalPhotoCount - 1),
          };
        }
        return true;
      } catch (e) {
        this.error = e instanceof Error ? e.message : '삭제에 실패했어요';
        return false;
      }
    },
  },
});
