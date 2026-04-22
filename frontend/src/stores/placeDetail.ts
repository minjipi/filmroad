import { defineStore } from 'pinia';
import api from '@/services/api';

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
  likedIds: number[];
  savedIds: number[];
}

export const usePlaceDetailStore = defineStore('placeDetail', {
  state: (): State => ({
    place: null,
    photos: [],
    related: [],
    loading: false,
    error: null,
    likedIds: [],
    savedIds: [],
  }),
  getters: {
    isLiked: (state) => (id: number): boolean => state.likedIds.includes(id),
    isSaved: (state) => (id: number): boolean => state.savedIds.includes(id),
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
    toggleLikeLocal(id: number): void {
      const i = this.likedIds.indexOf(id);
      if (i >= 0) this.likedIds.splice(i, 1);
      else this.likedIds.push(id);
    },
    toggleSaveLocal(id: number): void {
      const i = this.savedIds.indexOf(id);
      if (i >= 0) this.savedIds.splice(i, 1);
      else this.savedIds.push(id);
    },
  },
});
