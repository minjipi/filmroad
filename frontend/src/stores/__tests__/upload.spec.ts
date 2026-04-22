import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { post: vi.fn() },
}));

import api from '@/services/api';
import {
  useUploadStore,
  type CaptureTarget,
  type PhotoResponse,
} from '@/stores/upload';

const mockApi = api as unknown as { post: ReturnType<typeof vi.fn> };

const target: CaptureTarget = {
  placeId: 10,
  workId: 1,
  workTitle: '도깨비',
  workEpisode: '1회',
  placeName: '주문진 영진해변 방파제',
  sceneImageUrl: 'https://img/scene.jpg',
};

// Smallest base64 jpeg payload — bytes themselves don't matter, only mime detection + body parsing.
const JPEG_DATA_URL = 'data:image/jpeg;base64,QUJDRA=='; // ABCD

const fakeResponse: PhotoResponse = {
  id: 99,
  imageUrl: 'https://cdn/p/99.jpg',
  placeId: 10,
  workId: 1,
  workTitle: '도깨비',
  workEpisode: '1회',
  caption: 'hello',
  tags: ['도깨비', '강릉'],
  visibility: 'PUBLIC',
  createdAt: '2026-04-22T00:00:00Z',
};

describe('upload store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockApi.post.mockReset();
  });

  it('beginCapture sets targetPlace and reset wipes everything back', () => {
    const store = useUploadStore();

    store.beginCapture(target);
    expect(store.targetPlace).toEqual(target);
    expect(store.photos).toEqual([]);
    expect(store.visibility).toBe('PUBLIC');
    expect(store.addToStampbook).toBe(true);
    expect(store.error).toBeNull();

    store.addPhoto(JPEG_DATA_URL);
    store.setCaption('hello');
    store.setVisibility('FOLLOWERS');
    store.toggleStampbook();
    store.error = 'oops';

    store.reset();
    expect(store.targetPlace).toBeNull();
    expect(store.photos).toEqual([]);
    expect(store.selectedIndex).toBe(0);
    expect(store.caption).toBe('');
    expect(store.visibility).toBe('PUBLIC');
    expect(store.addToStampbook).toBe(true);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it('addPhoto / selectPhoto / removePhoto manage the photo list', () => {
    const store = useUploadStore();
    store.beginCapture(target);

    store.addPhoto('data:image/jpeg;base64,AAAA');
    store.addPhoto('data:image/jpeg;base64,BBBB');
    store.addPhoto('data:image/jpeg;base64,CCCC');
    expect(store.photos.length).toBe(3);
    // addPhoto promotes selectedIndex to the new photo.
    expect(store.selectedIndex).toBe(2);
    expect(store.selectedPhoto).toBe('data:image/jpeg;base64,CCCC');

    store.selectPhoto(1);
    expect(store.selectedIndex).toBe(1);
    expect(store.selectedPhoto).toBe('data:image/jpeg;base64,BBBB');

    // Out-of-range selectPhoto is a no-op.
    store.selectPhoto(99);
    expect(store.selectedIndex).toBe(1);

    // Remove the currently selected photo (index 1) — selectedIndex stays in range.
    store.removePhoto(1);
    expect(store.photos).toEqual([
      'data:image/jpeg;base64,AAAA',
      'data:image/jpeg;base64,CCCC',
    ]);

    // Remove the trailing photo while it's selected — selectedIndex clamps down.
    store.selectPhoto(1);
    store.removePhoto(1);
    expect(store.photos).toEqual(['data:image/jpeg;base64,AAAA']);
    expect(store.selectedIndex).toBe(0);
  });

  it('submit happy path POSTs FormData with file Blob + JSON meta Blob and returns the response', async () => {
    mockApi.post.mockResolvedValueOnce({ data: fakeResponse });

    const store = useUploadStore();
    store.beginCapture(target);
    store.addPhoto(JPEG_DATA_URL);
    store.setCaption('hello');
    store.setVisibility('FOLLOWERS');
    store.setTags(['도깨비', '강릉']);
    store.addToStampbook = false;

    const result = await store.submit();
    expect(result).toEqual(fakeResponse);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();

    expect(mockApi.post).toHaveBeenCalledTimes(1);
    const [url, form] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/photos');
    expect(form).toBeInstanceOf(FormData);

    const fileEntry = (form as FormData).get('file');
    expect(fileEntry).toBeInstanceOf(Blob);
    expect((fileEntry as Blob).type).toBe('image/jpeg');

    const metaEntry = (form as FormData).get('meta');
    expect(metaEntry).toBeInstanceOf(Blob);
    expect((metaEntry as Blob).type).toBe('application/json');
    const metaText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(metaEntry as Blob);
    });
    const metaJson = JSON.parse(metaText);
    expect(metaJson).toEqual({
      placeId: 10,
      caption: 'hello',
      tags: '도깨비,강릉',
      visibility: 'FOLLOWERS',
      addToStampbook: false,
    });
  });

  it('submit success stores the response in lastResult (for the reward screen)', async () => {
    const rewardedResponse = {
      ...fakeResponse,
      stamp: {
        placeName: '주문진 영진해변 방파제',
        workId: 1,
        workTitle: '도깨비',
        collectedCount: 3,
        totalCount: 10,
        percent: 30,
      },
      reward: {
        pointsEarned: 50,
        currentPoints: 400,
        streakDays: 7,
        level: 5,
        levelName: '성지 순례자',
        newBadges: [
          {
            badgeId: 77,
            code: 'first-light',
            name: '첫 일출',
            description: null,
            iconKey: 'sunrise',
            gradient: null,
            acquired: true,
            progressText: null,
            acquiredAt: '2026-04-22T06:00:00Z',
          },
        ],
      },
    };
    mockApi.post.mockResolvedValueOnce({ data: rewardedResponse });

    const store = useUploadStore();
    expect(store.lastResult).toBeNull();
    store.beginCapture(target);
    store.addPhoto(JPEG_DATA_URL);

    const result = await store.submit();
    expect(result).toEqual(rewardedResponse);
    expect(store.lastResult).toEqual(rewardedResponse);
    expect(store.lastResult?.stamp?.collectedCount).toBe(3);
    expect(store.lastResult?.reward?.pointsEarned).toBe(50);
  });

  it('submit failure surfaces error message and clears loading', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('network down'));

    const store = useUploadStore();
    store.beginCapture(target);
    store.addPhoto(JPEG_DATA_URL);

    const result = await store.submit();
    expect(result).toBeNull();
    expect(store.error).toBe('network down');
    expect(store.loading).toBe(false);
  });

  it('submit guards against missing target or empty photos without calling api', async () => {
    const store = useUploadStore();

    expect(await store.submit()).toBeNull();
    expect(store.error).toBe('촬영 대상이 설정되지 않았어요');
    expect(mockApi.post).not.toHaveBeenCalled();

    store.beginCapture(target);
    expect(await store.submit()).toBeNull();
    expect(store.error).toBe('사진을 먼저 선택해주세요');
    expect(mockApi.post).not.toHaveBeenCalled();
  });
});
