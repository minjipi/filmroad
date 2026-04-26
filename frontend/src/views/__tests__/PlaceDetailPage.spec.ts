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
  overrides: { coverImageUrls?: string[] } = {},
) {
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
    },
    stubs: {
      'ion-router-outlet': true,
    },
  });

  return { wrapper, store: usePlaceDetailStore() };
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

    const imgs = wrapper.findAll('[data-testid="pd-hero-carousel"] img.hero-img');
    expect(imgs.length).toBe(3);
    expect(imgs.map((i) => i.attributes('src'))).toEqual([
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

  it('updates the active dot when the carousel scrolls to the next slide', async () => {
    const { wrapper } = mountPlaceDetailPage({
      coverImageUrls: [
        'https://img/cover-0.jpg',
        'https://img/cover-1.jpg',
        'https://img/cover-2.jpg',
      ],
    });
    await flushPromises();

    const carouselEl = wrapper.find('[data-testid="pd-hero-carousel"]')
      .element as HTMLElement;
    // jsdom doesn't lay things out — fake the dimensions used by the index calc.
    Object.defineProperty(carouselEl, 'clientWidth', { value: 320, configurable: true });
    Object.defineProperty(carouselEl, 'scrollLeft', { value: 320, configurable: true });
    await wrapper.find('[data-testid="pd-hero-carousel"]').trigger('scroll');
    await flushPromises();

    const dots = wrapper.findAll('[data-testid="pd-hero-dots"] .hero-dot');
    expect(dots[0].classes()).not.toContain('active');
    expect(dots[1].classes()).toContain('active');
    expect(wrapper.find('[data-testid="pd-hero-counter"]').text()).toContain(
      '2 / 3',
    );
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
});
