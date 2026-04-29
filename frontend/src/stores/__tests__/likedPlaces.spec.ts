import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn() },
}));

import api from '@/services/api';
import { useLikedPlacesStore, type LikedPlace } from '@/stores/likedPlaces';

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

function fixturePlace(id: number, overrides: Partial<LikedPlace> = {}): LikedPlace {
  return {
    id,
    name: `장소 ${id}`,
    regionLabel: '강원도 강릉시',
    coverImageUrls: [`/uploads/cover-${id}.jpg`],
    contentId: 100,
    contentTitle: '도깨비',
    likeCount: 12,
    likeId: id,
    ...overrides,
  };
}

describe('useLikedPlacesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockApi.get.mockReset();
  });

  it('fetch() 가 첫 페이지를 받아 items / nextCursor / loaded 를 채운다', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: {
        places: [fixturePlace(17), fixturePlace(16), fixturePlace(14)],
        nextCursor: 14,
      },
    });

    const store = useLikedPlacesStore();
    await store.fetch();

    expect(mockApi.get).toHaveBeenCalledWith('/api/users/me/liked-places', {
      params: { limit: 30 },
    });
    expect(store.items.map((p) => p.id)).toEqual([17, 16, 14]);
    expect(store.nextCursor).toBe(14);
    expect(store.hasMore).toBe(true);
    expect(store.loaded).toBe(true);
  });

  it('nextCursor=null 응답이면 hasMore=false 로 끝 표시', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: { places: [fixturePlace(17)], nextCursor: null },
    });

    const store = useLikedPlacesStore();
    await store.fetch();

    expect(store.hasMore).toBe(false);
    expect(store.nextCursor).toBeNull();
  });

  it('loadMore() 가 cursor 를 보내고 결과를 push 한다', async () => {
    const store = useLikedPlacesStore();
    // seed 첫 페이지 상태 직접 설정 — fetch 두 번 부르지 않도록.
    store.items = [fixturePlace(17), fixturePlace(16)];
    store.nextCursor = 14;
    store.hasMore = true;
    store.loaded = true;

    mockApi.get.mockResolvedValueOnce({
      data: { places: [fixturePlace(13), fixturePlace(10)], nextCursor: null },
    });

    await store.loadMore();

    expect(mockApi.get).toHaveBeenCalledWith('/api/users/me/liked-places', {
      params: { limit: 30, cursor: 14 },
    });
    expect(store.items.map((p) => p.id)).toEqual([17, 16, 13, 10]);
    expect(store.hasMore).toBe(false);
    expect(store.nextCursor).toBeNull();
  });

  it('loadMore() 는 hasMore=false / nextCursor=null / loading 상태에서 noop', async () => {
    const store = useLikedPlacesStore();

    store.hasMore = false;
    await store.loadMore();
    expect(mockApi.get).not.toHaveBeenCalled();

    store.hasMore = true;
    store.nextCursor = null;
    await store.loadMore();
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('removeFromList(id) 가 해당 placeId 만 제거한다 (다른 surface 의 unlike 후크용)', () => {
    const store = useLikedPlacesStore();
    store.items = [fixturePlace(17), fixturePlace(16), fixturePlace(14)];

    store.removeFromList(16);

    expect(store.items.map((p) => p.id)).toEqual([17, 14]);
  });

  it('removeFromList 가 없는 placeId 면 no-op (좋아요 안 한 곳에서도 안전)', () => {
    const store = useLikedPlacesStore();
    store.items = [fixturePlace(17)];

    store.removeFromList(999);

    expect(store.items.map((p) => p.id)).toEqual([17]);
  });

  it('reset() 이 모든 state 를 초기값으로 되돌린다', () => {
    const store = useLikedPlacesStore();
    store.items = [fixturePlace(17)];
    store.nextCursor = 14;
    store.hasMore = false;
    store.loaded = true;
    store.error = 'oops';

    store.reset();

    expect(store.items).toEqual([]);
    expect(store.nextCursor).toBeNull();
    expect(store.hasMore).toBe(true);
    expect(store.loaded).toBe(false);
    expect(store.error).toBeNull();
  });

  it('fetch 실패 시 error 가 채워지고 items 는 그대로', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('network down'));

    const store = useLikedPlacesStore();
    await store.fetch();

    expect(store.error).toBe('network down');
    expect(store.items).toEqual([]);
    expect(store.loaded).toBe(false);
  });
});
