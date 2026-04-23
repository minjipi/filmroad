import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

export interface WorkSummary {
  id: number;
  title: string;
}

export interface PlaceSummary {
  id: number;
  name: string;
  regionLabel: string;
  coverImageUrl: string;
  workId: number;
  workTitle: string;
  liked: boolean;
  likeCount: number;
}

export interface Hero {
  monthLabel: string;
  tag: string;
  title: string;
  subtitle: string;
  workId: number;
  primaryPlaceId: number;
}

export interface HomeResponse {
  hero: Hero;
  works: WorkSummary[];
  places: PlaceSummary[];
}

export type HomeScope = 'NEAR' | 'TRENDING';

interface FetchOptions {
  lat?: number;
  lng?: number;
}

interface State {
  hero: Hero | null;
  works: WorkSummary[];
  places: PlaceSummary[];
  loading: boolean;
  error: string | null;
  selectedWorkId: number | null;
  scope: HomeScope;
}

export const useHomeStore = defineStore('home', {
  state: (): State => ({
    hero: null,
    works: [],
    places: [],
    loading: false,
    error: null,
    selectedWorkId: null,
    scope: 'NEAR',
  }),
  actions: {
    async fetchHome(opts: FetchOptions = {}): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const params: Record<string, string | number> = { scope: this.scope };
        if (this.selectedWorkId !== null) params.workId = this.selectedWorkId;
        if (typeof opts.lat === 'number') params.lat = opts.lat;
        if (typeof opts.lng === 'number') params.lng = opts.lng;
        const { data } = await api.get<HomeResponse>('/api/home', { params });
        this.hero = data.hero;
        this.works = data.works;
        this.places = data.places;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load home';
      } finally {
        this.loading = false;
      }
    },
    async setWork(id: number | null): Promise<void> {
      if (this.selectedWorkId === id) return;
      this.selectedWorkId = id;
      await this.fetchHome();
    },
    async setScope(s: HomeScope): Promise<void> {
      if (this.scope === s) return;
      this.scope = s;
      await this.fetchHome();
    },
    async toggleLike(placeId: number): Promise<void> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('좋아요는 로그인 후 이용할 수 있어요.');
        return;
      }
      try {
        const { data } = await api.post<{ liked: boolean; likeCount: number }>(
          `/api/places/${placeId}/like`,
        );
        const place = this.places.find((p) => p.id === placeId);
        if (place) {
          place.liked = data.liked;
          place.likeCount = data.likeCount;
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to toggle like';
      }
    },
  },
});
