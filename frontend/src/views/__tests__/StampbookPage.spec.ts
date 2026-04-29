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

import StampbookPage from '@/views/StampbookPage.vue';
import { useStampbookStore, type StampbookFilter } from '@/stores/stampbook';
import { mountWithStubs } from './__helpers__/mount';

const stampbookState = {
  hero: {
    contentsCollectingCount: 3,
    placesCollectedCount: 42,
    badgesCount: 8,
    completedContentsCount: 1,
  },
  contents: [
    {
      contentId: 1,
      title: '도깨비',
      posterUrl: 'https://img/w1.jpg',
      year: 2016,
      collectedCount: 12,
      totalCount: 20,
      percent: 60,
      completed: false,
      gradient: 'linear-gradient(135deg,#14BCED,#7c3aed)',
    },
    {
      contentId: 2,
      title: '이태원 클라쓰',
      posterUrl: 'https://img/w2.jpg',
      year: 2020,
      collectedCount: 8,
      totalCount: 8,
      percent: 100,
      completed: true,
      gradient: 'linear-gradient(135deg,#f5a524,#ef4444)',
    },
    {
      contentId: 3,
      title: '더 글로리',
      posterUrl: 'https://img/w3.jpg',
      year: 2022,
      collectedCount: 3,
      totalCount: 15,
      percent: 20,
      completed: false,
      gradient: 'linear-gradient(135deg,#10b981,#06b6d4)',
    },
  ],
  recentBadges: [
    {
      badgeId: 10,
      code: 'first-light',
      name: '첫 일출',
      description: '일출 장면 인증',
      iconKey: 'sunrise',
      gradient: null,
      acquired: true,
      progressText: null,
      acquiredAt: '2026-04-20T06:05:00Z',
    },
    {
      badgeId: 11,
      code: 'globe',
      name: '세계 일주',
      description: null,
      iconKey: 'globe',
      gradient: null,
      acquired: false,
      progressText: '3 / 10 국가',
      acquiredAt: null,
    },
  ],
  filter: 'WORKS' as const,
  loading: false,
  error: null as string | null,
};

function mountStampbook(filter: StampbookFilter = 'WORKS') {
  return mountWithStubs(StampbookPage, {
    initialState: { stampbook: { ...stampbookState, filter } },
  });
}

describe('StampbookPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
  });

  it('hero section renders contents/places/badges counts from the store', async () => {
    const { wrapper } = mountStampbook();
    await flushPromises();

    const hero = wrapper.find('.hero');
    expect(hero.exists()).toBe(true);
    expect(hero.text()).toContain('3개 작품');
    expect(hero.text()).toContain('42 성지');
    // meter renders badges and completed counts as bold numbers.
    const meterDs = hero.findAll('.meter .d');
    expect(meterDs.length).toBe(3);
  });

  it('renders the four filter tabs and clicking one calls setFilter', async () => {
    const { wrapper } = mountStampbook();
    await flushPromises();
    const store = useStampbookStore();
    const setFilterSpy = vi.spyOn(store, 'setFilter');

    const tabs = wrapper.findAll('.filter-tabs .ft');
    expect(tabs.length).toBe(4);
    expect(tabs.map((t) => t.text())).toEqual(['작품', '뱃지', '완주한 것', '진행 중']);
    // WORKS is active by default.
    expect(tabs[0].classes()).toContain('on');

    await tabs[2].trigger('click');
    expect(setFilterSpy).toHaveBeenCalledWith('COMPLETED');
  });

  it('drama-card count matches visibleContents (default WORKS shows all three)', async () => {
    const { wrapper } = mountStampbook('WORKS');
    await flushPromises();

    const cards = wrapper.findAll('.drama-card');
    expect(cards.length).toBe(stampbookState.contents.length);
    // The only completed work renders the .completed-badge overlay.
    const completedBadges = wrapper.findAll('.completed-badge');
    expect(completedBadges.length).toBe(1);
  });

  it('BADGES filter hides drama-list and still renders the badges grid', async () => {
    const { wrapper } = mountStampbook('BADGES');
    await flushPromises();

    expect(wrapper.findAll('.drama-card').length).toBe(0);
    const badges = wrapper.findAll('.badges .badge');
    expect(badges.length).toBe(stampbookState.recentBadges.length);
    // The second badge is not acquired → rendered with .locked.
    expect(badges[0].classes()).not.toContain('locked');
    expect(badges[1].classes()).toContain('locked');
  });
});
