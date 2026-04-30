import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: null }) },
}));

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

import ContentDetailPage from '@/views/ContentDetailPage.vue';
import { useContentDetailStore } from '@/stores/contentDetail';
import { mountWithStubs } from './__helpers__/mount';

const contentDetailState = {
  content: {
    id: 1,
    title: '도깨비',
    subtitle: '쓸쓸하고 찬란하神',
    yearStart: 2016,
    kind: '드라마',
    posterUrl: 'https://img/w1.jpg',
    coverUrl: 'https://img/w1.jpg',
    ratingAverage: 9.2,
    episodeCount: 16,
    network: 'tvN',
    synopsis: '도깨비 김신의 이야기',
  },
  progress: {
    collectedCount: 12,
    totalCount: 20,
    percent: 60,
    nextBadgeText: '4곳 더 모으면 완주 뱃지!',
  },
  spots: [
    {
      placeId: 10,
      name: '주문진 영진해변 방파제',
      regionShort: '주문진',
      regionLabel: '강원 강릉시 주문진읍',
      address: '강원 강릉시 주문진읍 영진리 1',
      coverImageUrls: ['https://img/s10.jpg'],
      scenes: [
        {
          id: 1000,
          imageUrl: 'https://img/scene-10.jpg',
          contentEpisode: '1회',
          sceneTimestamp: '00:24:10',
          sceneDescription: '도깨비 등장 장면',
          orderIndex: 0,
        },
      ],
      visited: true,
      visitedAt: '2026-04-20T10:00:00Z',
      orderIndex: 1,
    },
    {
      placeId: 11,
      name: '덕수궁 돌담길',
      regionShort: '정동',
      regionLabel: '서울 중구 정동',
      address: '서울 중구 세종대로 99',
      coverImageUrls: ['https://img/s11.jpg'],
      scenes: [
        {
          id: 1001,
          imageUrl: 'https://img/scene-11.jpg',
          contentEpisode: '5회',
          sceneTimestamp: null,
          sceneDescription: '눈 오는 장면',
          orderIndex: 0,
        },
      ],
      visited: false,
      visitedAt: null,
      orderIndex: 2,
    },
  ],
  activeChip: 'SPOTS' as const,
  loading: false,
  error: null as string | null,
};

function mountContentDetail() {
  return mountWithStubs(ContentDetailPage, {
    props: { id: 1 },
    initialState: { contentDetail: { ...contentDetailState } },
  });
}

// task #27: KakaoMap stub — captures the `fit-to` prop so the test can
// assert that the parent passed the expected list of points. The real
// component talks to Kakao SDK which jsdom can't host; only the prop
// flow matters for this regression.
const KakaoMapStub = {
  name: 'KakaoMap',
  props: ['center', 'zoom', 'markers', 'selectedId', 'visitedIds', 'fitTo'],
  emits: ['markerClick'],
  template:
    '<div class="kakao-map-stub" :data-fit-count="fitTo?.length ?? 0" :data-fit-json="JSON.stringify(fitTo ?? [])"></div>',
};

function mountContentDetailWithCoords(spots: Array<typeof contentDetailState.spots[number] & { latitude: number; longitude: number }>) {
  const stateWithCoords = {
    ...contentDetailState,
    spots: spots.map((s) => ({ ...s })),
  };
  return mountWithStubs(ContentDetailPage, {
    props: { id: 1 },
    initialState: { contentDetail: stateWithCoords },
    stubs: { KakaoMap: KakaoMapStub },
  });
}

