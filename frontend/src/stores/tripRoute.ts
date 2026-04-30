import { defineStore } from 'pinia';
import {
  fetchDirections,
  fetchRouteInit,
  saveRoute,
  updateRoute,
  loadRoute,
  deleteRoute,
  type LatLng,
  type RouteInitPlace,
  type SaveRouteResponse,
  type SavedRouteDetail,
  type SavedRouteItem,
} from '@/services/route';

/**
 * 한 코스에 들어가는 장소 한 칸. 디자인 시안의 PLACES 구조를 기반으로 우리
 * 도메인 필드(latitude/longitude/coverImageUrl/sceneImageUrl/contentId 등)에
 * 맞춘 형태. seedFromContent 가 `/api/contents/{contentId}` 응답의 spots 를
 * 이 모양으로 매핑한다.
 */
export interface TripPlace {
  id: number;
  name: string;
  /** 카드/리스트 좌측에 노출되는 도시·구·동 한 줄 라벨. */
  regionLabel: string;
  /** 카카오맵 마커/폴리라인 좌표. */
  latitude: number;
  longitude: number;
  /** 작품 chip 표기를 위한 콘텐츠 식별 정보. */
  contentId: number;
  contentTitle: string;
  /** 카드/모달의 hero 썸네일에 쓰는 이미지(우리 톤: 인증샷 cover/scene). */
  coverImageUrl: string | null;
  sceneImageUrl: string | null;
  /** 추천 체류 시간(분) — 디자인의 "약 5시간 30분" 합계 산출에 쓴다. */
  durationMin: number;
  /** 상세 모달의 정보 탭 — 모두 optional. 백엔드 contract 확정 후 채움. */
  address?: string | null;
  openHours?: string | null;
  price?: string | null;
  rating?: number | null;
  /** task #21: 방문 인증 여부 + 마지막 인증 시각. backend `visited/visitedAt` 와 1:1. */
  visited: boolean;
  visitedAt: string | null;
}

interface State {
  /** 코스 이름. 디자인 헤더의 "춘천 당일치기 코스" 자리. */
  name: string;
  /** 출발(0) → 경유 → 도착(N-1) 순서로 정렬된 placeId 배열. */
  placeIds: number[];
  /** placeId → TripPlace 상세. orderedPlaces getter 가 join 해서 노출. */
  placesById: Record<number, TripPlace>;
  /** placeId → 사용자 메모. RoutePlaceDetailModal 의 "내 메모" 탭이 직접 mutate. */
  notes: Record<number, string>;
  /** 마커/카드 활성 인덱스 식별. null 이면 어떤 것도 highlight 되지 않음. */
  activeId: number | null;
  /**
   * 출발 시간(HH:MM, 24시간). 디자인은 09:00 고정이지만 RouteEditorModal 의
   * "변경" 버튼이 향후 picker 를 띄울 수 있으므로 state 로 보관.
   */
  startTime: string;
  /** 시드 컨텍스트 — ContentDetailPage 에서 받은 작품 ID. mock 폴백에 사용. */
  seedContentId: number | null;
  seedContentTitle: string | null;
  loading: boolean;
  error: string | null;
  /**
   * 카카오 모빌리티 도로 경로(`/api/route/directions`) 결과. ≥2 면 RouteMapLayer
   * 가 직선 대신 이 path 로 폴리라인을 그린다. 비어 있으면(미요청 / 실패 /
   * available:false) 직선 폴백.
   */
  routePath: LatLng[];
  /**
   * leg 별 좌표. 같은 도로를 두 번 지나가는 코스에서 KakaoMap 이 각 leg 를
   * 별도 polyline + perpendicular offset 으로 그려 두 라인이 모두 보이게 한다.
   * 비었으면 KakaoMap 이 routePath 1개로 폴백.
   */
  routeSections: LatLng[][];
  routeDistanceMeters: number | null;
  routeDurationSec: number | null;
  /**
   * race 가드 — placeIds 변경 직후 비동기 fetch 가 여러 번 in-flight 일 수 있다.
   * 호출 직전 sig 를 캡처하고, 응답이 돌아왔을 때 현재 sig 와 다르면 stale 로 보고
   * 결과 반영을 건너뛴다. 빈 코스(<2)일 때 path 를 비우는 동작은 sig 무관 즉시 반영.
   */
  routeRequestSig: string | null;
  /**
   * 현재 코스가 백엔드에 저장된 코스라면 그 routeId. null = 신규(미저장) 또는
   * `/route?contentId=...` init 으로 진입한 새 코스. 저장 시 POST(null→id 부여)
   * vs PUT(기존 id 갱신) 분기 결정에 사용.
   */
  currentSavedRouteId: number | null;
}

