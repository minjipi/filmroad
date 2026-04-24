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

// Seed for the saved tab (task #36) — 3 items (two unclassified, one in a
// user collection) + 2 user collections. The profile's 기본 card count
// derives from `items.filter(i => i.collectionId == null).length`.
const savedSeedState = {
  collections: [
    { id: 1, name: '다음 여행 · 강릉', coverImageUrl: 'https://img/c1.jpg', count: 8, gradient: null },
    { id: 2, name: '도깨비 컴플리트', coverImageUrl: 'https://img/c2.jpg', count: 24, gradient: null },
  ],
  items: [
    {
      placeId: 10,
      name: '주문진 영진해변 방파제',
      regionLabel: '강릉시 주문진읍',
      coverImageUrl: 'https://img/p10.jpg',
      workId: 1,
      workTitle: '도깨비',
      distanceKm: 1.2,
      likeCount: 3200,
      visited: false,
      collectionId: null,
    },
    {
      placeId: 11,
      name: '덕수궁 돌담길',
      regionLabel: '정동',
      coverImageUrl: 'https://img/p11.jpg',
      workId: 1,
      workTitle: '도깨비',
      distanceKm: 8.4,
      likeCount: 900,
      visited: false,
      collectionId: null,
    },
    {
      placeId: 13,
      name: '단밤 포차',
      regionLabel: '서울 용산구 이태원동',
      coverImageUrl: 'https://img/p13.jpg',
      workId: 2,
      workTitle: '이태원 클라쓰',
      distanceKm: 4.8,
      likeCount: 5100,
      visited: true,
      collectionId: 1,
    },
  ],
  savedPlaceIds: [10, 11, 13],
  totalCount: 3,
  suggestion: null,
  loading: false,
  error: null as string | null,
};

