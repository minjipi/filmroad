import { defineStore } from 'pinia';
import api from '@/services/api';
import { useSavedStore } from '@/stores/saved';

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
  coverImageUrls: string[];
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

// Bottom-sheet snap mode. Mirrors useDraggableSheet's SHEET_CLOSED/PEEK/FULL.
// Stored here (not local to MapPage) so the sheet's open/closed state survives
// cross-page hops, and so other actions (selectMarker, markLastViewed, close
// button) can drive it from a single source of truth.
export type SheetMode = 'closed' | 'peek' | 'full';

interface FetchOptions {
  lat?: number;
  lng?: number;
  // Viewport bounding box (south-west + north-east corners). When all four are
  // provided the backend constrains the marker list to places inside the box;
  // without them the backend falls back to its default radius/country query.
  swLat?: number;
  swLng?: number;
  neLat?: number;
  neLng?: number;
  // First-entry (country view) calls set this to true so a server-seeded
  // `selected` doesn't sneak the bottom sheet open before the user has
  // explicitly picked a place. Markers still update as normal.
  countryView?: boolean;
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
  zoom: number;
  // First-entry (country view) vs re-entry (restore last viewed) switch — flips
  // true the moment the user picks a marker or opens a PlaceDetail that mirrors
  // itself back into this store via markLastViewed.
  hasBeenViewed: boolean;
  sheetMode: SheetMode;
  // Client-side mock: a real app would persist visited places per-user on
  // the server. Saved-place state is the savedStore's job (task #19 unified
  // that across the app).
  visitedIds: number[];
}

// Approximate geographic centre of South Korea (between 충북 and 경북) — picked
// so the first-entry map frames Seoul, 제주, and the east/west coasts at the
// country zoom below.
export const KOREA_CENTER = { lat: 36.0, lng: 127.8 };
// Kakao Map "level" — higher = zoomed out. SDK max is 14, which frames the
// entire peninsula incl. 제주 on a 390pt-wide mobile viewport but reads as
// uncomfortably wide / sparse to first-time users. Level 13 (one step closer)
// trims 제주 and the far edges of 강원/경상 but gives a denser default view
// of the populated regions where most content lives. The earlier "first entry
// shows only Seoul" regression (task #11) was a data bug — bounds_changed
// refetch overwriting the country marker set — and is held back by the
// COUNTRY_BOUNDS_SUPPRESS_MS gate in MapPage, independent of zoom level.
// 5 is the regional detail zoom used when the sheet shows a selected place.
export const COUNTRY_ZOOM = 13;
export const DETAIL_ZOOM = 5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 14;

export const useMapStore = defineStore('map', {
  state: (): State => ({
    markers: [],
    selected: null,
    loading: false,
    error: null,
    filter: 'SPOTS',
    workId: null,
    q: '',
    center: { ...KOREA_CENTER },
    zoom: COUNTRY_ZOOM,
    hasBeenViewed: false,
    sheetMode: 'peek',
    visitedIds: [10],
  }),
  getters: {
    visibleMarkers(state): MapMarker[] {
      if (state.filter === 'VISITED') {
        const v = new Set(state.visitedIds);
        return state.markers.filter((m) => v.has(m.id));
      }
      if (state.filter === 'SAVED') {
        // Delegate to the unified savedStore so the map filter stays in sync
        // with bookmark state from every other page (Feed / Gallery / etc.).
        const saved = useSavedStore();
        return state.markers.filter((m) => saved.isSaved(m.id));
      }
      return state.markers;
    },
    isVisited: (state) => (id: number): boolean => state.visitedIds.includes(id),
  },
  actions: {
    async fetchMap(opts: FetchOptions = {}): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const params: Record<string, string | number> = {};
        params.lat = opts.lat ?? this.center.lat;
        params.lng = opts.lng ?? this.center.lng;
        if (
          opts.swLat !== undefined &&
          opts.swLng !== undefined &&
          opts.neLat !== undefined &&
          opts.neLng !== undefined
        ) {
          params.swLat = opts.swLat;
          params.swLng = opts.swLng;
          params.neLat = opts.neLat;
          params.neLng = opts.neLng;
        }
        if (this.workId !== null) params.workId = this.workId;
        if (this.q.trim()) params.q = this.q.trim();
        if (this.selected) params.selectedId = this.selected.id;
        const { data } = await api.get<MapResponse>('/api/map/places', { params });
        this.markers = data.markers;
        if (opts.countryView) {
          // Country view is the "I haven't looked at anything yet" state —
          // discard the server's pre-seeded selected and leave the sheet
          // closed so the first-entry map is visually clean.
          this.selected = null;
        } else {
          this.selected = data.selected;
          if (data.selected) this.hasBeenViewed = true;
        }
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
          coverImageUrls: prev?.coverImageUrls ?? [],
          photoCount: prev?.photoCount ?? 0,
          likeCount: prev?.likeCount ?? 0,
          rating: prev?.rating ?? 0,
          distanceKm: hit.distanceKm,
        };
        // Zoom into the picked place and remember we've left the country view.
        this.center = { lat: hit.latitude, lng: hit.longitude };
        this.zoom = DETAIL_ZOOM;
        this.hasBeenViewed = true;
        // Any *new* selection resets the sheet to peek so the user sees the
        // summary card regardless of prior height (closed, or carried-over
        // FULL from a previous place). Same-state re-entry (no new selection)
        // doesn't go through here, so FULL persists on simple tab swaps.
        this.sheetMode = 'peek';
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
    setZoom(z: number): void {
      this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z)));
    },
    // Called by PlaceDetailPage so the map tab, when revisited, opens on the
    // place the user was just looking at. Stays local — no network call.
    markLastViewed(place: PlaceDetail): void {
      this.selected = { ...place };
      this.center = { lat: place.latitude, lng: place.longitude };
      this.zoom = DETAIL_ZOOM;
      this.hasBeenViewed = true;
      // PlaceDetail just mirrored a new place in — always surface it at peek.
      // "Same state re-entry" (tab swap without visiting PlaceDetail) never
      // hits this code path, so a FULL sheet stays FULL in that scenario.
      this.sheetMode = 'peek';
    },
    setSheetMode(mode: SheetMode): void {
      this.sheetMode = mode;
    },
    // Return the store to "first entry" appearance. Unused today but exposed
    // so a future "전국 보기" reset button has a single entry point.
    resetToCountryView(): void {
      this.selected = null;
      this.center = { ...KOREA_CENTER };
      this.zoom = COUNTRY_ZOOM;
      this.hasBeenViewed = false;
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
        coverImageUrls: [],
        photoCount: 0,
        likeCount: 0,
        rating: 0,
        distanceKm: next.distanceKm,
      };
    },
    markVisited(id: number): void {
      if (!this.visitedIds.includes(id)) this.visitedIds.push(id);
    },
  },
});