/**
 * `/api/route/init` 의 RouteInitPlace → TripPlace 변환. backend 가 좌표/이미지/
 * 평점까지 채워서 보내므로 추가 정제 없이 그대로 매핑.
 */
function initPlaceToTripPlace(
  p: RouteInitPlace,
  contentId: number,
  contentTitle: string,
): TripPlace {
  return {
    id: p.placeId,
    name: p.name,
    regionLabel: p.regionLabel,
    latitude: p.latitude,
    longitude: p.longitude,
    contentId,
    contentTitle,
    coverImageUrl: p.coverImageUrl,
    sceneImageUrl: p.sceneImageUrl,
    durationMin: p.durationMin,
    address: p.address,
    openHours: null,
    price: null,
    rating: p.rating,
    visited: Boolean(p.visited),
    visitedAt: p.visitedAt ?? null,
  };
}

/**
 * 저장된 코스 상세(`/api/route/{id}`) 의 hydrated item → TripPlace. content
 * 컨텍스트는 저장 시 null 일 수 있으니 호출부가 contentId/contentTitle 을 같이
 * 전달.
 */
function savedItemToTripPlace(
  item: SavedRouteItem,
  contentId: number | null,
  contentTitle: string | null,
): TripPlace {
  return {
    id: item.placeId,
    name: item.name,
    regionLabel: item.regionLabel,
    latitude: item.latitude,
    longitude: item.longitude,
    contentId: contentId ?? 0,
    contentTitle: contentTitle ?? '',
    coverImageUrl: item.coverImageUrl,
    sceneImageUrl: item.sceneImageUrl,
    durationMin: item.durationMin,
    address: item.address,
    openHours: null,
    price: null,
    rating: item.rating,
    visited: Boolean(item.visited),
    visitedAt: item.visitedAt ?? null,
  };
}

/**
 * 디자인의 SEARCH_SUGGESTIONS — SearchPlaceModal 추천행에 mock 으로 노출.
 * TODO: 검색 contract 가 확정되면 별도 fetch 로 교체. 이번 패스(real /api/contents
 * fetch) 의 범위 밖이라 일단 mock 유지.
 */
const MOCK_SEARCH_SUGGESTIONS: TripPlace[] = [
  {
    id: 90011,
    name: '강촌 유원지',
    regionLabel: '강원 춘천 남산면',
    latitude: 37.8048,
    longitude: 127.5968,
    contentId: 1,
    contentTitle: '겨울연가',
    coverImageUrl: null,
    sceneImageUrl: null,
    durationMin: 90,
    rating: 4.2,
    visited: false,
    visitedAt: null,
  },
  {
    id: 90012,
    name: '의암 호수 카페거리',
    regionLabel: '강원 춘천 의암동',
    latitude: 37.8689,
    longitude: 127.6815,
    contentId: 1,
    contentTitle: '겨울연가',
    coverImageUrl: null,
    sceneImageUrl: null,
    durationMin: 60,
    rating: 4.4,
    visited: false,
    visitedAt: null,
  },
  {
    id: 90013,
    name: '춘천 막국수 체험관',
    regionLabel: '강원 춘천 신북읍',
    latitude: 37.9384,
    longitude: 127.7378,
    contentId: 1,
    contentTitle: '겨울연가',
    coverImageUrl: null,
    sceneImageUrl: null,
    durationMin: 60,
    rating: 4.5,
    visited: false,
    visitedAt: null,
  },
];

