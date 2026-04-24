import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn() },
}));

import api from '@/services/api';
import {
  useProfileStore,
  type MyPhoto,
  type ProfileResponse,
} from '@/stores/profile';

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const fixture: ProfileResponse = {
  user: {
    id: 1,
    nickname: '김미루',
    handle: 'miru',
    avatarUrl: 'https://img/avatar.jpg',
    bio: '성지 순례 중',
    level: 5,
    levelName: '성지 순례자',
    points: 350,
    streakDays: 7,
    followersCount: 1200,
    followingCount: 234,
  },
  stats: {
    visitedCount: 42,
    photoCount: 186,
    followersCount: 1200,
    followingCount: 234,
  },
  miniMapPins: [
    { latitude: 37.8928, longitude: 128.8347, variant: 'PRIMARY' },
    { latitude: 37.5658, longitude: 126.9751, variant: 'VIOLET' },
    { latitude: 35.1796, longitude: 129.0756, variant: 'MINT' },
  ],
};

describe('profile store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockApi.get.mockReset();
  });

  it('initial state has null user/stats, empty pins, no error, not loading', () => {
    const store = useProfileStore();
    expect(store.user).toBeNull();
    expect(store.stats).toBeNull();
    expect(store.miniMapPins).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('fetch happy path populates user/stats/miniMapPins and calls GET /api/users/me', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });

    const store = useProfileStore();
    await store.fetch();

    expect(store.user).toEqual(fixture.user);
    expect(store.stats).toEqual(fixture.stats);
    expect(store.miniMapPins).toEqual(fixture.miniMapPins);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    const [url, opts] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/users/me');
    // /me endpoint is called without any query params.
    expect(opts).toBeUndefined();
  });

  it('fetch failure surfaces the error message and clears loading', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('unauth'));

    const store = useProfileStore();
    await store.fetch();

    expect(store.error).toBe('unauth');
    expect(store.loading).toBe(false);
    expect(store.user).toBeNull();
  });

  // ---------------- task #35: fetchMyPhotos ----------------

  function makePhoto(id: number, overrides: Partial<MyPhoto> = {}): MyPhoto {
    return {
      id,
      imageUrl: `https://cdn/p/${id}.jpg`,
      caption: null,
      placeId: id,
      placeName: `장소${id}`,
      regionLabel: '강원 강릉시',
      workId: 1,
      workTitle: '도깨비',
      visibility: 'PUBLIC',
      createdAt: '2026-04-22T00:00:00Z',
      ...overrides,
    };
  }

  it('fetchMyPhotos() first-page: GET /api/users/me/photos?limit=30 populates photos + nextCursor (task #35)', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: { photos: [makePhoto(10), makePhoto(9)], nextCursor: 9 },
    });

    const store = useProfileStore();
    await store.fetchMyPhotos();

    expect(store.myPhotos.length).toBe(2);
    expect(store.myPhotos[0].id).toBe(10);
    expect(store.myPhotosNextCursor).toBe(9);
    expect(store.myPhotosLoaded).toBe(true);
    expect(store.myPhotosLoading).toBe(false);
    expect(store.myPhotosError).toBeNull();

    const [url, opts] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/users/me/photos');
    expect(opts?.params).toMatchObject({ limit: 30 });
    // cursor omitted on the first page.
    expect(opts?.params?.cursor).toBeUndefined();
  });

  it('fetchMyPhotos(cursor=N) appends to the existing list and forwards cursor in the request', async () => {
    // Seed first page.
    mockApi.get.mockResolvedValueOnce({
      data: { photos: [makePhoto(10), makePhoto(9)], nextCursor: 9 },
    });
    const store = useProfileStore();
    await store.fetchMyPhotos();
    expect(store.myPhotos.length).toBe(2);

    // Second page: same call shape with cursor=9 → appends.
    mockApi.get.mockResolvedValueOnce({
      data: { photos: [makePhoto(8), makePhoto(7)], nextCursor: null },
    });
    await store.fetchMyPhotos(9);

    expect(store.myPhotos.length).toBe(4);
    expect(store.myPhotos.map((p) => p.id)).toEqual([10, 9, 8, 7]);
    expect(store.myPhotosNextCursor).toBeNull();

    const [, opts] = mockApi.get.mock.calls[1];
    expect(opts?.params).toMatchObject({ cursor: 9, limit: 30 });
  });

  it('fetchMyPhotos honors a custom limit argument (server clamps to 60)', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: { photos: [], nextCursor: null },
    });
    const store = useProfileStore();
    await store.fetchMyPhotos(null, 10);

    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ limit: 10 });
  });

  it('fetchMyPhotos failure surfaces myPhotosError and clears loading (existing list untouched)', async () => {
    // Seed a prior successful page.
    mockApi.get.mockResolvedValueOnce({
      data: { photos: [makePhoto(1)], nextCursor: null },
    });
    const store = useProfileStore();
    await store.fetchMyPhotos();

    mockApi.get.mockRejectedValueOnce(new Error('server down'));
    await store.fetchMyPhotos(1);

    expect(store.myPhotosError).toBe('server down');
    expect(store.myPhotosLoading).toBe(false);
    // Existing photos remain — failed pagination doesn't blank the grid.
    expect(store.myPhotos.length).toBe(1);
  });
});
