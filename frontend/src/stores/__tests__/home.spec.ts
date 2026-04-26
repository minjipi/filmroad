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
      coverImageUrls: ['https://img/1.jpg'],
      workId: 1,
      workTitle: '도깨비',
      liked: false,
      likeCount: 3200,
    },
    {
      id: 11,
      name: '단밤 포차',
      regionLabel: '서울 용산구 이태원동',
      coverImageUrls: ['https://img/2.jpg'],
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

  it('default scope is TRENDING (first page load does not request geolocation)', () => {
    const store = useHomeStore();
    expect(store.scope).toBe('TRENDING');
  });

  it('setWork(id) triggers a refetch with workId in the query params', async () => {
    mockApi.get.mockResolvedValue({ data: fixture });

    const store = useHomeStore();
    await store.setWork(1);

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ workId: 1, scope: 'TRENDING' });
    expect(store.selectedWorkId).toBe(1);
  });

  it('fetchHome forwards lat/lng/radiusKm to /api/home when provided', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useHomeStore();
    await store.fetchHome({ lat: 37.5665, lng: 126.978, radiusKm: 50 });

    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({
      scope: 'TRENDING',
      lat: 37.5665,
      lng: 126.978,
      radiusKm: 50,
    });
  });

  it("setScope('NEAR', {lat, lng, radiusKm}) refetches with those coords + radius", async () => {
    mockApi.get.mockResolvedValue({ data: fixture });
    const store = useHomeStore();
    await store.setScope('NEAR', { lat: 37.5, lng: 127.0, radiusKm: 30 });

    expect(store.scope).toBe('NEAR');
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({
      scope: 'NEAR',
      lat: 37.5,
      lng: 127.0,
      radiusKm: 30,
    });
  });

  it("setScope('NEAR', {radiusKm: 100}) still refetches even when scope is already NEAR (radius toggle)", async () => {
    mockApi.get.mockResolvedValue({ data: fixture });
    const store = useHomeStore();
    await store.setScope('NEAR', { lat: 37, lng: 127, radiusKm: 30 });
    mockApi.get.mockClear();

    await store.setScope('NEAR', { lat: 37, lng: 127, radiusKm: 100 });
    expect(mockApi.get).toHaveBeenCalledTimes(1);
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ scope: 'NEAR', radiusKm: 100 });
  });

  it("setScope back to 'TRENDING' from NEAR triggers a refetch with scope: 'TRENDING'", async () => {
    mockApi.get.mockResolvedValue({ data: fixture });

    const store = useHomeStore();
    // Move off the default TRENDING first so switching back actually refetches.
    await store.setScope('NEAR', { lat: 37, lng: 127, radiusKm: 30 });
    mockApi.get.mockClear();

    await store.setScope('TRENDING');

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ scope: 'TRENDING' });
    expect(store.scope).toBe('TRENDING');
  });

  it('fetchHome hydrates popularWorks from the response payload (task #24)', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: {
        ...fixture,
        popularWorks: [
          { id: 1, title: '도깨비', posterUrl: 'https://img/p1.jpg', placeCount: 12 },
          { id: 2, title: '이태원 클라쓰', posterUrl: null, placeCount: 6 },
        ],
      },
    });

    const store = useHomeStore();
    await store.fetchHome();

    expect(store.popularWorks).toHaveLength(2);
    expect(store.popularWorks[0]).toMatchObject({ id: 1, title: '도깨비', placeCount: 12 });
    expect(store.popularWorks[1].posterUrl).toBeNull();
  });

  it('popularWorks falls back to an empty array when the server omits the field (older API)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useHomeStore();
    await store.fetchHome();

    expect(store.popularWorks).toEqual([]);
  });

  it("setScope('POPULAR_WORKS') is a view-only toggle — no /api/home refetch", async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useHomeStore();
    await store.fetchHome();
    mockApi.get.mockClear();

    await store.setScope('POPULAR_WORKS');
    expect(store.scope).toBe('POPULAR_WORKS');
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it("setScope back to 'TRENDING' from POPULAR_WORKS refetches (server resorts places)", async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useHomeStore();
    await store.fetchHome();
    mockApi.get.mockClear();

    await store.setScope('POPULAR_WORKS');
    expect(mockApi.get).not.toHaveBeenCalled();

    mockApi.get.mockResolvedValueOnce({ data: fixture });
    await store.setScope('TRENDING');
    expect(store.scope).toBe('TRENDING');
    expect(mockApi.get).toHaveBeenCalledTimes(1);
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ scope: 'TRENDING' });
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

  it('toggleLike flips state optimistically BEFORE the API call resolves', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useHomeStore();
    await store.fetchHome();

    // 응답을 직접 통제할 수 있는 deferred promise — POST 가 in-flight 인 동안
    // 상태가 이미 뒤집혀 있어야 한다.
    let resolvePost!: (v: { data: { liked: boolean; likeCount: number } }) => void;
    mockApi.post.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolvePost = r;
        }),
    );
    const inflight = store.toggleLike(10);

    // 응답 오기 전: optimistic 으로 이미 liked=true, likeCount +1.
    expect(store.places.find((p) => p.id === 10)?.liked).toBe(true);
    expect(store.places.find((p) => p.id === 10)?.likeCount).toBe(3201);

    resolvePost({ data: { liked: true, likeCount: 3201 } });
    await inflight;
    // 서버 응답이 와도 같은 값이라 그대로.
    expect(store.places.find((p) => p.id === 10)?.liked).toBe(true);
    expect(store.places.find((p) => p.id === 10)?.likeCount).toBe(3201);
  });

  it('toggleLike rolls back the optimistic flip when the API call fails and surfaces a Korean error', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = useHomeStore();
    await store.fetchHome();
    const initialLiked = store.places.find((p) => p.id === 10)?.liked;
    const initialCount = store.places.find((p) => p.id === 10)?.likeCount;

    mockApi.post.mockRejectedValueOnce(new Error('network down'));
    await store.toggleLike(10);

    // 실패 → 원래 값으로 복원.
    expect(store.places.find((p) => p.id === 10)?.liked).toBe(initialLiked);
    expect(store.places.find((p) => p.id === 10)?.likeCount).toBe(initialCount);
    // store.error 가 사용자에게 보여줄 메시지를 들고 있다.
    expect(store.error).toBe('network down');
  });
});
