import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: null }) },
}));

const { pushSpy, backSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, back: backSpy }),
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

import PlaceDetailPage from '@/views/PlaceDetailPage.vue';
import {
  usePlaceDetailStore,
  type PlaceDetailResponse,
} from '@/stores/placeDetail';
import { useSavedStore } from '@/stores/saved';
import type { PlaceKakaoInfoResponse } from '@/stores/kakaoInfo';
import { mountWithStubs } from './__helpers__/mount';

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

function mountPlaceDetailPage(
  overrides: {
    coverImageUrls?: string[];
    kakaoInfo?: PlaceKakaoInfoResponse | null;
  } = {},
) {
  // kakaoInfo override 가 들어오면 placeId 키로 prefill — store 의 fetch 가
  // 캐시 hit 으로 즉시 return 하니 mock api 없이도 렌더 시점에 값이 보인다.
  const kakaoInfoState = overrides.kakaoInfo
    ? { infoByPlace: { [fixture.place.id]: overrides.kakaoInfo } }
    : { infoByPlace: {} };

  const { wrapper } = mountWithStubs(PlaceDetailPage, {
    props: { id: fixture.place.id },
    initialState: {
      placeDetail: {
        place: {
          ...fixture.place,
          ...(overrides.coverImageUrls
            ? { coverImageUrls: overrides.coverImageUrls }
            : {}),
        },
        photos: [...fixture.photos],
        related: [...fixture.related],
        loading: false,
        error: null,
        likedIds: [],
      },
      // map store is referenced by onCapture but not exercised in render.
      map: {
        markers: [],
        selected: null,
        loading: false,
        error: null,
        filter: 'SPOTS',
        workId: null,
        q: '',
        center: { lat: 37.5, lng: 127.0 },
        visitedIds: [],
      },
      kakaoInfo: kakaoInfoState,
    },
    stubs: {
      'ion-router-outlet': true,
    },
  });

  return { wrapper, store: usePlaceDetailStore() };
}

function makeKakaoInfo(
  overrides: Partial<PlaceKakaoInfoResponse> = {},
): PlaceKakaoInfoResponse {
  return {
    roadAddress: '강원 강릉시 주문진읍 해안로 1737',
    jibunAddress: '강원 강릉시 주문진읍 교항리 산51-2',
    phone: '033-662-3639',
    category: '여행 > 관광지 > 명소',
    kakaoPlaceUrl: 'https://place.map.kakao.com/12345',
    lastSyncedAt: '2026-04-26T00:00:00Z',
    nearby: [],
    available: true,
    ...overrides,
  };
}

