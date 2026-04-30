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
import { useUiStore } from '@/stores/ui';
import { mountWithStubs } from './__helpers__/mount';

const target: CaptureTarget = {
  placeId: 10,
  contentId: 1,
  contentTitle: '도깨비',
  contentEpisode: '1회',
  placeName: '주문진 영진해변 방파제',
  sceneImageUrl: 'https://img/scene.jpg',
};

const photoA = 'data:image/jpeg;base64,AAAA';
const photoB = 'data:image/jpeg;base64,BBBB';

// Stub for ScoreRevealOverlay — synchronously emits count-up-complete the
// instant it sees a numeric totalScore + loading=false. Lets task #8 stage
// transition tests advance past the RAF-driven count-up without depending on
// fake-timer RAF integration (vitest doesn't fake RAF by default).
const ScoreRevealOverlayStub = {
  name: 'ScoreRevealOverlay',
  props: ['loading', 'totalScore', 'similarityScore', 'gpsScore'],
  emits: ['count-up-complete'],
  template:
    '<div data-testid="score-total">{{ totalScore ?? "" }}</div>',
  mounted(this: { loading: boolean; totalScore: number | null | undefined; $emit: (e: string) => void }) {
    if (!this.loading && typeof this.totalScore === 'number') {
      this.$emit('count-up-complete');
    }
  },
  watch: {
    loading(this: { loading: boolean; totalScore: number | null | undefined; $emit: (e: string) => void }, v: boolean) {
      if (!v && typeof this.totalScore === 'number') this.$emit('count-up-complete');
    },
    totalScore(this: { loading: boolean; totalScore: number | null | undefined; $emit: (e: string) => void }, v: number | null | undefined) {
      if (!this.loading && typeof v === 'number') this.$emit('count-up-complete');
    },
  },
};

