import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

// Must mock api before HomePage -> home store is evaluated.
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: null }),
    post: vi.fn(),
  },
}));

const { pushSpy, backSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, back: backSpy }),
}));

const { toastCreateSpy } = vi.hoisted(() => ({
  toastCreateSpy: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@ionic/vue', async () => {
  const actual = await vi.importActual<typeof import('@ionic/vue')>('@ionic/vue');
  return { ...actual, toastController: { create: toastCreateSpy } };
});

// useGeolocation 은 모듈 싱글톤이라 테스트마다 상태가 누적되면 flaky 해진다.
// 제어 가능한 refs + spy 로 아예 모듈을 mock out.
const { geoRequestSpy, geoCoordsRef, geoStatusRef } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue');
  return {
    geoRequestSpy: vi.fn(),
    geoCoordsRef: ref(null),
    geoStatusRef: ref('idle'),
  };
});
vi.mock('@/composables/useGeolocation', () => ({
  useGeolocation: () => ({
    coords: geoCoordsRef,
    status: geoStatusRef,
    error: { value: null },
    request: geoRequestSpy,
    reset: () => {
      geoCoordsRef.value = null;
      geoStatusRef.value = 'idle';
    },
  }),
}));

import HomePage from '@/views/HomePage.vue';
import { useHomeStore, type HomeResponse } from '@/stores/home';
import { mountWithStubs } from './__helpers__/mount';

const fixture: HomeResponse = {
  hero: {
    monthLabel: 'APR',
    tag: '주말 추천',
    title: "오늘은 '도깨비'의 주문진을 걸어볼까요?",
    subtitle: '내 위치에서 차로 12분 · 2곳의 성지',
    workId: 1,
    primaryPlaceId: 10,
  },
  works: [
    { id: 1, title: '도깨비' },
    { id: 2, title: '이태원 클라쓰' },
  ],
  places: [
    {
      id: 10,
      name: '주문진 영진해변 방파제',
      regionLabel: '강릉시 주문진읍',
      coverImageUrl: 'https://img/1.jpg',
      workId: 1,
      workTitle: '도깨비',
      liked: false,
      likeCount: 3200,
    },
    {
      id: 11,
      name: '단밤 포차',
      regionLabel: '서울 용산구 이태원동',
      coverImageUrl: 'https://img/2.jpg',
      workId: 2,
      workTitle: '이태원 클라쓰',
      liked: false,
      likeCount: 1800,
    },
    {
      id: 12,
      name: '덕수궁 돌담길',
      regionLabel: '서울 중구 정동',
      coverImageUrl: 'https://img/3.jpg',
      workId: 1,
      workTitle: '도깨비',
      liked: false,
      likeCount: 420,
    },
  ],
};

interface HomeTestOpts {
  popularWorks?: Array<{
    id: number;
    title: string;
    posterUrl?: string | null;
    placeCount: number;
  }>;
  selectedWorkId?: number | null;
  scope?: 'NEAR' | 'TRENDING' | 'POPULAR_WORKS';
}

function mountHomePage(opts: HomeTestOpts = {}) {
  const { wrapper } = mountWithStubs(HomePage, {
    initialState: {
      home: {
        hero: fixture.hero,
        works: fixture.works,
        places: [...fixture.places],
        popularWorks: opts.popularWorks ?? [],
        loading: false,
        error: null,
        selectedWorkId: opts.selectedWorkId ?? null,
        scope: opts.scope ?? 'NEAR',
      },
    },
  });

  return { wrapper, store: useHomeStore() };
}

