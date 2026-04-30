import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url === '/api/feed/recommended-users') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: null });
    }),
    post: vi.fn(),
  },
}));

const { pushSpy, replaceSpy, backSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  replaceSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
}));
// task #25: useRoute also needed (FeedPage syncs tab to query.tab).
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy, back: backSpy }),
  useRoute: () => ({ path: '/feed', query: {} }),
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

import FeedPage from '@/views/FeedPage.vue';
import {
  useFeedStore,
  type FeedPost,
  type FeedTab,
} from '@/stores/feed';
import { mountWithStubs } from './__helpers__/mount';

function makePost(
  id: number,
  contentTitle = '도깨비',
  overrides: Partial<FeedPost> = {},
): FeedPost {
  return {
    id,
    imageUrl: `https://cdn/p/${id}.jpg`,
    caption: `post-${id}`,
    createdAt: '2026-04-22T00:00:00Z',
    sceneCompare: false,
    dramaSceneImageUrl: null,
    author: {
      userId: id,
      handle: `user${id}`,
      nickname: `닉${id}`,
      avatarUrl: `https://img/ava${id}.jpg`,
      verified: false,
      following: false,
    },
    place: { id: id * 10, name: `장소${id}`, regionLabel: '강릉시 주문진읍' },
    content: { id: 1, title: contentTitle, contentEpisode: '1회', sceneTimestamp: '00:24:10' },
    likeCount: 100 + id,
    commentCount: 3,
    liked: false,
    saved: false,
    visitedAt: null,
    ...overrides,
  };
}

function mountFeed(overrides: {
  posts?: FeedPost[];
  tab?: FeedTab;
} = {}) {
  return mountWithStubs(FeedPage, {
    initialState: {
      feed: {
        posts: overrides.posts ?? [
          // Post 1 (highest like) becomes the hero; the rest fill the grid.
          makePost(1, '도깨비', { sceneCompare: true, likeCount: 1248 }),
          makePost(2, '미스터션샤인', { likeCount: 834 }),
          makePost(3, '갯마을차차차', { sceneCompare: true, likeCount: 562 }),
          makePost(4, '도깨비', { likeCount: 472 }),
        ],
        recommendedUsers: [],
        tab: overrides.tab ?? 'RECENT',
        contentId: null,
        cursor: null,
        hasMore: false,
        loading: false,
        error: null,
        nearbyCoords: null,
      },
    },
    stubs: {
      'ion-infinite-scroll': true,
      'ion-infinite-scroll-content': true,
    },
  });
}

