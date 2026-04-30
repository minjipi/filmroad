import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/route', () => ({
  fetchDirections: vi.fn(),
  fetchRouteInit: vi.fn(),
  saveRoute: vi.fn(),
  updateRoute: vi.fn(),
  loadRoute: vi.fn(),
  listMyRoutes: vi.fn(),
  deleteRoute: vi.fn(),
}));

import {
  fetchDirections,
  fetchRouteInit,
  saveRoute,
  updateRoute,
  loadRoute,
  deleteRoute,
} from '@/services/route';
import type { RouteInitPlace, RouteInitResponse, SavedRouteDetail } from '@/services/route';
import { useTripRouteStore, type TripPlace } from '@/stores/tripRoute';

const mockFetchDirections = fetchDirections as unknown as ReturnType<typeof vi.fn>;
const mockFetchRouteInit = fetchRouteInit as unknown as ReturnType<typeof vi.fn>;
const mockSaveRoute = saveRoute as unknown as ReturnType<typeof vi.fn>;
const mockUpdateRoute = updateRoute as unknown as ReturnType<typeof vi.fn>;
const mockLoadRoute = loadRoute as unknown as ReturnType<typeof vi.fn>;
const mockDeleteRoute = deleteRoute as unknown as ReturnType<typeof vi.fn>;

function makePlace(over: Partial<TripPlace> = {}): TripPlace {
  return {
    id: 1,
    name: '테스트 장소',
    regionLabel: '강원 춘천',
    latitude: 37.88,
    longitude: 127.73,
    contentId: 1,
    contentTitle: '테스트 작품',
    coverImageUrl: null,
    sceneImageUrl: null,
    durationMin: 60,
    ...over,
  };
}

function makeInitPlace(over: Partial<RouteInitPlace> = {}): RouteInitPlace {
  return {
    placeId: 100,
    name: '테스트 spot',
    regionLabel: '강원 춘천 남산면',
    address: '강원 춘천시 남산면 1',
    latitude: 37.79,
    longitude: 127.52,
    coverImageUrl: null,
    sceneImageUrl: null,
    durationMin: 60,
    rating: null,
    ...over,
  };
}

function makeInitResponse(places: RouteInitPlace[], title = '겨울연가'): RouteInitResponse {
  return {
    content: {
      id: 1,
      title,
      posterUrl: null,
    },
    suggestedName: `${title} 코스`,
    suggestedStartTime: '09:00',
    places,
  };
}

const FIVE_INIT_PLACES: RouteInitPlace[] = [
  makeInitPlace({ placeId: 90001, name: '남이섬', latitude: 37.7903, longitude: 127.5253, durationMin: 120 }),
  makeInitPlace({ placeId: 90002, name: '강촌 레일파크', latitude: 37.8237, longitude: 127.6151, durationMin: 90 }),
  makeInitPlace({ placeId: 90003, name: '명동 닭갈비', latitude: 37.8813, longitude: 127.7299, durationMin: 75 }),
  makeInitPlace({ placeId: 90004, name: '소양강 스카이워크', latitude: 37.8961, longitude: 127.7129, durationMin: 45 }),
  makeInitPlace({ placeId: 90005, name: '구봉산 전망대', latitude: 37.9023, longitude: 127.7826, durationMin: 60 }),
];

function makeSavedDetail(over: Partial<SavedRouteDetail> = {}): SavedRouteDetail {
  return {
    id: 42,
    name: '나의 강원 코스',
    startTime: '10:30',
    contentId: 1,
    contentTitle: '겨울연가',
    items: [
      {
        placeId: 70001,
        orderIndex: 0,
        durationMin: 90,
        note: '벚꽃 좋음',
        name: '남이섬',
        regionLabel: '강원 춘천',
        address: null,
        latitude: 37.79,
        longitude: 127.525,
        coverImageUrl: null,
        sceneImageUrl: null,
        rating: 4.6,
      },
      {
        placeId: 70002,
        orderIndex: 1,
        durationMin: 60,
        note: null,
        name: '강촌 레일파크',
        regionLabel: '강원 춘천',
        address: null,
        latitude: 37.8237,
        longitude: 127.6151,
        coverImageUrl: null,
        sceneImageUrl: null,
        rating: 4.4,
      },
    ],
    createdAt: '2026-04-30T10:00:00Z',
    updatedAt: '2026-04-30T10:00:00Z',
    ...over,
  };
}

