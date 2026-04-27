import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn() },
}));

import api from '@/services/api';
import { useTourNearbyStore, type TourNearbyRestaurant } from '@/stores/tourNearby';

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const sample: TourNearbyRestaurant = {
  contentId: 'tour-001',
  title: '주문진 활어회센터',
  addr1: '강원 강릉시 주문진읍',
  imageUrl: null,
  latitude: 37.89,
  longitude: 128.83,
  distanceM: 240,
  categoryName: '한식',
};

describe('tourNearby store (task #29)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockApi.get.mockReset();
  });

  it('fetch happy path → caches array under placeId, GET /api/places/:id/nearby-restaurants', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { items: [sample] } });
    const store = useTourNearbyStore();
    await store.fetch(10);

    const [url] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/places/10/nearby-restaurants');
    expect(store.itemsFor(10)).toEqual([sample]);
  });

  it('fetch failure → caches null (treat as "tried, no data") + console.warn, no throw', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockApi.get.mockRejectedValueOnce(new Error('boom'));
    const store = useTourNearbyStore();
    await store.fetch(10);

    expect(store.itemsByPlace[10]).toBeNull();
    expect(store.itemsFor(10)).toEqual([]); // null fallback to []
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('shape mismatch (non-array items) → null cached', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { items: 'not-an-array' } });
    const store = useTourNearbyStore();
    await store.fetch(10);
    expect(store.itemsByPlace[10]).toBeNull();
  });

  it('fetch dedupes — second call for same placeId is a silent no-op (kakaoInfo parity)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { items: [sample] } });
    const store = useTourNearbyStore();
    await store.fetch(10);
    await store.fetch(10);
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it('null cache (prior failure) is also treated as "already tried" — no second request', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('first-fail'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = useTourNearbyStore();
    await store.fetch(10);
    mockApi.get.mockReset();
    await store.fetch(10);
    expect(mockApi.get).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
