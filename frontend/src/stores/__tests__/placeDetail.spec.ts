import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '@/services/api';
import { usePlaceDetailStore, type PlaceDetailResponse } from '@/stores/placeDetail';
import { signInForTest } from './__helpers__/auth';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const fixture: PlaceDetailResponse = {
  place: {
    id: 10,
    name: '주문진 영진해변 방파제',
    regionLabel: '강릉시 주문진읍',
    latitude: 37.8928,
    longitude: 128.8347,
    coverImageUrls: ['https://img/1.jpg'],
    workId: 1,
    workTitle: '도깨비',
    workEpisode: '1회',
    sceneTimestamp: '00:24:10',
    sceneImageUrl: 'https://img/scene-1.jpg',
    sceneDescription: '도깨비와 은탁이 처음 만난 곳',
    rating: 4.8,
    reviewCount: 312,
    photoCount: 1204,
    likeCount: 3200,
    liked: false,
    nearbyRestaurantCount: 12,
    recommendedTimeLabel: '일몰',
    distanceKm: 0.1,
    driveTimeMin: 1,
  },
  photos: [
    { id: 1, imageUrl: 'https://img/p1.jpg', authorNickname: 'kim' },
    { id: 2, imageUrl: 'https://img/p2.jpg', authorNickname: 'lee' },
    { id: 3, imageUrl: 'https://img/p3.jpg', authorNickname: 'park' },
  ],
  related: [
    {
      id: 11,
      name: '주문진 방파제 등대',
      coverImageUrls: ['https://img/r1.jpg'],
      workEpisode: '1회',
      regionShort: '강릉시',
    },
    {
      id: 12,
      name: '안목해변',
      coverImageUrls: ['https://img/r2.jpg'],
      workEpisode: '3회',
      regionShort: '강릉시',
    },
  ],
};

describe('placeDetail store', () => {
  beforeEach(() => {
    setActivePinia(createPinia()); signInForTest();
    mockApi.get.mockReset();
    mockApi.post.mockReset();
  });

  it('fetch happy path populates place/photos/related and clears loading/error', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });

    const store = usePlaceDetailStore();
    await store.fetch(10);

    expect(store.place).toEqual(fixture.place);
    expect(store.photos).toEqual(fixture.photos);
    expect(store.related).toEqual(fixture.related);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    const [url] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/places/10');
  });

  it('fetch forwards lat/lng query params when provided', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });

    const store = usePlaceDetailStore();
    await store.fetch(10, { lat: 37.5, lng: 127.0 });

    const [url, opts] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/places/10');
    expect(opts?.params).toMatchObject({ lat: 37.5, lng: 127.0 });
  });

  it('fetch failure surfaces the error message and stops loading', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('boom'));

    const store = usePlaceDetailStore();
    await store.fetch(10);

    expect(store.error).toBe('boom');
    expect(store.loading).toBe(false);
    expect(store.place).toBeNull();
  });

  it('toggleLike posts to /api/places/:id/like and updates place.liked/likeCount', async () => {
    mockApi.get.mockResolvedValueOnce({ data: fixture });
    const store = usePlaceDetailStore();
    await store.fetch(10);
    expect(store.isLiked(10)).toBe(false);

    mockApi.post.mockResolvedValueOnce({ data: { liked: true, likeCount: 3201 } });
    await store.toggleLike();

    const [url] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/places/10/like');
    expect(store.place?.liked).toBe(true);
    expect(store.place?.likeCount).toBe(3201);
    expect(store.isLiked(10)).toBe(true);

    mockApi.post.mockResolvedValueOnce({ data: { liked: false, likeCount: 3200 } });
    await store.toggleLike();
    expect(store.place?.liked).toBe(false);
    expect(store.isLiked(10)).toBe(false);
  });

  // Saved state moved to useSavedStore (task #19) — placeDetail store no
  // longer carries its own savedIds/toggleSaveLocal. See saved.spec.ts for
  // the unified coverage.
});