describe('HomePage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastCreateSpy.mockClear();
    pushSpy.mockClear();
    backSpy.mockClear();
    geoRequestSpy.mockReset();
    geoCoordsRef.value = null;
    geoStatusRef.value = 'idle';
    localStorage.clear();
  });

  afterEach(() => {
    // Teleport("body") 로 document.body 에 추가된 priming 시트는 wrapper 가
    // 언마운트돼도 jsdom 에 그대로 남는다. 다음 테스트가 "시트가 없는 상태"를
    // 전제할 수 있게 수동으로 청소.
    document.body
      .querySelectorAll('.geo-prime-backdrop')
      .forEach((el) => el.remove());
  });

  it('renders the hero title from the store', async () => {
    const { wrapper } = mountHomePage();
    await flushPromises();
    const h1 = wrapper.find('.home-hero h1');
    expect(h1.exists()).toBe(true);
    expect(h1.text()).toContain("오늘은 '도깨비'의");
  });

  it('renders one .photo-card per place', async () => {
    const { wrapper } = mountHomePage();
    await flushPromises();
    const cards = wrapper.findAll('.photo-card');
    expect(cards.length).toBe(fixture.places.length);
  });

  it("dispatches setWork when a work tab is clicked", async () => {
    const { wrapper, store } = mountHomePage();
    await flushPromises();

    const setWorkSpy = vi.spyOn(store, 'setWork');

    // The first .tab is "모두" (null); subsequent tabs map to works by index.
    const tabs = wrapper.findAll('.tab');
    expect(tabs.length).toBe(fixture.works.length + 1);
    await tabs[1].trigger('click'); // works[0] => id 1
    expect(setWorkSpy).toHaveBeenCalledWith(1);
  });

  it('shows an error toast when setWork fails', async () => {
    const { wrapper, store } = mountHomePage();
    await flushPromises();
    toastCreateSpy.mockClear();

    vi.spyOn(store, 'setWork').mockImplementation(async (id: number | null) => {
      store.selectedWorkId = id;
      store.error = '네트워크 오류';
    });

    const tabs = wrapper.findAll('.tab');
    await tabs[1].trigger('click');
    await flushPromises();

    expect(toastCreateSpy).toHaveBeenCalledTimes(1);
    expect(toastCreateSpy).toHaveBeenCalledWith(expect.objectContaining({
      message: '네트워크 오류',
      color: 'danger',
    }));
  });

  it('renders the 3-way segmented control including "인기 작품"', async () => {
    const { wrapper } = mountHomePage();
    await flushPromises();
    const segs = wrapper.findAll('[data-testid="home-segmented"] .seg');
    expect(segs.length).toBe(3);
    expect(segs.map((s) => s.text())).toEqual([
      '내 위치 근처',
      '전국 트렌드',
      '인기 작품',
    ]);
  });

  it('POPULAR_WORKS scope swaps the place grid for a works grid (one card per popular work)', async () => {
    const { wrapper } = mountHomePage({
      popularWorks: [
        { id: 1, title: '도깨비', posterUrl: 'https://img/p1.jpg', placeCount: 12 },
        { id: 2, title: '이태원 클라쓰', posterUrl: null, placeCount: 6 },
      ],
      scope: 'POPULAR_WORKS',
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="works-grid"]').exists()).toBe(true);
    // Place grid is hidden under POPULAR_WORKS.
    expect(wrapper.findAll('.home-grid.works-grid .photo-card').length).toBe(2);
    const cards = wrapper.findAll('[data-testid="work-card"]');
    expect(cards[0].find('.cap .t').text()).toBe('도깨비');
    expect(cards[0].text()).toContain('성지 12곳');
    expect(cards[1].find('.cap .t').text()).toBe('이태원 클라쓰');
    // No posterUrl → initial fallback renders.
    expect(cards[1].find('.work-initial').exists()).toBe(true);
    expect(cards[1].find('.work-initial').text()).toBe('이');
  });

  it('tapping a work card navigates to that work detail page (/work/:id)', async () => {
    const { wrapper } = mountHomePage({
      popularWorks: [
        { id: 42, title: '도깨비', posterUrl: null, placeCount: 12 },
      ],
      scope: 'POPULAR_WORKS',
    });
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('[data-testid="work-card"]').trigger('click');
    await flushPromises();

    expect(pushSpy).toHaveBeenCalledWith('/work/42');
  });

  it('search icon pushes /search', async () => {
    const { wrapper } = mountHomePage();
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('button[aria-label="search"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/search');
  });

  it('clicking a .photo-card pushes /place/:id', async () => {
    const { wrapper } = mountHomePage();
    await flushPromises();
    pushSpy.mockClear();

    const cards = wrapper.findAll('.photo-card');
    await cards[0].trigger('click');
    await flushPromises();

    expect(pushSpy).toHaveBeenCalledWith(`/place/${fixture.places[0].id}`);
  });

  it('tapping "내 위치 근처" (first time) opens the priming sheet instead of firing geolocation', async () => {
    const { wrapper } = mountHomePage({ scope: 'TRENDING' });
    await flushPromises();

    const segs = wrapper.findAll('[data-testid="home-segmented"] .seg');
    await segs[0].trigger('click'); // "내 위치 근처"
    await flushPromises();

    // Teleport("body") 로 올라가서 wrapper 바깥에 있으므로 document 에서 조회.
    expect(document.body.querySelector('[data-testid="geo-priming-sheet"]')).not.toBeNull();
    expect(geoRequestSpy).not.toHaveBeenCalled();
  });

  it('priming accept → calls geolocation.request → setScope NEAR with coords + default radius 30', async () => {
    geoRequestSpy.mockImplementation(async () => {
      geoCoordsRef.value = { latitude: 37.5665, longitude: 126.978, accuracy: 10 };
      geoStatusRef.value = 'granted';
      return geoCoordsRef.value;
    });

    const { wrapper, store } = mountHomePage({ scope: 'TRENDING' });
    await flushPromises();
    const setScopeSpy = vi.spyOn(store, 'setScope');

    await wrapper.findAll('[data-testid="home-segmented"] .seg')[0].trigger('click');
    await flushPromises();
    const acceptBtn = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="geo-prime-accept"]',
    );
    expect(acceptBtn).not.toBeNull();
    acceptBtn!.click();
    await flushPromises();

    expect(geoRequestSpy).toHaveBeenCalledTimes(1);
    expect(setScopeSpy).toHaveBeenCalledWith('NEAR', {
      lat: 37.5665,
      lng: 126.978,
      radiusKm: 30,
    });
    expect(localStorage.getItem('filmroad.geo-primed')).toBe('yes');
  });

  it('priming dismiss → sets primed flag but stays on TRENDING (no geolocation call)', async () => {
    const { wrapper } = mountHomePage({ scope: 'TRENDING' });
    await flushPromises();

    await wrapper.findAll('[data-testid="home-segmented"] .seg')[0].trigger('click');
    await flushPromises();
    const dismissBtn = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="geo-prime-dismiss"]',
    );
    expect(dismissBtn).not.toBeNull();
    dismissBtn!.click();
    await flushPromises();

    expect(geoRequestSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('filmroad.geo-primed')).toBe('yes');
    expect(document.body.querySelector('[data-testid="geo-priming-sheet"]')).toBeNull();
  });

  it('second NEAR tap after primed skips the sheet and requests location directly', async () => {
    localStorage.setItem('filmroad.geo-primed', 'yes');
    geoRequestSpy.mockImplementation(async () => {
      geoCoordsRef.value = { latitude: 35.18, longitude: 129.08, accuracy: 20 };
      geoStatusRef.value = 'granted';
      return geoCoordsRef.value;
    });
    const { wrapper } = mountHomePage({ scope: 'TRENDING' });
    await flushPromises();

    await wrapper.findAll('[data-testid="home-segmented"] .seg')[0].trigger('click');
    await flushPromises();

    expect(document.body.querySelector('[data-testid="geo-priming-sheet"]')).toBeNull();
    expect(geoRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('denied status renders the re-enable banner on the NEAR scope', async () => {
    geoStatusRef.value = 'denied';
    const { wrapper } = mountHomePage({ scope: 'NEAR' });
    await flushPromises();
    expect(wrapper.find('[data-testid="geo-denied-banner"]').exists()).toBe(true);
  });

  it('empty NEAR results with granted location renders the radius-expand toggle', async () => {
    geoStatusRef.value = 'granted';
    geoCoordsRef.value = { latitude: 37.5665, longitude: 126.978, accuracy: 10 };

    const { wrapper } = mountHomePage({ scope: 'NEAR' });
    // Empty the places list on the (already-hydrated) store.
    const store = useHomeStore();
    store.places = [];
    await flushPromises();

    const empty = wrapper.find('[data-testid="nearby-empty"]');
    expect(empty.exists()).toBe(true);
    const buttons = wrapper.findAll('[data-testid="radius-toggle"] .rt');
    expect(buttons.map((b) => b.text())).toEqual(['30km', '50km', '100km']);

    const setScopeSpy = vi.spyOn(store, 'setScope');
    await buttons[1].trigger('click'); // 50km
    await flushPromises();

    expect(setScopeSpy).toHaveBeenCalledWith('NEAR', {
      lat: 37.5665,
      lng: 126.978,
      radiusKm: 50,
    });
  });

  it('clicking a .like dispatches toggleLike and reflects the server response', async () => {
    const { wrapper, store } = mountHomePage();
    await flushPromises();

    const likes = wrapper.findAll('.photo-card .like');
    expect(likes.length).toBe(fixture.places.length);
    expect(likes.every((l) => !l.classes('on'))).toBe(true);

    const toggleSpy = vi
      .spyOn(store, 'toggleLike')
      .mockImplementation(async (id: number) => {
        const p = store.places.find((x) => x.id === id);
        if (p) {
          p.liked = true;
          p.likeCount += 1;
        }
      });

    await likes[0].trigger('click');
    await flushPromises();

    expect(toggleSpy).toHaveBeenCalledWith(fixture.places[0].id);
    const likesAfter = wrapper.findAll('.photo-card .like');
    expect(likesAfter[0].classes()).toContain('on');
    expect(likesAfter[1].classes()).not.toContain('on');
    expect(likesAfter[2].classes()).not.toContain('on');
  });
});
