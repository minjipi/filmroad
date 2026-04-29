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
// task #25: useRoute also needed (HomePage syncs scope/contentId to query).
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, back: backSpy, replace: vi.fn().mockResolvedValue(undefined) }),
  useRoute: () => ({ path: '/home', query: {} }),
}));

const { toastCreateSpy } = vi.hoisted(() => ({
  toastCreateSpy: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@ionic/vue', async () => {
  const actual = await vi.importActual<typeof import('@ionic/vue')>('@ionic/vue');
  return { ...actual, toastController: { create: toastCreateSpy } };
});

// useGeolocation 의 두 export 를 spy 로 교체. 테스트별로 분기 동작을 다르게
// 심을 수 있게 하려는 의도.
const { requestLocationSpy, peekPermissionSpy } = vi.hoisted(() => ({
  requestLocationSpy: vi.fn(),
  peekPermissionSpy: vi.fn(),
}));
vi.mock('@/composables/useGeolocation', () => ({
  requestLocation: requestLocationSpy,
  peekPermission: peekPermissionSpy,
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
    contentId: 1,
    primaryPlaceId: 10,
  },
  contents: [
    { id: 1, title: '도깨비' },
    { id: 2, title: '이태원 클라쓰' },
  ],
  places: [
    {
      id: 10,
      name: '주문진 영진해변 방파제',
      regionLabel: '강릉시 주문진읍',
      coverImageUrls: ['https://img/1.jpg'],
      contentId: 1,
      contentTitle: '도깨비',
      liked: false,
      likeCount: 3200,
    },
    {
      id: 11,
      name: '단밤 포차',
      regionLabel: '서울 용산구 이태원동',
      coverImageUrls: ['https://img/2.jpg'],
      contentId: 2,
      contentTitle: '이태원 클라쓰',
      liked: false,
      likeCount: 1800,
    },
    {
      id: 12,
      name: '덕수궁 돌담길',
      regionLabel: '서울 중구 정동',
      coverImageUrls: ['https://img/3.jpg'],
      contentId: 1,
      contentTitle: '도깨비',
      liked: false,
      likeCount: 420,
    },
  ],
};

interface HomeTestOpts {
  popularContents?: Array<{
    id: number;
    title: string;
    posterUrl?: string | null;
    placeCount: number;
  }>;
  selectedContentId?: number | null;
  scope?: 'NEAR' | 'TRENDING' | 'POPULAR_WORKS';
}

function mountHomePage(opts: HomeTestOpts = {}) {
  const { wrapper } = mountWithStubs(HomePage, {
    initialState: {
      home: {
        hero: fixture.hero,
        contents: fixture.contents,
        places: [...fixture.places],
        popularContents: opts.popularContents ?? [],
        loading: false,
        error: null,
        selectedContentId: opts.selectedContentId ?? null,
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
    requestLocationSpy.mockReset();
    peekPermissionSpy.mockReset();
    // 기본은 'unknown' — peekPermission 가 정보 없다고 답해 priming sheet
    // 경로가 동작하도록. 특정 테스트는 mockResolvedValueOnce 로 덮어씀.
    peekPermissionSpy.mockResolvedValue('unknown');
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

  it("dispatches setContent when a work tab is clicked", async () => {
    const { wrapper, store } = mountHomePage();
    await flushPromises();

    const setContentSpy = vi.spyOn(store, 'setContent');

    // The first .tab is "모두" (null); subsequent tabs map to contents by index.
    const tabs = wrapper.findAll('.tab');
    expect(tabs.length).toBe(fixture.contents.length + 1);
    await tabs[1].trigger('click'); // contents[0] => id 1
    expect(setContentSpy).toHaveBeenCalledWith(1);
  });

  it('shows an error toast when setContent fails', async () => {
    const { wrapper, store } = mountHomePage();
    await flushPromises();
    toastCreateSpy.mockClear();

    vi.spyOn(store, 'setContent').mockImplementation(async (id: number | null) => {
      store.selectedContentId = id;
      store.error = '네트워크 오류';
    });

    const tabs = wrapper.findAll('.tab');
    await tabs[1].trigger('click');
    await flushPromises();

    expect(toastCreateSpy).toHaveBeenCalledTimes(1);
    expect(toastCreateSpy).toHaveBeenCalledWith(expect.objectContaining({
      message: '네트워크 오류',
      cssClass: expect.arrayContaining(['fr-toast--danger']),
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

  it('POPULAR_WORKS scope swaps the place grid for a contents grid (one card per popular work)', async () => {
    const { wrapper } = mountHomePage({
      popularContents: [
        { id: 1, title: '도깨비', posterUrl: 'https://img/p1.jpg', placeCount: 12 },
        { id: 2, title: '이태원 클라쓰', posterUrl: null, placeCount: 6 },
      ],
      scope: 'POPULAR_WORKS',
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="contents-grid"]').exists()).toBe(true);
    // Place grid is hidden under POPULAR_WORKS.
    expect(wrapper.findAll('.home-grid.contents-grid .photo-card').length).toBe(2);
    const cards = wrapper.findAll('[data-testid="content-card"]');
    expect(cards[0].find('.cap .t').text()).toBe('도깨비');
    expect(cards[0].text()).toContain('성지 12곳');
    expect(cards[1].find('.cap .t').text()).toBe('이태원 클라쓰');
    // No posterUrl → initial fallback renders.
    expect(cards[1].find('.content-initial').exists()).toBe(true);
    expect(cards[1].find('.content-initial').text()).toBe('이');
  });

  it('home-segmented is hidden on work tab (selectedContentId !== null)', async () => {
    const { wrapper } = mountHomePage({ selectedContentId: 1 });
    await flushPromises();
    expect(wrapper.find('[data-testid="home-segmented"]').exists()).toBe(false);
  });

  it('home-segmented is visible on 모두 tab (selectedContentId === null)', async () => {
    const { wrapper } = mountHomePage({ selectedContentId: null });
    await flushPromises();
    expect(wrapper.find('[data-testid="home-segmented"]').exists()).toBe(true);
  });

  it('work tab with stored POPULAR_WORKS scope renders place grid, not contents-grid', async () => {
    // 사용자가 모두 탭에서 POPULAR_WORKS 를 골라둔 상태로 작품 탭에 들어온
    // 케이스 — contents-grid 가 새어 나와선 안 되고 place grid 가 떠야 한다.
    const { wrapper } = mountHomePage({
      selectedContentId: 1,
      scope: 'POPULAR_WORKS',
      popularContents: [
        { id: 1, title: '도깨비', posterUrl: null, placeCount: 12 },
      ],
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="contents-grid"]').exists()).toBe(false);
    expect(wrapper.findAll('.home-grid:not(.contents-grid) .photo-card').length)
      .toBeGreaterThan(0);
  });

  it('tapping a work card navigates to that work detail page (/content/:id)', async () => {
    const { wrapper } = mountHomePage({
      popularContents: [
        { id: 42, title: '도깨비', posterUrl: null, placeCount: 12 },
      ],
      scope: 'POPULAR_WORKS',
    });
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('[data-testid="content-card"]').trigger('click');
    await flushPromises();

    expect(pushSpy).toHaveBeenCalledWith('/content/42');
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

  it('tapping "내 위치 근처" (first time, unknown permission) opens the priming sheet', async () => {
    const { wrapper } = mountHomePage({ scope: 'TRENDING' });
    await flushPromises();

    const segs = wrapper.findAll('[data-testid="home-segmented"] .seg');
    await segs[0].trigger('click');
    await flushPromises();

    // Teleport("body") 로 올라가 있어 document 쪽에서 조회.
    expect(document.body.querySelector('[data-testid="geo-priming-sheet"]')).not.toBeNull();
    expect(requestLocationSpy).not.toHaveBeenCalled();
  });

  it('priming accept → calls requestLocation → setScope NEAR with coords + default radius 30', async () => {
    requestLocationSpy.mockResolvedValueOnce({ ok: true, coords: { lat: 37.5665, lng: 126.978 } });

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

    expect(requestLocationSpy).toHaveBeenCalledTimes(1);
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

    expect(requestLocationSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('filmroad.geo-primed')).toBe('yes');
    expect(document.body.querySelector('[data-testid="geo-priming-sheet"]')).toBeNull();
  });

  it('second NEAR tap after primed skips the sheet and requests location directly', async () => {
    localStorage.setItem('filmroad.geo-primed', 'yes');
    requestLocationSpy.mockResolvedValueOnce({ ok: true, coords: { lat: 35.18, lng: 129.08 } });
    const { wrapper } = mountHomePage({ scope: 'TRENDING' });
    await flushPromises();

    await wrapper.findAll('[data-testid="home-segmented"] .seg')[0].trigger('click');
    await flushPromises();

    expect(document.body.querySelector('[data-testid="geo-priming-sheet"]')).toBeNull();
    expect(requestLocationSpy).toHaveBeenCalledTimes(1);
  });

  it('peekPermission=granted auto-skips priming on the first NEAR tap', async () => {
    peekPermissionSpy.mockResolvedValueOnce('granted');
    requestLocationSpy.mockResolvedValueOnce({ ok: true, coords: { lat: 37.5, lng: 127 } });
    const { wrapper } = mountHomePage({ scope: 'TRENDING' });
    await flushPromises();

    await wrapper.findAll('[data-testid="home-segmented"] .seg')[0].trigger('click');
    await flushPromises();

    expect(document.body.querySelector('[data-testid="geo-priming-sheet"]')).toBeNull();
    expect(requestLocationSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('filmroad.geo-primed')).toBe('yes');
  });

  it('reason="denied" renders the permission-recovery banner (no retry button)', async () => {
    localStorage.setItem('filmroad.geo-primed', 'yes');
    requestLocationSpy.mockResolvedValueOnce({ ok: false, reason: 'denied' });
    const { wrapper } = mountHomePage({ scope: 'TRENDING' });
    await flushPromises();

    await wrapper.findAll('[data-testid="home-segmented"] .seg')[0].trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="geo-denied-banner"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="geo-unavailable-banner"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="geo-timeout-banner"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="geo-retry"]').exists()).toBe(false);
  });

  it('reason="unavailable" renders the GPS-hint banner with a retry button', async () => {
    localStorage.setItem('filmroad.geo-primed', 'yes');
    requestLocationSpy.mockResolvedValueOnce({ ok: false, reason: 'unavailable' });
    const { wrapper } = mountHomePage({ scope: 'TRENDING' });
    await flushPromises();

    await wrapper.findAll('[data-testid="home-segmented"] .seg')[0].trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="geo-unavailable-banner"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="geo-retry"]').exists()).toBe(true);
  });

  it('reason="timeout" retry button calls requestLocation again and renders coords on success', async () => {
    localStorage.setItem('filmroad.geo-primed', 'yes');
    requestLocationSpy
      .mockResolvedValueOnce({ ok: false, reason: 'timeout' })
      .mockResolvedValueOnce({ ok: true, coords: { lat: 37, lng: 127 } });
    const { wrapper, store } = mountHomePage({ scope: 'TRENDING' });
    await flushPromises();
    const setScopeSpy = vi.spyOn(store, 'setScope');

    await wrapper.findAll('[data-testid="home-segmented"] .seg')[0].trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="geo-timeout-banner"]').exists()).toBe(true);

    await wrapper.find('[data-testid="geo-retry"]').trigger('click');
    await flushPromises();

    expect(requestLocationSpy).toHaveBeenCalledTimes(2);
    expect(setScopeSpy).toHaveBeenCalledWith('NEAR', { lat: 37, lng: 127, radiusKm: 30 });
  });

  it('empty NEAR results with granted location renders the radius-expand toggle', async () => {
    localStorage.setItem('filmroad.geo-primed', 'yes');
    requestLocationSpy.mockResolvedValue({ ok: true, coords: { lat: 37.5665, lng: 126.978 } });

    const { wrapper, store } = mountHomePage({ scope: 'TRENDING' });
    await flushPromises();

    // Promote to NEAR with granted location, then empty out the place grid so
    // the empty-state block renders.
    await wrapper.findAll('[data-testid="home-segmented"] .seg')[0].trigger('click');
    await flushPromises();
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
