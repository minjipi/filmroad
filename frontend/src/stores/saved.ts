import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

export interface SavedCollection {
  id: number;
  name: string;
  coverImageUrl: string | null;
  count: number;
  gradient: string | null;
  // Optional iconKey for future server-driven cover icons (MAP_PIN / FILM /
  // MOON etc.). Renderers fall back to a generic pin when absent.
  iconKey?: string | null;
}

export interface SavedItem {
  placeId: number;
  name: string;
  regionLabel: string;
  coverImageUrl: string;
  workId: number;
  workTitle: string;
  distanceKm: number | null;
  likeCount: number;
  visited: boolean;
  collectionId: number | null;
}

export interface NearbyRouteSuggestion {
  title: string;
  subtitle: string;
  placeCount: number;
}

export interface SavedResponse {
  collections: SavedCollection[];
  totalCount: number;
  items: SavedItem[];
  nearbyRouteSuggestion: NearbyRouteSuggestion | null;
}

interface FetchOptions {
  lat?: number;
  lng?: number;
}

interface State {
  collections: SavedCollection[];
  items: SavedItem[];
  // Canonical "is this place saved?" index, kept in sync with the server via
  // fetch / toggleSave. Separate from `items` because bookmark buttons across
  // the app (PlaceDetail, Feed, Gallery, Map) need to know saved state for
  // places that aren't necessarily rendered on SavedPage.
  savedPlaceIds: number[];
  totalCount: number;
  suggestion: NearbyRouteSuggestion | null;
  loading: boolean;
  error: string | null;
}

export const useSavedStore = defineStore('saved', {
  state: (): State => ({
    collections: [],
    items: [],
    savedPlaceIds: [],
    totalCount: 0,
    suggestion: null,
    loading: false,
    error: null,
  }),
  getters: {
    isSaved: (state) => (placeId: number): boolean =>
      state.savedPlaceIds.includes(placeId),
  },
  actions: {
    async fetch(opts: FetchOptions = {}): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const params: Record<string, string | number> = {};
        if (typeof opts.lat === 'number') params.lat = opts.lat;
        if (typeof opts.lng === 'number') params.lng = opts.lng;
        const { data } = await api.get<SavedResponse>('/api/saved', { params });
        this.collections = data.collections;
        this.items = data.items;
        this.savedPlaceIds = data.items.map((i) => i.placeId);
        this.totalCount = data.totalCount;
        this.suggestion = data.nearbyRouteSuggestion;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load saved';
      } finally {
        this.loading = false;
      }
    },
    async createCollection(name: string): Promise<SavedCollection | null> {
      const trimmed = name.trim();
      if (!trimmed) {
        this.error = '컬렉션 이름을 입력해 주세요';
        return null;
      }
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('컬렉션 만들기는 로그인 후 이용할 수 있어요.');
        return null;
      }
      try {
        const { data } = await api.post<SavedCollection>(
          '/api/saved/collections',
          { name: trimmed },
        );
        // Prepend so the user sees the card they just added at the start of
        // the horizontal list — re-sorting stays the server's job.
        this.collections.unshift(data);
        return data;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to create collection';
        return null;
      }
    },
    async toggleSave(
      placeId: number,
      collectionId?: number | null,
    ): Promise<void> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('저장은 로그인 후 이용할 수 있어요.');
        return;
      }
      try {
        // Only forward collectionId when the caller explicitly supplied one —
        // omitting it entirely keeps the server-side default ("unassigned"
        // i.e. collectionId=null) while still letting unsave paths skip the
        // field. `null` is a valid value meaning "drop into 기본".
        const body: { placeId: number; collectionId?: number | null } = {
          placeId,
        };
        if (collectionId !== undefined) body.collectionId = collectionId;
        const { data } = await api.post<{ saved: boolean; totalCount: number }>('/api/saved/toggle', body);
        this.totalCount = data.totalCount;
        if (data.saved) {
          if (!this.savedPlaceIds.includes(placeId)) {
            this.savedPlaceIds.push(placeId);
          }
          // Re-hydrate items so SavedPage / ProfilePage saved tab renders
          // the full place card (thumbnail, region, work) right away. The
          // toggle response only carries { saved, totalCount } — without
          // this refetch, the item exists in savedPlaceIds but never shows
          // up in the list until the next manual page visit.
          await this.fetch();
        } else {
          this.savedPlaceIds = this.savedPlaceIds.filter((id) => id !== placeId);
          this.items = this.items.filter((i) => i.placeId !== placeId);
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to toggle save';
      }
    },
  },
});
