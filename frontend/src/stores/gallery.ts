import { defineStore } from 'pinia';
import api from '@/services/api';

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
  },
});
