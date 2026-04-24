import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

// task #37: mock the geolocation composable so NEARBY tests can drive
// success / null paths without touching navigator.geolocation.
const { geolocationMock } = vi.hoisted(() => ({
  geolocationMock: vi.fn<[], Promise<{ lat: number; lng: number } | null>>(),
}));
vi.mock('@/composables/useGeolocation', () => ({
  getCurrentCoords: geolocationMock,
}));

// Stub toastController so the NEARBY-denied path's toast doesn't touch
// real Ionic internals.
const { toastCreateSpy } = vi.hoisted(() => ({
  toastCreateSpy: vi
    .fn()
    .mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@ionic/vue', async () => {
  const actual = await vi.importActual<typeof import('@ionic/vue')>('@ionic/vue');
  return { ...actual, toastController: { create: toastCreateSpy } };
});

import api from '@/services/api';
import {
  useFeedStore,
  type FeedPost,
  type FeedUser,
} from '@/stores/feed';
import { signInForTest } from './__helpers__/auth';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

function makePost(id: number, sceneCompare = false): FeedPost {
  return {
    id,
    imageUrl: `https://cdn/p/${id}.jpg`,
    caption: `post-${id}`,
    createdAt: '2026-04-22T00:00:00Z',
    sceneCompare,
    dramaSceneImageUrl: sceneCompare ? `https://cdn/scene/${id}.jpg` : null,
    author: {
      userId: id,
      handle: `user${id}`,
      nickname: `닉${id}`,
      avatarUrl: `https://img/ava${id}.jpg`,
      verified: id === 1,
    },
    place: { id: id * 10, name: `장소${id}`, regionLabel: '강릉시' },
    work: { id: 1, title: '도깨비', workEpisode: '1회', sceneTimestamp: '00:24:10' },
    likeCount: 100 + id,
    commentCount: 3,
    liked: false,
    saved: false,
    visitedAt: null,
  };
}

function makeUser(id: number): FeedUser {
  return {
    userId: id,
    handle: `reco${id}`,
    nickname: `추천${id}`,
    avatarUrl: `https://img/r${id}.jpg`,
    verified: false,
    workTitle: '도깨비',
    stampCountForWork: id,
    following: false,
  };
}

const page1 = {
  posts: [makePost(1, true), makePost(2, false)],
  recommendedUsers: [makeUser(1), makeUser(2)],
  hasMore: true,
  nextCursor: 'cursor-2',
};

const page2 = {
  posts: [makePost(3), makePost(4)],
  hasMore: false,
  nextCursor: null,
};

describe('feed store', () => {
  beforeEach(() => {
    setActivePinia(createPinia()); signInForTest();
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    geolocationMock.mockReset();
    toastCreateSpy.mockClear();
  });

  it('default tab is RECENT and the first fetch forwards params.tab=RECENT (task #33)', async () => {
    const store = useFeedStore();
    // State default — no fetch yet, no setTab call.
    expect(store.tab).toBe('RECENT');

    mockApi.get.mockResolvedValueOnce({ data: page1 });
    await store.fetch();

    const [url, opts] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/feed');
    expect(opts?.params).toMatchObject({ tab: 'RECENT', limit: 5 });
  });

  it('fetch happy path populates posts/recommendedUsers/cursor and calls GET /api/feed', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page1 });

    const store = useFeedStore();
    await store.fetch();

    expect(store.posts).toEqual(page1.posts);
    expect(store.recommendedUsers).toEqual(page1.recommendedUsers);
    expect(store.hasMore).toBe(true);
    expect(store.cursor).toBe('cursor-2');
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();

    const [url, opts] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/feed');
    // Default tab flipped from POPULAR → RECENT in task #33.
    expect(opts?.params).toMatchObject({ tab: 'RECENT', limit: 5 });
  });

  it('fetch failure surfaces the error message and clears loading', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('boom'));
    const store = useFeedStore();
    await store.fetch();

    expect(store.error).toBe('boom');
    expect(store.loading).toBe(false);
  });

  it('setTab(different) resets cursor and refetches with the new tab; same tab is a no-op', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page1 });
    const store = useFeedStore();
    await store.fetch();
    mockApi.get.mockClear();

    // Same tab → no refetch (default is RECENT post task #33).
    await store.setTab('RECENT');
    expect(mockApi.get).not.toHaveBeenCalled();

    // New tab → refetches and resets cursor.
    mockApi.get.mockResolvedValueOnce({
      data: { posts: [makePost(5)], hasMore: false, nextCursor: null },
    });
    await store.setTab('FOLLOWING');
    expect(store.tab).toBe('FOLLOWING');
    expect(store.cursor).toBeNull();
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ tab: 'FOLLOWING' });
  });

  it('loadMore appends posts from the next cursor and updates hasMore', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page1 });
    const store = useFeedStore();
    await store.fetch();
    mockApi.get.mockClear();

    mockApi.get.mockResolvedValueOnce({ data: page2 });
    await store.loadMore();

    expect(store.posts.length).toBe(4);
    expect(store.posts.map((p) => p.id)).toEqual([1, 2, 3, 4]);
    expect(store.cursor).toBeNull();
    expect(store.hasMore).toBe(false);

    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ cursor: 'cursor-2', tab: 'RECENT' });
  });

  it('loadMore is a no-op when hasMore is false', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page2 }); // hasMore=false
    const store = useFeedStore();
    await store.fetch();
    mockApi.get.mockClear();

    await store.loadMore();
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('fetchRecommended hits /api/feed/recommended-users and replaces recommendedUsers', async () => {
    const recos = [makeUser(10), makeUser(11)];
    mockApi.get.mockResolvedValueOnce({ data: recos });

    const store = useFeedStore();
    await store.fetchRecommended(7);

    expect(store.recommendedUsers).toEqual(recos);
    const [url, opts] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/feed/recommended-users');
    expect(opts?.params).toMatchObject({ limit: 4, workId: 7 });
  });

  it('toggleLikePost posts to /api/photos/:id/like and updates liked/likeCount for the matching post', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page1 });
    const store = useFeedStore();
    await store.fetch();

    mockApi.post.mockResolvedValueOnce({ data: { liked: true, likeCount: 102 } });
    await store.toggleLikePost(1);

    const [url] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/photos/1/like');
    const first = store.posts.find((p) => p.id === 1);
    expect(first?.liked).toBe(true);
    expect(first?.likeCount).toBe(102);
    const second = store.posts.find((p) => p.id === 2);
    expect(second?.liked).toBe(false);
  });

  it('toggleFollow posts to /api/users/:id/follow and updates following for the matching recommended user', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page1 });
    const store = useFeedStore();
    await store.fetch();

    mockApi.post.mockResolvedValueOnce({
      data: { following: true, followersCount: 42, followingCount: 7 },
    });
    await store.toggleFollow(1);

    const [url] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/users/1/follow');
    const u1 = store.recommendedUsers.find((u) => u.userId === 1);
    expect(u1?.following).toBe(true);
    const u2 = store.recommendedUsers.find((u) => u.userId === 2);
    expect(u2?.following).toBe(false);
  });

  // ---------- task #37: NEARBY tab geolocation wiring ----------

  it('setTab(NEARBY) requests coords, caches them, and forwards lat/lng to GET /api/feed', async () => {
    geolocationMock.mockResolvedValueOnce({ lat: 37.5665, lng: 126.978 });
    mockApi.get.mockResolvedValueOnce({
      data: { posts: [], hasMore: false, nextCursor: null },
    });

    const store = useFeedStore();
    await store.setTab('NEARBY');

    expect(geolocationMock).toHaveBeenCalledTimes(1);
    expect(store.nearbyCoords).toEqual({ lat: 37.5665, lng: 126.978 });
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({
      tab: 'NEARBY',
      lat: 37.5665,
      lng: 126.978,
    });
  });

  it('setTab(NEARBY) with denied permission shows an error toast and still fetches (no lat/lng)', async () => {
    geolocationMock.mockResolvedValueOnce(null);
    mockApi.get.mockResolvedValueOnce({
      data: { posts: [], hasMore: false, nextCursor: null },
    });

    const store = useFeedStore();
    await store.setTab('NEARBY');

    expect(geolocationMock).toHaveBeenCalledTimes(1);
    expect(store.nearbyCoords).toBeNull();
    // Toast fires with Korean denial copy.
    const hasDeniedToast = toastCreateSpy.mock.calls.some((c) =>
      ((c[0] as { message?: string })?.message ?? '').includes('위치 정보'),
    );
    expect(hasDeniedToast).toBe(true);
    // Backend still called — with tab=NEARBY but no lat/lng. Server returns
    // an empty array per the task #37 brief.
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ tab: 'NEARBY' });
    expect(opts?.params?.lat).toBeUndefined();
    expect(opts?.params?.lng).toBeUndefined();
  });

  it('NEARBY loadMore reuses cached coords without re-prompting geolocation', async () => {
    // First entry caches coords.
    geolocationMock.mockResolvedValueOnce({ lat: 10, lng: 20 });
    mockApi.get.mockResolvedValueOnce({
      data: {
        posts: [makePost(1)],
        hasMore: true,
        nextCursor: 'cur-1',
      },
    });
    const store = useFeedStore();
    await store.setTab('NEARBY');
    expect(geolocationMock).toHaveBeenCalledTimes(1);

    // loadMore: geolocation NOT called again.
    mockApi.get.mockResolvedValueOnce({
      data: { posts: [makePost(2)], hasMore: false, nextCursor: null },
    });
    await store.loadMore();
    expect(geolocationMock).toHaveBeenCalledTimes(1);
    const [, opts] = mockApi.get.mock.calls[1];
    expect(opts?.params).toMatchObject({
      tab: 'NEARBY',
      lat: 10,
      lng: 20,
      cursor: 'cur-1',
    });
  });

  it('setTab(NEARBY) does not re-request coords on re-entry while cached', async () => {
    geolocationMock.mockResolvedValueOnce({ lat: 10, lng: 20 });
    mockApi.get.mockResolvedValue({
      data: { posts: [], hasMore: false, nextCursor: null },
    });
    const store = useFeedStore();
    await store.setTab('NEARBY');

    // Switch to another tab then back to NEARBY — no second geolocation call.
    await store.setTab('RECENT');
    await store.setTab('NEARBY');
    expect(geolocationMock).toHaveBeenCalledTimes(1);
  });

  it('explicit fetch({lat,lng}) overrides the NEARBY cache', async () => {
    // Cache a pair.
    geolocationMock.mockResolvedValueOnce({ lat: 10, lng: 20 });
    mockApi.get.mockResolvedValueOnce({
      data: { posts: [], hasMore: false, nextCursor: null },
    });
    const store = useFeedStore();
    await store.setTab('NEARBY');

    // Explicit override.
    mockApi.get.mockResolvedValueOnce({
      data: { posts: [], hasMore: false, nextCursor: null },
    });
    await store.fetch({ lat: 99, lng: -99 });
    const [, opts] = mockApi.get.mock.calls[1];
    expect(opts?.params).toMatchObject({ lat: 99, lng: -99 });
  });

  it('refreshNearbyCoords clears cache and re-requests (user retry after denial)', async () => {
    geolocationMock.mockResolvedValueOnce(null); // initial denial
    mockApi.get.mockResolvedValueOnce({
      data: { posts: [], hasMore: false, nextCursor: null },
    });
    const store = useFeedStore();
    await store.setTab('NEARBY');
    expect(store.nearbyCoords).toBeNull();

    // User taps retry → coords granted this time.
    geolocationMock.mockResolvedValueOnce({ lat: 37.5, lng: 127 });
    await store.refreshNearbyCoords();
    expect(store.nearbyCoords).toEqual({ lat: 37.5, lng: 127 });
  });

  it('toggleFollow failure surfaces the error message without mutating following', async () => {
    const freshPage = {
      ...page1,
      recommendedUsers: [makeUser(1), makeUser(2)],
    };
    mockApi.get.mockResolvedValueOnce({ data: freshPage });
    const store = useFeedStore();
    await store.fetch();

    mockApi.post.mockRejectedValueOnce(new Error('자기 자신은 팔로우할 수 없어요'));
    await store.toggleFollow(1);

    expect(store.error).toBe('자기 자신은 팔로우할 수 없어요');
    const u1 = store.recommendedUsers.find((u) => u.userId === 1);
    expect(u1?.following).toBe(false);
  });
});