describe('ContentDetailPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
  });

  it('hero head renders the work title (and subtitle)', async () => {
    const { wrapper } = mountContentDetail();
    await flushPromises();

    const heroH1 = wrapper.find('.head-info h1');
    expect(heroH1.exists()).toBe(true);
    expect(heroH1.text()).toContain('도깨비');
    expect(heroH1.text()).toContain('쓸쓸하고 찬란하神');
    // Rating + episode + network meta line.
    expect(wrapper.find('.head-info .meta').text()).toContain('9.2');
    expect(wrapper.find('.head-info .meta').text()).toContain('16부작');
    expect(wrapper.find('.head-info .meta').text()).toContain('tvN');
  });

  it('progress card shows percent, fraction and nextBadgeText', async () => {
    const { wrapper } = mountContentDetail();
    await flushPromises();

    const card = wrapper.find('.progress-card');
    expect(card.exists()).toBe(true);
    expect(card.find('.ring .pct').text()).toBe('60%');
    expect(card.find('.mid .t').text()).toBe('12 / 20 성지 수집 중');
    expect(card.find('.mid .s').text()).toBe('4곳 더 모으면 완주 뱃지!');
  });

  it('renders four chips and clicking one calls setChip on the store', async () => {
    const { wrapper } = mountContentDetail();
    await flushPromises();
    const store = useContentDetailStore();
    const setChipSpy = vi.spyOn(store, 'setChip');

    const chips = wrapper.findAll('.card-sheet .chips .chip-i');
    expect(chips.length).toBe(4);
    expect(chips.map((c) => c.text())).toEqual(['성지 목록', '정보', '출연진', '다른 팬들']);
    // SPOTS is active by default.
    expect(chips[0].classes()).toContain('on');

    await chips[1].trigger('click');
    expect(setChipSpy).toHaveBeenCalledWith('INFO');
  });

  it('spots list renders one row per spot with .done on visited entries', async () => {
    const { wrapper } = mountContentDetail();
    await flushPromises();

    const spots = wrapper.findAll('.spots .spot');
    expect(spots.length).toBe(contentDetailState.spots.length);
    // First spot is visited → .done.
    expect(spots[0].classes()).toContain('done');
    expect(spots[1].classes()).not.toContain('done');
  });

  it('spots section header shows "회차순" + a chevron-down affordance (09-design)', async () => {
    const { wrapper } = mountContentDetail();
    await flushPromises();

    const trigger = wrapper.find('[data-testid="spots-sort"]');
    expect(trigger.exists()).toBe(true);
    expect(trigger.text()).toContain('회차순');
    // The chevron is an <ion-icon> stub — its presence marks the design's sort arrow.
    expect(trigger.findAll('ion-icon-stub').length + trigger.findAll('ion-icon').length).toBeGreaterThan(0);
  });

  it('visited spot shows "인증완료" with the check glyph (design mint badge)', async () => {
    const { wrapper } = mountContentDetail();
    await flushPromises();

    const badge = wrapper.find('[data-testid="spot-visited"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toContain('인증완료');
    // Mint class ties the tint to var(--fr-mint).
    expect(badge.classes()).toContain('mint');
    // Inline check icon must be there (design 의 "✓").
    expect(
      badge.findAll('ion-icon-stub').length + badge.findAll('ion-icon').length,
    ).toBeGreaterThan(0);
  });

  it('clicking a spot pushes /place/:id', async () => {
    const { wrapper } = mountContentDetail();
    await flushPromises();
    pushSpy.mockClear();

    const spots = wrapper.findAll('.spots .spot');
    await spots[1].trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/place/11');
  });

  it('spots view toggle switches between list and map', async () => {
    const { wrapper } = mountContentDetail();
    await flushPromises();

    // Default is list view
    expect(wrapper.find('.spots').exists()).toBe(true);
    expect(wrapper.find('[data-testid="spots-map"]').exists()).toBe(false);

    // Toggle to map
    await wrapper.find('[data-testid="spots-view-map"]').trigger('click');
    expect(wrapper.find('[data-testid="spots-map"]').exists()).toBe(true);
    expect(wrapper.find('.spots').exists()).toBe(false);

    // Toggle back to list
    await wrapper.find('[data-testid="spots-view-list"]').trigger('click');
    expect(wrapper.find('.spots').exists()).toBe(true);
    expect(wrapper.find('[data-testid="spots-map"]').exists()).toBe(false);
  });

  // task #27 — 지도 탭 진입 시 KakaoMap.fitTo 가 모든 성지 좌표를 포함해
  // viewport 가 자동 조정되도록 함. unit-level 에선 prop 전달 회귀 보장.
  it('지도 탭 → KakaoMap 의 fit-to prop 이 모든 성지 lat/lng 로 채워짐 (task #27)', async () => {
    const spotsWithCoords = [
      { ...contentDetailState.spots[0], latitude: 37.8928, longitude: 128.8347 },
      { ...contentDetailState.spots[1], latitude: 37.5658, longitude: 126.9751 },
    ];
    const { wrapper } = mountContentDetailWithCoords(spotsWithCoords);
    await flushPromises();

    // 진입 직후엔 list 모드 — 지도 stub 없음.
    expect(wrapper.find('.kakao-map-stub').exists()).toBe(false);

    // 지도 탭 클릭.
    await wrapper.find('[data-testid="spots-view-map"]').trigger('click');
    await flushPromises();

    const stub = wrapper.find('.kakao-map-stub');
    expect(stub.exists()).toBe(true);
    expect(stub.attributes('data-fit-count')).toBe('2');
    const fit = JSON.parse(stub.attributes('data-fit-json') ?? '[]');
    expect(fit).toEqual([
      { lat: 37.8928, lng: 128.8347 },
      { lat: 37.5658, lng: 126.9751 },
    ]);
  });

  it('단일 성지일 때도 fit-to 전달 — KakaoMap 이 single-marker zoom 로 처리 (task #27)', async () => {
    const spotsWithCoords = [
      { ...contentDetailState.spots[0], latitude: 37.8928, longitude: 128.8347 },
    ];
    const { wrapper } = mountContentDetailWithCoords(spotsWithCoords);
    await flushPromises();
    await wrapper.find('[data-testid="spots-view-map"]').trigger('click');
    await flushPromises();

    const stub = wrapper.find('.kakao-map-stub');
    expect(stub.attributes('data-fit-count')).toBe('1');
  });

  it('좌표 없는 성지만 있으면 KakaoMap 자체가 미렌더 — 빈 안내 노출 (task #27)', async () => {
    // 좌표 없는 fixture (기본 contentDetailState) — mapMarkers.length === 0.
    const { wrapper } = mountContentDetail();
    await flushPromises();
    await wrapper.find('[data-testid="spots-view-map"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('.kakao-map-stub').exists()).toBe(false);
    expect(wrapper.find('[data-testid="spots-map"] .empty-note').exists()).toBe(true);
  });

  // task #25: 페이지 언마운트 시 store reset — 다른 contentId 진입 시 이전
  // work / spots / progress 가 잠시 잔류하지 않게.
  it('unmount → contentStore.reset() called (task #25 stale-data guard)', async () => {
    const { wrapper } = mountContentDetail();
    await flushPromises();
    const store = useContentDetailStore();
    const resetSpy = vi.spyOn(store, 'reset');

    wrapper.unmount();
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });
});
