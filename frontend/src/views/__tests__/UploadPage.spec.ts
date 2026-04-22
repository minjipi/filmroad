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
}> = {}) {
  return mountWithStubs(UploadPage, {
    initialState: {
      upload: {
        targetPlace: { ...target },
        photos: overrides.photos ?? [photoA, photoB],
        selectedIndex: overrides.selectedIndex ?? 0,
        caption: overrides.caption ?? '',
        tags: [],
        visibility: overrides.visibility ?? 'PUBLIC',
        addToStampbook: overrides.addToStampbook ?? true,
        loading: false,
        error: null,
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
    };
    const submitSpy = vi.spyOn(store, 'submit').mockResolvedValue(fakeRes);

    await wrapper.find('button.post').trigger('click');
    await flushPromises();

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).toHaveBeenCalledWith('/reward/10');
  });
});
