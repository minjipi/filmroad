import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn() },
}));

import api from '@/services/api';
import {
  useStampbookStore,
  type StampbookResponse,
} from '@/stores/stampbook';

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const fixture: StampbookResponse = {
  hero: {
    contentsCollectingCount: 3,
    placesCollectedCount: 42,
    badgesCount: 8,
    completedContentsCount: 1,
  },
  contents: [
    {
      contentId: 1,
      title: '도깨비',
      posterUrl: 'https://img/w1.jpg',
      year: 2016,
      collectedCount: 12,
      totalCount: 20,
      percent: 60,
      completed: false,
      gradient: 'linear-gradient(135deg,#14BCED,#7c3aed)',
    },
    {
      contentId: 2,
      title: '이태원 클라쓰',
      posterUrl: 'https://img/w2.jpg',
      year: 2020,
      collectedCount: 8,
      totalCount: 8,
      percent: 100,
      completed: true,
      gradient: 'linear-gradient(135deg,#f5a524,#ef4444)',
    },
    {
      contentId: 3,
      title: '더 글로리',
      posterUrl: 'https://img/w3.jpg',
      year: 2022,
      collectedCount: 3,
      totalCount: 15,
      percent: 20,
      completed: false,
      gradient: 'linear-gradient(135deg,#10b981,#06b6d4)',
    },
  ],
  recentBadges: [
    {
      badgeId: 10,
      code: 'first-light',
      name: '첫 일출',
      description: '일출 장면 인증',
      iconKey: 'sunrise',
      gradient: null,
      acquired: true,
      progressText: null,
      acquiredAt: '2026-04-20T06:05:00Z',
    },
    {
      badgeId: 11,
      code: 'globe',
      name: '세계 일주',
      description: null,
      iconKey: 'globe',
      gradient: null,
      acquired: false,
      progressText: '3 / 10 국가',
      acquiredAt: null,
    },
  ],
};

describe('stampbook store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockApi.get.mockReset();
  });

  it('fetch happy path populates hero/contents/recentBadges and calls GET /api/stampbook', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });

    const store = useStampbookStore();
    await store.fetch();

    expect(store.hero).toEqual(fixture.hero);
    expect(store.contents).toEqual(fixture.contents);
    expect(store.recentBadges).toEqual(fixture.recentBadges);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();

    const [url] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/stampbook');
  });

  it('fetch failure surfaces the error message and clears loading', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('boom'));

    const store = useStampbookStore();
    await store.fetch();

    expect(store.error).toBe('boom');
    expect(store.loading).toBe(false);
  });

  it('setFilter updates the current filter value', () => {
    const store = useStampbookStore();
    expect(store.filter).toBe('WORKS');

    store.setFilter('BADGES');
    expect(store.filter).toBe('BADGES');

    store.setFilter('IN_PROGRESS');
    expect(store.filter).toBe('IN_PROGRESS');
  });

  it('visibleContents getter filters contents by COMPLETED / IN_PROGRESS', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useStampbookStore();
    await store.fetch();

    // Default WORKS shows everything.
    expect(store.visibleContents.map((w) => w.contentId)).toEqual([1, 2, 3]);

    store.setFilter('COMPLETED');
    expect(store.visibleContents.map((w) => w.contentId)).toEqual([2]);

    store.setFilter('IN_PROGRESS');
    expect(store.visibleContents.map((w) => w.contentId)).toEqual([1, 3]);

    // BADGES does not filter contents — it's a section toggle at the view layer.
    store.setFilter('BADGES');
    expect(store.visibleContents.map((w) => w.contentId)).toEqual([1, 2, 3]);
  });
});
