import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '@/services/api';
import { useShotDetailStore, type ShotDetail } from '@/stores/shotDetail';
import type { FeedPost } from '@/stores/feed';
import { signInForTest } from './__helpers__/auth';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const fixture: ShotDetail = {
  id: 77,
  imageUrl: 'https://cdn/p/77.jpg',
  scenes: [
    {
      id: 200,
      imageUrl: 'https://cdn/scene/77.jpg',
      contentEpisode: '1회',
      sceneTimestamp: '00:15:24',
      sceneDescription: null,
      orderIndex: 0,
    },
  ],
  caption: '첫 방문',
  tags: ['도깨비', '주문진'],
  createdAt: '2026-04-20T10:00:00Z',
  visibility: 'PUBLIC',
  likeCount: 1248,
  commentCount: 89,
  liked: true,
  saved: false,
  author: {
    id: 1,
    nickname: '김소연',
    handle: 'soyeon_film',
    avatarUrl: 'https://img/ava1.jpg',
    verified: true,
    isMe: true,
    following: false,
  },
  place: {
    id: 10,
    name: '주문진 영진해변 방파제',
    regionLabel: '강원 강릉시 주문진읍',
    latitude: 37.89,
    longitude: 128.83,
  },
  content: {
    id: 1,
    title: '도깨비',
    network: 'tvN',
    episode: '1회',
    sceneTimestamp: '00:15:24',
  },
  images: [{ id: 77, imageUrl: 'https://cdn/p/77.jpg', imageOrderIndex: 0 }],
  topComments: [
    {
      id: 1,
      content: '와 이 구도 대박…',
      authorHandle: 'trip_hj',
      authorAvatarUrl: 'https://img/ava2.jpg',
      createdAt: '2026-04-20T11:00:00Z',
      likeCount: 24,
      liked: true,
      isReply: false,
    },
  ],
  moreCommentsCount: 85,
};

