import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn() },
}));

import api from '@/services/api';
import { useSearchStore, type SearchResponse } from '@/stores/search';

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const fixture: SearchResponse = {
  works: [
    { id: 1, title: '도깨비', posterUrl: 'https://img/g.jpg', placeCount: 12 },
    { id: 2, title: '이태원 클라쓰', posterUrl: null, placeCount: 6 },
  ],
  places: [
    {
      id: 10,
      name: '주문진 영진해변 방파제',
      regionLabel: '강릉시 주문진읍',
      coverImageUrls: ['https://img/10.jpg'],
      workId: 1,
      workTitle: '도깨비',
    },
  ],
};

describe('search store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockApi.get.mockReset();
  });

  it('initial state has empty query / empty lists / not loading', () => {
    const store = useSearchStore();
    expect(store.query).toBe('');
    expect(store.works).toEqual([]);
    expect(store.places).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.hasResults).toBe(false);
  });

  it('search(q) forwards q to GET /api/search and populates works + places', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useSearchStore();

    await store.search('도깨비');

    const [url, opts] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/search');
    expect(opts?.params).toEqual({ q: '도깨비', limit: 20 });
    expect(store.works).toEqual(fixture.works);
    expect(store.places).toEqual(fixture.places);
    expect(store.hasResults).toBe(true);
    expect(store.loading).toBe(false);
  });

  it('search("") clears results without hitting the server', async () => {
    // Seed some prior results so we can verify they get wiped.
    const store = useSearchStore();
    store.works = [...fixture.works];
    store.places = [...fixture.places];

    await store.search('');
    await store.search('   '); // whitespace also counts as empty

    expect(mockApi.get).not.toHaveBeenCalled();
    expect(store.works).toEqual([]);
    expect(store.places).toEqual([]);
    expect(store.query).toBe('   ');
  });

  it('search failure surfaces the error message and clears previous hits', async () => {
    const store = useSearchStore();
    store.works = [...fixture.works];
    store.places = [...fixture.places];

    mockApi.get.mockRejectedValueOnce(new Error('net down'));
    await store.search('x');

    expect(store.error).toBe('net down');
    expect(store.works).toEqual([]);
    expect(store.places).toEqual([]);
    expect(store.loading).toBe(false);
  });

  it('missing works/places arrays in the response default to empty without blowing up', async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });
    const store = useSearchStore();

    await store.search('anything');
    expect(store.works).toEqual([]);
    expect(store.places).toEqual([]);
    expect(store.error).toBeNull();
  });
});
