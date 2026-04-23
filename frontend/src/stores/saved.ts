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
  totalCount: number;
  suggestion: NearbyRouteSuggestion | null;
  loading: boolean;
  error: string | null;
}

export const useSavedStore = defineStore('saved', {
  state: (): State => ({
    collections: [],
    items: [],
    totalCount: 0,
    suggestion: null,
    loading: false,
    error: null,
  }),
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
        this.totalCount = data.totalCount;
        this.suggestion = data.nearbyRouteSuggestion;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load saved';
      } finally {
        this.loading = false;
      }
    },
    async toggleSave(placeId: number): Promise<void> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('저장은 로그인 후 이용할 수 있어요.');
        return;
      }
      try {
        const { data } = await api.post<{ saved: boolean; totalCount: number }>('/api/saved/toggle', { placeId });
        this.totalCount = data.totalCount;
        if (!data.saved) {
          this.items = this.items.filter((i) => i.placeId !== placeId);
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to toggle save';
      }
    },
  },
});