describe('PlaceDetailPage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
  });

  it('renders hero name, work chips and regionLabel', async () => {
    const { wrapper } = mountPlaceDetailPage();
    await flushPromises();

    const hero = wrapper.find('.hero');
    expect(hero.exists()).toBe(true);
    expect(hero.find('h1').text()).toBe(fixture.place.name);
    expect(hero.find('.loc').text()).toContain(fixture.place.regionLabel);

    const chipText = hero.find('.hero-chips').text();
    expect(chipText).toContain(fixture.place.workTitle);
    // workEpisode + sceneTimestamp combine into the second chip.
    expect(chipText).toContain('1회');
    expect(chipText).toContain('00:24:10');
  });

  it('renders all cover images inside the hero carousel and hides dot/counter overlays for a single-cover place', async () => {
    const { wrapper } = mountPlaceDetailPage();
    await flushPromises();

    const carousel = wrapper.find('[data-testid="pd-hero-carousel"]');
    expect(carousel.exists()).toBe(true);
    // fixture has exactly one cover URL — dots and counter must stay hidden so
    // a single-image place keeps the original visual.
    expect(carousel.findAll('img.hero-img').length).toBe(1);
    expect(wrapper.find('[data-testid="pd-hero-dots"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="pd-hero-counter"]').exists()).toBe(false);
  });

  it('renders one .hero-img + one .hero-dot per cover URL, marks dot 0 active, and shows "1 / N" counter when length > 1', async () => {
    const { wrapper } = mountPlaceDetailPage({
      coverImageUrls: [
        'https://img/cover-0.jpg',
        'https://img/cover-1.jpg',
        'https://img/cover-2.jpg',
      ],
    });
    await flushPromises();

    // Track 안에는 진짜 슬라이드 3장 + 양 끝 clone 2장(aria-hidden) = 5장.
    // clone 은 forward / backward wrap 시 transition 이 진행 방향으로 이어지도록
    // 두는 자리표지일 뿐 사용자 시각상으론 무한 회전.
    const imgs = wrapper.findAll('[data-testid="pd-hero-carousel"] img.hero-img');
    expect(imgs.length).toBe(5);
    const realImgs = wrapper.findAll(
      '[data-testid="pd-hero-carousel"] img.hero-img:not([aria-hidden="true"])',
    );
    expect(realImgs.length).toBe(3);
    expect(realImgs.map((i) => i.attributes('src'))).toEqual([
      'https://img/cover-0.jpg',
      'https://img/cover-1.jpg',
      'https://img/cover-2.jpg',
    ]);

    const dots = wrapper.findAll('[data-testid="pd-hero-dots"] .hero-dot');
    expect(dots.length).toBe(3);
    // First dot active on initial render — scroll position is 0.
    expect(dots[0].classes()).toContain('active');
    expect(dots[1].classes()).not.toContain('active');

    expect(wrapper.find('[data-testid="pd-hero-counter"]').text()).toContain(
      '1 / 3',
    );
  });

  it('auto-advances the hero carousel every 4s on a multi-cover place and wraps after the last slide', async () => {
    vi.useFakeTimers();
    try {
      const { wrapper } = mountPlaceDetailPage({
        coverImageUrls: [
          'https://img/cover-0.jpg',
          'https://img/cover-1.jpg',
          'https://img/cover-2.jpg',
        ],
      });
      await flushPromises();

      const dotsAt = (): string[] =>
        wrapper
          .findAll('[data-testid="pd-hero-dots"] .hero-dot')
          .map((d) => (d.classes().includes('active') ? 'on' : 'off'));

      // initial — slide 0 active
      expect(dotsAt()).toEqual(['on', 'off', 'off']);

      // tick 4s → slide 1
      vi.advanceTimersByTime(4000);
      await flushPromises();
      expect(dotsAt()).toEqual(['off', 'on', 'off']);

      // tick 4s → slide 2
      vi.advanceTimersByTime(4000);
      await flushPromises();
      expect(dotsAt()).toEqual(['off', 'off', 'on']);

      // tick 4s → wrap to slide 0
      vi.advanceTimersByTime(4000);
      await flushPromises();
      expect(dotsAt()).toEqual(['on', 'off', 'off']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not start the auto-advance timer for a single-cover place', async () => {
    vi.useFakeTimers();
    try {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      mountPlaceDetailPage();
      await flushPromises();

      // fixture has length=1; the auto-advance branch must short-circuit before
      // setInterval is ever called.
      expect(setIntervalSpy).not.toHaveBeenCalled();
      setIntervalSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the auto-advance interval on unmount (no leak after navigating away)', async () => {
    vi.useFakeTimers();
    try {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const { wrapper } = mountPlaceDetailPage({
        coverImageUrls: ['https://img/a.jpg', 'https://img/b.jpg'],
      });
      await flushPromises();

      wrapper.unmount();
      // unmount 시점에 stopHeroAutoAdvance 가 호출되어야 한다 — 한 번이라도
      // 정리되었는지만 확인 (다른 라이프사이클이 호출했어도 상관없음).
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it('mouse drag past the threshold also advances the slide (desktop drag, not just touch swipe)', async () => {
    const { wrapper } = mountPlaceDetailPage({
      coverImageUrls: [
        'https://img/cover-0.jpg',
        'https://img/cover-1.jpg',
        'https://img/cover-2.jpg',
      ],
    });
    await flushPromises();

    const carousel = wrapper.find('[data-testid="pd-hero-carousel"]');
    const carouselEl = carousel.element as HTMLElement;
    Object.defineProperty(carouselEl, 'clientWidth', { value: 320, configurable: true });
    // setPointerCapture 가 환경(jsdom)에 없을 수도 있으니 spy 로 박아 호출 자체는
    // 검증 — 마우스가 영역 밖으로 빠져도 드래그가 유지되는 게 핵심.
    const captureSpy = vi.fn();
    (carouselEl as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = captureSpy;

    await carousel.trigger('pointerdown', {
      pointerId: 99,
      pointerType: 'mouse',
      clientX: 200,
      clientY: 100,
    });
    expect(captureSpy).toHaveBeenCalledWith(99);

    await carousel.trigger('pointermove', {
      pointerId: 99,
      pointerType: 'mouse',
      clientX: 80,
      clientY: 100,
    });
    await carousel.trigger('pointerup', {
      pointerId: 99,
      pointerType: 'mouse',
      clientX: 80,
      clientY: 100,
    });
    await flushPromises();

    const dots = wrapper.findAll('[data-testid="pd-hero-dots"] .hero-dot');
    expect(dots[1].classes()).toContain('active');
  });

  it('horizontal swipe past the threshold (15% of width) advances to the next slide', async () => {
    const { wrapper } = mountPlaceDetailPage({
      coverImageUrls: [
        'https://img/cover-0.jpg',
        'https://img/cover-1.jpg',
        'https://img/cover-2.jpg',
      ],
    });
    await flushPromises();

    const carousel = wrapper.find('[data-testid="pd-hero-carousel"]');
    const carouselEl = carousel.element as HTMLElement;
    // jsdom 은 layout 을 안 해서 clientWidth=0. swipe 임계값(15%)을 계산하려면
    // width 가 필요하니 stub.
    Object.defineProperty(carouselEl, 'clientWidth', { value: 320, configurable: true });

    // pointerdown @ x=200, pointermove @ x=120 (왼쪽으로 80px → next slide 임계값
    // 320 * 0.15 = 48 초과). 그리고 pointerup.
    await carousel.trigger('pointerdown', { pointerId: 1, clientX: 200, clientY: 100 });
    await carousel.trigger('pointermove', { pointerId: 1, clientX: 120, clientY: 100 });
    await carousel.trigger('pointerup', { pointerId: 1, clientX: 120, clientY: 100 });
    await flushPromises();

    const dots = wrapper.findAll('[data-testid="pd-hero-dots"] .hero-dot');
    expect(dots[0].classes()).not.toContain('active');
    expect(dots[1].classes()).toContain('active');
    expect(wrapper.find('[data-testid="pd-hero-counter"]').text()).toContain('2 / 3');
  });

  it('vertical pointer move (page-scroll intent) does not change the carousel slide', async () => {
    const { wrapper } = mountPlaceDetailPage({
      coverImageUrls: ['https://img/a.jpg', 'https://img/b.jpg'],
    });
    await flushPromises();

    const carousel = wrapper.find('[data-testid="pd-hero-carousel"]');
    Object.defineProperty(carousel.element, 'clientWidth', { value: 320, configurable: true });

    // dy >> dx — axis lock decides "y", carousel ignores the gesture.
    await carousel.trigger('pointerdown', { pointerId: 1, clientX: 200, clientY: 100 });
    await carousel.trigger('pointermove', { pointerId: 1, clientX: 195, clientY: 250 });
    await carousel.trigger('pointerup', { pointerId: 1, clientX: 195, clientY: 250 });
    await flushPromises();

    const dots = wrapper.findAll('[data-testid="pd-hero-dots"] .hero-dot');
    expect(dots[0].classes()).toContain('active');
  });

  it('a small horizontal pointer move under the threshold snaps back without changing slide', async () => {
    const { wrapper } = mountPlaceDetailPage({
      coverImageUrls: ['https://img/a.jpg', 'https://img/b.jpg', 'https://img/c.jpg'],
    });
    await flushPromises();

    const carousel = wrapper.find('[data-testid="pd-hero-carousel"]');
    Object.defineProperty(carousel.element, 'clientWidth', { value: 320, configurable: true });

    // dx = -20 (under 15% × 320 = 48) → no commit, slide stays at 0.
    await carousel.trigger('pointerdown', { pointerId: 1, clientX: 200, clientY: 100 });
    await carousel.trigger('pointermove', { pointerId: 1, clientX: 180, clientY: 100 });
    await carousel.trigger('pointerup', { pointerId: 1, clientX: 180, clientY: 100 });
    await flushPromises();

    const dots = wrapper.findAll('[data-testid="pd-hero-dots"] .hero-dot');
    expect(dots[0].classes()).toContain('active');
    expect(dots[1].classes()).not.toContain('active');
  });

  it('shows prev/next arrows for a multi-cover place and hides them for a single-cover one', async () => {
    const single = mountPlaceDetailPage();
    await flushPromises();
    expect(single.wrapper.find('[data-testid="pd-hero-prev"]').exists()).toBe(false);
    expect(single.wrapper.find('[data-testid="pd-hero-next"]').exists()).toBe(false);
    single.wrapper.unmount();

    const multi = mountPlaceDetailPage({
      coverImageUrls: ['https://img/a.jpg', 'https://img/b.jpg', 'https://img/c.jpg'],
    });
    await flushPromises();
    expect(multi.wrapper.find('[data-testid="pd-hero-prev"]').exists()).toBe(true);
    expect(multi.wrapper.find('[data-testid="pd-hero-next"]').exists()).toBe(true);
  });

  it('forward wrap on next: track transitions into the appended clone (rightward) before snapping to real index 0', async () => {
    const { wrapper } = mountPlaceDetailPage({
      coverImageUrls: ['https://img/a.jpg', 'https://img/b.jpg', 'https://img/c.jpg'],
    });
    await flushPromises();

    const nextBtn = wrapper.find('[data-testid="pd-hero-next"]');
    const trackEl = (): HTMLElement =>
      wrapper.find('[data-testid="pd-hero-carousel"] .hero-track').element as HTMLElement;
    const transformOf = (): string => trackEl().style.transform;

    // 0 → 1 → 2 (마지막 진짜 슬라이드).
    await nextBtn.trigger('click');
    await nextBtn.trigger('click');
    expect(transformOf()).toContain('-300%'); // -(2 + 1) * 100% = -300%

    // 2 → forward wrap. transition 은 clone-of-first(visible position 4)
    // 자리로 흘러 -400% 까지 간다. transitionend 가 발동하기 전엔 이 위치 그대로.
    await nextBtn.trigger('click');
    expect(transformOf()).toContain('-400%'); // 오른쪽으로 한 칸 더 — 사용자 시점엔 0 으로 자연스럽게 흐름

    // counter / dot 은 이미 realHeroSlide 기준이라 사용자 perspective 의 첫 슬라이드.
    expect(wrapper.find('[data-testid="pd-hero-counter"]').text()).toContain('1 / 3');
    const dots = wrapper.findAll('[data-testid="pd-hero-dots"] .hero-dot');
    expect(dots[0].classes()).toContain('active');
  });

  it('backward wrap on prev: track transitions into the prepended clone (leftward) before snapping to real index N-1', async () => {
    const { wrapper } = mountPlaceDetailPage({
      coverImageUrls: ['https://img/a.jpg', 'https://img/b.jpg', 'https://img/c.jpg'],
    });
    await flushPromises();

    const prevBtn = wrapper.find('[data-testid="pd-hero-prev"]');
    const trackEl = (): HTMLElement =>
      wrapper.find('[data-testid="pd-hero-carousel"] .hero-track').element as HTMLElement;

    // 0 에서 prev → -1 (= clone-of-last 자리, visible position 0).
    // transform = -(−1 + 1) * 100% = 0%. 진짜 슬라이드 0 자리(-100%) 에서 0% 으로
    // 왼쪽으로 흐른다 — 사용자 시점에선 마지막 슬라이드로 자연스럽게 이동.
    await prevBtn.trigger('click');
    expect(trackEl().style.transform).toContain('translate3d(0%');

    // counter / dot 은 realHeroSlide → ((-1 % 3) + 3) % 3 = 2.
    expect(wrapper.find('[data-testid="pd-hero-counter"]').text()).toContain('3 / 3');
    const dots = wrapper.findAll('[data-testid="pd-hero-dots"] .hero-dot');
    expect(dots[2].classes()).toContain('active');
  });

  it('next button advances to the following slide and wraps from the last back to the first', async () => {
    const { wrapper } = mountPlaceDetailPage({
      coverImageUrls: ['https://img/a.jpg', 'https://img/b.jpg', 'https://img/c.jpg'],
    });
    await flushPromises();

    const nextBtn = wrapper.find('[data-testid="pd-hero-next"]');
    const dotsActive = (): number =>
      wrapper
        .findAll('[data-testid="pd-hero-dots"] .hero-dot')
        .findIndex((d) => d.classes().includes('active'));

    expect(dotsActive()).toBe(0);
    await nextBtn.trigger('click');
    expect(dotsActive()).toBe(1);
    await nextBtn.trigger('click');
    expect(dotsActive()).toBe(2);
    // wrap last → first
    await nextBtn.trigger('click');
    expect(dotsActive()).toBe(0);
  });

  it('prev button moves backward and wraps from the first back to the last', async () => {
    const { wrapper } = mountPlaceDetailPage({
      coverImageUrls: ['https://img/a.jpg', 'https://img/b.jpg', 'https://img/c.jpg'],
    });
    await flushPromises();

    const prevBtn = wrapper.find('[data-testid="pd-hero-prev"]');
    const dotsActive = (): number =>
      wrapper
        .findAll('[data-testid="pd-hero-dots"] .hero-dot')
        .findIndex((d) => d.classes().includes('active'));

    // From slide 0 prev wraps back to the last (length-1 = 2).
    expect(dotsActive()).toBe(0);
    await prevBtn.trigger('click');
    expect(dotsActive()).toBe(2);
    await prevBtn.trigger('click');
    expect(dotsActive()).toBe(1);
  });

  it('clicking next resets the auto-advance timer so the freshly chosen slide gets a full window', async () => {
    vi.useFakeTimers();
    try {
      const { wrapper } = mountPlaceDetailPage({
        coverImageUrls: ['https://img/a.jpg', 'https://img/b.jpg', 'https://img/c.jpg'],
      });
      await flushPromises();

      const dotsActive = (): number =>
        wrapper
          .findAll('[data-testid="pd-hero-dots"] .hero-dot')
          .findIndex((d) => d.classes().includes('active'));

      // 3s into the auto-advance window → still on slide 0.
      vi.advanceTimersByTime(3000);
      await flushPromises();
      expect(dotsActive()).toBe(0);

      // User clicks next → jumps to slide 1, timer resets.
      await wrapper.find('[data-testid="pd-hero-next"]').trigger('click');
      expect(dotsActive()).toBe(1);

      // 3s after the click — still on slide 1 (auto-advance hasn't re-fired
      // because the timer was reset). If reset weren't happening the next
      // tick at the carry-over 1s mark would have already moved us to 2.
      vi.advanceTimersByTime(3000);
      await flushPromises();
      expect(dotsActive()).toBe(1);

      // 1s more → 4s since the click → auto-advance fires, slide 2.
      vi.advanceTimersByTime(1000);
      await flushPromises();
      expect(dotsActive()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders gallery cells = photos.length + (photoCount > photos.length ? 1 : 0)', async () => {
    const { wrapper } = mountPlaceDetailPage();
    await flushPromises();

    // photoCount=1204, photos.length=3 → cap is 6, remaining > 0
    // implementation: photos.slice(0, 5) + 1 "more" cell = 3 + 1 = 4.
    const cells = wrapper.findAll('.gallery .cell');
    const expected =
      fixture.photos.length +
      (fixture.place.photoCount > fixture.photos.length ? 1 : 0);
    expect(cells.length).toBe(expected);
    expect(wrapper.findAll('.gallery .cell.more').length).toBe(1);
  });

  it('renders one .rel-card per related place', async () => {
    const { wrapper } = mountPlaceDetailPage();
    await flushPromises();

    const cards = wrapper.findAll('.rel-card');
    expect(cards.length).toBe(fixture.related.length);
    expect(cards[0].find('.t').text()).toBe(fixture.related[0].name);
  });

  it('like button invokes toggleLike; bookmark on unsaved place opens the collection picker (task #29)', async () => {
    const { useUiStore } = await import('@/stores/ui');
    const { wrapper, store } = mountPlaceDetailPage();
    await flushPromises();

    const likeSpy = vi.spyOn(store, 'toggleLike').mockResolvedValue();
    const saved = useSavedStore();
    const ui = useUiStore();
    const saveSpy = vi.spyOn(saved, 'toggleSave').mockResolvedValue();
    const pickerSpy = vi.spyOn(ui, 'openCollectionPicker');

    await wrapper.find('.act.like').trigger('click');
    expect(likeSpy).toHaveBeenCalledTimes(1);

    // .act without .like = bookmark/save button.
    const bookmarkBtn = wrapper.findAll('.act').find((b) => !b.classes('like'));
    expect(bookmarkBtn).toBeDefined();
    await bookmarkBtn!.trigger('click');
    // Unsaved place → picker opens, toggleSave not called directly.
    expect(pickerSpy).toHaveBeenCalledWith(fixture.place.id);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('bookmark on already-saved place unsaves directly — picker skipped', async () => {
    const { useUiStore } = await import('@/stores/ui');
    const { wrapper } = mountPlaceDetailPage();
    await flushPromises();
    const saved = useSavedStore();
    const ui = useUiStore();
    saved.savedPlaceIds = [fixture.place.id];
    await flushPromises();

    const saveSpy = vi.spyOn(saved, 'toggleSave').mockResolvedValue();
    const pickerSpy = vi.spyOn(ui, 'openCollectionPicker');

    const bookmarkBtn = wrapper.findAll('.act').find((b) => !b.classes('like'));
    await bookmarkBtn!.trigger('click');
    expect(saveSpy).toHaveBeenCalledWith(fixture.place.id);
    expect(pickerSpy).not.toHaveBeenCalled();
  });

  it('"지도 보기" pushes /map with selectedId/lat/lng query', async () => {
    const { wrapper } = mountPlaceDetailPage();
    await flushPromises();
    pushSpy.mockClear();

    const ghostBtn = wrapper.findAll('.fr-btn').find((b) => b.classes('ghost'));
    expect(ghostBtn).toBeDefined();
    await ghostBtn!.trigger('click');
    await flushPromises();

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/map',
      query: {
        selectedId: String(fixture.place.id),
        lat: String(fixture.place.latitude),
        lng: String(fixture.place.longitude),
      },
    });
  });

  // ----- 카카오맵 정보 섹션 (task: feat/place-kakao-info) -----

  it('hides the kakao section entirely when kakaoInfo is missing or available=false', async () => {
    // case 1: 응답이 아예 없음 (fetch 전 / 실패)
    const noInfo = mountPlaceDetailPage();
    await flushPromises();
    expect(noInfo.wrapper.find('[data-testid="pd-kakao-section"]').exists()).toBe(
      false,
    );
    noInfo.wrapper.unmount();

    // case 2: available=false (미매핑 place 또는 dev 환경 placeholder)
    const unavailable = mountPlaceDetailPage({
      kakaoInfo: makeKakaoInfo({
        available: false,
        roadAddress: null,
        jibunAddress: null,
        phone: null,
        category: null,
        kakaoPlaceUrl: null,
        lastSyncedAt: null,
      }),
    });
    await flushPromises();
    expect(
      unavailable.wrapper.find('[data-testid="pd-kakao-section"]').exists(),
    ).toBe(false);
  });

  it('renders address, phone and the kakao-map CTA when kakaoInfo is available', async () => {
    const info = makeKakaoInfo();
    const { wrapper } = mountPlaceDetailPage({ kakaoInfo: info });
    await flushPromises();

    const section = wrapper.find('[data-testid="pd-kakao-section"]');
    expect(section.exists()).toBe(true);

    const text = section.text();
    // 도로명주소가 메인, 지번은 sub 라인.
    expect(text).toContain(info.roadAddress!);
    expect(text).toContain(info.jibunAddress!);
    expect(text).toContain(info.phone!);
    expect(text).toContain(info.category!);
    // 4개 CTA: 길찾기 / 저장 / 공유 / 카카오맵
    const actions = section.findAll('.k-act-btn');
    expect(actions.length).toBe(4);
    expect(actions.map((a) => a.text())).toEqual([
      '길찾기',
      '저장',
      '공유',
      '카카오맵',
    ]);
    // 카카오맵 링크는 응답의 kakaoPlaceUrl 그대로 사용.
    const kakaoCta = section
      .findAll('a.k-act-btn')
      .find((a) => a.attributes('href') === info.kakaoPlaceUrl);
    expect(kakaoCta).toBeDefined();
  });

  it('hides .k-nearby header when nearby is empty and renders one card per nearby item otherwise', async () => {
    const empty = mountPlaceDetailPage({
      kakaoInfo: makeKakaoInfo({ nearby: [] }),
    });
    await flushPromises();
    expect(empty.wrapper.find('[data-testid="pd-kakao-section"] .k-nearby').exists()).toBe(
      false,
    );
    empty.wrapper.unmount();

    const withNearby = mountPlaceDetailPage({
      kakaoInfo: makeKakaoInfo({
        nearby: [
          {
            name: '주문진 활어회센터',
            categoryGroupCode: 'FD6',
            categoryName: '음식점 > 한식 > 해물,생선',
            distanceMeters: 240,
            kakaoPlaceUrl: 'https://place.map.kakao.com/aaa',
            lat: 37.89,
            lng: 128.83,
            phone: null,
          },
          {
            name: '영진해변 카페',
            categoryGroupCode: 'CE7',
            categoryName: '카페',
            distanceMeters: 80,
            kakaoPlaceUrl: 'https://place.map.kakao.com/bbb',
            lat: 37.892,
            lng: 128.834,
            phone: null,
          },
        ],
      }),
    });
    await flushPromises();
    const section = withNearby.wrapper.find('[data-testid="pd-kakao-section"]');
    expect(section.find('.k-nearby').exists()).toBe(true);
    const cards = section.findAll('.k-nearby-card');
    expect(cards.length).toBe(2);
    expect(cards[0].find('.nm').text()).toBe('주문진 활어회센터');
    // 첫 카드: 음식점 240m → 240/80=3분
    expect(cards[0].find('.d').text()).toContain('도보 3분');
    // 두 번째 카드: 80m → 1분 (clamp 안 적용되는 경계)
    expect(cards[1].find('.d').text()).toContain('도보 1분');
  });

  it('clicking the address copy button writes roadAddress to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // jsdom 은 navigator.clipboard 를 안 깔아주므로 직접 stub.
    const originalClipboard = (navigator as unknown as { clipboard?: unknown })
      .clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    try {
      const info = makeKakaoInfo();
      const { wrapper } = mountPlaceDetailPage({ kakaoInfo: info });
      await flushPromises();

      const section = wrapper.find('[data-testid="pd-kakao-section"]');
      // 첫 .k-info-row 가 주소행 — .act 가 button 이므로 직접 클릭.
      const copyBtn = section.find('.k-info-row button.act');
      expect(copyBtn.exists()).toBe(true);
      await copyBtn.trigger('click');
      await flushPromises();

      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith(info.roadAddress);
    } finally {
      // 다른 테스트가 navigator 를 더럽히지 않게 원복.
      if (originalClipboard === undefined) {
        // 원래 없었던 경우 — defineProperty 한 키만 다시 지운다.
        delete (navigator as unknown as { clipboard?: unknown }).clipboard;
      } else {
        Object.defineProperty(navigator, 'clipboard', {
          value: originalClipboard,
          configurable: true,
        });
      }
    }
  });
});
