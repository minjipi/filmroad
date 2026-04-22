import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn() },
}));

import api from '@/services/api';
import { useProfileStore, type ProfileResponse } from '@/stores/profile';

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
});
