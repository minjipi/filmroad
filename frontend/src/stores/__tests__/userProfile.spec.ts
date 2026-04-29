import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '@/services/api';
import { useUserProfileStore, type UserProfile } from '@/stores/userProfile';
import { signInForTest } from './__helpers__/auth';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const fixture: UserProfile = {
  id: 42,
  nickname: '김소연',
  handle: 'soyeon_film',
  avatarUrl: 'https://img/soyeon.jpg',
  bio: '드라마 성지 순례 4년차.',
  verified: true,
  level: 12,
  levelName: '성지지기',
  points: 1800,
  streakDays: 14,
  stats: {
    visitedCount: 214,
    photoCount: 214,
    followersCount: 1200,
    followingCount: 186,
    collectedWorksCount: 47,
  },
  isMe: false,
  following: false,
  topPhotos: [
    { id: 1, imageUrl: 'https://cdn/p/1.jpg', contentTitle: '도깨비', placeName: '주문진' },
    { id: 2, imageUrl: 'https://cdn/p/2.jpg', contentTitle: '갯마을차차차', placeName: '청하' },
  ],
  recentCollectedWorks: [
    { id: 1, title: '도깨비', posterUrl: 'https://img/w1.jpg', collectedCount: 24, totalCount: 24 },
    { id: 2, title: '갯마을차차차', posterUrl: 'https://img/w2.jpg', collectedCount: 18, totalCount: 26 },
  ],
};

describe('userProfile store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    signInForTest();
    mockApi.get.mockReset();
    mockApi.post.mockReset();
  });

  it('initial state: user=null, not loading, no error', () => {
    const store = useUserProfileStore();
    expect(store.user).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.followPending).toBe(false);
  });

  it('fetchUser happy path populates user and calls GET /api/users/:id', async () => {
    mockApi.get.mockResolvedValueOnce({ data: structuredClone(fixture) });
    const store = useUserProfileStore();
    await store.fetchUser(42);

    expect(store.user).toEqual(fixture);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    const [url] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/users/42');
  });

  it('fetchUser failure (404 / network) surfaces the error message and clears loading', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Not Found'));
    const store = useUserProfileStore();
    await store.fetchUser(999);

    expect(store.user).toBeNull();
    expect(store.error).toBe('Not Found');
    expect(store.loading).toBe(false);
  });

  it('toggleFollow POSTs /api/users/:id/follow and reconciles with server response', async () => {
    mockApi.get.mockResolvedValueOnce({ data: structuredClone(fixture) });
    const store = useUserProfileStore();
    await store.fetchUser(42);

    mockApi.post.mockResolvedValueOnce({
      data: { following: true, followersCount: 1201, followingCount: 186 },
    });
    await store.toggleFollow();

    const [url] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/users/42/follow');
    expect(store.user?.following).toBe(true);
    expect(store.user?.stats.followersCount).toBe(1201);
  });

  it('toggleFollow flips optimistically before the POST resolves (task #42)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: structuredClone(fixture) });
    const store = useUserProfileStore();
    await store.fetchUser(42);
    expect(store.user?.following).toBe(false);

    let resolvePost: (v: {
      data: { following: boolean; followersCount: number; followingCount: number };
    }) => void = () => undefined;
    mockApi.post.mockImplementationOnce(
      () => new Promise((r) => { resolvePost = r; }),
    );

    const p = store.toggleFollow();
    await Promise.resolve();
    expect(store.user?.following).toBe(true);
    expect(store.user?.stats.followersCount).toBe(1201);
    expect(store.followPending).toBe(true);

    resolvePost({ data: { following: true, followersCount: 1201, followingCount: 186 } });
    await p;
    expect(store.followPending).toBe(false);
  });

  it('toggleFollow rollbacks optimistic flip when the POST fails', async () => {
    mockApi.get.mockResolvedValueOnce({ data: structuredClone(fixture) });
    const store = useUserProfileStore();
    await store.fetchUser(42);

    mockApi.post.mockRejectedValueOnce(new Error('server down'));
    await store.toggleFollow();

    expect(store.user?.following).toBe(false);
    expect(store.user?.stats.followersCount).toBe(1200);
    expect(store.error).toBe('server down');
    expect(store.followPending).toBe(false);
  });

  it('toggleFollow is a no-op on your own profile (isMe=true)', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: { ...structuredClone(fixture), isMe: true },
    });
    const store = useUserProfileStore();
    await store.fetchUser(1);
    await store.toggleFollow();
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('reset clears user/error/loading/followPending so the next page entry starts fresh', async () => {
    mockApi.get.mockResolvedValueOnce({ data: structuredClone(fixture) });
    const store = useUserProfileStore();
    await store.fetchUser(42);
    expect(store.user).not.toBeNull();

    store.error = 'stale';
    store.followPending = true;
    store.reset();
    expect(store.user).toBeNull();
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.followPending).toBe(false);
  });
});
