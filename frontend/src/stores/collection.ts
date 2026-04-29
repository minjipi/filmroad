import { defineStore } from 'pinia';
import api from '@/services/api';

// Matches the server's CollectionDetail response. Optional fields are those
// that only apply to work-based collections or paid features — CUSTOM
// collections leave them null.
export type CollectionKind = 'WORK' | 'CUSTOM';
export type CollectionPrivacy = 'PRIVATE' | 'PUBLIC';

export interface CollectionOwner {
  id: number;
  nickname: string;
  avatarUrl: string | null;
}

export interface CollectionPlace {
  placeId: number;
  orderIndex: number;
  name: string;
  regionLabel: string;
  coverImageUrl: string;
  // contentId/contentTitle null for CUSTOM collections; populated for WORK-kind.
  contentId: number | null;
  contentTitle: string | null;
  contentEpisode: string | null;
  sceneTimestamp: string | null;
  distanceKm: number | null;
  likeCount: number;
  photoCount: number;
  visited: boolean;
  visitedAt: string | null;
  certified: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface CollectionDetail {
  id: number;
  name: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  kind: CollectionKind;
  contentTitle: string | null;
  createdAt: string;
  totalPlaces: number;
  visitedPlaces: number;
  certifiedPlaces: number;
  totalDistanceKm: number | null;
  likeCount: number | null;
  owner: CollectionOwner;
  privacy: CollectionPrivacy;
  upcomingPlaces: CollectionPlace[];
  visitedPlacesList: CollectionPlace[];
}

interface State {
  detail: CollectionDetail | null;
  loading: boolean;
  error: string | null;
}

export const useCollectionStore = defineStore('collection', {
  state: (): State => ({
    detail: null,
    loading: false,
    error: null,
  }),
  getters: {
    // Progress % — computed from visited/total so the UI doesn't have to
    // re-derive. Zero-total collections render 0% (not NaN).
    progressPercent: (state): number => {
      const d = state.detail;
      if (!d || d.totalPlaces === 0) return 0;
      return Math.round((d.visitedPlaces / d.totalPlaces) * 100);
    },
    remainingCount: (state): number => {
      const d = state.detail;
      if (!d) return 0;
      return Math.max(0, d.totalPlaces - d.visitedPlaces);
    },
  },
  actions: {
    async fetchDetail(id: number): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<CollectionDetail>(
          `/api/saved/collections/${id}`,
        );
        this.detail = data;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load collection';
      } finally {
        this.loading = false;
      }
    },
    reset(): void {
      this.detail = null;
      this.error = null;
    },
  },
});
