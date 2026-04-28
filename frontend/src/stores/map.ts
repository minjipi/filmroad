import { defineStore } from 'pinia';
import api from '@/services/api';
import { useSavedStore } from '@/stores/saved';
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
  coverImageUrls: string[];
  photoCount: number;
  likeCount: number;
  rating: number;
  distanceKm: number | null;
  /** viewer 가 좋아요 눌렀는지. 비로그인은 false. 시트의 하트 아이콘 채움/외곽 분기. */
  liked: boolean;
}

export interface MapResponse {
  markers: MapMarker[];
  selected: PlaceDetail | null;
}

export type MapFilter = 'SPOTS' | 'VISITED' | 'SAVED';

// Advanced filter sheet (필터 버튼 → 시트). chip-row 의 1차 단축 필터와는
// 별도 차원으로 stacked AND 조합 — 예: chip "도깨비" + sheet "강원" = 도깨비
// 촬영지 중 강원 지역만. 평점 그룹은 MapMarkerDto 에 rating 이 아직 없어
// 다음 PR 로 미룸.
export type VisitStatus = 'ALL' | 'VISITED' | 'UNVISITED';
export interface MapSheetFilters {
  workIds: number[];        // 다중 선택 (빈 배열 = 전체)
  regions: string[];        // 다중 선택 (빈 배열 = 전국). regionLabel 의
                            // 첫 토큰 ("강원 강릉시 주문진읍" → "강원") 매칭.
  maxDistanceKm: number | null; // null = 전체. distanceKm 가 채워진 marker 만 비교.
  visitStatus: VisitStatus;
}

export const DEFAULT_SHEET_FILTERS: MapSheetFilters = Object.freeze({
  workIds: [],
  regions: [],
  maxDistanceKm: null,
  visitStatus: 'ALL',
});

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
  // GPS-derived 사용자 현재 위치. center(=지도 viewport) 와 분리 — 마커
  // 클릭/검색/딥링크로 center 가 바뀌어도 me 점은 따라가지 않게 한다.
  // 권한 거부·실패·미요청 상태에선 null → 내 위치 점을 표시하지 않음.
  userLocation: { lat: number; lng: number } | null;
  // First-entry (country view) vs re-entry (restore last viewed) switch — flips
  // true the moment the user picks a marker or opens a PlaceDetail that mirrors
  // itself back into this store via markLastViewed.
  hasBeenViewed: boolean;
  sheetMode: SheetMode;
  // Client-side mock: a real app would persist visited places per-user on
  // the server. Saved-place state is the savedStore's job (task #19 unified
  // that across the app).
  visitedIds: number[];
  // 필터 시트의 fine-grained 필터 (chip-row 1차 필터 위에 stacked AND).
  sheetFilters: MapSheetFilters;
}

// Approximate geographic centre of South Korea (between 충북 and 경북) — picked
// so the first-entry map frames Seoul, 제주, and the east/west coasts at the
// country zoom below.
export const KOREA_CENTER = { lat: 36.0, lng: 127.8 };
// Kakao Map "level" — higher = zoomed out. Level 14 is the SDK's max and
// frames the entire peninsula (제주 포함) on a 390pt-wide mobile viewport;
// level 13 clipped to roughly 서울~충청 on the same viewport which was the
// primary trigger of task #11's "first entry shows only Seoul" bug. 5 is
// the regional detail zoom used when the sheet shows a selected place.
// 17개 광역시도의 정식 명칭 ↔ 줄임 표기 정규화 맵. 같은 곳을 다르게 쓰는
// 데이터(예: "강원 강릉시" vs "강원도 강릉시")를 하나의 버킷으로 묶기 위함.
// 시·군·구(예: "강릉시") 까지 광역 단위로 끌어올리는 역매핑은 의도적으로
// 빼둠 — 여기에 들어오면 ~200+ 항목이라 별도 기획 필요.
const REGION_NORMALIZE: Record<string, string> = {
  서울: '서울', 서울특별시: '서울',
  부산: '부산', 부산광역시: '부산',
  대구: '대구', 대구광역시: '대구',
  인천: '인천', 인천광역시: '인천',
  광주: '광주', 광주광역시: '광주',
  대전: '대전', 대전광역시: '대전',
  울산: '울산', 울산광역시: '울산',
  세종: '세종', 세종특별자치시: '세종',
  경기: '경기', 경기도: '경기',
  강원: '강원', 강원도: '강원', 강원특별자치도: '강원',
  충북: '충북', 충청북도: '충북',
  충남: '충남', 충청남도: '충남',
  전북: '전북', 전라북도: '전북', 전북특별자치도: '전북',
  전남: '전남', 전라남도: '전남',
  경북: '경북', 경상북도: '경북',
  경남: '경남', 경상남도: '경남',
  제주: '제주', 제주도: '제주', 제주특별자치도: '제주',
};

// regionLabel ("강원도 강릉시 주문진읍") → 광역 토큰 ("강원"). 시트의 지역
// 필터 + 매칭에 같은 함수 — 토크나이즈 규칙이 한 곳으로 모임. 첫 토큰이
// 광역 명에 매칭되면 줄임 표기로 정규화, 그렇지 않으면(시·군 단독 등) 원본
// 그대로 노출.
export function firstRegionToken(regionLabel: string | null | undefined): string {
  if (!regionLabel) return '';
  const trimmed = regionLabel.trim();
  if (trimmed.length === 0) return '';
  const first = trimmed.split(/\s+/)[0];
  return REGION_NORMALIZE[first] ?? first;
}

