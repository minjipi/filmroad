import api from '@/services/api';

/**
 * 카카오 모빌리티 도로 경로 프록시(`/api/route/directions`) 클라이언트 래퍼.
 * 백엔드가 카카오 키와 좌표 변환을 책임지고 우리는 단순 JSON 만 주고받는다.
 *
 * 응답의 `available: false` 는 프록시 자체는 정상이나 카카오가 경로를 못
 * 찾은 경우(예: 좌표가 도로망 밖). 호출부는 `available && path.length >= 2`
 * 일 때만 도로 경로를 사용하고, 아니면 직선 폴리라인으로 폴백한다.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface DirectionsRequest {
  origin: LatLng;
  destination: LatLng;
  waypoints: LatLng[];
}

export interface DirectionsResponse {
  available: boolean;
  /** 합쳐진 전체 path — 마커 사이 chevron 같이 sections 무관 데이터 용도. */
  path: LatLng[];
  /**
   * leg(origin→via1, via1→via2, ...) 별 좌표 리스트. 같은 도로를 두 번 지나가는
   * 코스에서 polyline 을 leg 별로 분리해 perpendicular offset 으로 옆으로 밀어
   * 두 라인이 모두 보이게 한다. backend 가 빈 leg 는 skip 하므로 길이 신뢰 X.
   */
  sections: LatLng[][];
  distanceMeters: number | null;
  durationSec: number | null;
}

export async function fetchDirections(req: DirectionsRequest): Promise<DirectionsResponse> {
  const { data } = await api.post<DirectionsResponse>('/api/route/directions', req);
  return data;
}

// ── Route init / CRUD (task #11) ───────────────────────────────────────

export interface RouteInitContent {
  id: number;
  title: string;
  posterUrl: string | null;
}

export interface RouteInitPlace {
  placeId: number;
  name: string;
  regionLabel: string;
  address: string | null;
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
  sceneImageUrl: string | null;
  durationMin: number;
  rating: number | null;
}

export interface RouteInitResponse {
  content: RouteInitContent;
  suggestedName: string;
  /** HH:MM (24h). */
  suggestedStartTime: string;
  places: RouteInitPlace[];
}

/**
 * `/api/route/init?contentId=...` — 작품 진입 시 코스 시드 페이로드. 기존
 * `/api/contents/:id` 의 spots 를 직접 매핑하던 방식을 교체. 좌표 누락 등
 * 정제된 places 만 backend 가 보장.
 */
export async function fetchRouteInit(contentId: number): Promise<RouteInitResponse> {
  const { data } = await api.get<RouteInitResponse>('/api/route/init', {
    params: { contentId },
  });
  return data;
}

export interface RouteItemPayload {
  placeId: number;
  orderIndex: number;
  durationMin: number;
  note?: string | null;
}

export interface SaveRouteRequest {
  name: string;
  /** HH:MM (24h). */
  startTime: string;
  contentId: number | null;
  items: RouteItemPayload[];
}

/**
 * `GET /api/route/{id}` 결과 — 저장된 코스 상세. items 는 hydrated place 데이터
 * (name/regionLabel/address/lat/lng/cover/scene/rating) 포함이라 별도 place
 * fetch 없이 `/route?routeId=...` 직진입 가능.
 */
export interface SavedRouteDetail {
  id: number;
  name: string;
  startTime: string;
  contentId: number | null;
  contentTitle: string | null;
  items: SavedRouteItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedRouteItem {
  placeId: number;
  orderIndex: number;
  durationMin: number;
  note: string | null;
  // hydrated place data — backend 가 inline 으로 보내 준다고 가정. 다르면
  // 매핑 한 곳(savedItemToTripPlace) 만 수정.
  name: string;
  regionLabel: string;
  address: string | null;
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
  sceneImageUrl: string | null;
  rating: number | null;
}

/** `GET /api/route/me` 결과의 카드 요약. */
export interface SavedRouteSummary {
  id: number;
  name: string;
  contentTitle: string | null;
  placeCount: number;
  updatedAt: string;
  coverImageUrl: string | null;
}

/** `POST /api/route` 응답 — id 만 반환. */
export interface SaveRouteResponse {
  id: number;
}

/** `POST /api/route` — 신규 저장. */
export async function saveRoute(req: SaveRouteRequest): Promise<SaveRouteResponse> {
  const { data } = await api.post<SaveRouteResponse>('/api/route', req);
  return data;
}

/** `PUT /api/route/{id}` — 기존 코스 갱신. POST 와 동일한 응답 shape. */
export async function updateRoute(id: number, req: SaveRouteRequest): Promise<SaveRouteResponse> {
  const { data } = await api.put<SaveRouteResponse>(`/api/route/${id}`, req);
  return data;
}

/** `GET /api/route/me` — 내가 저장한 코스 목록. */
export async function listMyRoutes(): Promise<SavedRouteSummary[]> {
  const { data } = await api.get<SavedRouteSummary[]>('/api/route/me');
  return data;
}

/** `GET /api/route/{id}` — 단일 코스 상세 (items hydrated). */
export async function loadRoute(id: number): Promise<SavedRouteDetail> {
  const { data } = await api.get<SavedRouteDetail>(`/api/route/${id}`);
  return data;
}

/** `DELETE /api/route/{id}` — 삭제. 응답은 void / 단순 success. */
export async function deleteRoute(id: number): Promise<void> {
  await api.delete(`/api/route/${id}`);
}
