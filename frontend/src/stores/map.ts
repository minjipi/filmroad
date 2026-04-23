import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

export interface MapMarker {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  workId: number;
  workTitle: string;
  regionLabel: string;
  distanceKm: number | null;
}

export interface PlaceDetail {
  id: number;
  name: string;
  regionLabel: string;
  latitude: number;
  longitude: number;
  workId: number;
  workTitle: string;
  workEpisode: string | null;
  coverImageUrl: string;
  photoCount: number;
  likeCount: number;
  rating: number;
  distanceKm: number | null;
}

export interface MapResponse {
  markers: MapMarker[];
  selected: PlaceDetail | null;
}

export type MapFilter = 'SPOTS' | 'VISITED' | 'SAVED';

interface FetchOptions {
  lat?: number;
  lng?: number;
}

interface State {
  markers: MapMarker[];
  selected: PlaceDetail | null;
  loading: boolean;
  error: string | null;
  filter: MapFilter;
  workId: number | null;
  q: string;
  center: { lat: number; lng: number };
  // Client-side mock: a real app would persist these per-user on the server.
  visitedIds: number[];
  savedIds: number[];
}

// Gangneung / Jumunjin area — matches the design's "me" marker.
const DEFAULT_CENTER = { lat: 37.8928, lng: 128.8347 };

export const useMapStore = defineStore('map', {
  state: (): State => ({
    markers: [],
    selected: null,
    loading: false,
    error: null,
    filter: 'SPOTS',
    workId: null,
    q: '',
    center: { ...DEFAULT_CENTER },
    visitedIds: [10],
    savedIds: [],
  }),
  getters: {
    visibleMarkers(state): MapMarker[] {
      if (state.filter === 'VISITED') {
        const v = new Set(state.visitedIds);
        return state.markers.filter((m) => v.has(m.id));
      }
      if (state.filter === 'SAVED') {
        const s = new Set(state.savedIds);
        return state.markers.filter((m) => s.has(m.id));
      }
      return state.markers;
    },
    isVisited: (state) => (id: number): boolean => state.visitedIds.includes(id),
    isSaved: (state) => (id: number): boolean => state.savedIds.includes(id),
  },
  actions: {
    async fetchMap(opts: FetchOptions = {}): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const params: Record<string, string | number> = {};
        params.lat = opts.lat ?? this.center.lat;
        params.lng = opts.lng ?? this.center.lng;
        if (this.workId !== null) params.workId = this.workId;
        if (this.q.trim()) params.q = this.q.trim();
        if (this.selected) params.selectedId = this.selected.id;
        const { data } = await api.get<MapResponse>('/api/map/places', { params });
        this.markers = data.markers;
        this.selected = data.selected;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load map';
      } finally {
        this.loading = false;
      }
    },
    async selectMarker(id: number): Promise<void> {
      // Optimistic promotion so the bottom sheet updates instantly; server refetch
      // then supplies the full detail payload (stats, cover, episode).
      const hit = this.markers.find((m) => m.id === id);
      if (hit) {
        const prev = this.selected && this.selected.id === id ? this.selected : null;
        this.selected = {
          id: hit.id,
          name: hit.name,
          regionLabel: hit.regionLabel,
          latitude: hit.latitude,
          longitude: hit.longitude,
          workId: hit.workId,
          workTitle: hit.workTitle,
          workEpisode: prev?.workEpisode ?? null,
          coverImageUrl: prev?.coverImageUrl ?? '',
          photoCount: prev?.photoCount ?? 0,
          likeCount: prev?.likeCount ?? 0,
          rating: prev?.rating ?? 0,
          distanceKm: hit.distanceKm,
        };
      }
      await this.fetchMap();
    },
    setFilter(f: MapFilter): void {
      this.filter = f;
      this.reconcileSelected();
    },
    async setWork(id: number | null): Promise<void> {
      if (this.workId === id) return;
      this.workId = id;
      await this.fetchMap();
      this.reconcileSelected();
    },
    async setQuery(q: string): Promise<void> {
      this.q = q;
      await this.fetchMap();
      this.reconcileSelected();
    },
    async setCenter(lat: number, lng: number): Promise<void> {
      this.center = { lat, lng };
      await this.fetchMap();
    },
    reconcileSelected(): void {
      if (!this.selected) return;
      const visible = this.visibleMarkers;
      if (visible.some((m) => m.id === this.selected!.id)) return;
      const next = visible[0] ?? null;
      if (next === null) {
        this.selected = null;
        return;
      }
      this.selected = {
        id: next.id,
        name: next.name,
        regionLabel: next.regionLabel,
        latitude: next.latitude,
        longitude: next.longitude,
        workId: next.workId,
        workTitle: next.workTitle,
        workEpisode: null,
        coverImageUrl: '',
        photoCount: 0,
        likeCount: 0,
        rating: 0,
        distanceKm: next.distanceKm,
      };
    },
    toggleSave(id: number): void {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('저장은 로그인 후 이용할 수 있어요.');
        return;
      }
      const i = this.savedIds.indexOf(id);
      if (i >= 0) this.savedIds.splice(i, 1);
      else this.savedIds.push(id);
    },
    markVisited(id: number): void {
      if (!this.visitedIds.includes(id)) this.visitedIds.push(id);
    },
  },
});