export const COUNTRY_ZOOM = 14;
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
    userLocation: null,
    hasBeenViewed: false,
    sheetMode: 'peek',
    visitedIds: [10],
    sheetFilters: { ...DEFAULT_SHEET_FILTERS },
  }),
  getters: {
    visibleMarkers(state): MapMarker[] {
      // Pass 1 — chip-row 의 1차 단축 필터.
      let pool = state.markers;
      if (state.filter === 'VISITED') {
        const v = new Set(state.visitedIds);
        pool = pool.filter((m) => v.has(m.id));
      } else if (state.filter === 'SAVED') {
        // Delegate to the unified savedStore so the map filter stays in sync
        // with bookmark state from every other page (Feed / Gallery / etc.).
        const saved = useSavedStore();
        pool = pool.filter((m) => saved.isSaved(m.id));
      }
      // Pass 2 — 시트의 fine-grained 필터를 stacked AND 로 적용.
      const sf = state.sheetFilters;
      if (sf.workIds.length > 0) {
        const ids = new Set(sf.workIds);
        pool = pool.filter((m) => ids.has(m.workId));
      }
      if (sf.regions.length > 0) {
        const regions = new Set(sf.regions);
        // regionLabel 첫 토큰 ("강원 강릉시 …") 만 비교. 사용자는 광역 단위로
        // 고르고 시 / 군 / 구 까진 신경 안 쓰는 게 자연스러움.
        pool = pool.filter((m) => regions.has(firstRegionToken(m.regionLabel)));
      }
      if (sf.maxDistanceKm !== null) {
        const max = sf.maxDistanceKm;
        // distanceKm 이 null 인 marker (위치 권한 없을 때) 는 거리 필터를
        // 통과시킴 — 강제로 떨궈 빈 결과를 만드는 것보다 lenient.
        pool = pool.filter((m) => m.distanceKm == null || m.distanceKm <= max);
      }
      if (sf.visitStatus !== 'ALL') {
        const v = new Set(state.visitedIds);
        pool = pool.filter((m) => sf.visitStatus === 'VISITED' ? v.has(m.id) : !v.has(m.id));
      }
      return pool;
    },
    isVisited: (state) => (id: number): boolean => state.visitedIds.includes(id),
    // 활성 시트 필터 그룹 수 — 0 이면 필터 버튼에 뱃지 없음.
    activeSheetFilterCount(state): number {
      const sf = state.sheetFilters;
      let n = 0;
      if (sf.workIds.length > 0) n += 1;
      if (sf.regions.length > 0) n += 1;
      if (sf.maxDistanceKm !== null) n += 1;
      if (sf.visitStatus !== 'ALL') n += 1;
      return n;
    },
    // 시트의 작품 picker 가 보여줄 후보 — 현재 markers 에 등장한 distinct
    // (workId, workTitle). 동적 list 라 server round-trip 없이 가능.
    availableWorks(state): { id: number; title: string }[] {
      const seen = new Map<number, string>();
      for (const m of state.markers) {
        if (!seen.has(m.workId)) seen.set(m.workId, m.workTitle);
      }
      return Array.from(seen, ([id, title]) => ({ id, title }));
    },
    // 시트의 지역 picker 가 보여줄 후보 — 현재 markers 의 distinct 광역 토큰.
    availableRegions(state): string[] {
      const seen = new Set<string>();
      for (const m of state.markers) {
        seen.add(firstRegionToken(m.regionLabel));
      }
      return Array.from(seen).filter((r) => r.length > 0).sort();
    },
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
          liked: prev?.liked ?? false,
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
    // 시트 적용 — partial 로 받아 기존 키를 보존. visibleMarkers 가
    // 클라이언트 측에서 즉시 좁히므로 서버 재요청은 안 함.
    setSheetFilters(partial: Partial<MapSheetFilters>): void {
      this.sheetFilters = { ...this.sheetFilters, ...partial };
      this.reconcileSelected();
    },
    resetSheetFilters(): void {
      this.sheetFilters = { ...DEFAULT_SHEET_FILTERS };
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
    // GPS 기반 사용자 위치 갱신. null 을 넘기면 권한 거부/실패 상태로 되돌림
    // → 지도의 me overlay 가 사라진다. center 와 별개로 동작 — viewport 가
    // 다른 곳으로 이동해도 이 값은 그대로 유지된다.
    setUserLocation(loc: { lat: number; lng: number } | null): void {
      this.userLocation = loc;
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
        liked: false,
      };
    },
    markVisited(id: number): void {
      if (!this.visitedIds.includes(id)) this.visitedIds.push(id);
    },
    /**
     * 시트 하트 아이콘 토글. HomeStore.toggleLike 와 동일 패턴 — optimistic 으로
     * 먼저 뒤집고, 응답이 오면 서버 진실로 덮어쓰고, 실패 시 롤백. 비로그인은
     * 로그인 프롬프트로 우회. 시트는 단일 place 만 보여주므로 selected 만 갱신.
     */
    async toggleLike(placeId: number): Promise<void> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('좋아요는 로그인 후 이용할 수 있어요.');
        return;
      }
      const target = this.selected;
      if (!target || target.id !== placeId) return;
      const prevLiked = target.liked;
      const prevLikeCount = target.likeCount;
      target.liked = !prevLiked;
      target.likeCount = prevLikeCount + (target.liked ? 1 : -1);
      try {
        const { data } = await api.post<{ liked: boolean; likeCount: number }>(
          `/api/places/${placeId}/like`,
        );
        target.liked = data.liked;
        target.likeCount = data.likeCount;
      } catch (e) {
        target.liked = prevLiked;
        target.likeCount = prevLikeCount;
        this.error = e instanceof Error ? e.message : '좋아요를 저장하지 못했어요';
      }
    },
  },
});
