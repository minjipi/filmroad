import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn() },
}));

import api from '@/services/api';
import {
  useWorkDetailStore,
  type WorkDetailResponse,
} from '@/stores/workDetail';

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const fixture: WorkDetailResponse = {
  work: {
    id: 1,
    title: '도깨비',
    subtitle: '쓸쓸하고 찬란하神',
    yearStart: 2016,
    kind: '드라마',
    posterUrl: 'https://img/w1.jpg',
    coverUrl: 'https://img/w1.jpg',
    ratingAverage: 9.2,
    episodeCount: 16,
    network: 'tvN',
    synopsis: '도깨비 김신의 이야기',
  },
  progress: {
    collectedCount: 12,
    totalCount: 20,
    percent: 60,
    nextBadgeText: '4곳 더 모으면 완주 뱃지!',
  },
  spots: [
    {
      placeId: 10,
      name: '주문진 영진해변 방파제',
      regionShort: '주문진',
      coverImageUrls: ['https://img/s10.jpg'],
      workEpisode: '1회',
      sceneTimestamp: '00:24:10',
      sceneDescription: '도깨비 등장 장면',
      visited: true,
      visitedAt: '2026-04-20T10:00:00Z',
      orderIndex: 1,
    },
    {
      placeId: 11,
      name: '덕수궁 돌담길',
      regionShort: '정동',
      coverImageUrls: ['https://img/s11.jpg'],
      workEpisode: '5회',
      sceneTimestamp: null,
      sceneDescription: '눈 오는 장면',
      visited: false,
      visitedAt: null,
      orderIndex: 2,
    },
  ],
};

describe('workDetail store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockApi.get.mockReset();
  });

  it('fetch happy path populates work/progress/spots and calls GET /api/works/:id', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useWorkDetailStore();
    await store.fetch(1);

    expect(store.work).toEqual(fixture.work);
    expect(store.progress).toEqual(fixture.progress);
    expect(store.spots).toEqual(fixture.spots);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();

    const [url] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/works/1');
  });

  it('fetch failure surfaces the error message and clears loading', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('boom'));
    const store = useWorkDetailStore();
    await store.fetch(1);

    expect(store.error).toBe('boom');
    expect(store.loading).toBe(false);
  });

  it('setChip updates activeChip without touching the network', () => {
    const store = useWorkDetailStore();
    expect(store.activeChip).toBe('SPOTS');

    store.setChip('INFO');
    expect(store.activeChip).toBe('INFO');

    store.setChip('CAST');
    expect(store.activeChip).toBe('CAST');

    store.setChip('FANS');
    expect(store.activeChip).toBe('FANS');

    expect(mockApi.get).not.toHaveBeenCalled();
  });
});
