import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

/**
 * 한 장의 작품 씬(scene) — 회차/타임스탬프/설명/이미지 URL 묶음. 백엔드의
 * `PlaceSceneDto` 와 1:1 매핑이며, `orderIndex` ASC 로 정렬된 채로 내려온다.
 * 0번이 대표(primary) — 요약 surface 의 평면 필드 폴백, ShotScoringService 의
 * 비교 기준과 동일.
 */
export interface PlaceScene {
  id: number;
  imageUrl: string;
  workEpisode: string | null;
  sceneTimestamp: string | null;
  sceneDescription: string | null;
  orderIndex: number;
}

export interface PlaceDetailPlace {
  id: number;
  name: string;
  regionLabel: string;
  latitude: number;
  longitude: number;
  // image_order_index ASC 로 정렬된 cover 이미지 배열. 빈 배열은 cover 가 없는 상태.
  coverImageUrls: string[];
  workId: number;
  workTitle: string;
  /**
   * 작품 씬 목록 — `orderIndex` ASC. 0번이 대표(primary). 회차/타임스탬프/설명/
   * 이미지 URL 4종은 모두 이 안에 들어간다 (place 평면 필드에서 제거됨).
   * 등록된 씬이 없으면 빈 배열(null 아님).
   */
  scenes: PlaceScene[];
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
  coverImageUrls: string[];
  sceneImageUrl: string | null;
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