describe('FeedPage.vue (Explore grid — task #40)', () => {
  beforeEach(() => {
    toastCreateSpy.mockClear();
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
  });

  it('renders the head (탐색 title + notif/send icons) + search bar + tab row', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();

    expect(wrapper.find('.feed-head h1').text()).toBe('탐색');
    expect(wrapper.find('.search-bar').text()).toContain('작품, 장소, 사용자 검색');
    const tabs = wrapper.findAll('.feed-tabs .t');
    expect(tabs.map((t) => t.text())).toEqual(['최신', '인기', '팔로잉', '내 주변', '작품별']);
  });

  it('tapping the search bar pushes /search', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('.search-row').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/search');
  });

  it('chip row renders "전체" + one chip per distinct work title in posts (task #40)', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();

    const chips = wrapper.findAll('[data-testid="feed-chip"]');
    // 전체 + (도깨비 / 미스터션샤인 / 갯마을차차차) — duplicates collapsed.
    expect(chips.length).toBe(4);
    expect(chips.map((c) => c.attributes('data-chip'))).toEqual([
      '전체',
      '도깨비',
      '미스터션샤인',
      '갯마을차차차',
    ]);
    // Default active = 전체.
    expect(chips[0].classes()).toContain('on');
  });

  it('featured hero is the highest-like post from the filtered set', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();

    const featured = wrapper.find('[data-testid="feed-featured"]');
    expect(featured.exists()).toBe(true);
    // Post 1 (likeCount 1248) wins.
    expect(featured.find('img').attributes('src')).toBe('https://cdn/p/1.jpg');
    expect(featured.text()).toContain('도깨비');
    expect(featured.text()).toContain('1.2k');
  });

  it('grid renders one cell per non-featured post with drama chip + like count', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();

    const cells = wrapper.findAll('[data-testid="feed-grid-cell"]');
    // 4 posts, 1 becomes the hero → grid shows the other 3.
    expect(cells.length).toBe(3);
    // Posts ordered by posts[] minus the hero.
    expect(cells.map((c) => c.attributes('data-post-id'))).toEqual(['2', '3', '4']);
    // Post 3 has sceneCompare=true → .compare class for the split-stripe marker.
    expect(cells[1].classes()).toContain('compare');
    expect(cells[0].classes()).not.toContain('compare');
  });

  it('tapping a grid cell pushes /feed/detail?shotId=:id (task #23 unification)', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();
    pushSpy.mockClear();

    const cells = wrapper.findAll('[data-testid="feed-grid-cell"]');
    await cells[1].trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/feed/detail?shotId=3');
  });

  it('tapping the featured hero pushes /feed/detail?shotId=:id for the hero post', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('[data-testid="feed-featured"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/feed/detail?shotId=1');
  });

  it('selecting a work chip narrows the grid + hero to matching posts (task #40)', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();

    const chips = wrapper.findAll('[data-testid="feed-chip"]');
    // Click "미스터션샤인".
    const minister = chips.find((c) => c.attributes('data-chip') === '미스터션샤인');
    expect(minister).toBeDefined();
    await minister!.trigger('click');
    await flushPromises();

    // Hero becomes the only 미스터션샤인 post (id=2).
    expect(
      wrapper.find('[data-testid="feed-featured"] img').attributes('src'),
    ).toBe('https://cdn/p/2.jpg');
    // Grid is empty — only one match, and it's the hero.
    expect(wrapper.findAll('[data-testid="feed-grid-cell"]').length).toBe(0);
  });

  it('selecting "전체" resets the filter and restores the full grid', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();

    // Filter then reset.
    const chips = () => wrapper.findAll('[data-testid="feed-chip"]');
    await chips().find((c) => c.attributes('data-chip') === '도깨비')!.trigger('click');
    await flushPromises();
    await chips().find((c) => c.attributes('data-chip') === '전체')!.trigger('click');
    await flushPromises();

    // Back to full grid (3 non-hero cells).
    expect(wrapper.findAll('[data-testid="feed-grid-cell"]').length).toBe(3);
  });

  it('"전체보기 ›" tap pushes /feed/detail (full-card scroll)', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('[data-testid="feed-see-all"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/feed/detail');
  });

  it('tab click dispatches feedStore.setTab + clears any active chip', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();
    const store = useFeedStore();
    const setTabSpy = vi.spyOn(store, 'setTab').mockResolvedValue();

    // Seed an active chip first.
    const chips = wrapper.findAll('[data-testid="feed-chip"]');
    await chips
      .find((c) => c.attributes('data-chip') === '도깨비')!
      .trigger('click');
    await flushPromises();

    // Flip to NEARBY.
    const tabs = wrapper.findAll('.feed-tabs .t');
    await tabs[3].trigger('click'); // 내 주변
    expect(setTabSpy).toHaveBeenCalledWith('NEARBY');
    // Active chip resets to 전체.
    const after = wrapper.findAll('[data-testid="feed-chip"]');
    expect(after[0].classes()).toContain('on');
  });

  // task #25: tab click 시 URL query 도 동기화 (?tab=POPULAR 식). 사용자가
  // 새로고침 / 공유 URL 로 같은 탭에 복귀할 수 있게 store 와 routing 양쪽에 반영.
  it('tab click → router.replace with ?tab=<key> query synced (task #25)', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();
    const store = useFeedStore();
    vi.spyOn(store, 'setTab').mockResolvedValue();
    replaceSpy.mockClear();

    const tabs = wrapper.findAll('.feed-tabs .t');
    await tabs[1].trigger('click'); // 인기 (POPULAR)
    await flushPromises();

    expect(replaceSpy).toHaveBeenCalledWith({
      path: '/feed',
      query: { tab: 'POPULAR' },
    });
  });

  it('empty posts → no featured hero, no grid cells, empty-note shown', async () => {
    const { wrapper } = mountFeed({ posts: [] });
    await flushPromises();

    expect(wrapper.find('[data-testid="feed-featured"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="feed-grid-cell"]').length).toBe(0);
    expect(wrapper.find('.empty-note').exists()).toBe(true);
  });
});
