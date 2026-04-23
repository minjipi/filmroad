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

import ProfilePage from '@/views/ProfilePage.vue';
import { mountWithStubs } from './__helpers__/mount';

const profileState = {
  user: {
    id: 1,
    nickname: '김미루',
    handle: 'miru',
    avatarUrl: 'https://img/avatar.jpg',
    bio: '성지 순례 중',
    level: 5,
    levelName: '성지 순례자',
    points: 350,
    streakDays: 7,
    followersCount: 1200,
    followingCount: 234,
  },
  stats: {
    visitedCount: 42,
    photoCount: 186,
    followersCount: 1200,
    followingCount: 234,
  },
  miniMapPins: [
    { latitude: 37.89, longitude: 128.83, variant: 'PRIMARY' as const },
    { latitude: 37.56, longitude: 126.99, variant: 'VIOLET' as const },
    { latitude: 35.18, longitude: 129.08, variant: 'MINT' as const },
  ],
  loading: false,
  error: null as string | null,
};

function mountProfile() {
  return mountWithStubs(ProfilePage, {
    initialState: { profile: { ...profileState } },
  });
}

describe('ProfilePage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
  });

  it('renders the profile card with nickname, handle and level pill', async () => {
    const { wrapper } = mountProfile();
    await flushPromises();

    expect(wrapper.find('.profile-card').exists()).toBe(true);
    expect(wrapper.text()).toContain('김미루');
    // Handle is rendered at the top bar as "@miru".
    expect(wrapper.find('.top-bar h1').text()).toBe('@miru');
    expect(wrapper.text()).toContain('성지 순례자');
    expect(wrapper.text()).toContain('LV.5');
  });

  it('renders four stat tiles with formatted counts from stats', async () => {
    const { wrapper } = mountProfile();
    await flushPromises();

    const stats = wrapper.findAll('.stats .stat');
    expect(stats.length).toBe(4);
    const numbers = stats.map((s) => s.find('.n').text());
    // 42 / 186 / 1200→1.2k / 234.
    expect(numbers).toEqual(['42', '186', '1.2k', '234']);
    const labels = stats.map((s) => s.find('.l').text());
    expect(labels).toEqual(['방문 성지', '인증샷', '팔로워', '팔로잉']);
  });

  it('renders one .mini-pin per miniMapPins entry with its variant class', async () => {
    const { wrapper } = mountProfile();
    await flushPromises();

    const pins = wrapper.findAll('.mini-pin');
    expect(pins.length).toBe(3);
    expect(pins[0].classes()).toContain('PRIMARY');
    expect(pins[1].classes()).toContain('VIOLET');
    expect(pins[2].classes()).toContain('MINT');
  });

  it('photos / stampbook tabs stay in-place; "저장" tab pushes /saved (reverted in task #20)', async () => {
    const { wrapper } = mountProfile();
    await flushPromises();

    const tabs = wrapper.findAll('.local-tabs .tab-i');
    expect(tabs.map((t) => t.text())).toEqual(['인증샷', '스탬프북', '저장']);

    // Default: 인증샷 grid is visible, no push.
    expect(wrapper.find('[data-testid="tab-photos"]').exists()).toBe(true);
    expect(pushSpy).not.toHaveBeenCalled();

    // 스탬프북 탭: still in-place.
    await tabs[1].trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="tab-stampbook"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tab-photos"]').exists()).toBe(false);
    expect(pushSpy).not.toHaveBeenCalled();

    // 저장 탭: navigates to the dedicated SavedPage.
    await tabs[2].trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/saved');
  });

  it('stampbook tab renders only the "수집 중인 작품" list (no summary card)', async () => {
    const { wrapper } = mountProfile();
    await flushPromises();
    await wrapper.findAll('.local-tabs .tab-i')[1].trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="stampbook-detail-btn"]').exists()).toBe(false);
    expect(wrapper.find('.stampbook-card').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stampbook-works-list"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('수집 중인 작품');
  });

  it('"지도로 보기" overlay link pushes /map', async () => {
    const { wrapper } = mountProfile();
    await flushPromises();

    await wrapper.find('.map-overlay .r').trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/map');
  });
});
