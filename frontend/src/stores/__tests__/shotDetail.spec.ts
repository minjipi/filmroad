import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '@/services/api';
import { useShotDetailStore, type ShotDetail } from '@/stores/shotDetail';
import { signInForTest } from './__helpers__/auth';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const fixture: ShotDetail = {
  id: 77,
  imageUrl: 'https://cdn/p/77.jpg',
  sceneImageUrl: 'https://cdn/scene/77.jpg',
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
    address: '강원 강릉시 주문진읍 교항리 산51-2',
    latitude: 37.89,
    longitude: 128.83,
  },
  work: {
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
  });
});
