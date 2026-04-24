import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
import api from '@/services/api';

const { pushSpy, replaceSpy, backSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  replaceSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushSpy,
    replace: replaceSpy,
    back: backSpy,
    currentRoute: { value: { path: '/user/42' } },
  }),
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

import UserProfilePage from '@/views/UserProfilePage.vue';
import type { UserProfile } from '@/stores/userProfile';
import { mountWithStubs } from './__helpers__/mount';

const fixture: UserProfile = {
  id: 42,
  nickname: '김소연',
  handle: 'soyeon_film',
  avatarUrl: 'https://img/soyeon.jpg',
  bio: '드라마 성지 순례 4년차.',
  verified: true,
  level: 12,
  levelName: '성지지기',
  points: 1800,
  streakDays: 14,
  stats: {
    visitedCount: 214,
    photoCount: 214,
    followersCount: 1200,
    followingCount: 186,
    collectedWorksCount: 47,
  },
  isMe: false,
  following: false,
  topPhotos: [
    { id: 1, imageUrl: 'https://cdn/p/1.jpg', workTitle: '도깨비', placeName: '주문진' },
    { id: 2, imageUrl: 'https://cdn/p/2.jpg', workTitle: '갯마을차차차', placeName: '청하' },
  ],
  recentCollectedWorks: [
    { id: 1, title: '도깨비', posterUrl: 'https://img/w1.jpg', collectedCount: 24, totalCount: 24 },
    { id: 2, title: '갯마을차차차', posterUrl: 'https://img/w2.jpg', collectedCount: 18, totalCount: 26 },
  ],
};

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

function mountPage(id: string | number = '42', overrides: Partial<UserProfile> = {}) {
  const merged: UserProfile = { ...structuredClone(fixture), ...overrides };
  mockApi.get.mockImplementation(() => Promise.resolve({ data: structuredClone(merged) }));
  return mountWithStubs(UserProfilePage, {
    props: { id },
    initialState: {
      userProfile: {
        user: merged,
        loading: false,
        error: null,
        followPending: false,
      },
      auth: {
        // Signed in as a *different* user so follow button renders (not isMe).
        user: { id: 999, nickname: 'me', handle: 'me', avatarUrl: null },
      },
    },
  });
}

describe('UserProfilePage.vue (task #42)', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
    mockApi.get.mockReset();
    mockApi.post.mockReset();
  });

  it('mounted → GET /api/users/:id is called with the route param', async () => {
    mountPage('42');
    await flushPromises();
    const called = mockApi.get.mock.calls.some(
      (call) => String(call[0]) === '/api/users/42',
    );
    expect(called).toBe(true);
  });

  it('hero renders nickname, handle, level badge and bio', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const head = wrapper.find('[data-testid="up-loaded"]');
    expect(head.exists()).toBe(true);
    expect(head.find('.up-nm').text()).toBe('김소연');
    expect(head.find('.up-handle').text()).toBe('@soyeon_film');
    expect(head.find('.up-badge').text()).toContain('Lv.12');
    expect(head.find('.up-bio').text()).toContain('성지 순례');
  });

  it('stats row shows the four counts from backend (photos/followers/following/works)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const stats = wrapper.findAll('.up-stat');
    expect(stats.length).toBe(4);
    const labels = stats.map((s) => s.find('.l').text());
    expect(labels).toEqual(['인증샷', '팔로워', '팔로잉', '작품']);
    const nums = stats.map((s) => s.find('.n').text());
    // 214 / 1200 → 1.2k / 186 / 47.
    expect(nums).toEqual(['214', '1.2k', '186', '47']);
  });

  it('follow button reflects `following=false` → 팔로우 (task #42)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const btn = wrapper.find('[data-testid="up-follow-btn"]');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain('팔로우');
    expect(btn.classes()).not.toContain('on');
  });

  it('follow button reflects `following=true` → 팔로잉 with .on', async () => {
    const { wrapper } = mountPage('42', { following: true });
    await flushPromises();

    const btn = wrapper.find('[data-testid="up-follow-btn"]');
    expect(btn.text()).toContain('팔로잉');
    expect(btn.classes()).toContain('on');
  });

  it('isMe=true (without a viewer-id match) swaps follow button for 프로필 편집', async () => {
    const { wrapper } = mountPage('42', { isMe: true });
    await flushPromises();
    expect(wrapper.find('[data-testid="up-edit-btn"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="up-follow-btn"]').exists()).toBe(false);
  });

  it('clicking the follow button dispatches userProfileStore.toggleFollow', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const { useUserProfileStore } = await import('@/stores/userProfile');
    const store = useUserProfileStore();
    const spy = vi.spyOn(store, 'toggleFollow').mockResolvedValue();

    await wrapper.find('[data-testid="up-follow-btn"]').trigger('click');
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('highlights row renders one ring per recentCollectedWorks entry', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const hls = wrapper.findAll('[data-testid="up-highlight"]');
    expect(hls.length).toBe(2);
    expect(hls[0].find('.nm').text()).toBe('도깨비');
    expect(hls[0].find('.c').text()).toBe('24/24');
    expect(hls[1].find('.nm').text()).toBe('갯마을차차차');
    expect(hls[1].find('.c').text()).toBe('18/26');
  });

  it('tapping a highlight routes to /work/:id', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.findAll('[data-testid="up-highlight"]')[0].trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/work/1');
  });

  it('photo grid renders one cell per topPhotos; tap routes to /shot/:id', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    pushSpy.mockClear();

    const cells = wrapper.findAll('[data-testid="up-cell"]');
    expect(cells.length).toBe(2);
    await cells[1].trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/shot/2');
  });

  it('empty topPhotos renders the up-photos-empty placeholder', async () => {
    const { wrapper } = mountPage('42', { topPhotos: [] });
    await flushPromises();
    expect(wrapper.find('[data-testid="up-photos-empty"]').exists()).toBe(true);
  });

  it('switching tabs shows the placeholder for 컬렉션 / 지도', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    await wrapper.find('[data-testid="up-tab-collections"]').trigger('click');
    expect(wrapper.find('[data-testid="up-grid"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('공개 컬렉션은 곧 공개됩니다');

    await wrapper.find('[data-testid="up-tab-map"]').trigger('click');
    expect(wrapper.text()).toContain('방문 지도는 곧 공개됩니다');
  });

  it('back button calls router.back when history exists', async () => {
    window.history.pushState({}, '', '/user/42');
    const { wrapper } = mountPage();
    await flushPromises();
    backSpy.mockClear();

    await wrapper.find('[data-testid="up-back"]').trigger('click');
    expect(backSpy).toHaveBeenCalledTimes(1);
    window.history.back();
  });

  it('mounting on your own user id redirects to /profile instead of rendering (task #42)', async () => {
    mountWithStubs(UserProfilePage, {
      props: { id: '999' },
      initialState: {
        userProfile: { user: null, loading: false, error: null, followPending: false },
        auth: { user: { id: 999, nickname: 'me', handle: 'me', avatarUrl: null } },
      },
    });
    await flushPromises();
    expect(replaceSpy).toHaveBeenCalledWith('/profile');
  });
});
