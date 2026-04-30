import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), delete: vi.fn() },
}));

import api from '@/services/api';
import { useGalleryStore, type GalleryResponse } from '@/stores/gallery';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function makePhoto(id: number) {
  return {
    id,
    imageUrl: `https://cdn/p/${id}.jpg`,
    caption: `photo-${id}`,
    authorUserId: 7,
    authorNickname: '김미루',
    authorHandle: 'miru',
    authorAvatarUrl: 'https://img/ava.jpg',
    authorVerified: true,
    createdAt: '2026-04-22T00:00:00Z',
    likeCount: 120,
    commentCount: 3,
    sceneCompare: false,
  };
}

const pagePhotos = [makePhoto(1), makePhoto(2), makePhoto(3)];

const page0Fixture: GalleryResponse = {
  place: {
    placeId: 10,
    name: '주문진 영진해변 방파제',
    contentId: 1,
    contentTitle: '도깨비',
    contentEpisode: '1회',
    totalPhotoCount: 6,
  },
  photos: pagePhotos,
  total: 6,
  page: 0,
  size: 20,
  sort: 'RECENT',
};

const page1Photos = [makePhoto(4), makePhoto(5), makePhoto(6)];
const page1Fixture: GalleryResponse = {
  ...page0Fixture,
  photos: page1Photos,
  page: 1,
};

describe('gallery store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockApi.get.mockReset();
  });

  it('fetch happy path populates placeHeader/photos/total and calls GET /api/places/:id/photos with sort/page/size', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page0Fixture });
    const store = useGalleryStore();
    await store.fetch(10);

    expect(store.placeHeader).toEqual(page0Fixture.place);
    expect(store.photos).toEqual(pagePhotos);
    expect(store.total).toBe(6);
    expect(store.page).toBe(0);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();

    const [url, opts] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/places/10/photos');
    expect(opts?.params).toEqual({ sort: 'RECENT', page: 0, size: 20 });
  });

  it('setSort(different) refetches with the new sort; same sort is a no-op', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page0Fixture });
    const store = useGalleryStore();
    await store.fetch(10);
    mockApi.get.mockClear();

    // Same sort → no fetch.
    await store.setSort('RECENT');
    expect(mockApi.get).not.toHaveBeenCalled();

    // New sort → refetch with new sort in params.
    mockApi.get.mockResolvedValueOnce({ data: { ...page0Fixture, sort: 'POPULAR' } });
    await store.setSort('POPULAR');
    expect(store.sort).toBe('POPULAR');
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ sort: 'POPULAR' });
  });

  it('setViewMode flips between FEED and GRID without any network call', () => {
    const store = useGalleryStore();
    expect(store.viewMode).toBe('FEED');
    store.setViewMode('GRID');
    expect(store.viewMode).toBe('GRID');
    store.setViewMode('FEED');
    expect(store.viewMode).toBe('FEED');
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('loadMore appends photos from page+1 and updates page', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page0Fixture });
    const store = useGalleryStore();
    await store.fetch(10);
    mockApi.get.mockClear();

    mockApi.get.mockResolvedValueOnce({ data: page1Fixture });
    await store.loadMore();

    expect(store.photos.length).toBe(6);
    expect(store.photos.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(store.page).toBe(1);

    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ page: 1 });
  });

  it('loadMore no-ops when all photos are already loaded', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: { ...page0Fixture, total: pagePhotos.length },
    });
    const store = useGalleryStore();
    await store.fetch(10);
    mockApi.get.mockClear();

    await store.loadMore();
    expect(mockApi.get).not.toHaveBeenCalled();
    expect(store.photos.length).toBe(pagePhotos.length);
  });

  it('deletePhoto: DELETE /api/photos/:id 후 photos splice + total/totalPhotoCount 감소', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page0Fixture });
    const store = useGalleryStore();
    await store.fetch(10);
    const before = store.photos.length;
    const beforeTotal = store.total;
    const beforeHeaderCount = store.placeHeader!.totalPhotoCount;
    const targetId = store.photos[0].id;

    mockApi.delete.mockResolvedValueOnce({ data: null });
    const ok = await store.deletePhoto(targetId);

    expect(ok).toBe(true);
    expect(mockApi.delete).toHaveBeenCalledWith(`/api/photos/${targetId}`);
    expect(store.photos.length).toBe(before - 1);
    expect(store.total).toBe(beforeTotal - 1);
    expect(store.placeHeader!.totalPhotoCount).toBe(beforeHeaderCount - 1);
    expect(store.photos.find((p) => p.id === targetId)).toBeUndefined();
  });

  it('deletePhoto: 실패 시 error 저장 + photos 그대로', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page0Fixture });
    const store = useGalleryStore();
    await store.fetch(10);
    const before = store.photos.length;

    mockApi.delete.mockRejectedValueOnce(new Error('서버 오류'));
    const ok = await store.deletePhoto(store.photos[0].id);

    expect(ok).toBe(false);
    expect(store.error).toBe('서버 오류');
    expect(store.photos.length).toBe(before);
  });
});
