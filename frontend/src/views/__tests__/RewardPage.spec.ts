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

import RewardPage from '@/views/RewardPage.vue';
import {
  useUploadStore,
  type PhotoResponse,
  type CaptureTarget,
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

const rewardedResponse: PhotoResponse = {
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
  images: [{ id: 99, imageUrl: 'https://cdn/p/99.jpg', imageOrderIndex: 0 }],
  stamp: {
    placeName: '주문진 영진해변 방파제',
    workId: 1,
    workTitle: '도깨비',
    collectedCount: 3,
    totalCount: 10,
    percent: 30,
  },
  reward: {
    pointsEarned: 50,
    currentPoints: 400,
    streakDays: 7,
    level: 5,
    previousLevel: 5,
    levelName: '성지 순례자',
    newBadges: [
      {
        badgeId: 77,
        code: 'first-light',
        name: '첫 일출',
        description: '일출 장면 인증',
        iconKey: 'sunrise',
        gradient: null,
        acquired: true,
        progressText: null,
        acquiredAt: '2026-04-22T06:00:00Z',
      },
    ],
  },
};

function mountReward(opts: { withResult?: boolean } = { withResult: true }) {
  return mountWithStubs(RewardPage, {
    props: { placeId: 10 },
    initialState: {
      upload: {
        targetPlace: { ...target },
        photos: [],
        selectedIndex: 0,
        caption: '',
        tags: [],
        visibility: 'PUBLIC' as const,
        addToStampbook: true,
        loading: false,
        error: null,
        lastResult: opts.withResult ? rewardedResponse : null,
      },
    },
  });
}

describe('RewardPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
  });

  it('redirects to /home when lastResult is null', async () => {
    mountReward({ withResult: false });
    await flushPromises();

    expect(replaceSpy).toHaveBeenCalledWith('/home');
  });

  it('renders success title, stamp progress and reward tiles when lastResult is set', async () => {
    const { wrapper } = mountReward();
    await flushPromises();

    expect(wrapper.find('.title').text()).toBe('인증 완료!');
    // Stamp card shows the work title + progress line (percent rendered in .p-v).
    const stampCard = wrapper.find('.stamp-card');
    expect(stampCard.exists()).toBe(true);
    expect(stampCard.text()).toContain('도깨비');
    expect(stampCard.find('.p-v').text()).toBe('30%');
    const fill = stampCard.find('.bar .fill');
    expect(fill.attributes('style')).toContain('width: 30%');

    // Three reward tiles: points, streak, level.
    const rewards = wrapper.findAll('.rewards .reward');
    expect(rewards.length).toBe(3);
    expect(rewards[0].text()).toContain('+50');
    expect(rewards[1].text()).toContain('7일');
    expect(rewards[2].text()).toContain('LV.5');
  });

  it('renders the new-badges section when reward.newBadges is non-empty', async () => {
    const { wrapper } = mountReward();
    await flushPromises();

    const newBadgesSection = wrapper.find('.new-badges');
    expect(newBadgesSection.exists()).toBe(true);
    const nbCards = wrapper.findAll('.new-badges .nb-card');
    expect(nbCards.length).toBe(1);
    expect(nbCards[0].text()).toContain('첫 일출');
  });

  it('"홈으로 돌아가기" resets the upload store and replaces /home', async () => {
    const { wrapper } = mountReward();
    await flushPromises();
    const store = useUploadStore();
    const resetSpy = vi.spyOn(store, 'reset');
    replaceSpy.mockClear();

    await wrapper.find('button.link').trigger('click');
    await flushPromises();

    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).toHaveBeenCalledWith('/home');
  });
});
