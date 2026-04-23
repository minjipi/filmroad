import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '@/services/api';
import { useSavedStore, type SavedResponse } from '@/stores/saved';
import { signInForTest } from './__helpers__/auth';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const fixture: SavedResponse = {
  collections: [
    { id: 1, name: '다음 여행 · 강릉', coverImageUrl: 'https://img/c1.jpg', count: 8, gradient: null },
    { id: 2, name: '도깨비 컴플리트', coverImageUrl: 'https://img/c2.jpg', count: 24, gradient: null },
  ],
  totalCount: 2,
  items: [
    {
      placeId: 10,
      name: '주문진 영진해변 방파제',
      regionLabel: '강릉시 주문진읍',
      coverImageUrl: 'https://img/p10.jpg',
      workId: 1,
      workTitle: '도깨비',
      distanceKm: 1.2,
      likeCount: 3200,
      visited: false,
      collectionId: null,
    },
    {
      placeId: 13,
      name: '단밤 포차',
      regionLabel: '서울 용산구 이태원동',
      coverImageUrl: 'https://img/p13.jpg',
      workId: 2,
      workTitle: '이태원 클라쓰',
      distanceKm: 4.8,
      likeCount: 5100,
      visited: true,
      collectionId: null,
    },
  ],
  nearbyRouteSuggestion: {
    title: '근처 성지 4곳, 하루에 돌 수 있어요',
    subtitle: 'AI가 자동으로 루트를 짜드려요',
    placeCount: 4,
  },
};

describe('saved store', () => {
  beforeEach(() => {
    setActivePinia(createPinia()); signInForTest();
    mockApi.get.mockReset();
    mockApi.post.mockReset();
  });

  it('fetch happy path populates collections/items/totalCount/suggestion and hits /api/saved', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });

    const store = useSavedStore();
    await store.fetch();

    expect(store.collections).toEqual(fixture.collections);
    expect(store.items).toEqual(fixture.items);
    expect(store.totalCount).toBe(2);
    expect(store.suggestion).toEqual(fixture.nearbyRouteSuggestion);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();

    const [url] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/saved');
  });

  it('fetch forwards lat/lng query params when provided', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useSavedStore();
    await store.fetch({ lat: 37.5, lng: 127.0 });

    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ lat: 37.5, lng: 127.0 });
  });

  it('fetch failure surfaces the error message and clears loading', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('boom'));
    const store = useSavedStore();
    await store.fetch();

    expect(store.error).toBe('boom');
    expect(store.loading).toBe(false);
  });

  it('fetch hydrates savedPlaceIds from items so isSaved(placeId) works across pages', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useSavedStore();
    await store.fetch();

    expect(store.savedPlaceIds.sort()).toEqual([10, 13]);
    expect(store.isSaved(10)).toBe(true);
    expect(store.isSaved(13)).toBe(true);
    expect(store.isSaved(999)).toBe(false);
  });

  it('toggleSave(off) drops the place from items + savedPlaceIds and updates totalCount', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useSavedStore();
    await store.fetch();

    mockApi.post.mockResolvedValueOnce({ data: { saved: false, totalCount: 1 } });
    await store.toggleSave(10);

    expect(store.items.find((i) => i.placeId === 10)).toBeUndefined();
    expect(store.items.length).toBe(1);
    expect(store.totalCount).toBe(1);
    expect(store.isSaved(10)).toBe(false);
    expect(store.savedPlaceIds).not.toContain(10);

    const [url, body] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/saved/toggle');
    expect(body).toEqual({ placeId: 10 });
  });

  it('toggleSave(on) adds to savedPlaceIds AND re-fetches so items surfaces the new place (not just the id)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useSavedStore();
    await store.fetch();

    expect(store.isSaved(99)).toBe(false);
    // Server says "saved" in the toggle response …
    mockApi.post.mockResolvedValueOnce({ data: { saved: true, totalCount: 3 } });
    // … and the subsequent re-fetch returns the extended list with the new place.
    const extended: SavedResponse = {
      ...fixture,
      items: [
        ...fixture.items,
        {
          placeId: 99,
          name: '영진 커피숍',
          regionLabel: '강릉시 주문진읍',
          coverImageUrl: 'https://img/p99.jpg',
          workId: 1,
          workTitle: '도깨비',
          distanceKm: 0.4,
          likeCount: 120,
          visited: false,
          collectionId: null,
        },
      ],
      totalCount: 3,
    };
    mockApi.get.mockResolvedValueOnce({ data: extended });

    await store.toggleSave(99);

    expect(store.items.length).toBe(3);
    expect(store.items.find((i) => i.placeId === 99)?.name).toBe('영진 커피숍');
    expect(store.totalCount).toBe(3);
    expect(store.isSaved(99)).toBe(true);
    expect(store.savedPlaceIds).toContain(99);
    // Initial fetch + post-toggle re-fetch.
    expect(mockApi.get).toHaveBeenCalledTimes(2);
    expect(mockApi.post).toHaveBeenCalledTimes(1);
  });

  it('toggleSave(off) is still an optimistic local splice — no extra re-fetch', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useSavedStore();
    await store.fetch();
    mockApi.get.mockClear();

    mockApi.post.mockResolvedValueOnce({ data: { saved: false, totalCount: 1 } });
    await store.toggleSave(10);

    expect(store.items.find((i) => i.placeId === 10)).toBeUndefined();
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('toggleSave on an anonymous visitor opens the login prompt instead of hitting /api/saved/toggle', async () => {
    const { useAuthStore } = await import('@/stores/auth');
    useAuthStore().user = null; // signInForTest ran in beforeEach — undo it.

    const uiMod = await import('@/stores/ui');
    const promptSpy = vi.spyOn(uiMod.useUiStore(), 'showLoginPrompt');
    const store = useSavedStore();

    await store.toggleSave(10);

    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(mockApi.post).not.toHaveBeenCalled();
  });
});
