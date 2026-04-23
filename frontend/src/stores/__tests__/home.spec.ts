import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock the services/api module at the boundary before importing the store.
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '@/services/api';
import { useHomeStore, type HomeResponse } from '@/stores/home';
import { signInForTest } from './__helpers__/auth';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const fixture: HomeResponse = {
  hero: {
    monthLabel: 'APR',
    tag: '주말 추천',
    title: "오늘은 '도깨비'의\n주문진을 걸어볼까요?",
    subtitle: '내 위치에서 차로 12분 · 2곳의 성지',
    workId: 1,
    primaryPlaceId: 10,
  },
  works: [
    { id: 1, title: '도깨비' },
    { id: 2, title: '이태원 클라쓰' },
  ],
  places: [
    {
      id: 10,
      name: '주문진 영진해변 방파제',
      regionLabel: '강릉시 주문진읍',
      coverImageUrl: 'https://img/1.jpg',
      workId: 1,
      workTitle: '도깨비',
      liked: false,
      likeCount: 3200,
    },
    {
      id: 11,
      name: '단밤 포차',
      regionLabel: '서울 용산구 이태원동',
      coverImageUrl: 'https://img/2.jpg',
      workId: 2,
      workTitle: '이태원 클라쓰',
      liked: false,
      likeCount: 640,
    },
  ],
};

describe('home store', () => {
  beforeEach(() => {
    setActivePinia(createPinia()); signInForTest();
    mockApi.get.mockReset();
    mockApi.post.mockReset();
  });

  it('fetchHome happy path populates hero/works/places and clears loading/error', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });

    const store = useHomeStore();
    await store.fetchHome();

    expect(store.hero).toEqual(fixture.hero);
    expect(store.works).toEqual(fixture.works);
    expect(store.places).toEqual(fixture.places);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('fetchHome failure surfaces the error message and stops loading', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('boom'));

    const store = useHomeStore();
    await store.fetchHome();

    expect(store.error).toBe('boom');
    expect(store.loading).toBe(false);
  });

  it('setWork(id) triggers a refetch with workId in the query params', async () => {
    mockApi.get.mockResolvedValue({ data: fixture });

    const store = useHomeStore();
    await store.setWork(1);

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ workId: 1, scope: 'NEAR' });
    expect(store.selectedWorkId).toBe(1);
  });

  it("setScope('TRENDING') triggers a refetch with scope: 'TRENDING'", async () => {
    mockApi.get.mockResolvedValue({ data: fixture });

    const store = useHomeStore();
    await store.setScope('TRENDING');

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ scope: 'TRENDING' });
    expect(store.scope).toBe('TRENDING');
  });

  it('toggleLike(placeId) posts to /api/places/:id/like and updates liked/likeCount from response', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });

    const store = useHomeStore();
    await store.fetchHome();

    mockApi.post.mockResolvedValueOnce({ data: { liked: true, likeCount: 3201 } });
    await store.toggleLike(10);

    const [url] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/places/10/like');
    expect(store.places.find((p) => p.id === 10)?.liked).toBe(true);
    expect(store.places.find((p) => p.id === 10)?.likeCount).toBe(3201);
    expect(store.places.find((p) => p.id === 11)?.liked).toBe(false);

    mockApi.post.mockResolvedValueOnce({ data: { liked: false, likeCount: 3200 } });
    await store.toggleLike(10);
    expect(store.places.find((p) => p.id === 10)?.liked).toBe(false);
    expect(store.places.find((p) => p.id === 10)?.likeCount).toBe(3200);
  });
});