/**
 * 두 좌표 사이 직선 거리(haversine, km). RouteTimelineSheet 의 "약 38km"
 * 라벨 산출에 사용. 정확한 도로 거리는 아니지만 mock 단계의 시각 cue 로 충분.
 */
function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const useTripRouteStore = defineStore('tripRoute', {
  state: (): State => ({
    name: '나의 여행 코스',
    placeIds: [],
    placesById: {},
    notes: {},
    activeId: null,
    startTime: '09:00',
    seedContentId: null,
    seedContentTitle: null,
    loading: false,
    error: null,
    routePath: [],
    routeSections: [],
    routeDistanceMeters: null,
    routeDurationSec: null,
    routeRequestSig: null,
    currentSavedRouteId: null,
  }),
  getters: {
    /** placeIds 순서로 join 한 TripPlace[]. 누락된 id 는 자동 스킵. */
    orderedPlaces(state): TripPlace[] {
      return state.placeIds
        .map((id) => state.placesById[id])
        .filter((p): p is TripPlace => Boolean(p));
    },
    /** 출발/경유/도착 합산 체류 시간(분). 분당 이동 30분 가산은 view 측에서 처리. */
    totalDurationMin(): number {
      return (this.orderedPlaces as TripPlace[]).reduce((s, p) => s + (p.durationMin || 0), 0);
    },
    /** 인접한 두 점 사이 직선 거리의 합(km). 1자리 소수 표기. */
    totalDistanceKm(): number {
      const ps = this.orderedPlaces as TripPlace[];
      if (ps.length < 2) return 0;
      let sum = 0;
      for (let i = 0; i < ps.length - 1; i++) sum += haversineKm(ps[i], ps[i + 1]);
      return Math.round(sum * 10) / 10;
    },
    /** 검색 모달의 mock 후보 — 라우트에 이미 들어간 id 는 추천에서 제거. */
    searchSuggestions(state): TripPlace[] {
      return MOCK_SEARCH_SUGGESTIONS.filter((p) => !state.placeIds.includes(p.id));
    },
  },
  actions: {
    /**
     * ContentDetailPage 에서 query 로 받은 (contentId, contentTitle) 시드를
     * 받아 `/api/route/init` 의 places 로 코스를 채운다. 같은 시드로 이미
     * 채워진 상태면 noop — 페이지를 다녀와도 사용자가 손댄 placeIds 가
     * 유지된다. contentId 가 null 이면 빈 코스 + 기본 이름만 세팅하고 fetch 는
     * 건너뛴다(직접 `/route` 로 진입한 케이스).
     *
     * 신규(미저장) 코스의 시드라 `currentSavedRouteId` 는 항상 null 로 비움.
     */
    async seedFromContent(contentId: number | null, contentTitle: string | null): Promise<void> {
      if (
        this.placeIds.length > 0 &&
        this.seedContentId === contentId &&
        this.seedContentTitle === contentTitle &&
        this.currentSavedRouteId == null
      ) {
        return;
      }
      // 새 시드 — 기존 사용자 손길은 의도적으로 폐기한다(다른 작품 진입).
      this.placesById = {};
      this.notes = {};
      this.placeIds = [];
      this.activeId = null;
      this.seedContentId = contentId;
      this.seedContentTitle = contentTitle;
      this.name = contentTitle ? `${contentTitle} 코스` : '나의 여행 코스';
      this.error = null;
      this.currentSavedRouteId = null;

      if (contentId == null) {
        this.loading = false;
        return;
      }

      this.loading = true;
      try {
        const data = await fetchRouteInit(contentId);
        // contentTitle 시드가 비어 있으면 응답의 작품 제목을 폴백으로 사용해 헤더 라벨이
        // 비어 보이지 않게 한다. backend 가 정렬된 places 를 보내므로 추가 sort 불필요.
        const title = contentTitle ?? data.content.title;
        for (const p of data.places) {
          const place = initPlaceToTripPlace(p, data.content.id, title);
          this.placesById[place.id] = place;
          this.placeIds.push(place.id);
        }
        this.activeId = this.placeIds[0] ?? null;
        if (!contentTitle && data.content.title) {
          this.seedContentTitle = data.content.title;
        }
        // 코스 이름은 backend 의 suggestion 우선 — 없으면 "{작품} 코스" 폴백.
        this.name = data.suggestedName || (this.seedContentTitle ? `${this.seedContentTitle} 코스` : '나의 여행 코스');
        if (data.suggestedStartTime) this.startTime = data.suggestedStartTime;
        // 코스가 채워지면 도로 경로도 같이 시도. fire-and-forget — fetch 실패해도
        // 직선 폴백이 있어 사용자 흐름은 막히지 않는다.
        void this.refreshRoutePath();
      } catch (e) {
        // 빈 코스 + error 노출 — 페이지가 토스트 띄움. 이미 위에서 시드 컨텍스트는
        // 갱신해 둔 상태라 다음 진입 시 같은 시드면 noop 이지만, error 가 살아 있어
        // 사용자가 문제 인식 가능. 다른 시드로 들어오면 자연스럽게 재시도된다.
        this.error = e instanceof Error ? e.message : '코스를 불러올 수 없어요';
      } finally {
        this.loading = false;
      }
    },

    /**
     * `/api/route/{id}` 의 저장된 코스로 코스를 채운다. `/route?routeId=42`
     * 진입 흐름. 기존 시드/coursesById 모두 폐기하고 hydrated items 로 다시
     * 빌드. routeId 가 같으면 noop(사용자 손길 보존).
     */
    async seedFromSavedRoute(
      routeId: number,
      options?: { force?: boolean },
    ): Promise<void> {
      // 기본은 같은 routeId + 비어있지 않은 코스에 대해 noop(사용자 손길 보존).
      // force:true 면 backend 의 visited/place 변동을 즉시 끌어오기 위해 우회.
      if (
        !options?.force &&
        this.currentSavedRouteId === routeId &&
        this.placeIds.length > 0
      ) {
        return;
      }
      this.placesById = {};
      this.notes = {};
      this.placeIds = [];
      this.activeId = null;
      this.error = null;
      this.loading = true;
      try {
        const data: SavedRouteDetail = await loadRoute(routeId);
        // 응답 방어 — items 가 누락/비배열로 와도 페이지가 죽지 않게.
        const rawItems = Array.isArray(data?.items) ? data.items : [];
        const items = [...rawItems].sort((a, b) => a.orderIndex - b.orderIndex);
        for (const it of items) {
          // 좌표 누락된 item 은 지도에 그릴 수 없어 skip — 다른 item 으로 진행.
          if (typeof it.latitude !== 'number' || typeof it.longitude !== 'number') continue;
          const place = savedItemToTripPlace(it, data.contentId ?? null, data.contentTitle ?? null);
          this.placesById[place.id] = place;
          this.placeIds.push(place.id);
          if (it.note) this.notes[place.id] = it.note;
        }
        this.activeId = this.placeIds[0] ?? null;
        // 필드 누락 폴백 — backend 가 일부 필드를 빠뜨려도 UI 가 깨지지 않게.
        this.name = data.name ?? '나의 여행 코스';
        this.startTime = data.startTime ?? '09:00';
        this.seedContentId = data.contentId ?? null;
        this.seedContentTitle = data.contentTitle ?? null;
        this.currentSavedRouteId = data.id ?? routeId;
        void this.refreshRoutePath();
      } catch (e) {
        this.error = e instanceof Error ? e.message : '저장된 코스를 불러올 수 없어요';
      } finally {
        this.loading = false;
      }
    },

    /**
     * 카메라/업로드 다녀와 page 가 재진입될 때 호출. reseed 안 하고 visited/
     * visitedAt 만 backend 의 최신 stamp 기준으로 갱신 — placeIds 순서 / notes /
     * currentSavedRouteId 모두 보존. currentSavedRouteId 가 없으면 noop. fetch
     * 실패는 silent (보조 정보, 사용자 흐름 막지 않음).
     */
    async refreshVisitedFromBackend(): Promise<void> {
      const id = this.currentSavedRouteId;
      if (id == null) return;
      try {
        const data = await loadRoute(id);
        const items = Array.isArray(data?.items) ? data.items : [];
        for (const it of items) {
          const p = this.placesById[it.placeId];
          if (p) {
            p.visited = Boolean(it.visited);
            p.visitedAt = it.visitedAt ?? null;
          }
        }
      } catch {
        /* silent — 재시도는 다음 진입 때 자동. */
      }
    },

    /**
     * 현재 코스를 backend 에 저장. `currentSavedRouteId` 가 null 이면 POST,
     * 있으면 PUT. 성공 시 응답의 id 로 currentSavedRouteId 갱신. placeIds 가
     * 비어 있으면 throw (호출부가 토스트로 표면화).
     */
    async saveCurrentRoute(): Promise<SaveRouteResponse> {
      if (this.placeIds.length === 0) {
        throw new Error('코스가 비어 있어 저장할 수 없어요');
      }
      const items = this.placeIds.map((id, idx) => {
        const place = this.placesById[id];
        return {
          placeId: id,
          orderIndex: idx,
          durationMin: place?.durationMin ?? 60,
          note: this.notes[id] ?? null,
        };
      });
      const body = {
        name: this.name,
        startTime: this.startTime,
        contentId: this.seedContentId,
        items,
      };
      const res =
        this.currentSavedRouteId == null
          ? await saveRoute(body)
          : await updateRoute(this.currentSavedRouteId, body);
      this.currentSavedRouteId = res.id;
      return res;
    },

    /**
     * 저장된 코스 삭제. 현재 들고 있는 코스가 같은 id 였으면 currentSavedRouteId
     * 도 비워서 다음 저장이 신규(POST)로 동작하게.
     */
    async removeSavedRoute(routeId: number): Promise<void> {
      await deleteRoute(routeId);
      if (this.currentSavedRouteId === routeId) {
        this.currentSavedRouteId = null;
      }
    },
    setActive(id: number | null): void {
      this.activeId = id;
    },
    setName(name: string): void {
      this.name = name;
    },
    setStartTime(hhmm: string): void {
      this.startTime = hhmm;
    },
    /**
     * 검색 결과에서 한 장소를 코스에 추가. 이미 들어 있으면 활성화만 하고
     * 종료. 신규면 placesById 에 등록하고 마지막에 push.
     */
    addPlace(place: TripPlace): void {
      if (this.placeIds.includes(place.id)) {
        this.activeId = place.id;
        return;
      }
      this.placesById[place.id] = { ...place };
      this.placeIds.push(place.id);
      this.activeId = place.id;
      void this.refreshRoutePath();
    },
    removePlace(id: number): void {
      const idx = this.placeIds.indexOf(id);
      if (idx < 0) return;
      this.placeIds.splice(idx, 1);
      delete this.placesById[id];
      delete this.notes[id];
      if (this.activeId === id) {
        this.activeId = this.placeIds[0] ?? null;
      }
      void this.refreshRoutePath();
    },
    /**
     * Drag-and-drop 재정렬. fromIdx/toIdx 는 placeIds 기준. 동일 인덱스면 noop.
     */
    reorder(fromIdx: number, toIdx: number): void {
      if (fromIdx === toIdx) return;
      if (fromIdx < 0 || fromIdx >= this.placeIds.length) return;
      const clamped = Math.max(0, Math.min(this.placeIds.length - 1, toIdx));
      const [moved] = this.placeIds.splice(fromIdx, 1);
      this.placeIds.splice(clamped, 0, moved);
      void this.refreshRoutePath();
    },
    updateNote(placeId: number, note: string): void {
      // 빈 문자열은 키 자체를 제거 — Object.keys 길이로 "메모 있음" 카운트하려면 깔끔.
      if (!note || !note.trim()) {
        delete this.notes[placeId];
        return;
      }
      this.notes[placeId] = note;
    },
    /**
     * 페이지 leave 직후 호출되는 reset. 시드 컨텍스트가 다른 작품으로 바뀐
     * 경우 다음 진입에서 새 mock 으로 갈아끼우게 비워둔다. ContentDetailPage
     * 에서 같은 작품으로 재진입하면 seedFromContent 의 noop guard 가 작동.
     */
    reset(): void {
      this.name = '나의 여행 코스';
      this.placeIds = [];
      this.placesById = {};
      this.notes = {};
      this.activeId = null;
      this.startTime = '09:00';
      this.seedContentId = null;
      this.seedContentTitle = null;
      this.loading = false;
      this.error = null;
      this.routePath = [];
      this.routeSections = [];
      this.routeDistanceMeters = null;
      this.routeDurationSec = null;
      this.routeRequestSig = null;
      this.currentSavedRouteId = null;
    },
    /**
     * 현재 placeIds 의 좌표로 카카오 모빌리티 도로 경로를 갱신. 점이 2개 미만이면
     * 곧바로 path 를 비운다(직선 폴백). 응답 `available:false` 또는 path<2 도
     * 동일하게 비움. race 가드 — sig 가 호출 시점과 응답 도착 시점에 일치할 때만
     * 결과를 반영.
     */
    async refreshRoutePath(): Promise<void> {
      const ids = [...this.placeIds];
      if (ids.length < 2) {
        this.routePath = [];
        this.routeSections = [];
        this.routeDistanceMeters = null;
        this.routeDurationSec = null;
        this.routeRequestSig = null;
        return;
      }
      const sig = ids.join(',');
      this.routeRequestSig = sig;

      const points: LatLng[] = ids
        .map((id) => this.placesById[id])
        .filter((p): p is TripPlace => Boolean(p))
        .map((p) => ({ lat: p.latitude, lng: p.longitude }));
      // 좌표 누락이 있어 점이 2 미만으로 줄면 의미 있는 호출이 안 되므로 건너뜀.
      if (points.length < 2) {
        this.routePath = [];
        this.routeSections = [];
        this.routeDistanceMeters = null;
        this.routeDurationSec = null;
        return;
      }
      const origin = points[0];
      const destination = points[points.length - 1];
      const waypoints = points.slice(1, -1);

      try {
        const res = await fetchDirections({ origin, destination, waypoints });
        // 응답 도착 시점에 placeIds 가 또 바뀌었으면 stale — 무시.
        if (this.routeRequestSig !== sig) return;
        if (res.available && res.path.length >= 2) {
          this.routePath = res.path;
          // sections 가 빈 배열로 와도 그대로 반영 — KakaoMap 이 path 1개 list 폴백.
          this.routeSections = res.sections ?? [];
          this.routeDistanceMeters = res.distanceMeters;
          this.routeDurationSec = res.durationSec;
        } else {
          // 카카오가 경로를 못 찾음 → 직선 폴백.
          this.routePath = [];
          this.routeSections = [];
          this.routeDistanceMeters = null;
          this.routeDurationSec = null;
        }
      } catch {
        // 네트워크/프록시 실패도 직선 폴백. 사용자에게 별도 토스트는 띄우지
        // 않는다 — 이는 보조 정보라 코스 사용 자체를 막을 이유가 없다.
        if (this.routeRequestSig !== sig) return;
        this.routePath = [];
        this.routeSections = [];
        this.routeDistanceMeters = null;
        this.routeDurationSec = null;
      }
    },
  },
});
