import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

const { pushSpy, replaceSpy, backSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  replaceSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy, back: backSpy }),
}));

const { toastCreateSpy } = vi.hoisted(() => ({
  toastCreateSpy: vi
    .fn()
    .mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@ionic/vue', async () => {
  const actual = await vi.importActual<typeof import('@ionic/vue')>('@ionic/vue');
  return { ...actual, toastController: { create: toastCreateSpy } };
});

import UploadPage from '@/views/UploadPage.vue';
import {
  useUploadStore,
  type CaptureTarget,
  type PhotoResponse,
} from '@/stores/upload';
import { mountWithStubs } from './__helpers__/mount';

const target: CaptureTarget = {
  placeId: 10,
  workId: 1,
  workTitle: '도깨비',
  workEpisode: '1회',
  placeName: '주문진 영진해변 방파제',
  sceneImageUrl: 'https://img/scene.jpg',
};

const photoA = 'data:image/jpeg;base64,AAAA';
const photoB = 'data:image/jpeg;base64,BBBB';

function mountUpload(overrides: Partial<{
  photos: string[];
  selectedIndex: number;
  caption: string;
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  addToStampbook: boolean;
  targetPlace: CaptureTarget | null;
  homePlaces: Array<{
    id: number;
    name: string;
    regionLabel: string;
    coverImageUrl: string;
    workId: number;
    workTitle: string;
    liked: boolean;
    likeCount: number;
  }>;
}> = {}) {
  return mountWithStubs(UploadPage, {
    initialState: {
      upload: {
        targetPlace:
          overrides.targetPlace === undefined ? { ...target } : overrides.targetPlace,
        photos: overrides.photos ?? [photoA, photoB],
        selectedIndex: overrides.selectedIndex ?? 0,
        caption: overrides.caption ?? '',
        tags: [],
        visibility: overrides.visibility ?? 'PUBLIC',
        addToStampbook: overrides.addToStampbook ?? true,
        loading: false,
        error: null,
      },
      home: {
        hero: null,
        works: [],
        places: overrides.homePlaces ?? [],
        loading: false,
        error: null,
        selectedWorkId: null,
        scope: 'NEAR',
      },
    },
  });
}

describe('UploadPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
  });

  it('preview shows photos[selectedIndex]', async () => {
    const { wrapper } = mountUpload({ selectedIndex: 1 });
    await flushPromises();

    const previewImg = wrapper.find('.preview img');
    expect(previewImg.exists()).toBe(true);
    expect(previewImg.attributes('src')).toBe(photoB);
  });

  it('thumbnail row renders one cell per photo plus the add (+) button', async () => {
    const { wrapper } = mountUpload();
    await flushPromises();

    const thumbCells = wrapper.findAll('.thumbs .t');
    expect(thumbCells.length).toBe(2);
    // The selected thumb gets the .sel marker.
    expect(thumbCells[0].classes()).toContain('sel');
    expect(thumbCells[1].classes()).not.toContain('sel');
    expect(wrapper.findAll('.thumbs .plus').length).toBe(1);
  });

  it('typing into the caption textarea updates the store via setCaption', async () => {
    const { wrapper } = mountUpload();
    await flushPromises();
    const store = useUploadStore();
    const setCaptionSpy = vi.spyOn(store, 'setCaption');

    const textarea = wrapper.find('textarea.caption');
    expect(textarea.exists()).toBe(true);
    await textarea.setValue('첫 방문이에요');

    expect(setCaptionSpy).toHaveBeenCalledWith('첫 방문이에요');
    expect(store.caption).toBe('첫 방문이에요');
  });

  it('toggle buttons reflect the on/off binding from the store', async () => {
    const { wrapper } = mountUpload({
      addToStampbook: false,
      visibility: 'FOLLOWERS',
    });
    await flushPromises();

    const toggles = wrapper.findAll('button.toggle');
    // Two toggles: stampbook + visibility — both off in this fixture.
    expect(toggles.length).toBe(2);
    expect(toggles[0].classes()).toContain('off');
    expect(toggles[1].classes()).toContain('off');

    const store = useUploadStore();

    // Tap the stampbook toggle → flips to on (no .off).
    await toggles[0].trigger('click');
    expect(store.addToStampbook).toBe(true);
    expect(wrapper.findAll('button.toggle')[0].classes()).not.toContain('off');

    // Tap the visibility toggle → switches to PUBLIC (no .off).
    await toggles[1].trigger('click');
    expect(store.visibility).toBe('PUBLIC');
    expect(wrapper.findAll('button.toggle')[1].classes()).not.toContain('off');
  });

  it('bottom-nav entry with no targetPlace: renders the "장소 선택" CTA and disables 공유하기', async () => {
    const { wrapper } = mountUpload({ targetPlace: null, photos: [photoA] });
    await flushPromises();

    // Preview still renders the shot photo — user just hasn't attached a place yet.
    expect(wrapper.find('.preview img').attributes('src')).toBe(photoA);
    // Frame sticker is tied to targetPlace and must stay hidden.
    expect(wrapper.find('.frame-sticker').exists()).toBe(false);
    // Place CTA replaces the normal "위치" row.
    const cta = wrapper.find('[data-testid="pick-place-cta"]');
    expect(cta.exists()).toBe(true);
    expect(cta.text()).toContain('장소를 선택해 주세요');
    // Share button disabled until a place is picked.
    expect((wrapper.find('button.post').element as HTMLButtonElement).disabled).toBe(true);
  });

  it('tapping the place CTA opens the picker sheet with home places; selecting one calls setTargetPlace and closes it', async () => {
    const homePlaces = [
      {
        id: 13,
        name: '단밤 포차',
        regionLabel: '서울 용산구',
        coverImageUrl: 'https://img/13.jpg',
        workId: 2,
        workTitle: '이태원 클라쓰',
        liked: false,
        likeCount: 0,
      },
    ];
    const { wrapper } = mountUpload({
      targetPlace: null,
      photos: [photoA],
      homePlaces,
    });
    await flushPromises();
    const store = useUploadStore();
    const setSpy = vi.spyOn(store, 'setTargetPlace');

    // Backdrop / sheet are hidden until the CTA is tapped.
    expect(wrapper.find('[data-testid="picker-backdrop"]').exists()).toBe(false);

    await wrapper.find('[data-testid="pick-place-cta"]').trigger('click');
    await flushPromises();

    const items = wrapper.findAll('[data-testid="picker-item"]');
    expect(items.length).toBe(1);
    expect(items[0].text()).toContain('단밤 포차');

    await items[0].trigger('click');

    expect(setSpy).toHaveBeenCalledWith({
      placeId: 13,
      workId: 2,
      workTitle: '이태원 클라쓰',
      workEpisode: null,
      placeName: '단밤 포차',
      sceneImageUrl: null,
    });
    // Sheet closes after selection.
    expect(wrapper.find('[data-testid="picker-backdrop"]').exists()).toBe(false);
  });

  it('"공유하기" button triggers uploadStore.submit and routes to /reward/:id on success', async () => {
    const { wrapper } = mountUpload();
    await flushPromises();
    const store = useUploadStore();

    const fakeRes: PhotoResponse = {
      id: 99,
      imageUrl: 'https://cdn/p/99.jpg',
      placeId: 10,
      workId: 1,
      workTitle: '도깨비',
      workEpisode: '1회',
      caption: null,
      tags: [],
      visibility: 'PUBLIC',
      createdAt: '2026-04-22T00:00:00Z',
      groupPhotos: [{ id: 99, imageUrl: 'https://cdn/p/99.jpg', orderIndex: 0 }],
    };
    const submitSpy = vi.spyOn(store, 'submit').mockResolvedValue(fakeRes);

    await wrapper.find('button.post').trigger('click');
    await flushPromises();

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).toHaveBeenCalledWith('/reward/10');
  });

  it('upload error surfaces an inline retry banner; tapping 재시도 calls uploadStore.retry (task #31)', async () => {
    const { wrapper } = mountUpload();
    await flushPromises();
    const store = useUploadStore();

    // Simulate a prior failed submit — error set, loading=false.
    store.error = '네트워크 오류';
    await flushPromises();

    const banner = wrapper.find('[data-testid="upload-error-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('네트워크 오류');

    const fakeRes: PhotoResponse = {
      id: 77,
      imageUrl: 'https://cdn/p/77.jpg',
      placeId: 10,
      workId: 1,
      workTitle: '도깨비',
      workEpisode: '1회',
      caption: null,
      tags: [],
      visibility: 'PUBLIC',
      createdAt: '2026-04-23T00:00:00Z',
      groupPhotos: [{ id: 77, imageUrl: 'https://cdn/p/77.jpg', orderIndex: 0 }],
    };
    const retrySpy = vi.spyOn(store, 'retry').mockResolvedValue(fakeRes);

    await wrapper.find('[data-testid="upload-retry"]').trigger('click');
    await flushPromises();

    expect(retrySpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).toHaveBeenCalledWith('/reward/10');
  });

  it('error banner is hidden while loading (progress bar takes over)', async () => {
    const { wrapper } = mountUpload();
    await flushPromises();
    const store = useUploadStore();
    store.error = '네트워크 오류';
    store.loading = true;
    await flushPromises();

    // Banner suppressed during in-flight upload.
    expect(wrapper.find('[data-testid="upload-error-banner"]').exists()).toBe(false);
    // Progress bar is visible instead.
    expect(wrapper.find('[data-testid="upload-progress"]').exists()).toBe(true);
  });

  it('offline mode: banner renders and "공유하기" is disabled (task #31)', async () => {
    // Force navigator.onLine=false before the component mounts so useOnline()
    // initializes to offline. Also fire the event once for good measure.
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      'onLine',
    );
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
    try {
      const { wrapper } = mountUpload();
      await flushPromises();
      window.dispatchEvent(new Event('offline'));
      await flushPromises();

      const banner = wrapper.find('[data-testid="upload-offline-banner"]');
      expect(banner.exists()).toBe(true);
      expect(banner.text()).toContain('인터넷 연결');

      // Share button disabled — even with a valid place + photos.
      const shareBtn = wrapper.find('button.post').element as HTMLButtonElement;
      expect(shareBtn.disabled).toBe(true);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window.navigator, 'onLine', originalDescriptor);
      } else {
        delete (window.navigator as unknown as { onLine?: boolean }).onLine;
      }
      window.dispatchEvent(new Event('online'));
    }
  });
});