function mountUpload(overrides: Partial<{
  photos: string[];
  selectedIndex: number;
  caption: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  addToStampbook: boolean;
  targetPlace: CaptureTarget | null;
  homePlaces: Array<{
    id: number;
    name: string;
    regionLabel: string;
    coverImageUrls: string[];
    contentId: number;
    contentTitle: string;
    liked: boolean;
    likeCount: number;
  }>;
}> = {}) {
  return mountWithStubs(UploadPage, {
    stubs: { ScoreRevealOverlay: ScoreRevealOverlayStub },
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
        contents: [],
        places: overrides.homePlaces ?? [],
        loading: false,
        error: null,
        selectedContentId: null,
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

  it('stampbook toggle + visibility segmented control reflect store state', async () => {
    const { wrapper } = mountUpload({
      addToStampbook: false,
      visibility: 'PRIVATE',
    });
    await flushPromises();

    // 스탬프북 / 공개 범위는 고급 설정 안에 들어가 기본 접힘이라 먼저 expand.
    await wrapper.find('[data-testid="advanced-toggle"]').trigger('click');

    // 스탬프북은 토글 버튼 — 단일 .toggle.
    const stampbookToggle = wrapper.find('button.toggle');
    expect(stampbookToggle.exists()).toBe(true);
    expect(stampbookToggle.classes()).toContain('off');

    // 공개 범위는 segmented control (radio). PRIVATE 가 선택되어 있어야.
    const publicSeg = wrapper.find('[data-testid="visibility-public"]');
    const privateSeg = wrapper.find('[data-testid="visibility-private"]');
    expect(publicSeg.classes()).not.toContain('on');
    expect(privateSeg.classes()).toContain('on');
    expect(privateSeg.attributes('aria-checked')).toBe('true');

    const store = useUploadStore();

    // 스탬프북 토글 → on.
    await stampbookToggle.trigger('click');
    expect(store.addToStampbook).toBe(true);
    expect(wrapper.find('button.toggle').classes()).not.toContain('off');

    // 전체 공개 라디오 탭 → store.visibility 'PUBLIC'.
    await publicSeg.trigger('click');
    expect(store.visibility).toBe('PUBLIC');
    expect(wrapper.find('[data-testid="visibility-public"]').classes()).toContain('on');
    expect(wrapper.find('[data-testid="visibility-private"]').classes()).not.toContain('on');
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
    // Share button disabled-style until a place is picked. native disabled 속성은
    // 떼고 aria-disabled + 시각 흐림(.post-disabled) 만 — 클릭은 onShareClick 가
    // 받아 누락 안내 토스트 + picker 자동 오픈을 처리.
    const shareBtn = wrapper.find('button.post');
    expect(shareBtn.attributes('aria-disabled')).toBe('true');
    expect(shareBtn.classes()).toContain('post-disabled');
  });

  it('장소 없이 공유하기 클릭 → "장소를 선택해 주세요" 토스트 + picker 자동 오픈', async () => {
    const { wrapper } = mountUpload({ targetPlace: null, photos: [photoA] });
    await flushPromises();
    toastCreateSpy.mockClear();

    expect(wrapper.find('[data-testid="picker-backdrop"]').exists()).toBe(false);
    await wrapper.find('button.post').trigger('click');
    await flushPromises();

    // 토스트가 안내 문구와 함께 떴는지
    expect(toastCreateSpy).toHaveBeenCalledTimes(1);
    expect(toastCreateSpy.mock.calls[0][0].message).toContain('장소를 선택');
    // picker 자동 오픈 — 한 번 더 누르는 수고 절약
    expect(wrapper.find('[data-testid="picker-backdrop"]').exists()).toBe(true);
  });

  it('사진 없이 공유하기 클릭 → "사진을 한 장 이상 추가" 토스트 (picker 는 안 열림)', async () => {
    const { wrapper } = mountUpload({ targetPlace: target, photos: [] });
    await flushPromises();
    toastCreateSpy.mockClear();

    await wrapper.find('button.post').trigger('click');
    await flushPromises();

    expect(toastCreateSpy).toHaveBeenCalledTimes(1);
    expect(toastCreateSpy.mock.calls[0][0].message).toContain('사진을 한 장');
    expect(wrapper.find('[data-testid="picker-backdrop"]').exists()).toBe(false);
  });

  it('tapping the place CTA opens the picker sheet with home places; selecting one calls setTargetPlace and closes it', async () => {
    const homePlaces = [
      {
        id: 13,
        name: '단밤 포차',
        regionLabel: '서울 용산구',
        coverImageUrls: ['https://img/13.jpg'],
        contentId: 2,
        contentTitle: '이태원 클라쓰',
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
      contentId: 2,
      contentTitle: '이태원 클라쓰',
      contentEpisode: null,
      placeName: '단밤 포차',
      sceneImageUrl: null,
    });
    // Sheet closes after selection.
    expect(wrapper.find('[data-testid="picker-backdrop"]').exists()).toBe(false);
  });

  it('"공유하기" → stage transitions compose → scoring → authenticated; no /reward redirect (task #8)', async () => {
    vi.useFakeTimers();
    try {
      const { wrapper } = mountUpload();
      await flushPromises();
      const store = useUploadStore();

      const fakeRes: PhotoResponse = {
        id: 99,
        imageUrl: 'https://cdn/p/99.jpg',
        placeId: 10,
        contentId: 1,
        contentTitle: '도깨비',
        contentEpisode: '1회',
        caption: null,
        tags: [],
        visibility: 'PUBLIC',
        createdAt: '2026-04-22T00:00:00Z',
        images: [{ id: 99, imageUrl: 'https://cdn/p/99.jpg', imageOrderIndex: 0 }],
        totalScore: 84,
        similarityScore: 82,
        gpsScore: 86,
        stamp: {
          placeName: '주문진 영진해변 방파제',
          contentId: 1,
          contentTitle: '도깨비',
          collectedCount: 12,
          totalCount: 24,
          percent: 50,
        },
      };
      const submitSpy = vi.spyOn(store, 'submit').mockResolvedValue(fakeRes);

      // Compose stage initial state.
      expect(wrapper.find('button.post').exists()).toBe(true);
      expect(wrapper.find('[data-testid="upload-completion"]').exists()).toBe(false);

      await wrapper.find('button.post').trigger('click');
      await flushPromises();

      expect(submitSpy).toHaveBeenCalledTimes(1);
      // Scoring stage: count-up overlay mounted; total testid present.
      expect(wrapper.find('[data-testid="upload-stage-scoring"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="score-total"]').exists()).toBe(true);
      // Compose form (post button) hidden — stage swap is exclusive.
      expect(wrapper.find('button.post').exists()).toBe(false);

      // count-up-complete + 700ms beat → authenticated stage.
      await vi.advanceTimersByTimeAsync(800);
      await flushPromises();

      expect(wrapper.find('[data-testid="upload-stage-authenticated"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="completion-place-name"]').text())
        .toContain('주문진 영진해변 방파제');

      // Crucially, /reward routing is gone — UploadPage hosts the entire flow.
      expect(replaceSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^\/reward\//));
    } finally {
      vi.useRealTimers();
    }
  });

  it('stamp-card / rewards 는 인증완료 헤더가 자리 잡은 뒤 EXTRAS_REVEAL_DELAY_MS 후에 노출 (task #10 → 정책 변경)', async () => {
    vi.useFakeTimers();
    try {
      const { wrapper } = mountUpload();
      await flushPromises();
      const store = useUploadStore();

      const fakeRes: PhotoResponse = {
        id: 99,
        imageUrl: 'https://cdn/p/99.jpg',
        placeId: 10,
        contentId: 1,
        contentTitle: '도깨비',
        contentEpisode: '1회',
        caption: null,
        tags: [],
        visibility: 'PUBLIC',
        createdAt: '2026-04-22T00:00:00Z',
        images: [{ id: 99, imageUrl: 'https://cdn/p/99.jpg', imageOrderIndex: 0 }],
        totalScore: 84,
        similarityScore: 82,
        gpsScore: 86,
        stamp: {
          placeName: '주문진 영진해변 방파제',
          contentId: 1,
          contentTitle: '도깨비',
          collectedCount: 12,
          totalCount: 24,
          percent: 50,
        },
        reward: {
          pointsEarned: 50,
          currentPoints: 400,
          streakDays: 7,
          level: 5,
          previousLevel: 5,
          levelName: '성지 순례자',
          newBadges: [],
          newTrophyTier: null,
          newTrophyContentTitle: null,
          newTrophyContentPosterUrl: null,
        },
      };
      vi.spyOn(store, 'submit').mockImplementation(async () => {
        // Mirror what the real submit() would do so the parent's stamp/reward
        // computeds (which read from lastResult) have something to project.
        store.lastResult = fakeRes;
        return fakeRes;
      });

      await wrapper.find('button.post').trigger('click');
      await flushPromises();

      // scoring 단계: 응답이 도착해도 stamp-card / rewards 는 미노출.
      expect(wrapper.find('[data-testid="upload-stage-scoring"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="upload-stage-authenticated"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="completion-stamp-card"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="completion-rewards"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="completion-place-name"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="upload-go-home"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="upload-boast"]').exists()).toBe(false);

      // STAGE_BEAT_MS(700) 만 경과: authenticated 진입했지만 extras 는 아직.
      await vi.advanceTimersByTimeAsync(800);
      await flushPromises();

      expect(wrapper.find('[data-testid="upload-stage-authenticated"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="upload-go-home"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="completion-stamp-card"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="completion-rewards"]').exists()).toBe(false);

      // EXTRAS_REVEAL_DELAY_MS(500) 추가 경과 → stamp-card / rewards fade-up 진입.
      await vi.advanceTimersByTimeAsync(600);
      await flushPromises();

      expect(wrapper.find('[data-testid="completion-stamp-card"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="completion-rewards"]').exists()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('scoring stage hides stamp-card / rewards when the response carries no stamp or reward (task #10 auto-hide)', async () => {
    vi.useFakeTimers();
    try {
      const { wrapper } = mountUpload();
      await flushPromises();
      const store = useUploadStore();

      // No stamp / no reward in the response.
      const bareRes: PhotoResponse = {
        id: 77,
        imageUrl: 'https://cdn/p/77.jpg',
        placeId: 10,
        contentId: 1,
        contentTitle: '도깨비',
        contentEpisode: '1회',
        caption: null,
        tags: [],
        visibility: 'PUBLIC',
        createdAt: '2026-04-22T00:00:00Z',
        images: [{ id: 77, imageUrl: 'https://cdn/p/77.jpg', imageOrderIndex: 0 }],
        totalScore: 60,
      };
      vi.spyOn(store, 'submit').mockImplementation(async () => {
        store.lastResult = bareRes;
        return bareRes;
      });

      await wrapper.find('button.post').trigger('click');
      await flushPromises();

      // Scoring stage rendered, but neither stamp-card nor rewards because
      // the response simply doesn't include them — graceful fallback.
      expect(wrapper.find('[data-testid="upload-stage-scoring"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="completion-stamp-card"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="completion-rewards"]').exists()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('"이 성지 인증샷 보기" in stage B resets the store and replaces to /gallery/:placeId', async () => {
    vi.useFakeTimers();
    try {
      const { wrapper } = mountUpload();
      await flushPromises();
      const store = useUploadStore();
      const resetSpy = vi.spyOn(store, 'reset');

      const fakeRes: PhotoResponse = {
        id: 99,
        imageUrl: 'https://cdn/p/99.jpg',
        placeId: 10,
        contentId: 1,
        contentTitle: '도깨비',
        contentEpisode: '1회',
        caption: null,
        tags: [],
        visibility: 'PUBLIC',
        createdAt: '2026-04-22T00:00:00Z',
        images: [{ id: 99, imageUrl: 'https://cdn/p/99.jpg', imageOrderIndex: 0 }],
        totalScore: 70,
      };
      // 실 submit 은 응답을 받아 store.lastResult 에 저장하는데, mockResolvedValue
      // 만 쓰면 그 부수효과가 빠진다. onGoHome 이 lastResult.placeId 를 사용해
      // gallery 로 분기하므로 여기서 직접 lastResult 를 시드해 실 흐름과 동일한
      // 상태를 맞춘다.
      vi.spyOn(store, 'submit').mockImplementation(async () => {
        store.lastResult = fakeRes;
        return fakeRes;
      });

      await wrapper.find('button.post').trigger('click');
      await flushPromises();
      await vi.advanceTimersByTimeAsync(800);
      await flushPromises();

      replaceSpy.mockClear();
      await wrapper.find('[data-testid="upload-go-home"]').trigger('click');
      await flushPromises();

      expect(resetSpy).toHaveBeenCalledTimes(1);
      // 사용자가 방금 인증한 성지(placeId=10)의 갤러리로 이동.
      expect(replaceSpy).toHaveBeenCalledWith('/gallery/10');
    } finally {
      vi.useRealTimers();
    }
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
      contentId: 1,
      contentTitle: '도깨비',
      contentEpisode: '1회',
      caption: null,
      tags: [],
      visibility: 'PUBLIC',
      createdAt: '2026-04-23T00:00:00Z',
      images: [{ id: 77, imageUrl: 'https://cdn/p/77.jpg', imageOrderIndex: 0 }],
    };
    const retrySpy = vi.spyOn(store, 'retry').mockResolvedValue(fakeRes);

    await wrapper.find('[data-testid="upload-retry"]').trigger('click');
    await flushPromises();

    expect(retrySpy).toHaveBeenCalledTimes(1);
    // Same compose → scoring → authenticated flow as 공유하기 (task #8) —
    // /reward redirect is gone; the page itself shows 인증 완료.
    expect(wrapper.find('[data-testid="upload-stage-scoring"]').exists()).toBe(true);
    expect(replaceSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^\/reward\//));
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

      // Share button disabled-style — even with a valid place + photos.
      // aria-disabled + .post-disabled 시각 흐림으로 표현 (native disabled 아님).
      const shareBtn = wrapper.find('button.post');
      expect(shareBtn.attributes('aria-disabled')).toBe('true');
      expect(shareBtn.classes()).toContain('post-disabled');
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

// -----------------------------------------------------------------------------
// task #9 — /upload 단계 B (인증완료) 마크업 회귀
// -----------------------------------------------------------------------------

describe('UploadPage.vue — 단계 B 인증완료 (task #9)', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
  });

  /**
   * 단계 B 진입까지 일관된 helper. 응답 mock 받아서 mount→submit→advance→authenticated 까지.
   *
   * 주의: `mockResolvedValue` 만 쓰면 store.submit 안의 `this.lastResult = data` 가 실행되지
   * 않아 컴포넌트의 completionStamp / completionReward / completionPlaceName 이 stamp/reward
   * 분기를 못 받는다. `mockImplementation` 으로 lastResult 까지 직접 세팅해서 실 흐름을 흉내.
   */
  async function reachAuthenticatedStage(
    response: PhotoResponse,
    overrides: Parameters<typeof mountUpload>[0] = {},
  ) {
    const { wrapper } = mountUpload(overrides);
    await flushPromises();
    const store = useUploadStore();
    vi.spyOn(store, 'submit').mockImplementation(async () => {
      store.lastResult = response;
      return response;
    });

    await wrapper.find('button.post').trigger('click');
    await flushPromises();
    // STAGE_BEAT_MS(700) + EXTRAS_REVEAL_DELAY_MS(500) + 버퍼.
    // authenticated 진입 후 stamp-card/rewards 가 fade-up 으로 들어올 때까지 기다림.
    await vi.advanceTimersByTimeAsync(1400);
    await flushPromises();
    return wrapper;
  }

  function baseResponse(overrides: Partial<PhotoResponse> = {}): PhotoResponse {
    return {
      id: 99,
      imageUrl: 'https://cdn/p/99.jpg',
      placeId: 10,
      contentId: 1,
      contentTitle: '도깨비',
      contentEpisode: '1회',
      caption: null,
      tags: [],
      visibility: 'PUBLIC',
      createdAt: '2026-04-22T00:00:00Z',
      images: [{ id: 99, imageUrl: 'https://cdn/p/99.jpg', imageOrderIndex: 0 }],
      totalScore: 84,
      similarityScore: 82,
      gpsScore: 86,
      ...overrides,
    };
  }

  it('U5: stamp-card 노출 + contentTitle/collectedCount/totalCount/percent 텍스트 매핑', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = await reachAuthenticatedStage(baseResponse({
        stamp: {
          placeName: '주문진 영진해변 방파제',
          contentId: 1,
          contentTitle: '도깨비',
          collectedCount: 12,
          totalCount: 24,
          percent: 50,
        },
      }));

      // task #10 후 testid 셀렉터 사용 — class 보다 회귀 안정적
      const stampCard = wrapper.find('[data-testid="completion-stamp-card"]');
      expect(stampCard.exists()).toBe(true);
      expect(stampCard.find('.stamp-info .t').text()).toBe('도깨비 스탬프북');
      expect(stampCard.find('.stamp-info .s').text()).toBe('12 / 24 성지 수집');
      expect(stampCard.find('.p-v').text()).toBe('50%');
      expect(stampCard.find('.fill').attributes('style')).toContain('width: 50%');
    } finally {
      vi.useRealTimers();
    }
  });

  it('U6: rewards 카드 4종 — score / pointsEarned / streakDays / level 텍스트', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = await reachAuthenticatedStage(baseResponse({
        reward: {
          pointsEarned: 50,
          currentPoints: 350,
          streakDays: 7,
          level: 3,
          previousLevel: 3,
          levelName: '성실 순례자',
          newBadges: [],
          newTrophyTier: null,
          newTrophyContentTitle: null,
          newTrophyContentPosterUrl: null,
        },
      }));

      const rewardsContainer = wrapper.find('[data-testid="completion-rewards"]');
      expect(rewardsContainer.exists()).toBe(true);
      const rewards = rewardsContainer.findAll('.reward');
      expect(rewards).toHaveLength(4);
      expect(rewards[0].find('.n').text()).toBe('84점');
      expect(rewards[1].find('.n').text()).toBe('+50');
      expect(rewards[2].find('.n').text()).toBe('7일');
      expect(rewards[3].find('.n').text()).toBe('LV.3');
      expect(rewards[3].find('.l').text()).toBe('성실 순례자');
    } finally {
      vi.useRealTimers();
    }
  });

  it('U7: nextMilestoneCount 분기 — 미수집 남았으면 노출, 완주(=)면 미렌더', async () => {
    vi.useFakeTimers();
    try {
      // collected < total → "다음 12곳 모으면..." 노출
      let wrapper = await reachAuthenticatedStage(baseResponse({
        stamp: {
          placeName: '주문진 영진해변 방파제',
          contentId: 1,
          contentTitle: '도깨비',
          collectedCount: 12,
          totalCount: 24,
          percent: 50,
        },
      }));
      expect(wrapper.find('.next-milestone').exists()).toBe(true);
      expect(wrapper.find('.next-milestone').text()).toContain('12곳');

      // collected == total → 미렌더 (회귀)
      wrapper = await reachAuthenticatedStage(baseResponse({
        stamp: {
          placeName: '주문진 영진해변 방파제',
          contentId: 1,
          contentTitle: '도깨비',
          collectedCount: 24,
          totalCount: 24,
          percent: 100,
        },
      }));
      expect(wrapper.find('.next-milestone').exists()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('U8: completionPlaceName fallback — stamp.placeName 우선, 없으면 targetPlace.placeName', async () => {
    vi.useFakeTimers();
    try {
      // 1) 응답에 stamp.placeName 있으면 그게 우선 (target 과 다른 값으로 검증)
      let wrapper = await reachAuthenticatedStage(baseResponse({
        stamp: {
          placeName: '응답 우선 이름',
          contentId: 1, contentTitle: '도깨비',
          collectedCount: 1, totalCount: 24, percent: 4,
        },
      }));
      expect(wrapper.find('[data-testid="completion-place-name"]').text())
        .toContain("'응답 우선 이름'");

      // 2) 응답에 stamp 없음 → targetPlace.placeName fallback
      wrapper = await reachAuthenticatedStage(baseResponse({}));  // stamp undefined
      expect(wrapper.find('[data-testid="completion-place-name"]').text())
        .toContain("'주문진 영진해변 방파제'");  // mountUpload 의 기본 target

      // 참고: targetPlace=null 상태에서 단계 B 도달은 정상 흐름 아님 (button.post 가 disabled
      // 처리되어 단계 전환 트리거 자체가 막힘). 따라서 '성지' literal fallback 은 unit
      // 레벨에서 컴포넌트로 검증하지 않고 computed 정의 자체로 신뢰.
    } finally {
      vi.useRealTimers();
    }
  });

  it('U9: placeName XSS escape 회귀 — `<script>` 가 raw HTML 로 주입되지 않음', async () => {
    vi.useFakeTimers();
    try {
      const malicious = '<script>alert(1)</script>';
      const wrapper = await reachAuthenticatedStage(baseResponse({
        stamp: {
          placeName: malicious,
          contentId: 1, contentTitle: '도깨비',
          collectedCount: 1, totalCount: 24, percent: 4,
        },
      }));
      const sub = wrapper.find('[data-testid="completion-place-name"]');
      // text 는 그대로(escape 후 원문) 노출
      expect(sub.text()).toContain(malicious);
      // innerHTML 안에 raw <script> 노드가 없어야 함 (Vue 가 entity 로 escape)
      const html = sub.html();
      expect(html).not.toMatch(/<script\b/i);
      expect(html).toContain('&lt;script');
    } finally {
      vi.useRealTimers();
    }
  });

  it('U10: 친구에게 자랑하기 CTA 클릭 → ShareSheet 가 인증 카드 데이터로 열린다', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = await reachAuthenticatedStage(baseResponse({
        stamp: {
          placeName: '주문진 영진해변 방파제',
          contentId: 1,
          contentTitle: '도깨비',
          collectedCount: 1,
          totalCount: 8,
          percent: 12,
        },
      }));
      const uiStore = useUiStore();
      const boastBtn = wrapper.find('[data-testid="upload-boast"]');
      expect(boastBtn.exists()).toBe(true);
      await boastBtn.trigger('click');
      await flushPromises();
      expect(uiStore.shareSheetOpen).toBe(true);
      expect(uiStore.shareData).toMatchObject({
        title: '도깨비 · 주문진 영진해변 방파제 인증 완료!',
        description: '필름로드에서 도깨비 성지를 다녀왔어요',
        imageUrl: 'https://cdn/p/99.jpg',
        url: expect.stringMatching(/\/shot\/99$/),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('U11: stage B 마크업 — h1 "인증 완료!" + check-ring + ion-icon stub 노출 (디자인 회귀)', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = await reachAuthenticatedStage(baseResponse({}));
      expect(wrapper.find('h1.rw-title').text()).toBe('인증 완료!');
      expect(wrapper.find('.check-ring').exists()).toBe(true);
      // stage B 단독 노출 — scoring 영역은 사라짐
      expect(wrapper.find('[data-testid="upload-stage-scoring"]').exists()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  // 정책 — stamp/rewards 는 인증완료 헤더가 자리 잡은 뒤(EXTRAS_REVEAL_DELAY_MS)
  // fade-up 으로 따라 들어온다. scoring 단계에서는 미노출.
  // showCompletionExtras = (stage==='authenticated') && extrasVisible

  it('U12: scoring 단계 — 응답이 도착해도 stamp-card / rewards 는 미노출', async () => {
    vi.useFakeTimers();
    try {
      const { wrapper } = mountUpload();
      await flushPromises();
      const store = useUploadStore();

      const fakeRes: PhotoResponse = baseResponse({
        stamp: {
          placeName: '주문진 영진해변 방파제',
          contentId: 1, contentTitle: '도깨비',
          collectedCount: 12, totalCount: 24, percent: 50,
        },
        reward: {
          pointsEarned: 50, currentPoints: 350, streakDays: 7,
          level: 3, previousLevel: 3, levelName: '성실 순례자', newBadges: [],
          newTrophyTier: null, newTrophyContentTitle: null, newTrophyContentPosterUrl: null,
        },
      });
      vi.spyOn(store, 'submit').mockImplementation(async () => {
        store.lastResult = fakeRes;
        return fakeRes;
      });

      await wrapper.find('button.post').trigger('click');
      await flushPromises();
      // 700ms beat 전 — 아직 stage='scoring' (아직 advanceTimers 안 함).

      expect(wrapper.find('[data-testid="upload-stage-scoring"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="upload-stage-authenticated"]').exists()).toBe(false);

      // 정책 변경 — scoring 단계에서는 stamp/rewards 모두 미노출.
      expect(wrapper.find('[data-testid="completion-stamp-card"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="completion-rewards"]').exists()).toBe(false);

      // 액션 버튼 / placeName 문장은 단계 B 전용 → 아직 미노출.
      expect(wrapper.find('[data-testid="upload-go-home"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="upload-boast"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="completion-place-name"]').exists()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('U13: scoring 단계 + 응답에 stamp/reward 없음 → stamp-card / rewards 미노출 (응답 분기 회귀)', async () => {
    vi.useFakeTimers();
    try {
      const { wrapper } = mountUpload();
      await flushPromises();
      const store = useUploadStore();

      // stamp/reward 없는 응답
      const fakeRes = baseResponse({});
      vi.spyOn(store, 'submit').mockImplementation(async () => {
        store.lastResult = fakeRes;
        return fakeRes;
      });

      await wrapper.find('button.post').trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="upload-stage-scoring"]').exists()).toBe(true);
      // showCompletionExtras 는 true 지만 v-if 의 completionStamp/completionReward 가 null
      expect(wrapper.find('[data-testid="completion-stamp-card"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="completion-rewards"]').exists()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
