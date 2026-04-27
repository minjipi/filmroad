import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { post: vi.fn() },
}));

// Geolocation hook — stubbed per-test so we can drive ok/fail paths without
// touching the real navigator.geolocation (jsdom has none).
vi.mock('@/composables/useGeolocation', () => ({
  requestLocation: vi.fn().mockResolvedValue({ ok: false, reason: 'unavailable' }),
}));

import api from '@/services/api';
import { requestLocation } from '@/composables/useGeolocation';

const mockRequestLocation = requestLocation as unknown as ReturnType<typeof vi.fn>;
import {
  useUploadStore,
  type CaptureTarget,
  type PhotoResponse,
} from '@/stores/upload';
import { signInForTest } from './__helpers__/auth';

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
  images: [{ id: 99, imageUrl: 'https://cdn/p/99.jpg', imageOrderIndex: 0 }],
};

describe('upload store', () => {
  beforeEach(() => {
    setActivePinia(createPinia()); signInForTest();
    mockApi.post.mockReset();
    // Default to "no GPS" — tests that need coords opt in by overriding the
    // mock for that case. Keeps the meta-shape assertions in older tests
    // unchanged (lat/lng absent when geolocation is unavailable).
    mockRequestLocation.mockReset();
    mockRequestLocation.mockResolvedValue({ ok: false, reason: 'unavailable' });
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

  it('setTargetPlace attaches (or swaps) the target without touching photos or form state', () => {
    const store = useUploadStore();

    // Simulate the bottom-nav camera flow: shoot first, set place later.
    store.addPhoto(JPEG_DATA_URL);
    store.setCaption('hello');
    expect(store.targetPlace).toBeNull();

    store.setTargetPlace(target);
    expect(store.targetPlace).toEqual(target);
    // Photos / caption / toggles survive — this is the key difference from beginCapture.
    expect(store.photos).toEqual([JPEG_DATA_URL]);
    expect(store.caption).toBe('hello');

    // Swapping the target works the same way.
    const other = { ...target, placeId: 99, placeName: '다른 장소' };
    store.setTargetPlace(other);
    expect(store.targetPlace).toEqual(other);
    expect(store.photos).toEqual([JPEG_DATA_URL]);
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

    // task #44: the payload uses `files` (plural) and one form-entry per
    // photo so multi-image posts go up in a single request.
    const fileEntries = (form as FormData).getAll('files');
    expect(fileEntries).toHaveLength(1);
    expect(fileEntries[0]).toBeInstanceOf(Blob);
    expect((fileEntries[0] as Blob).type).toBe('image/jpeg');

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

  it('submit sends one `files` form-entry per photo for multi-image posts (task #44)', async () => {
    mockApi.post.mockResolvedValueOnce({ data: fakeResponse });

    const store = useUploadStore();
    store.beginCapture(target);
    store.addPhoto(JPEG_DATA_URL);
    store.addPhoto(JPEG_DATA_URL);
    store.addPhoto(JPEG_DATA_URL);

    await store.submit();

    const [, form] = mockApi.post.mock.calls[0];
    const fileEntries = (form as FormData).getAll('files');
    expect(fileEntries).toHaveLength(3);
    for (const entry of fileEntries) {
      expect(entry).toBeInstanceOf(Blob);
    }
    // Meta is still one part.
    expect((form as FormData).getAll('meta')).toHaveLength(1);
  });

  it('addPhoto rejects an added frame once the 5-photo per-post cap is hit', () => {
    const store = useUploadStore();
    store.beginCapture(target);
    for (let i = 0; i < 5; i += 1) {
      expect(store.addPhoto(JPEG_DATA_URL)).toBe(true);
    }
    expect(store.addPhoto(JPEG_DATA_URL)).toBe(false);
    expect(store.photos).toHaveLength(5);
    expect(store.error).toMatch(/최대.*5.*장/);
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

  it('submit short-circuits when navigator.onLine is false (offline guard, task #31)', async () => {
    // Temporarily override the readonly onLine property for this test only.
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      'onLine',
    );
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });

    try {
      const store = useUploadStore();
      store.beginCapture(target);
      store.addPhoto(JPEG_DATA_URL);

      const result = await store.submit();
      expect(result).toBeNull();
      expect(store.error).toContain('인터넷에 연결');
      expect(mockApi.post).not.toHaveBeenCalled();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window.navigator, 'onLine', originalDescriptor);
      } else {
        // jsdom normally has onLine; deleting restores the default getter.
        delete (window.navigator as unknown as { onLine?: boolean }).onLine;
      }
    }
  });

  it('submit wires axios onUploadProgress → uploadProgress state (task #31)', async () => {
    type ProgressEv = { loaded: number; total: number };
    type PostOpts = { onUploadProgress?: (ev: ProgressEv) => void };
    let onProgress: ((ev: ProgressEv) => void) | undefined;
    // Hold the POST promise open so we can fire progress events *before*
    // submit() unwinds and snaps the bar to 100%.
    let resolvePost: (value: { data: typeof fakeResponse }) => void = () => {};
    mockApi.post.mockImplementationOnce(
      (_url: string, _form: FormData, opts: PostOpts) => {
        onProgress = opts.onUploadProgress;
        return new Promise((r) => {
          resolvePost = r;
        });
      },
    );

    const store = useUploadStore();
    store.beginCapture(target);
    store.addPhoto(JPEG_DATA_URL);

    const submitP = store.submit();
    // Let submit() reach api.post() so the interceptor captures our callback.
    await new Promise((r) => setTimeout(r, 0));
    expect(typeof onProgress).toBe('function');

    // Simulate two in-flight progress events — state should tick forward.
    onProgress!({ loaded: 30, total: 100 });
    expect(store.uploadProgress).toBe(30);
    onProgress!({ loaded: 90, total: 100 });
    expect(store.uploadProgress).toBe(90);

    // Resolve the upload; submit() snaps to 100% after the POST settles.
    resolvePost({ data: fakeResponse });
    await submitP;
    expect(store.uploadProgress).toBe(100);
  });

  it('submit includes latitude/longitude in meta when geolocation succeeds (task #4)', async () => {
    mockRequestLocation.mockResolvedValueOnce({
      ok: true,
      coords: { lat: 37.5665, lng: 126.978 },
    });
    mockApi.post.mockResolvedValueOnce({ data: fakeResponse });

    const store = useUploadStore();
    store.beginCapture(target);
    store.addPhoto(JPEG_DATA_URL);

    const result = await store.submit();
    expect(result).toEqual(fakeResponse);

    const [, form] = mockApi.post.mock.calls[0];
    const metaEntry = (form as FormData).get('meta');
    const metaText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(metaEntry as Blob);
    });
    const metaJson = JSON.parse(metaText);

    expect(metaJson.latitude).toBe(37.5665);
    expect(metaJson.longitude).toBe(126.978);
    expect(metaJson.placeId).toBe(10);
  });

  it('submit silently omits latitude/longitude when geolocation fails (silent fail, task #4)', async () => {
    mockRequestLocation.mockResolvedValueOnce({ ok: false, reason: 'denied' });
    mockApi.post.mockResolvedValueOnce({ data: fakeResponse });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const store = useUploadStore();
    store.beginCapture(target);
    store.addPhoto(JPEG_DATA_URL);

    const result = await store.submit();
    // Upload still goes through — geo failure is silent.
    expect(result).toEqual(fakeResponse);
    expect(store.error).toBeNull();

    const [, form] = mockApi.post.mock.calls[0];
    const metaEntry = (form as FormData).get('meta');
    const metaText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(metaEntry as Blob);
    });
    const metaJson = JSON.parse(metaText);

    // JSON.stringify drops undefined keys — lat/lng absent rather than null.
    expect('latitude' in metaJson).toBe(false);
    expect('longitude' in metaJson).toBe(false);
    // We left a console.warn breadcrumb (per task #4 brief — silent UX, not silent debug).
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('retry() is a named alias for submit() — re-uses current state and POSTs again', async () => {
    // First attempt fails — simulate a transient network error.
    mockApi.post.mockRejectedValueOnce(new Error('network down'));

    const store = useUploadStore();
    store.beginCapture(target);
    store.addPhoto(JPEG_DATA_URL);
    store.setCaption('retry-me');

    const first = await store.submit();
    expect(first).toBeNull();
    expect(store.error).toBe('network down');

    // Second attempt succeeds. Same photos/caption survive — no beginCapture.
    mockApi.post.mockResolvedValueOnce({ data: fakeResponse });
    const second = await store.retry();
    expect(second).toEqual(fakeResponse);
    expect(store.error).toBeNull();
    // Both POSTs landed on /api/photos with the same caption in meta.
    expect(mockApi.post).toHaveBeenCalledTimes(2);
  });
});
