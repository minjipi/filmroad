import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '@/services/api';
import { useSavedStore, type SavedResponse } from '@/stores/saved';
import { signInForTest } from './__helpers__/auth';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const fixture: SavedResponse = {
  collections: [
    { id: 1, name: '다음 여행 · 강릉', coverImageUrls: ['https://img/c1.jpg'], count: 8, gradient: null },
    { id: 2, name: '도깨비 컴플리트', coverImageUrls: ['https://img/c2.jpg'], count: 24, gradient: null },
  ],
  totalCount: 2,
  items: [
    {
      placeId: 10,
      name: '주문진 영진해변 방파제',
      regionLabel: '강릉시 주문진읍',
      coverImageUrls: ['https://img/p10.jpg'],
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
      coverImageUrls: ['https://img/p13.jpg'],
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
    mockApi.patch.mockReset();
    mockApi.delete.mockReset();
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
    // No collectionId supplied → must be absent from the body (undefined is
    // *not* serialized), so the server stays on the "unassigned" default.
    expect(body).toEqual({ placeId: 10 });
  });

  it('toggleSave(placeId, collectionId) forwards the collection id in the POST body (task #29)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useSavedStore();
    await store.fetch();

    mockApi.post.mockResolvedValueOnce({ data: { saved: true, totalCount: 3 } });
    // Re-fetch after save-on; mock it so we don't throw.
    mockApi.get.mockResolvedValueOnce({ data: fixture });

    await store.toggleSave(99, 7);

    const [url, body] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/saved/toggle');
    expect(body).toEqual({ placeId: 99, collectionId: 7 });
  });

  it('toggleSave(placeId, null) explicitly sends collectionId=null (drop into 기본)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useSavedStore();
    await store.fetch();

    mockApi.post.mockResolvedValueOnce({ data: { saved: true, totalCount: 3 } });
    mockApi.get.mockResolvedValueOnce({ data: fixture });

    await store.toggleSave(99, null);

    const [, body] = mockApi.post.mock.calls[0];
    expect(body).toEqual({ placeId: 99, collectionId: null });
  });

  it('toggleSave(on) pushes savedPlaceIds BEFORE the POST resolves (optimistic, task #32)', async () => {
    const store = useSavedStore();
    expect(store.isSaved(42)).toBe(false);

    // Hold the POST promise open so we can inspect state mid-flight.
    let resolvePost: (v: { data: { saved: boolean; totalCount: number } }) => void = () => {};
    mockApi.post.mockImplementationOnce(
      () => new Promise((r) => { resolvePost = r; }),
    );

    const p = store.toggleSave(42);
    // Yield once so the optimistic mutation lands.
    await Promise.resolve();
    // isSaved flips instantly — no await for the POST. This is the core
    // claim of the optimistic behavior: the bookmark icon can re-render
    // before any network round-trip lands.
    expect(store.isSaved(42)).toBe(true);

    // Post-await state depends on what `fetch()` returns; we've asserted
    // what matters above. Unblock the POST so the test exits cleanly.
    resolvePost({ data: { saved: true, totalCount: 1 } });
    // Also mock the subsequent fetch so the await resolves without error.
    mockApi.get.mockResolvedValueOnce({
      data: {
        collections: [],
        items: [
          {
            placeId: 42,
            name: 'x',
            regionLabel: 'y',
            coverImageUrls: ['z'],
            workId: 1,
            workTitle: 'w',
            distanceKm: null,
            likeCount: 0,
            visited: false,
            collectionId: null,
          },
        ],
        totalCount: 1,
        nearbyRouteSuggestion: null,
      },
    });
    await p;
  });

  it('toggleSave(on) rollbacks optimistic push when the POST fails (task #32)', async () => {
    const store = useSavedStore();
    expect(store.isSaved(42)).toBe(false);

    mockApi.post.mockRejectedValueOnce(new Error('server down'));
    await store.toggleSave(42);

    // The pre-POST push was reverted — icon returns to outline.
    expect(store.isSaved(42)).toBe(false);
    expect(store.savedPlaceIds).not.toContain(42);
    expect(store.error).toBe('server down');
  });

  it('toggleSave(off) rollbacks optimistic removal (items + savedPlaceIds) when POST fails', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useSavedStore();
    await store.fetch();
    const itemCountBefore = store.items.length;

    mockApi.post.mockRejectedValueOnce(new Error('server down'));
    await store.toggleSave(10);

    // Rollback restored both the id and the full item row.
    expect(store.isSaved(10)).toBe(true);
    expect(store.savedPlaceIds).toContain(10);
    expect(store.items.length).toBe(itemCountBefore);
    expect(store.items.find((i) => i.placeId === 10)).toBeDefined();
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
          coverImageUrls: ['https://img/p99.jpg'],
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

  it('createCollection posts to /api/saved/collections and prepends the new card to collections', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useSavedStore();
    await store.fetch();
    expect(store.collections.length).toBe(2);

    const serverResp = {
      id: 99,
      name: '새 여름 여행',
      coverImageUrls: null,
      count: 0,
      gradient: null,
    };
    mockApi.post.mockResolvedValueOnce({ data: serverResp });

    const created = await store.createCollection('  새 여름 여행  ');

    expect(created).toEqual(serverResp);
    const [url, body] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/saved/collections');
    // Server gets the trimmed name.
    expect(body).toEqual({ name: '새 여름 여행' });
    // Newly-created collection sits at index 0.
    expect(store.collections[0]).toEqual(serverResp);
    expect(store.collections.length).toBe(3);
  });

  it('createCollection rejects empty / whitespace-only input without hitting the server', async () => {
    const store = useSavedStore();
    const blank = await store.createCollection('   ');
    expect(blank).toBeNull();
    expect(store.error).toBeTruthy();
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('createCollection on an anonymous visitor shows the login prompt and does not POST', async () => {
    const { useAuthStore } = await import('@/stores/auth');
    useAuthStore().user = null;
    const uiMod = await import('@/stores/ui');
    const promptSpy = vi.spyOn(uiMod.useUiStore(), 'showLoginPrompt');

    const store = useSavedStore();
    const result = await store.createCollection('anything');

    expect(result).toBeNull();
    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('renameCollection optimistically flips the card label before the PATCH resolves', async () => {
    // Deep-clone so the optimistic mutation doesn't leak into the shared fixture.
    mockApi.get.mockResolvedValueOnce({ data: structuredClone(fixture) });
    let resolvePatch: (v: { data: unknown }) => void = () => {};
    mockApi.patch.mockImplementationOnce(
      () => new Promise((r) => { resolvePatch = r; }),
    );

    const store = useSavedStore();
    await store.fetch();

    const p = store.renameCollection(1, '강릉 새이름');
    await Promise.resolve();
    // Before the PATCH resolves, optimistic update should already have flipped the name.
    expect(store.collections.find((c) => c.id === 1)?.name).toBe('강릉 새이름');

    resolvePatch({ data: { id: 1, name: '강릉 새이름', count: 8, coverImageUrls: null, gradient: null } });
    await p;

    expect(store.collections.find((c) => c.id === 1)?.name).toBe('강릉 새이름');
    const [url, body] = mockApi.patch.mock.calls[0];
    expect(url).toBe('/api/saved/collections/1');
    expect(body).toEqual({ name: '강릉 새이름' });
  });

  it('renameCollection rolls back the card label when the PATCH fails', async () => {
    mockApi.get.mockResolvedValueOnce({ data: structuredClone(fixture) });
    mockApi.patch.mockRejectedValueOnce(new Error('boom'));

    const store = useSavedStore();
    await store.fetch();

    const ok = await store.renameCollection(1, '실패할 이름');

    expect(ok).toBe(false);
    expect(store.collections.find((c) => c.id === 1)?.name).toBe('다음 여행 · 강릉');
    expect(store.error).toBe('boom');
  });

  it('renameCollection rejects empty name without hitting the server', async () => {
    mockApi.get.mockResolvedValueOnce({ data: structuredClone(fixture) });
    const store = useSavedStore();
    await store.fetch();

    const ok = await store.renameCollection(1, '   ');

    expect(ok).toBe(false);
    expect(store.error).toBeTruthy();
    expect(mockApi.patch).not.toHaveBeenCalled();
  });

  it('renameCollection on an anonymous visitor opens the login prompt and skips the PATCH', async () => {
    const { useAuthStore } = await import('@/stores/auth');
    useAuthStore().user = null;
    const uiMod = await import('@/stores/ui');
    const promptSpy = vi.spyOn(uiMod.useUiStore(), 'showLoginPrompt');

    const store = useSavedStore();
    // Need a target in collections so the early "not found" branch doesn't fire.
    store.collections = [{ id: 1, name: '강릉', coverImageUrls: null, count: 0, gradient: null }];

    const ok = await store.renameCollection(1, '새 이름');

    expect(ok).toBe(false);
    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(mockApi.patch).not.toHaveBeenCalled();
  });

  it('deleteCollection optimistically removes the card + its items + adjusts savedPlaceIds and totalCount', async () => {
    // Hand-rolled fixture: one collection (id=1) holding two saved items.
    const localFixture: SavedResponse = {
      collections: [
        { id: 1, name: '강릉', coverImageUrls: null, count: 2, gradient: null },
        { id: 2, name: '서울', coverImageUrls: null, count: 1, gradient: null },
      ],
      totalCount: 3,
      items: [
        { placeId: 10, name: 'A', regionLabel: '', coverImageUrls: [], workId: 1, workTitle: '', distanceKm: null, likeCount: 0, visited: false, collectionId: 1 },
        { placeId: 11, name: 'B', regionLabel: '', coverImageUrls: [], workId: 1, workTitle: '', distanceKm: null, likeCount: 0, visited: false, collectionId: 1 },
        { placeId: 12, name: 'C', regionLabel: '', coverImageUrls: [], workId: 2, workTitle: '', distanceKm: null, likeCount: 0, visited: false, collectionId: 2 },
      ],
      nearbyRouteSuggestion: null,
    };
    mockApi.get.mockResolvedValueOnce({ data: localFixture });
    let resolveDelete: (v: { data: unknown }) => void = () => {};
    mockApi.delete.mockImplementationOnce(
      () => new Promise((r) => { resolveDelete = r; }),
    );

    const store = useSavedStore();
    await store.fetch();

    const p = store.deleteCollection(1);
    await Promise.resolve();
    // Optimistic: collection 1 gone, its items removed, totalCount adjusted, savedPlaceIds in sync.
    expect(store.collections.map((c) => c.id)).toEqual([2]);
    expect(store.items.map((i) => i.placeId)).toEqual([12]);
    expect(store.savedPlaceIds.sort()).toEqual([12]);
    expect(store.totalCount).toBe(1);

    resolveDelete({ data: null });
    await p;

    expect(mockApi.delete).toHaveBeenCalledWith('/api/saved/collections/1');
  });

  it('deleteCollection rolls back collections + items + savedPlaceIds + totalCount when DELETE fails', async () => {
    mockApi.get.mockResolvedValueOnce({ data: structuredClone(fixture) });
    mockApi.delete.mockRejectedValueOnce(new Error('boom'));

    const store = useSavedStore();
    await store.fetch();
    const before = {
      collectionIds: store.collections.map((c) => c.id),
      itemIds: store.items.map((i) => i.placeId),
      savedIds: [...store.savedPlaceIds].sort(),
      totalCount: store.totalCount,
    };

    const ok = await store.deleteCollection(1);

    expect(ok).toBe(false);
    expect(store.collections.map((c) => c.id)).toEqual(before.collectionIds);
    expect(store.items.map((i) => i.placeId)).toEqual(before.itemIds);
    expect([...store.savedPlaceIds].sort()).toEqual(before.savedIds);
    expect(store.totalCount).toBe(before.totalCount);
    expect(store.error).toBe('boom');
  });

  it('deleteCollection on an anonymous visitor opens the login prompt and skips the DELETE', async () => {
    const { useAuthStore } = await import('@/stores/auth');
    useAuthStore().user = null;
    const uiMod = await import('@/stores/ui');
    const promptSpy = vi.spyOn(uiMod.useUiStore(), 'showLoginPrompt');

    const store = useSavedStore();
    store.collections = [{ id: 1, name: '강릉', coverImageUrls: null, count: 0, gradient: null }];

    const ok = await store.deleteCollection(1);

    expect(ok).toBe(false);
    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(mockApi.delete).not.toHaveBeenCalled();
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