function mountProfile(
  overrides: {
    myPhotos?: Array<{
      id: number;
      imageUrl: string;
      caption: string | null;
      placeId: number;
      placeName: string;
      regionLabel: string;
      workId: number;
      workTitle: string;
      visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
      createdAt: string;
    }>;
    myPhotosLoaded?: boolean;
    savedState?: typeof savedSeedState;
  } = {},
) {
  return mountWithStubs(ProfilePage, {
    initialState: {
      profile: {
        ...profileState,
        // task #35 fields — default empty so the empty-state asserts cleanly.
        myPhotos: overrides.myPhotos ?? [],
        myPhotosLoading: false,
        myPhotosError: null,
        myPhotosNextCursor: null,
        myPhotosLoaded: overrides.myPhotosLoaded ?? true,
      },
      saved: overrides.savedState ?? { ...savedSeedState },
    },
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

  it('all three local tabs stay in-place — photos / stampbook / saved (task #36)', async () => {
    const { wrapper } = mountProfile();
    await flushPromises();

    const tabs = wrapper.findAll('.local-tabs .tab-i');
    expect(tabs.map((t) => t.text())).toEqual(['인증샷', '스탬프북', '저장']);

    // Default: photos grid visible, no push.
    expect(wrapper.find('[data-testid="tab-photos"]').exists()).toBe(true);
    expect(pushSpy).not.toHaveBeenCalled();

    // 스탬프북 tab stays in-place.
    await tabs[1].trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="tab-stampbook"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tab-photos"]').exists()).toBe(false);
    expect(pushSpy).not.toHaveBeenCalled();

    // 저장 tab also in-place — no /saved push on tap (task #36).
    await tabs[2].trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="tab-saved"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tab-stampbook"]').exists()).toBe(false);
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('saved tab renders 기본 card + one card per user collection (task #36)', async () => {
    const { wrapper } = mountProfile();
    await flushPromises();
    await wrapper.findAll('.local-tabs .tab-i')[2].trigger('click');
    await flushPromises();

    // 기본 card count = items where collectionId == null (2 in seed).
    const def = wrapper.find('[data-testid="coll-default"]');
    expect(def.exists()).toBe(true);
    expect(def.find('.name').text()).toBe('기본');
    expect(def.find('.count').text()).toContain('2곳');

    // User collections render in store order.
    const cards = wrapper.findAll('[data-testid="coll-card"]');
    expect(cards.length).toBe(2);
    expect(cards[0].find('.name').text()).toBe('다음 여행 · 강릉');
    expect(cards[0].find('.count').text()).toContain('8곳');
    expect(cards[1].find('.name').text()).toBe('도깨비 컴플리트');
    expect(cards[1].find('.count').text()).toContain('24곳');
  });

  it('saved tab click navigation: 기본 → /saved, user collection → /collection/:id (task #36)', async () => {
    const { wrapper } = mountProfile();
    await flushPromises();
    await wrapper.findAll('.local-tabs .tab-i')[2].trigger('click');
    await flushPromises();
    pushSpy.mockClear();

    // 기본 card routes to the flat saved list (no /collection/default yet).
    await wrapper.find('[data-testid="coll-default"]').trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/saved');

    // User collection → /collection/:id.
    pushSpy.mockClear();
    await wrapper.findAll('[data-testid="coll-card"]')[0].trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/collection/1');
  });

  it('saved tab uses the 11-saved.html horizontal `.collection-row` (task #36)', async () => {
    const { wrapper } = mountProfile();
    await flushPromises();
    await wrapper.findAll('.local-tabs .tab-i')[2].trigger('click');
    await flushPromises();

    // Row container is a flex-row with horizontal scroll — no 2-column grid.
    const row = wrapper.find('.saved-tab .collection-row');
    expect(row.exists()).toBe(true);
    // "새 컬렉션" tile is SavedPage-only and must not render here.
    expect(wrapper.find('[data-testid="coll-new"]').exists()).toBe(false);
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

  it('photos tab renders one cell per myPhotos entry with work chip + image (task #35)', async () => {
    const { wrapper } = mountProfile({
      myPhotos: [
        {
          id: 101,
          imageUrl: 'https://cdn/p/101.jpg',
          caption: '첫 방문',
          placeId: 10,
          placeName: '주문진 영진해변 방파제',
          regionLabel: '강원 강릉시',
          workId: 1,
          workTitle: '도깨비',
          visibility: 'PUBLIC' as const,
          createdAt: '2026-04-22T00:00:00Z',
        },
        {
          id: 102,
          imageUrl: 'https://cdn/p/102.jpg',
          caption: null,
          placeId: 11,
          placeName: '덕수궁 돌담길',
          regionLabel: '서울 중구',
          workId: 1,
          workTitle: '도깨비',
          visibility: 'PUBLIC' as const,
          createdAt: '2026-04-20T00:00:00Z',
        },
      ],
    });
    await flushPromises();

    const cells = wrapper.findAll('[data-testid="shot-cell"]');
    expect(cells.length).toBe(2);
    expect(cells[0].find('img').attributes('src')).toBe('https://cdn/p/101.jpg');
    expect(cells[0].find('.tag').text()).toBe('도깨비');
    expect(cells[1].find('img').attributes('src')).toBe('https://cdn/p/102.jpg');
  });

  it('photos tab renders the empty-note when myPhotos is empty and load has settled (task #35)', async () => {
    const { wrapper } = mountProfile({ myPhotos: [], myPhotosLoaded: true });
    await flushPromises();

    expect(wrapper.findAll('[data-testid="shot-cell"]').length).toBe(0);
    const empty = wrapper.find('[data-testid="photos-empty"]');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toContain('아직 인증샷이 없어요');
  });

  it('clicking a photo cell pushes /shot/:id (not /shot/<grid-index>) (task #35)', async () => {
    const { wrapper } = mountProfile({
      myPhotos: [
        {
          id: 777,
          imageUrl: 'https://cdn/p/777.jpg',
          caption: null,
          placeId: 10,
          placeName: '주문진',
          regionLabel: '강원',
          workId: 1,
          workTitle: '도깨비',
          visibility: 'PUBLIC' as const,
          createdAt: '2026-04-22T00:00:00Z',
        },
      ],
    });
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('[data-testid="shot-cell"]').trigger('click');
    await flushPromises();
    // Now pushes the real photo id (777), not the grid position.
    expect(pushSpy).toHaveBeenCalledWith('/shot/777');
  });

  it('first-time photos tab entry calls fetchMyPhotos; re-entry uses cached state (task #35)', async () => {
    const { wrapper } = mountProfile({ myPhotosLoaded: false });
    await flushPromises();
    // onMounted already fired a fetch on the real action (which hit the
    // null mock and flipped myPhotosLoaded back to true via the guard).
    // Reset the flag + install the spy to observe subsequent tab-driven
    // fetches explicitly.
    const store = (await import('@/stores/profile')).useProfileStore();
    store.myPhotosLoaded = false;
    const fetchSpy = vi.spyOn(store, 'fetchMyPhotos').mockResolvedValue();

    // Move to stampbook then back to photos — triggers one fetch.
    await wrapper.findAll('.local-tabs .tab-i')[1].trigger('click');
    await flushPromises();
    await wrapper.findAll('.local-tabs .tab-i')[0].trigger('click');
    await flushPromises();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Flip the loaded flag as the real store would, then re-enter — no second fetch.
    store.myPhotosLoaded = true;
    await wrapper.findAll('.local-tabs .tab-i')[1].trigger('click');
    await flushPromises();
    await wrapper.findAll('.local-tabs .tab-i')[0].trigger('click');
    await flushPromises();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('"지도로 보기" overlay link pushes /map', async () => {
    const { wrapper } = mountProfile();
    await flushPromises();

    await wrapper.find('.map-overlay .r').trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/map');
  });
});