describe('tripRoute store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockFetchDirections.mockReset();
    mockFetchRouteInit.mockReset();
    mockSaveRoute.mockReset();
    mockUpdateRoute.mockReset();
    mockLoadRoute.mockReset();
    mockDeleteRoute.mockReset();
    // default — directions 응답 없음 (직선 폴백).
    mockFetchDirections.mockResolvedValue({
      available: false,
      path: [],
      sections: [],
      distanceMeters: null,
      durationSec: null,
    });
  });

  it('seedFromContent calls fetchRouteInit, populates places, applies suggestedName + suggestedStartTime', async () => {
    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse(FIVE_INIT_PLACES));
    const store = useTripRouteStore();
    expect(store.placeIds.length).toBe(0);

    await store.seedFromContent(1, '겨울연가');

    expect(mockFetchRouteInit).toHaveBeenCalledWith(1);
    expect(store.placeIds).toEqual([90001, 90002, 90003, 90004, 90005]);
    expect(store.activeId).toBe(90001);
    expect(store.seedContentId).toBe(1);
    expect(store.seedContentTitle).toBe('겨울연가');
    expect(store.name).toBe('겨울연가 코스');
    expect(store.startTime).toBe('09:00');
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.currentSavedRouteId).toBeNull();
    expect(store.orderedPlaces.map((p) => p.id)).toEqual(store.placeIds);
  });

  it('seedFromContent maps RouteInitPlace fields (regionLabel, address, durationMin, rating) into TripPlace', async () => {
    const place = makeInitPlace({
      placeId: 7,
      name: '테스트',
      regionLabel: '서울 종로',
      address: '서울시 종로구 1',
      latitude: 37.5,
      longitude: 127.0,
      coverImageUrl: 'https://img/cover.jpg',
      sceneImageUrl: 'https://img/scene.jpg',
      durationMin: 75,
      rating: 4.7,
    });
    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse([place], '테스트작품'));
    const store = useTripRouteStore();
    await store.seedFromContent(99, '테스트작품');

    const p = store.placesById[7];
    expect(p.regionLabel).toBe('서울 종로');
    expect(p.address).toBe('서울시 종로구 1');
    expect(p.coverImageUrl).toBe('https://img/cover.jpg');
    expect(p.sceneImageUrl).toBe('https://img/scene.jpg');
    expect(p.durationMin).toBe(75);
    expect(p.rating).toBe(4.7);
  });

  it('seedFromContent is a noop when re-called with the same seed (preserves user mutations)', async () => {
    mockFetchRouteInit.mockResolvedValue(makeInitResponse(FIVE_INIT_PLACES));
    const store = useTripRouteStore();
    await store.seedFromContent(1, '겨울연가');
    const initialIds = [...store.placeIds];
    store.removePlace(initialIds[2]);
    expect(store.placeIds.length).toBe(4);

    // 같은 시드 재호출 → fetch 자체를 다시 안 부르고 사용자 상태 보존.
    await store.seedFromContent(1, '겨울연가');
    expect(store.placeIds.length).toBe(4);
    expect(mockFetchRouteInit).toHaveBeenCalledTimes(1);
  });

  it('seedFromContent re-seeds when the seed changes (different content)', async () => {
    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse(FIVE_INIT_PLACES, '겨울연가'));
    const store = useTripRouteStore();
    await store.seedFromContent(1, '겨울연가');
    store.removePlace(store.placeIds[0]);
    expect(store.placeIds.length).toBe(4);

    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse(FIVE_INIT_PLACES, '도깨비'));
    await store.seedFromContent(2, '도깨비');
    expect(store.placeIds.length).toBe(5);
    expect(store.seedContentId).toBe(2);
    expect(store.name).toBe('도깨비 코스');
  });

  it('seedFromContent surfaces error and leaves placeIds empty when fetch fails', async () => {
    mockFetchRouteInit.mockRejectedValueOnce(new Error('boom'));
    const store = useTripRouteStore();
    await store.seedFromContent(1, '겨울연가');

    expect(store.error).toBe('boom');
    expect(store.placeIds).toEqual([]);
    expect(store.loading).toBe(false);
  });

  it('seedFromContent skips fetch when contentId is null and only resets seed context', async () => {
    const store = useTripRouteStore();
    await store.seedFromContent(null, null);

    expect(mockFetchRouteInit).not.toHaveBeenCalled();
    expect(store.placeIds).toEqual([]);
    expect(store.name).toBe('나의 여행 코스');
  });

  it('addPlace appends a new place and skips when already present', () => {
    const store = useTripRouteStore();
    const p = makePlace({ id: 555 });
    store.addPlace(p);
    expect(store.placeIds).toEqual([555]);
    expect(store.activeId).toBe(555);

    store.activeId = null;
    store.addPlace(p);
    expect(store.placeIds).toEqual([555]);
    expect(store.activeId).toBe(555);
  });

  it('removePlace splices, drops note, and falls back activeId to the head', () => {
    const store = useTripRouteStore();
    store.addPlace(makePlace({ id: 1 }));
    store.addPlace(makePlace({ id: 2 }));
    store.addPlace(makePlace({ id: 3 }));
    store.updateNote(2, '메모 본문');
    store.setActive(2);

    store.removePlace(2);

    expect(store.placeIds).toEqual([1, 3]);
    expect(store.placesById[2]).toBeUndefined();
    expect(store.notes[2]).toBeUndefined();
    expect(store.activeId).toBe(1);
  });

  it('reorder moves a place from one index to another (clamped to bounds)', () => {
    const store = useTripRouteStore();
    [10, 20, 30, 40].forEach((id) => store.addPlace(makePlace({ id })));
    expect(store.placeIds).toEqual([10, 20, 30, 40]);

    store.reorder(1, 3);
    expect(store.placeIds).toEqual([10, 30, 40, 20]);

    store.reorder(2, 2);
    expect(store.placeIds).toEqual([10, 30, 40, 20]);

    store.reorder(0, 99);
    expect(store.placeIds).toEqual([30, 40, 20, 10]);
  });

  it('updateNote sets a trimmed note, and clears the key when the value is empty', () => {
    const store = useTripRouteStore();
    store.addPlace(makePlace({ id: 7 }));

    store.updateNote(7, '여기 분위기 좋음');
    expect(store.notes[7]).toBe('여기 분위기 좋음');

    store.updateNote(7, '   ');
    expect(store.notes[7]).toBeUndefined();
  });

  it('totalDistanceKm sums haversine distances between consecutive places (>= 0)', async () => {
    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse(FIVE_INIT_PLACES));
    const store = useTripRouteStore();
    await store.seedFromContent(1, '겨울연가');
    expect(store.totalDistanceKm).toBeGreaterThan(0);
    expect(store.totalDistanceKm).toBeCloseTo(Math.round(store.totalDistanceKm * 10) / 10, 1);
  });

  it('searchSuggestions excludes places already in the route', async () => {
    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse(FIVE_INIT_PLACES));
    const store = useTripRouteStore();
    await store.seedFromContent(1, '겨울연가');
    const suggestionIds = store.searchSuggestions.map((s) => s.id);
    expect(suggestionIds.length).toBeGreaterThan(0);
    for (const id of suggestionIds) {
      expect(store.placeIds.includes(id)).toBe(false);
    }

    const first = store.searchSuggestions[0];
    store.addPlace(first);
    expect(store.searchSuggestions.find((s) => s.id === first.id)).toBeUndefined();
  });

  it('reset clears all state — placeIds, notes, activeId, seed context, currentSavedRouteId', async () => {
    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse(FIVE_INIT_PLACES));
    const store = useTripRouteStore();
    await store.seedFromContent(1, '겨울연가');
    store.updateNote(store.placeIds[0], '메모');
    store.reset();

    expect(store.placeIds).toEqual([]);
    expect(store.placesById).toEqual({});
    expect(store.notes).toEqual({});
    expect(store.activeId).toBeNull();
    expect(store.seedContentId).toBeNull();
    expect(store.seedContentTitle).toBeNull();
    expect(store.name).toBe('나의 여행 코스');
    expect(store.currentSavedRouteId).toBeNull();
  });

  // ── task #9 / #17: 도로 경로 + sections ───────────────────────────────
  it('refreshRoutePath fetches directions and stores path/sections/distance/duration when ≥ 2 places', async () => {
    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse(FIVE_INIT_PLACES));
    mockFetchDirections.mockResolvedValueOnce({
      available: true,
      path: [
        { lat: 37.7903, lng: 127.5253 },
        { lat: 37.79, lng: 127.55 },
        { lat: 37.8237, lng: 127.6151 },
      ],
      sections: [
        [{ lat: 37.7903, lng: 127.5253 }, { lat: 37.79, lng: 127.55 }],
        [{ lat: 37.79, lng: 127.55 }, { lat: 37.8237, lng: 127.6151 }],
      ],
      distanceMeters: 12300,
      durationSec: 1500,
    });
    const store = useTripRouteStore();
    await store.seedFromContent(1, '겨울연가');
    await flushPromises();

    expect(mockFetchDirections).toHaveBeenCalledTimes(1);
    const call = mockFetchDirections.mock.calls[0][0];
    expect(call.origin).toEqual({ lat: 37.7903, lng: 127.5253 });
    expect(call.destination).toEqual({ lat: 37.9023, lng: 127.7826 });
    expect(call.waypoints.length).toBe(3);

    expect(store.routePath.length).toBe(3);
    expect(store.routeSections.length).toBe(2);
    expect(store.routeDistanceMeters).toBe(12300);
    expect(store.routeDurationSec).toBe(1500);
  });

  it('refreshRoutePath falls back (empty path + sections) when response.available is false', async () => {
    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse(FIVE_INIT_PLACES));
    mockFetchDirections.mockResolvedValueOnce({
      available: false,
      path: [],
      sections: [],
      distanceMeters: null,
      durationSec: null,
    });
    const store = useTripRouteStore();
    await store.seedFromContent(1, '겨울연가');
    await flushPromises();

    expect(store.routePath).toEqual([]);
    expect(store.routeSections).toEqual([]);
    expect(store.routeDistanceMeters).toBeNull();
    expect(store.routeDurationSec).toBeNull();
  });

  it('refreshRoutePath defaults routeSections to [] when backend omits the field', async () => {
    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse(FIVE_INIT_PLACES));
    mockFetchDirections.mockResolvedValueOnce({
      available: true,
      path: [
        { lat: 37.7903, lng: 127.5253 },
        { lat: 37.8237, lng: 127.6151 },
      ],
      distanceMeters: 8000,
      durationSec: 600,
    } as never);
    const store = useTripRouteStore();
    await store.seedFromContent(1, '겨울연가');
    await flushPromises();

    expect(store.routePath.length).toBe(2);
    expect(store.routeSections).toEqual([]);
  });

  it('addPlace / removePlace / reorder each retriggers refreshRoutePath', async () => {
    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse(FIVE_INIT_PLACES));
    const store = useTripRouteStore();
    await store.seedFromContent(1, '겨울연가');
    await flushPromises();
    expect(mockFetchDirections).toHaveBeenCalledTimes(1);

    store.addPlace(makePlace({ id: 555 }));
    await flushPromises();
    expect(mockFetchDirections).toHaveBeenCalledTimes(2);

    store.reorder(0, 2);
    await flushPromises();
    expect(mockFetchDirections).toHaveBeenCalledTimes(3);

    store.removePlace(555);
    await flushPromises();
    expect(mockFetchDirections).toHaveBeenCalledTimes(4);
  });

  it('refreshRoutePath skips fetch and clears path when fewer than 2 places', async () => {
    const store = useTripRouteStore();
    store.addPlace(makePlace({ id: 1 }));
    await flushPromises();
    expect(mockFetchDirections).not.toHaveBeenCalled();
    expect(store.routePath).toEqual([]);

    store.addPlace(makePlace({ id: 2 }));
    await flushPromises();
    expect(mockFetchDirections).toHaveBeenCalledTimes(1);

    mockFetchDirections.mockClear();
    store.removePlace(2);
    await flushPromises();
    expect(mockFetchDirections).not.toHaveBeenCalled();
    expect(store.routePath).toEqual([]);
    expect(store.routeDistanceMeters).toBeNull();
  });

  // ── task #11: 저장된 코스 init/save/load/delete ────────────────────────
  it('seedFromSavedRoute hydrates places + notes + start time from /api/route/{id}', async () => {
    mockLoadRoute.mockResolvedValueOnce(makeSavedDetail());
    const store = useTripRouteStore();
    await store.seedFromSavedRoute(42);

    expect(mockLoadRoute).toHaveBeenCalledWith(42);
    expect(store.placeIds).toEqual([70001, 70002]);
    expect(store.notes[70001]).toBe('벚꽃 좋음');
    expect(store.notes[70002]).toBeUndefined();
    expect(store.startTime).toBe('10:30');
    expect(store.name).toBe('나의 강원 코스');
    expect(store.currentSavedRouteId).toBe(42);
    expect(store.seedContentId).toBe(1);
    expect(store.seedContentTitle).toBe('겨울연가');
  });

  it('seedFromSavedRoute skips items without coordinates and falls back missing fields', async () => {
    // backend 가 일부 필드를 빠뜨리거나 좌표 없는 item 을 섞어 보내도 페이지가
    // 깨지지 않게 — 좌표 없는 item 은 skip, 누락 필드는 안전한 default.
    mockLoadRoute.mockResolvedValueOnce({
      id: 7,
      name: '강원 미니',
      // startTime 누락 → '09:00' 폴백
      // contentId / contentTitle 누락 → null 폴백
      items: [
        { placeId: 1, orderIndex: 0, durationMin: 60, note: null, name: '남이섬', regionLabel: '강원', address: null, latitude: 37.79, longitude: 127.52, coverImageUrl: null, sceneImageUrl: null, rating: null },
        { placeId: 2, orderIndex: 1, durationMin: 60, note: null, name: '좌표 누락', regionLabel: '?', address: null, latitude: null as unknown as number, longitude: null as unknown as number, coverImageUrl: null, sceneImageUrl: null, rating: null },
        { placeId: 3, orderIndex: 2, durationMin: 60, note: null, name: '강촌', regionLabel: '강원', address: null, latitude: 37.82, longitude: 127.61, coverImageUrl: null, sceneImageUrl: null, rating: null },
      ],
      createdAt: '2026-04-30T10:00:00Z',
      updatedAt: '2026-04-30T10:00:00Z',
    } as unknown as SavedRouteDetail);
    const store = useTripRouteStore();
    await store.seedFromSavedRoute(7);

    expect(store.placeIds).toEqual([1, 3]); // 좌표 없는 2 는 skip
    expect(store.startTime).toBe('09:00'); // 폴백
    expect(store.seedContentTitle).toBeNull();
    expect(store.currentSavedRouteId).toBe(7);
  });

  it('seedFromSavedRoute survives missing items field (treats as empty)', async () => {
    mockLoadRoute.mockResolvedValueOnce({
      id: 8,
      name: '빈 코스',
      startTime: '09:00',
      contentId: null,
      contentTitle: null,
      // items 자체 누락 → [] 처리
      createdAt: '2026-04-30T10:00:00Z',
      updatedAt: '2026-04-30T10:00:00Z',
    } as unknown as SavedRouteDetail);
    const store = useTripRouteStore();
    await store.seedFromSavedRoute(8);

    expect(store.placeIds).toEqual([]);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.currentSavedRouteId).toBe(8);
  });

  it('seedFromSavedRoute on fetch failure sets error and clears loading without throwing', async () => {
    mockLoadRoute.mockRejectedValueOnce(new Error('Forbidden'));
    const store = useTripRouteStore();
    await store.seedFromSavedRoute(99);

    expect(store.error).toBe('Forbidden');
    expect(store.loading).toBe(false);
    expect(store.placeIds).toEqual([]);
    // 페이지가 살아있도록 currentSavedRouteId 도 확정 X.
    expect(store.currentSavedRouteId).toBeNull();
  });

  it('seedFromSavedRoute is a noop when re-called with the same routeId', async () => {
    mockLoadRoute.mockResolvedValue(makeSavedDetail());
    const store = useTripRouteStore();
    await store.seedFromSavedRoute(42);
    await store.seedFromSavedRoute(42);
    expect(mockLoadRoute).toHaveBeenCalledTimes(1);
  });

  it('saveCurrentRoute POSTs when no currentSavedRouteId and assigns the returned id', async () => {
    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse(FIVE_INIT_PLACES));
    const store = useTripRouteStore();
    await store.seedFromContent(1, '겨울연가');
    expect(store.currentSavedRouteId).toBeNull();

    mockSaveRoute.mockResolvedValueOnce({ id: 99 });
    await store.saveCurrentRoute();

    expect(mockSaveRoute).toHaveBeenCalledTimes(1);
    expect(mockUpdateRoute).not.toHaveBeenCalled();
    const body = mockSaveRoute.mock.calls[0][0];
    expect(body.contentId).toBe(1);
    expect(body.name).toBe('겨울연가 코스');
    expect(body.startTime).toBe('09:00');
    expect(body.items.length).toBe(5);
    expect(body.items[0]).toMatchObject({ placeId: 90001, orderIndex: 0, durationMin: 120 });
    expect(store.currentSavedRouteId).toBe(99);
  });

  it('saveCurrentRoute PUTs when currentSavedRouteId is set', async () => {
    mockLoadRoute.mockResolvedValueOnce(makeSavedDetail({ id: 42 }));
    const store = useTripRouteStore();
    await store.seedFromSavedRoute(42);

    mockUpdateRoute.mockResolvedValueOnce({ id: 42 });
    await store.saveCurrentRoute();

    expect(mockUpdateRoute).toHaveBeenCalledTimes(1);
    expect(mockSaveRoute).not.toHaveBeenCalled();
    expect(mockUpdateRoute.mock.calls[0][0]).toBe(42);
    expect(store.currentSavedRouteId).toBe(42);
  });

  it('saveCurrentRoute throws when placeIds is empty (no API call)', async () => {
    const store = useTripRouteStore();
    expect(store.placeIds.length).toBe(0);
    await expect(store.saveCurrentRoute()).rejects.toThrow();
    expect(mockSaveRoute).not.toHaveBeenCalled();
    expect(mockUpdateRoute).not.toHaveBeenCalled();
  });

  it('saveCurrentRoute embeds notes per item in the request body', async () => {
    mockFetchRouteInit.mockResolvedValueOnce(makeInitResponse(FIVE_INIT_PLACES));
    const store = useTripRouteStore();
    await store.seedFromContent(1, '겨울연가');
    store.updateNote(90002, '맛집 추천');

    mockSaveRoute.mockResolvedValueOnce({ id: 1 });
    await store.saveCurrentRoute();

    const body = mockSaveRoute.mock.calls[0][0];
    const item = body.items.find((i: { placeId: number }) => i.placeId === 90002);
    expect(item.note).toBe('맛집 추천');
    const other = body.items.find((i: { placeId: number }) => i.placeId === 90001);
    expect(other.note).toBeNull();
  });

  it('removeSavedRoute calls deleteRoute and clears currentSavedRouteId when matching', async () => {
    mockLoadRoute.mockResolvedValueOnce(makeSavedDetail({ id: 42 }));
    const store = useTripRouteStore();
    await store.seedFromSavedRoute(42);
    expect(store.currentSavedRouteId).toBe(42);

    mockDeleteRoute.mockResolvedValueOnce(undefined);
    await store.removeSavedRoute(42);

    expect(mockDeleteRoute).toHaveBeenCalledWith(42);
    expect(store.currentSavedRouteId).toBeNull();
  });

  it('removeSavedRoute leaves currentSavedRouteId untouched when deleting a different id', async () => {
    mockLoadRoute.mockResolvedValueOnce(makeSavedDetail({ id: 42 }));
    const store = useTripRouteStore();
    await store.seedFromSavedRoute(42);

    mockDeleteRoute.mockResolvedValueOnce(undefined);
    await store.removeSavedRoute(7);

    expect(store.currentSavedRouteId).toBe(42);
  });
});
