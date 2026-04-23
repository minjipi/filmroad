import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from '@/services/api';
import { useMapStore, type MapResponse } from '@/stores/map';
import { signInForTest } from './__helpers__/auth';

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

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
    coverImageUrl: 'https://img/1.jpg',
    photoCount: 1204,
    likeCount: 3200,
    rating: 4.8,
    distanceKm: 0.1,
  },
};

describe('map store', () => {
  beforeEach(() => {
    setActivePinia(createPinia()); signInForTest();
    mockApi.get.mockReset();
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
        coverImageUrl: 'https://img/13.jpg',
        photoCount: 1980,
        likeCount: 4100,
        rating: 4.7,
        distanceKm: 180.4,
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

  it('toggleSave flips savedIds membership and powers the SAVED filter', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();

    store.toggleSave(13);
    expect(store.isSaved(13)).toBe(true);
    store.setFilter('SAVED');
    expect(store.visibleMarkers.map((m) => m.id)).toEqual([13]);

    store.toggleSave(13);
    expect(store.isSaved(13)).toBe(false);
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

  it('setFilter reassigns selected when it is no longer visible', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useMapStore();
    await store.fetchMap();

    // selected is id=10 (visited). Switching to SAVED (empty) drops selected.
    store.setFilter('SAVED');
    expect(store.selected).toBeNull();

    // Save id=13 and flip back to SAVED — selected should promote to id=13.
    store.toggleSave(13);
    store.setFilter('SPOTS');
    // Force selected back to 10, then SAVED should retarget to 13.
    store.selected = { ...fixture.selected! };
    store.setFilter('SAVED');
    expect(store.selected?.id).toBe(13);
  });
});
