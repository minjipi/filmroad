import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

export interface PlaceDetailPlace {
  id: number;
  name: string;
  regionLabel: string;
  latitude: number;
  longitude: number;
  coverImageUrl: string;
  workId: number;
  workTitle: string;
  workEpisode: string | null;
  sceneTimestamp: string | null;
  sceneImageUrl: string | null;
  sceneDescription: string | null;
  rating: number;
  reviewCount: number;
  photoCount: number;
  likeCount: number;
  liked: boolean;
  nearbyRestaurantCount: number;
  recommendedTimeLabel: string | null;
  distanceKm: number | null;
  driveTimeMin: number | null;
}

export interface PlacePhoto {
  id: number;
  imageUrl: string;
  authorNickname: string;
}

export interface RelatedPlace {
  id: number;
  name: string;
  coverImageUrl: string;
  workEpisode: string | null;
  regionShort: string;
}

export interface PlaceDetailResponse {
  place: PlaceDetailPlace;
  photos: PlacePhoto[];
  related: RelatedPlace[];
}

interface FetchOptions {
  lat?: number;
  lng?: number;
}

interface State {
  place: PlaceDetailPlace | null;
  photos: PlacePhoto[];
  related: RelatedPlace[];
  loading: boolean;
  error: string | null;
}

export const usePlaceDetailStore = defineStore('placeDetail', {
  state: (): State => ({
    place: null,
    photos: [],
    related: [],
    loading: false,
    error: null,
  }),
  getters: {
    isLiked: (state) => (id: number): boolean =>
      state.place !== null && state.place.id === id && state.place.liked === true,
  },
  actions: {
    async fetch(id: number, opts: FetchOptions = {}): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const params: Record<string, string | number> = {};
        if (typeof opts.lat === 'number') params.lat = opts.lat;
        if (typeof opts.lng === 'number') params.lng = opts.lng;
        const { data } = await api.get<PlaceDetailResponse>(`/api/places/${id}`, { params });
        this.place = data.place;
        this.photos = data.photos;
        this.related = data.related;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load place';
      } finally {
        this.loading = false;
      }
    },
    async toggleLike(): Promise<void> {
      const p = this.place;
      if (!p) return;
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('좋아요는 로그인 후 이용할 수 있어요.');
        return;
      }
      try {
        const { data } = await api.post<{ liked: boolean; likeCount: number }>(
          `/api/places/${p.id}/like`,
        );
        p.liked = data.liked;
        p.likeCount = data.likeCount;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to toggle like';
      }
    },
  },
});
