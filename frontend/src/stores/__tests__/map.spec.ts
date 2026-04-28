import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '@/services/api';
import {
  useMapStore,
  type MapResponse,
  KOREA_CENTER,
  COUNTRY_ZOOM,
  DETAIL_ZOOM,
} from '@/stores/map';
import { signInForTest } from './__helpers__/auth';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const fixture: MapResponse = {
  markers: [
    {
      id: 10,
      name: '주문진 영진해변 방파제',
      latitude: 37.8928,
      longitude: 128.8347,
      workId: 1,
      workTitle: '도깨비',
      regionLabel: '강릉시 주문진읍',
      distanceKm: 0.1,
    },
    {
      id: 13,
      name: '단밤 포차',
      latitude: 37.5347,
      longitude: 126.9947,
      workId: 2,
      workTitle: '이태원 클라쓰',
      regionLabel: '서울 용산구 이태원동',
      distanceKm: 180.4,
    },
  ],
  selected: {
    id: 10,
    name: '주문진 영진해변 방파제',
    regionLabel: '강릉시 주문진읍',
    latitude: 37.8928,
    longitude: 128.8347,
    workId: 1,
    workTitle: '도깨비',
    workEpisode: null,
    coverImageUrls: ['https://img/1.jpg'],
    photoCount: 1204,
    likeCount: 3200,
    rating: 4.8,
    distanceKm: 0.1,
    liked: false,
  },
};

