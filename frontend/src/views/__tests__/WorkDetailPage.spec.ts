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

import WorkDetailPage from '@/views/WorkDetailPage.vue';
import { useWorkDetailStore } from '@/stores/workDetail';
import { mountWithStubs } from './__helpers__/mount';

const workDetailState = {
  work: {
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
      coverImageUrl: 'https://img/s10.jpg',
      workEpisode: '1회',
      sceneTimestamp: '00:24:10',
      sceneDescription: '도깨비 등장 장면',
      visited: true,
      visitedAt: '2026-04-20T10:00:00Z',
      orderIndex: 1,
    },
    {
      placeId: 11,
      name: '덕수궁 돌담길',
      regionShort: '정동',
      coverImageUrl: 'https://img/s11.jpg',
      workEpisode: '5회',
      sceneTimestamp: null,
      sceneDescription: '눈 오는 장면',
      visited: false,
      visitedAt: null,
      orderIndex: 2,
    },
  ],
  activeChip: 'SPOTS' as const,
  loading: false,
  error: null as string | null,
};

function mountWorkDetail() {
  return mountWithStubs(WorkDetailPage, {
    props: { id: 1 },
    initialState: { workDetail: { ...workDetailState } },
  });
}

describe('WorkDetailPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
  });

  it('hero head renders the work title (and subtitle)', async () => {
    const { wrapper } = mountWorkDetail();
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
    const { wrapper } = mountWorkDetail();
    await flushPromises();

    const card = wrapper.find('.progress-card');
    expect(card.exists()).toBe(true);
    expect(card.find('.ring .pct').text()).toBe('60%');
    expect(card.find('.mid .t').text()).toBe('12 / 20 성지 수집 중');
    expect(card.find('.mid .s').text()).toBe('4곳 더 모으면 완주 뱃지!');
  });

  it('renders four chips and clicking one calls setChip on the store', async () => {
    const { wrapper } = mountWorkDetail();
    await flushPromises();
    const store = useWorkDetailStore();
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
    const { wrapper } = mountWorkDetail();
    await flushPromises();

    const spots = wrapper.findAll('.spots .spot');
    expect(spots.length).toBe(workDetailState.spots.length);
    // First spot is visited → .done.
    expect(spots[0].classes()).toContain('done');
    expect(spots[1].classes()).not.toContain('done');
  });

  it('clicking a spot pushes /place/:id', async () => {
    const { wrapper } = mountWorkDetail();
    await flushPromises();
    pushSpy.mockClear();

    const spots = wrapper.findAll('.spots .spot');
    await spots[1].trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/place/11');
  });
});
