import { defineStore } from 'pinia';
import api from '@/services/api';

export interface SearchContentResult {
  id: number;
  title: string;
  // Backend (task #16) currently emits 'MOVIE' | 'TV' | 'WEBTOON' style tags
  // we may surface as chips in a later pass. Optional so clients without it
  // keep rendering.
  type?: string | null;
  posterUrl?: string | null;
  placeCount?: number;
}

export interface SearchPlaceResult {
  id: number;
  name: string;
  regionLabel: string;
  coverImageUrls: string[];
  // Card 썸네일은 sceneImageUrl 우선 (home / work-detail / map / related 와 동일 패턴).
  // 씬이 등록 안 된 place 는 null — 카드는 회색 fallback 으로 떨어짐.
  sceneImageUrl?: string | null;
  contentId: number;
  contentTitle: string;
  // Coordinates travel through so /map deep-links can center on the place
  // without a second fetch when we wire that up; unused by the results list
  // today, kept on the DTO so the response isn't lossy.
  latitude?: number;
  longitude?: number;
}

export interface SearchResponse {
  query?: string;
  contents: SearchContentResult[];
  places: SearchPlaceResult[];
}

// Kept modest so slow links don't hang on a typo; backend default is the
// same so this mirrors what you'd get without the param.
const DEFAULT_LIMIT = 20;

interface State {
  query: string;
  contents: SearchContentResult[];
  places: SearchPlaceResult[];
  loading: boolean;
  error: string | null;
}

export const useSearchStore = defineStore('search', {
  state: (): State => ({
    query: '',
    contents: [],
    places: [],
    loading: false,
    error: null,
  }),
  getters: {
    hasResults: (state): boolean =>
      state.contents.length > 0 || state.places.length > 0,
  },
  actions: {
    // Single request wrapper. Debouncing is the page's responsibility — the
    // store always fires immediately when called so tests can drive it
    // deterministically.
    async search(q: string): Promise<void> {
      this.query = q;
      const trimmed = q.trim();
      if (!trimmed) {
        // Empty query = clear results; avoid hitting the server with "".
        this.contents = [];
        this.places = [];
        this.error = null;
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<SearchResponse>('/api/search', {
          params: { q: trimmed, limit: DEFAULT_LIMIT },
        });
        this.contents = data.contents ?? [];
        this.places = data.places ?? [];
      } catch (e) {
        this.contents = [];
        this.places = [];
        this.error = e instanceof Error ? e.message : 'Search failed';
      } finally {
        this.loading = false;
      }
    },
    reset(): void {
      this.query = '';
      this.contents = [];
      this.places = [];
      this.loading = false;
      this.error = null;
    },
  },
});