describe('map store', () => {
  beforeEach(() => {
    setActivePinia(createPinia()); signInForTest();
    mockApi.get.mockReset();
    mockApi.post.mockReset();
  });

  it('fetchMap populates markers, selected and forwards center as lat/lng', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });

    const store = useMapStore();
    await store.fetchMap();

    expect(store.markers).toEqual(fixture.markers);
    expect(store.selected).toEqual(fixture.selected);
    expect(store.error).toBeNull();
    const [url, opts] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/map/places');
    expect(opts?.params).toMatchObject({ lat: store.center.lat, lng: store.center.lng });
  });

  it('fetchMap failure surfaces the error message and stops loading', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('boom'));

    const store = useMapStore();
    await store.fetchMap();

    expect(store.error).toBe('boom');
    expect(store.loading).toBe(false);
  });

  it('fetchMap forwards viewport bounds as swLat/swLng/neLat/neLng query params', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap({
      swLat: 33.0,
      swLng: 124.0,
      neLat: 39.0,
      neLng: 132.0,
    });
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({
      swLat: 33.0,
      swLng: 124.0,
      neLat: 39.0,
      neLng: 132.0,
    });
  });

  it('fetchMap omits bounds params when any corner is missing (partial bounds = no filter)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap({ swLat: 33.0, swLng: 124.0 }); // no ne*
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params.swLat).toBeUndefined();
    expect(opts?.params.neLat).toBeUndefined();
  });

  it('setQuery triggers a refetch with q in the query params', async () => {
    mockApi.get.mockResolvedValue({ data: fixture });
    const store = useMapStore();
    await store.setQuery('이태원');
    expect(mockApi.get).toHaveBeenCalledTimes(1);
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ q: '이태원' });
  });

  it('selectMarker promotes the matching marker and forwards selectedId on refetch', async () => {
    // Initial load returns selected=10; the refetch triggered by selectMarker(13)
    // should pass selectedId=13 and accept the server's updated detail.
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();
    mockApi.get.mockClear();

    const afterSelect: MapResponse = {
      markers: fixture.markers,
      selected: {
        id: 13,
        name: '단밤 포차',
        regionLabel: '서울 용산구 이태원동',
        latitude: 37.5347,
        longitude: 126.9947,
        workId: 2,
        workTitle: '이태원 클라쓰',
        workEpisode: null,
        coverImageUrls: ['https://img/13.jpg'],
        photoCount: 1980,
        likeCount: 4100,
        rating: 4.7,
        distanceKm: 180.4,
        liked: false,
      },
    };
    mockApi.get.mockResolvedValueOnce({ data: afterSelect });

    await store.selectMarker(13);

    expect(store.selected?.id).toBe(13);
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ selectedId: 13 });
  });

  it("visibleMarkers filters by filter='VISITED' using visitedIds", async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();

    // Default visitedIds seeds [10] — so only marker 10 is visible under VISITED.
    store.setFilter('VISITED');
    expect(store.visibleMarkers.map((m) => m.id)).toEqual([10]);

    store.setFilter('SPOTS');
    expect(store.visibleMarkers.map((m) => m.id)).toEqual([10, 13]);
  });

  it('SAVED filter reads the unified savedStore (task #19) — mapStore no longer owns savedIds', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();

    const savedMod = await import('@/stores/saved');
    const saved = savedMod.useSavedStore();
    saved.savedPlaceIds = [13];
    store.setFilter('SAVED');
    expect(store.visibleMarkers.map((m) => m.id)).toEqual([13]);

    saved.savedPlaceIds = [];
    expect(store.visibleMarkers).toEqual([]);
  });

  it('setCenter updates center and refetches with the new lat/lng', async () => {
    mockApi.get.mockResolvedValue({ data: fixture });
    const store = useMapStore();
    await store.setCenter(37.5, 127.0);

    expect(store.center).toEqual({ lat: 37.5, lng: 127.0 });
    expect(mockApi.get).toHaveBeenCalledTimes(1);
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ lat: 37.5, lng: 127.0 });
  });

  it('fetchMap({ countryView: true }) updates markers but leaves selected null + hasBeenViewed false', async () => {
    // Simulate a server that pre-seeds a selected place even on the country
    // view — we should throw that away so the sheet stays hidden.
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap({ countryView: true });

    expect(store.markers).toEqual(fixture.markers);
    expect(store.selected).toBeNull();
    expect(store.hasBeenViewed).toBe(false);
  });

  it('initial state: country-level center + zoom, hasBeenViewed=false, selected=null', () => {
    const store = useMapStore();
    expect(store.center).toEqual(KOREA_CENTER);
    expect(store.zoom).toBe(COUNTRY_ZOOM);
    expect(store.hasBeenViewed).toBe(false);
    expect(store.selected).toBeNull();
  });

  it('initial userLocation is null (권한 요청 전 / 거부 시 me 점 미표시)', () => {
    const store = useMapStore();
    expect(store.userLocation).toBeNull();
  });

  it('setUserLocation updates userLocation and is independent of center', async () => {
    mockApi.get.mockResolvedValue({ data: fixture });
    const store = useMapStore();

    // GPS 좌표 시드 (서울 시청 인근).
    store.setUserLocation({ lat: 37.5665, lng: 126.978 });
    expect(store.userLocation).toEqual({ lat: 37.5665, lng: 126.978 });

    // viewport 가 다른 곳(부산)으로 이동해도 userLocation 은 그대로.
    await store.setCenter(35.18, 129.07);
    expect(store.center).toEqual({ lat: 35.18, lng: 129.07 });
    expect(store.userLocation).toEqual({ lat: 37.5665, lng: 126.978 });

    // 마커 선택으로 center 가 또 옮겨가도 userLocation 은 그대로.
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    await store.selectMarker(13);
    expect(store.center).toEqual({ lat: 37.5347, lng: 126.9947 });
    expect(store.userLocation).toEqual({ lat: 37.5665, lng: 126.978 });

    // null 로 리셋도 가능.
    store.setUserLocation(null);
    expect(store.userLocation).toBeNull();
  });

  it('selectMarker flips hasBeenViewed=true and switches to DETAIL_ZOOM centered on the picked place', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();
    // The fixture's `selected` already primed hasBeenViewed; reset to simulate
    // a country-view fetch that returned markers but no selected place.
    store.selected = null;
    store.hasBeenViewed = false;
    store.center = { ...KOREA_CENTER };
    store.zoom = COUNTRY_ZOOM;

    mockApi.get.mockResolvedValueOnce({ data: { ...fixture, selected: fixture.selected } });
    await store.selectMarker(13);

    expect(store.hasBeenViewed).toBe(true);
    expect(store.zoom).toBe(DETAIL_ZOOM);
    expect(store.center).toEqual({ lat: 37.5347, lng: 126.9947 });
  });

  it('markLastViewed mirrors a PlaceDetail into selected + center + zoom without a network call', () => {
    const store = useMapStore();
    const before = mockApi.get.mock.calls.length;
    store.markLastViewed({
      id: 42,
      name: '테스트 장소',
      regionLabel: '서울',
      latitude: 37.5,
      longitude: 127.0,
      workId: 9,
      workTitle: '테스트 드라마',
      workEpisode: '1회',
      coverImageUrls: [],
      photoCount: 0,
      likeCount: 0,
      rating: 4.2,
      distanceKm: null,
      liked: false,
    });

    expect(store.selected?.id).toBe(42);
    expect(store.center).toEqual({ lat: 37.5, lng: 127.0 });
    expect(store.zoom).toBe(DETAIL_ZOOM);
    expect(store.hasBeenViewed).toBe(true);
    expect(mockApi.get.mock.calls.length).toBe(before);
  });

  it('resetToCountryView wipes selected, restores KOREA_CENTER/COUNTRY_ZOOM, clears hasBeenViewed', () => {
    const store = useMapStore();
    store.markLastViewed({
      id: 1, name: 'x', regionLabel: '', latitude: 1, longitude: 2,
      workId: 0, workTitle: '', workEpisode: null, coverImageUrls: [],
      photoCount: 0, likeCount: 0, rating: 0, distanceKm: null, liked: false,
    });
    expect(store.hasBeenViewed).toBe(true);

    store.resetToCountryView();

    expect(store.selected).toBeNull();
    expect(store.center).toEqual(KOREA_CENTER);
    expect(store.zoom).toBe(COUNTRY_ZOOM);
    expect(store.hasBeenViewed).toBe(false);
  });

  it('sheetMode defaults to "peek"; setSheetMode updates it', () => {
    const store = useMapStore();
    expect(store.sheetMode).toBe('peek');

    store.setSheetMode('closed');
    expect(store.sheetMode).toBe('closed');

    store.setSheetMode('full');
    expect(store.sheetMode).toBe('full');
  });

  it('selectMarker always resets sheetMode to peek (even from full)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();

    // Any prior state — closed, full — gets reset when a new marker is picked,
    // so the user consistently sees the peek summary first.
    store.setSheetMode('full');
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    await store.selectMarker(13);
    expect(store.sheetMode).toBe('peek');

    store.setSheetMode('closed');
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    await store.selectMarker(10);
    expect(store.sheetMode).toBe('peek');
  });

  it('markLastViewed always resets sheetMode to peek (new place = peek)', () => {
    const place = {
      id: 42,
      name: '테스트',
      regionLabel: '서울',
      latitude: 37.5,
      longitude: 127.0,
      workId: 1,
      workTitle: '도깨비',
      workEpisode: null,
      coverImageUrls: [],
      photoCount: 0,
      likeCount: 0,
      rating: 4.0,
      distanceKm: null,
      liked: false,
    };

    const store = useMapStore();

    store.setSheetMode('closed');
    store.markLastViewed(place);
    expect(store.sheetMode).toBe('peek');

    store.setSheetMode('full');
    store.markLastViewed({ ...place, id: 43 });
    expect(store.sheetMode).toBe('peek');
  });

  it('setZoom clamps into [1, 14] and rounds non-integers', () => {
    const store = useMapStore();
    store.setZoom(0);
    expect(store.zoom).toBe(1);
    store.setZoom(99);
    expect(store.zoom).toBe(14);
    store.setZoom(6.7);
    expect(store.zoom).toBe(7);
  });

  it('setFilter reassigns selected when it is no longer visible', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();

    // selected is id=10 (visited). Switching to SAVED (empty) drops selected.
    store.setFilter('SAVED');
    expect(store.selected).toBeNull();

    // Save id=13 via the unified savedStore and flip back to SAVED — selected
    // should promote to id=13.
    const savedMod = await import('@/stores/saved');
    savedMod.useSavedStore().savedPlaceIds = [13];
    store.setFilter('SPOTS');
    // Force selected back to 10, then SAVED should retarget to 13.
    store.selected = { ...fixture.selected! };
    store.setFilter('SAVED');
    expect(store.selected?.id).toBe(13);
  });

  it('sheetFilters defaults: ALL workIds/regions empty, no distance limit, ALL visit', () => {
    const store = useMapStore();
    expect(store.sheetFilters.workIds).toEqual([]);
    expect(store.sheetFilters.regions).toEqual([]);
    expect(store.sheetFilters.maxDistanceKm).toBeNull();
    expect(store.sheetFilters.visitStatus).toBe('ALL');
    expect(store.activeSheetFilterCount).toBe(0);
  });

  it('setSheetFilters narrows visibleMarkers by workIds (multi)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();
    expect(store.visibleMarkers.length).toBe(2);

    store.setSheetFilters({ workIds: [1] });
    expect(store.visibleMarkers.map((m) => m.id)).toEqual([10]);

    store.setSheetFilters({ workIds: [2] });
    expect(store.visibleMarkers.map((m) => m.id)).toEqual([13]);

    store.setSheetFilters({ workIds: [1, 2] });
    expect(store.visibleMarkers.map((m) => m.id).sort()).toEqual([10, 13]);
  });

  it('setSheetFilters narrows visibleMarkers by region first-token', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();

    // 강릉시 주문진읍 → "강릉시"; 서울 용산구 이태원동 → "서울".
    store.setSheetFilters({ regions: ['서울'] });
    expect(store.visibleMarkers.map((m) => m.id)).toEqual([13]);
  });

  it('setSheetFilters maxDistanceKm filters by marker.distanceKm (null distance kept)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();

    // 10 → 0.1km, 13 → 180.4km. 5km 이하만 → 10 만 통과.
    store.setSheetFilters({ maxDistanceKm: 5 });
    expect(store.visibleMarkers.map((m) => m.id)).toEqual([10]);
  });

  it('setSheetFilters visitStatus stacks ON TOP of chip filter', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();

    // visitedIds 기본값 [10]. 'UNVISITED' 시트 필터 → 13 만.
    store.setSheetFilters({ visitStatus: 'UNVISITED' });
    expect(store.visibleMarkers.map((m) => m.id)).toEqual([13]);

    store.setSheetFilters({ visitStatus: 'VISITED' });
    expect(store.visibleMarkers.map((m) => m.id)).toEqual([10]);
  });

  it('activeSheetFilterCount counts only non-default groups', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();
    expect(store.activeSheetFilterCount).toBe(0);

    store.setSheetFilters({ workIds: [1] });
    expect(store.activeSheetFilterCount).toBe(1);

    store.setSheetFilters({ regions: ['서울'], maxDistanceKm: 30 });
    expect(store.activeSheetFilterCount).toBe(3);

    store.resetSheetFilters();
    expect(store.activeSheetFilterCount).toBe(0);
  });

  it('availableWorks / availableRegions derive from current markers', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();

    expect(store.availableWorks).toEqual([
      { id: 1, title: '도깨비' },
      { id: 2, title: '이태원 클라쓰' },
    ]);
    // 강릉시 주문진읍 → "강릉시"; 서울 용산구 이태원동 → "서울".
    expect(store.availableRegions).toEqual(['강릉시', '서울']);
  });

  it('availableRegions normalizes 광역시도 variants (강원/강원도/강원특별자치도 → 강원)', async () => {
    // regionLabel 데이터가 정식명·줄임명·신설 자치도명이 섞여 들어와도
    // 같은 광역으로 dedup 돼 한 줄로만 노출.
    mockApi.get.mockResolvedValueOnce({
      data: {
        markers: [
          { id: 1, name: 'A', latitude: 0, longitude: 0, workId: 1, workTitle: 'X', regionLabel: '강원 평창', distanceKm: null },
          { id: 2, name: 'B', latitude: 0, longitude: 0, workId: 1, workTitle: 'X', regionLabel: '강원도 강릉', distanceKm: null },
          { id: 3, name: 'C', latitude: 0, longitude: 0, workId: 1, workTitle: 'X', regionLabel: '강원특별자치도 속초', distanceKm: null },
          { id: 4, name: 'D', latitude: 0, longitude: 0, workId: 2, workTitle: 'Y', regionLabel: '서울특별시 종로구', distanceKm: null },
        ],
        selected: null,
      },
    });
    const store = useMapStore();
    await store.fetchMap();

    expect(store.availableRegions).toEqual(['강원', '서울']);

    // 시트에서 정규화된 "강원" 을 선택하면 raw 라벨이 "강원도", "강원특별자치도" 인
    // marker 도 모두 통과해야 함.
    store.setSheetFilters({ regions: ['강원'] });
    expect(store.visibleMarkers.map((m) => m.id).sort()).toEqual([1, 2, 3]);
  });

  it('toggleLike flips selected.liked optimistically and adopts the server response', async () => {
    // 각 toggleLike 테스트는 selected 를 mutate 하므로 공유 fixture 가 오염되지
    // 않도록 selected 를 새로 클론해서 mock 에 넘긴다.
    mockApi.get.mockResolvedValueOnce({ data: { ...fixture, selected: { ...fixture.selected! } } });
    const store = useMapStore();
    await store.fetchMap();
    expect(store.selected?.liked).toBe(false);
    expect(store.selected?.likeCount).toBe(3200);

    let resolvePost!: (v: { data: { liked: boolean; likeCount: number } }) => void;
    mockApi.post.mockImplementationOnce(
      () => new Promise((r) => { resolvePost = r; }),
    );
    const inflight = store.toggleLike(10);

    // optimistic flip — 응답 오기 전에 이미 liked=true, likeCount +1.
    expect(store.selected?.liked).toBe(true);
    expect(store.selected?.likeCount).toBe(3201);

    resolvePost({ data: { liked: true, likeCount: 3210 } });
    await inflight;
    // 서버 진실로 덮어쓰기 — optimistic 으로 박은 +1 과 다를 수 있다.
    expect(store.selected?.liked).toBe(true);
    expect(store.selected?.likeCount).toBe(3210);
    expect(mockApi.post.mock.calls[0][0]).toBe('/api/places/10/like');
  });

  it('toggleLike rolls back to previous state on API failure', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { ...fixture, selected: { ...fixture.selected! } } });
    const store = useMapStore();
    await store.fetchMap();

    mockApi.post.mockRejectedValueOnce(new Error('network down'));
    await store.toggleLike(10);

    // 롤백 — 원래의 liked=false, likeCount=3200 으로 복원되고 error 메시지 노출.
    expect(store.selected?.liked).toBe(false);
    expect(store.selected?.likeCount).toBe(3200);
    expect(store.error).toBe('network down');
  });

  it('toggleLike for a different place than selected is a no-op', async () => {
    // selected 만 단일 카드라 시트가 다른 placeId 로 액션을 보낼 일은 없지만,
    // 안전망 — 호출자 실수로 잘못된 id 가 들어와도 selected 가 오염되지 않는다.
    mockApi.get.mockResolvedValueOnce({ data: { ...fixture, selected: { ...fixture.selected! } } });
    const store = useMapStore();
    await store.fetchMap();

    await store.toggleLike(99);
    expect(mockApi.post).not.toHaveBeenCalled();
    expect(store.selected?.liked).toBe(false);
  });
});
