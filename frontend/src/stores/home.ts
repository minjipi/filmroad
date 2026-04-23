import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

export interface WorkSummary {
  id: number;
  title: string;
}

export interface PopularWork {
  id: number;
  title: string;
  // Optional cover/poster (3:4 card art). Falls back to an initial chip when
  // absent — backend may omit for works without licensed artwork.
  posterUrl?: string | null;
  // Number of 성지 registered under this work; rendered as "N곳" under title.
  placeCount: number;
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
  // Added in task #24 alongside backend #23. Optional so older servers
  // keep working — the frontend just renders an empty carousel.
  popularWorks?: PopularWork[];
}

// 'POPULAR_WORKS' swaps the grid from places → works (task #24 refactor).
// No network round-trip is needed — popularWorks ships on every /api/home
// response, so the store just flips the view mode.
export type HomeScope = 'NEAR' | 'TRENDING' | 'POPULAR_WORKS';

interface FetchOptions {
  lat?: number;
  lng?: number;
}

interface State {
  hero: Hero | null;
  works: WorkSummary[];
  places: PlaceSummary[];
  popularWorks: PopularWork[];
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
    popularWorks: [],
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
        this.popularWorks = data.popularWorks ?? [];
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
      // POPULAR_WORKS is a view-only toggle — works grid renders from the
      // already-hydrated popularWorks array, no network round-trip needed.
      // NEAR / TRENDING affect the server-side place sort, so those still
      // refetch.
      if (s === 'POPULAR_WORKS') return;
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
