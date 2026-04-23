import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
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

import CameraPage from '@/views/CameraPage.vue';
import { useUploadStore, type CaptureTarget } from '@/stores/upload';
import { mountWithStubs } from './__helpers__/mount';

const target: CaptureTarget = {
  placeId: 10,
  workId: 1,
  workTitle: '도깨비',
  workEpisode: '1회',
  placeName: '주문진 영진해변 방파제',
  sceneImageUrl: 'https://img/scene.jpg',
};

const baseUploadState: {
  targetPlace: CaptureTarget | null;
  photos: string[];
  selectedIndex: number;
  caption: string;
  tags: string[];
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  addToStampbook: boolean;
  loading: boolean;
  error: string | null;
} = {
  targetPlace: { ...target },
  photos: [],
  selectedIndex: 0,
  caption: '',
  tags: [],
  visibility: 'PUBLIC',
  addToStampbook: true,
  loading: false,
  error: null,
};

beforeAll(() => {
  // Patch canvas + image decode so onShutter's fallback path can produce a data URL.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(
    () => 'data:image/jpeg;base64,AAAA',
  );
  HTMLImageElement.prototype.decode = vi
    .fn()
    .mockResolvedValue(undefined);

  // No real camera in jsdom — leave mediaDevices undefined so liveActive stays false
  // and the fallback path is used by captureDataUrl.
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: undefined,
  });
});

function mountCamera(initialUpload: typeof baseUploadState = baseUploadState) {
  return mountWithStubs(CameraPage, {
    initialState: { upload: initialUpload },
  });
}

describe('CameraPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
  });

  it('mode tap updates the scene-overlay opacity (compare=1, overlay=0.42, plain=hidden)', async () => {
    const { wrapper } = mountCamera();
    await flushPromises();

    // Default mode = 'overlay' → overlay element rendered with opacity 0.42.
    let overlay = wrapper.find('.scene-overlay');
    expect(overlay.exists()).toBe(true);
    expect(overlay.attributes('style')).toContain('opacity: 0.42');

    const modes = wrapper.findAll('.mode');
    expect(modes.map((m) => m.text())).toEqual(['비교', '오버레이', '일반']);

    // 비교 → opacity 1.
    await modes[0].trigger('click');
    overlay = wrapper.find('.scene-overlay');
    expect(overlay.exists()).toBe(true);
    expect(overlay.attributes('style')).toContain('opacity: 1');

    // 일반 → overlay v-if becomes false (mode === 'plain').
    await modes[2].trigger('click');
    expect(wrapper.find('.scene-overlay').exists()).toBe(false);
  });

  it('shutter click captures a frame, calls addPhoto and routes to /upload', async () => {
    const { wrapper } = mountCamera();
    await flushPromises();
    const store = useUploadStore();
    const addSpy = vi.spyOn(store, 'addPhoto');
    replaceSpy.mockClear();

    await wrapper.find('.shutter').trigger('click');
    await flushPromises();

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addSpy.mock.calls[0][0]).toBe('data:image/jpeg;base64,AAAA');
    expect(replaceSpy).toHaveBeenCalledWith('/upload');
  });

  it('close (X) button stops the stream and goes back', async () => {
    const { wrapper } = mountCamera();
    await flushPromises();
    backSpy.mockClear();

    const closeBtn = wrapper.find('button[aria-label="close"]');
    expect(closeBtn.exists()).toBe(true);
    await closeBtn.trigger('click');

    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('bottom-nav entry (no targetPlace) keeps the camera open instead of bouncing to /home', async () => {
    const { wrapper } = mountCamera({ ...baseUploadState, targetPlace: null });
    await flushPromises();

    // No /home bounce — the user stays on the camera to shoot first.
    expect(replaceSpy).not.toHaveBeenCalledWith('/home');
    // Overlay + guide + spot-badge all key off targetPlace, so they're hidden.
    expect(wrapper.find('.scene-overlay').exists()).toBe(false);
    expect(wrapper.find('.guide-card').exists()).toBe(false);
    expect(wrapper.find('.spot-badge').exists()).toBe(false);
    // Shutter button is still present — that's the whole point of this flow.
    expect(wrapper.find('.shutter').exists()).toBe(true);
  });
});