describe('shotDetail store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    signInForTest();
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.patch.mockReset();
    mockApi.delete.mockReset();
  });

  it('initial state: shot=null, not loading, no error', () => {
    const store = useShotDetailStore();
    expect(store.shot).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('fetchShot happy path populates shot and hits GET /api/photos/:id', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useShotDetailStore();
    await store.fetchShot(77);

    expect(store.shot).toEqual(fixture);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();

    const [url] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/photos/77');
  });

  it('fetchShot failure (e.g. 404) surfaces the error message and clears loading', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Not Found'));
    const store = useShotDetailStore();
    await store.fetchShot(999);

    expect(store.shot).toBeNull();
    expect(store.error).toBe('Not Found');
    expect(store.loading).toBe(false);
  });

  it('toggleLike POSTs /api/photos/:id/like and updates shot.liked + likeCount', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: { ...fixture, liked: false, likeCount: 1247 },
    });
    const store = useShotDetailStore();
    await store.fetchShot(77);

    mockApi.post.mockResolvedValueOnce({ data: { liked: true, likeCount: 1248 } });
    await store.toggleLike();

    const [url] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/photos/77/like');
    expect(store.shot?.liked).toBe(true);
    expect(store.shot?.likeCount).toBe(1248);
  });

  it('toggleLike is a no-op when shot is null (defensive)', async () => {
    const store = useShotDetailStore();
    await store.toggleLike();
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('reset clears shot/error/loading so the next page entry starts fresh', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useShotDetailStore();
    await store.fetchShot(77);
    expect(store.shot).not.toBeNull();

    store.error = 'stale';
    store.reset();
    expect(store.shot).toBeNull();
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
    // task #15: infinite-scroll state also wiped on reset.
    expect(store.appendedShots).toEqual([]);
    expect(store.nextLoading).toBe(false);
    expect(store.nextEndReached).toBe(false);
    expect(store.nextError).toBeNull();
    expect(store.nextCursor).toBeNull();
  });

  // task #15 — infinite-scroll loadNext action. Backend reuses the existing
  // /api/feed?tab=RECENT&cursor=<id>&limit=N endpoint with auto-dedupe of
  // the seed shot. Response shape matches the main feed: { posts, hasMore,
  // nextCursor }.
  describe('loadNext (infinite scroll, task #15)', () => {
    const post1: FeedPost = {
      id: 76,
      imageUrl: 'https://cdn/p/76.jpg',
      caption: 'next post 1',
      createdAt: '2026-04-19T10:00:00Z',
      sceneCompare: true,
      dramaSceneImageUrl: 'https://cdn/scene/76.jpg',
      author: {
        userId: 2,
        handle: 'trip_hj',
        nickname: 'trip_hj',
        avatarUrl: null,
        verified: false,
        following: false,
      },
      place: { id: 11, name: '강릉 안목해변', regionLabel: '강원 강릉시' },
      content: { id: 1, title: '도깨비', contentEpisode: '2회', sceneTimestamp: '00:25:01' },
      likeCount: 100,
      commentCount: 12,
      liked: false,
      saved: false,
      visitedAt: null,
    };
    const post2: FeedPost = { ...post1, id: 75, imageUrl: 'https://cdn/p/75.jpg' };

    it('GET /api/feed?tab=RECENT&cursor=<seedId>&limit=10 with the primary shot id as initial cursor', async () => {
      mockApi.get.mockResolvedValueOnce({ data: fixture });
      const store = useShotDetailStore();
      await store.fetchShot(77);

      mockApi.get.mockResolvedValueOnce({
        data: { posts: [post1, post2], hasMore: true, nextCursor: '74' },
      });
      await store.loadNext();

      const calls = mockApi.get.mock.calls;
      const [url, opts] = calls[calls.length - 1];
      expect(url).toBe('/api/feed');
      expect(opts).toEqual({ params: { tab: 'RECENT', cursor: 77, limit: 10 } });

      expect(store.appendedShots).toEqual([post1, post2]);
      expect(store.nextCursor).toBe('74');
      expect(store.nextEndReached).toBe(false);
      expect(store.nextLoading).toBe(false);
      expect(store.nextError).toBeNull();
    });

    it('uses nextCursor on subsequent loads (cursor pagination)', async () => {
      mockApi.get.mockResolvedValueOnce({ data: fixture });
      const store = useShotDetailStore();
      await store.fetchShot(77);

      mockApi.get.mockResolvedValueOnce({
        data: { posts: [post1], hasMore: true, nextCursor: '75' },
      });
      await store.loadNext();
      mockApi.get.mockResolvedValueOnce({
        data: { posts: [post2], hasMore: false, nextCursor: null },
      });
      await store.loadNext();

      const calls = mockApi.get.mock.calls;
      // 2nd loadNext should use nextCursor='75', not the original shot id.
      const [, opts] = calls[calls.length - 1];
      expect(opts).toEqual({ params: { tab: 'RECENT', cursor: '75', limit: 10 } });
      expect(store.appendedShots).toEqual([post1, post2]);
      // hasMore=false → end-of-feed.
      expect(store.nextEndReached).toBe(true);
    });

    it('empty posts[] with hasMore=false sets nextEndReached=true without appending', async () => {
      mockApi.get.mockResolvedValueOnce({ data: fixture });
      const store = useShotDetailStore();
      await store.fetchShot(77);

      mockApi.get.mockResolvedValueOnce({
        data: { posts: [], hasMore: false, nextCursor: null },
      });
      await store.loadNext();

      expect(store.appendedShots).toEqual([]);
      expect(store.nextEndReached).toBe(true);
    });

    it('endpoint failure sets nextEndReached + nextError, never throws', async () => {
      mockApi.get.mockResolvedValueOnce({ data: fixture });
      const store = useShotDetailStore();
      await store.fetchShot(77);

      mockApi.get.mockRejectedValueOnce(new Error('Network error'));
      await store.loadNext();

      expect(store.appendedShots).toEqual([]);
      expect(store.nextEndReached).toBe(true);
      expect(store.nextError).toBe('Network error');
    });

    it('no-ops when nextLoading is in-flight or nextEndReached is true (guards)', async () => {
      const store = useShotDetailStore();
      // No primary shot loaded → no seed → no fetch.
      await store.loadNext();
      expect(mockApi.get).not.toHaveBeenCalled();

      // After end reached, additional calls are silent.
      mockApi.get.mockResolvedValueOnce({ data: fixture });
      await store.fetchShot(77);
      mockApi.get.mockReset();
      store.nextEndReached = true;
      await store.loadNext();
      expect(mockApi.get).not.toHaveBeenCalled();
    });
  });

  // task #18 — appended-card interaction store actions.
  describe('toggleAppendedLike / toggleAppendedFollow (task #18)', () => {
    const post: FeedPost = {
      id: 76,
      imageUrl: 'https://cdn/p/76.jpg',
      caption: '',
      createdAt: '2026-04-19T10:00:00Z',
      sceneCompare: false,
      dramaSceneImageUrl: null,
      author: {
        userId: 9,
        handle: 'trip_hj',
        nickname: 'trip_hj',
        avatarUrl: null,
        verified: false,
        following: false,
      },
      place: { id: 11, name: '강릉 안목해변', regionLabel: '강원 강릉시' },
      content: { id: 1, title: '도깨비', contentEpisode: null, sceneTimestamp: null },
      likeCount: 100,
      commentCount: 0,
      liked: false,
      saved: false,
      visitedAt: null,
    };

    it('toggleAppendedLike posts /api/photos/:id/like and applies optimistic flip', async () => {
      const store = useShotDetailStore();
      store.appendedShots.push({ ...post });

      mockApi.post.mockResolvedValueOnce({ data: { liked: true, likeCount: 101 } });
      await store.toggleAppendedLike(76);

      const [url] = mockApi.post.mock.calls[0];
      expect(url).toBe('/api/photos/76/like');
      expect(store.appendedShots[0].liked).toBe(true);
      expect(store.appendedShots[0].likeCount).toBe(101);
    });

    it('toggleAppendedLike rolls back liked + likeCount on failure', async () => {
      const store = useShotDetailStore();
      store.appendedShots.push({ ...post });
      const before = { ...store.appendedShots[0] };

      mockApi.post.mockRejectedValueOnce(new Error('boom'));
      await store.toggleAppendedLike(76);

      // 롤백 — 모든 값이 원래 상태.
      expect(store.appendedShots[0].liked).toBe(before.liked);
      expect(store.appendedShots[0].likeCount).toBe(before.likeCount);
      expect(store.error).toBe('boom');
    });

    it('toggleAppendedLike no-ops for an unknown postId', async () => {
      const store = useShotDetailStore();
      store.appendedShots.push({ ...post });
      await store.toggleAppendedLike(999);
      expect(mockApi.post).not.toHaveBeenCalled();
      // 기존 카드는 무변.
      expect(store.appendedShots[0].liked).toBe(false);
    });

    it('toggleAppendedFollow posts /api/users/:userId/follow + flips ALL cards from same author', async () => {
      const store = useShotDetailStore();
      // 같은 작성자의 카드 두 장 (각 카드는 author 사본 — Pinia 의 deep proxy
      // 가 공유 객체를 어떻게 다루는지에 의존하지 않도록 분리).
      store.appendedShots.push({ ...post, id: 76, author: { ...post.author } });
      store.appendedShots.push({ ...post, id: 75, author: { ...post.author } });

      mockApi.post.mockResolvedValueOnce({
        data: { following: true, followersCount: 1, followingCount: 1 },
      });
      await store.toggleAppendedFollow(9);

      const [url] = mockApi.post.mock.calls[0];
      expect(url).toBe('/api/users/9/follow');
      expect(store.appendedShots[0].author.following).toBe(true);
      expect(store.appendedShots[1].author.following).toBe(true);
    });

    it('toggleAppendedFollow rolls back ALL matching cards on failure', async () => {
      const store = useShotDetailStore();
      // Independent author objects per card so the test isolates the rollback
      // logic rather than accidentally testing shared-reference quirks.
      store.appendedShots.push({ ...post, id: 76, author: { ...post.author } });
      store.appendedShots.push({ ...post, id: 75, author: { ...post.author } });

      mockApi.post.mockRejectedValueOnce(new Error('boom'));
      await store.toggleAppendedFollow(9);

      expect(store.appendedShots[0].author.following).toBe(false);
      expect(store.appendedShots[1].author.following).toBe(false);
      expect(store.error).toBe('boom');
    });
  });

  describe('updateContent / deleteShot (작성자 수정·삭제)', () => {
    it('updateContent PATCH 성공 시 새 응답으로 store.shot 덮어쓰고 true 반환', async () => {
      const store = useShotDetailStore();
      store.shot = { ...fixture };

      const updated: ShotDetail = {
        ...fixture,
        caption: 'after edit',
        visibility: 'PRIVATE',
      };
      mockApi.patch.mockResolvedValueOnce({ data: updated });

      const ok = await store.updateContent({
        caption: 'after edit',
        visibility: 'PRIVATE',
      });

      expect(ok).toBe(true);
      const [url, body] = mockApi.patch.mock.calls[0];
      expect(url).toBe(`/api/photos/${fixture.id}`);
      expect(body).toMatchObject({
        caption: 'after edit',
        visibility: 'PRIVATE',
      });
      expect(store.shot?.caption).toBe('after edit');
      expect(store.shot?.visibility).toBe('PRIVATE');
    });

    it('updateContent PATCH 실패 시 error 메시지 세팅 + false 반환, shot 유지', async () => {
      const store = useShotDetailStore();
      store.shot = { ...fixture };

      mockApi.patch.mockRejectedValueOnce(new Error('네트워크 끊김'));

      const ok = await store.updateContent({
        caption: 'x',
        visibility: 'PUBLIC',
      });

      expect(ok).toBe(false);
      expect(store.error).toBe('네트워크 끊김');
      expect(store.shot?.caption).toBe(fixture.caption); // 변경 없음
    });

    it('updateContent shot 미로드 상태에선 PATCH 호출 자체 안 함 + false', async () => {
      const store = useShotDetailStore();
      const ok = await store.updateContent({
        caption: 'x',
        visibility: 'PUBLIC',
      });
      expect(ok).toBe(false);
      expect(mockApi.patch).not.toHaveBeenCalled();
    });

    it('deleteShot DELETE 성공 시 store.shot=null + true 반환', async () => {
      const store = useShotDetailStore();
      store.shot = { ...fixture };

      mockApi.delete.mockResolvedValueOnce({ data: null });

      const ok = await store.deleteShot();

      expect(ok).toBe(true);
      const [url] = mockApi.delete.mock.calls[0];
      expect(url).toBe(`/api/photos/${fixture.id}`);
      expect(store.shot).toBeNull();
    });

    it('deleteShot DELETE 실패 시 error 세팅 + false, shot 유지', async () => {
      const store = useShotDetailStore();
      store.shot = { ...fixture };

      mockApi.delete.mockRejectedValueOnce(new Error('삭제 실패'));

      const ok = await store.deleteShot();

      expect(ok).toBe(false);
      expect(store.error).toBe('삭제 실패');
      expect(store.shot).not.toBeNull();
    });
  });
});
