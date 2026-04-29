import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn() },
}));

import api from '@/services/api';
import { useCollectionStore, type CollectionDetail } from '@/stores/collection';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
};

const fixture: CollectionDetail = {
  id: 42,
  name: '도깨비 컴플리트',
  subtitle: '쓸쓸하고 찬란하神 도깨비의 모든 촬영지',
  coverImageUrl: 'https://img/c42.jpg',
  kind: 'WORK',
  contentTitle: '도깨비',
  createdAt: '2025-09-02T10:00:00Z',
  totalPlaces: 24,
  visitedPlaces: 14,
  certifiedPlaces: 9,
  totalDistanceKm: 486,
  likeCount: 3400,
  owner: { id: 1, nickname: '김소연', avatarUrl: 'https://img/avatar.jpg' },
  privacy: 'PRIVATE',
  upcomingPlaces: [],
  visitedPlacesList: [],
};

describe('collection store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockApi.get.mockReset();
  });

  it('fetchDetail happy path populates detail and hits /api/saved/collections/:id', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useCollectionStore();
    await store.fetchDetail(42);

    expect(store.detail).toEqual(fixture);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    const [url] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/saved/collections/42');
  });

  it('fetchDetail failure surfaces the error message and clears loading', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('boom'));
    const store = useCollectionStore();
    await store.fetchDetail(42);

    expect(store.detail).toBeNull();
    expect(store.error).toBe('boom');
    expect(store.loading).toBe(false);
  });

  it('progressPercent rounds visited/total; remainingCount is total-visited (non-negative)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { ...fixture, totalPlaces: 24, visitedPlaces: 14 } });
    const store = useCollectionStore();
    await store.fetchDetail(42);
    expect(store.progressPercent).toBe(58); // 14/24 = 58.33 → 58
    expect(store.remainingCount).toBe(10);
  });

  it('progressPercent returns 0 on empty collection (not NaN)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { ...fixture, totalPlaces: 0, visitedPlaces: 0 } });
    const store = useCollectionStore();
    await store.fetchDetail(42);
    expect(store.progressPercent).toBe(0);
    expect(store.remainingCount).toBe(0);
  });

  it('reset() clears detail + error so the next page entry starts fresh', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useCollectionStore();
    await store.fetchDetail(42);
    expect(store.detail).not.toBeNull();
    store.error = 'stale';
    store.reset();
    expect(store.detail).toBeNull();
    expect(store.error).toBeNull();
  });
});
