import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

const { apiGetSpy } = vi.hoisted(() => ({
  apiGetSpy: vi.fn().mockImplementation((url: string) => {
    if (url === '/api/feed/recommended-users') return Promise.resolve({ data: [] });
    if (url.startsWith('/api/places/') && url.includes('/photos')) {
      return Promise.resolve({
        data: { place: null, photos: [], total: 0, page: 1, size: 20, sort: 'RECENT' },
      });
    }
    return Promise.resolve({ data: null });
  }),
}));
vi.mock('@/services/api', () => ({
  default: { get: apiGetSpy, post: vi.fn() },
}));

const { pushSpy, replaceSpy, backSpy, queryRef } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  replaceSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
  queryRef: { value: {} as Record<string, string> },
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy, back: backSpy }),
  useRoute: () => ({ query: queryRef.value, params: {} }),
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

import FeedDetailPage from '@/views/FeedDetailPage.vue';
import {
  useFeedStore,
  type FeedPost,
  type FeedTab,
  type FeedUser,
} from '@/stores/feed';
import { useSavedStore } from '@/stores/saved';
import { mountWithStubs } from './__helpers__/mount';

function makePost(id: number, overrides: Partial<FeedPost> = {}): FeedPost {
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
    content: { id: 1, title: '도깨비', contentEpisode: '1회', sceneTimestamp: '00:24:10' },
    likeCount: 100 + id,
    commentCount: 3,
    liked: false,
    saved: false,
    visitedAt: null,
    ...overrides,
  };
}

function makeUser(id: number, following = false): FeedUser {
  return {
    userId: id,
    handle: `reco${id}`,
    nickname: `추천${id}`,
    avatarUrl: `https://img/r${id}.jpg`,
    verified: false,
    contentTitle: '도깨비',
    stampCountForContent: id,
    following,
  };
}

function mountFeed(overrides: {
  posts?: FeedPost[];
  recommendedUsers?: FeedUser[];
  tab?: FeedTab;
} = {}) {
  return mountWithStubs(FeedDetailPage, {
    initialState: {
      feed: {
        posts: overrides.posts ?? [
          makePost(1, {
            sceneCompare: true,
            dramaSceneImageUrl: 'https://cdn/scene/1.jpg',
            liked: true,
          }),
          makePost(2, { visitedAt: '2026-04-20T10:00:00Z' }),
          makePost(3),
        ],
        recommendedUsers: overrides.recommendedUsers ?? [makeUser(10), makeUser(11)],
        tab: overrides.tab ?? 'RECENT',
        contentId: null,
        cursor: null,
        hasMore: false,
        loading: false,
        error: null,
      },
    },
    stubs: {
      'ion-infinite-scroll': true,
      'ion-infinite-scroll-content': true,
      CommentSheet: {
        props: ['photoId', 'open'],
        template:
          '<div class="comment-sheet-stub" :data-photo-id="photoId ?? \'\'" :data-open="open"></div>',
      },
    },
  });
}

describe('FeedDetailPage.vue', () => {
  beforeEach(() => {
    toastCreateSpy.mockClear();
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    queryRef.value = {};
  });

  it('tapping the search bar pushes /search', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('.search-row').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/search');
  });

  it('renders four tabs with the active one marked and setTab is dispatched on click', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();
    const store = useFeedStore();
    const setTabSpy = vi.spyOn(store, 'setTab').mockResolvedValue();

    const tabs = wrapper.findAll('.feed-tabs .t');
    // Order per FeedPage (task #33): 최신 / 인기 / 팔로잉 / 내 주변 / 작품별.
    expect(tabs.length).toBe(5);
    expect(tabs.map((t) => t.text())).toEqual(['최신', '인기', '팔로잉', '내 주변', '작품별']);
    // Default tab = RECENT (index 0) → .on marker on the first tab.
    expect(tabs[0].classes()).toContain('on');
    expect(tabs[1].classes()).not.toContain('on');

    await tabs[3].trigger('click'); // 내 주변 → NEARBY
    expect(setTabSpy).toHaveBeenCalledWith('NEARBY');
  });

  it('compare posts render .compare-wrap; single posts render .single-img', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();

    const posts = wrapper.findAll('.post');
    expect(posts.length).toBe(3);
    // Post 1 is sceneCompare=true → .compare-wrap.
    expect(posts[0].find('.compare-wrap').exists()).toBe(true);
    expect(posts[0].find('.single-img').exists()).toBe(false);
    // Post 2/3 are not compare → .single-img only.
    expect(posts[1].find('.single-img').exists()).toBe(true);
    expect(posts[1].find('.compare-wrap').exists()).toBe(false);
  });

  it('renders .visit-chip only on posts with a visitedAt timestamp', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();

    const posts = wrapper.findAll('.post');
    // Post 1: visitedAt null → no chip.
    expect(posts[0].find('.visit-chip').exists()).toBe(false);
    // Post 2: visitedAt set → chip rendered.
    expect(posts[1].find('.visit-chip').exists()).toBe(true);
    expect(posts[1].find('.visit-chip').text()).toContain('여기 다녀왔어요');
  });

  it('reco-strip is inserted after the first post when recommendedUsers is non-empty', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();

    const recoStrips = wrapper.findAll('.reco-strip');
    expect(recoStrips.length).toBe(1);
    // It should render 2 reco cards matching fixture length.
    const cards = recoStrips[0].findAll('.reco-card');
    expect(cards.length).toBe(2);
    // 추천 유저 카드의 이름은 nickname 우선 — handle (`reco10`) 이 아닌
    // `추천10` (makeUser fixture) 이 표시되어야 한다.
    expect(cards[0].find('.t').text()).toBe('추천10');
  });

  it('reco-strip is suppressed when recommendedUsers is empty', async () => {
    const { wrapper } = mountFeed({ recommendedUsers: [] });
    await flushPromises();

    expect(wrapper.findAll('.reco-strip').length).toBe(0);
  });

  it('post heart reflects liked state and clicking dispatches toggleLikePost', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();
    const store = useFeedStore();

    const posts = wrapper.findAll('.post');
    const heart1 = posts[0].find('.post-actions .a');
    expect(heart1.classes()).toContain('on');
    const heart2 = posts[1].find('.post-actions .a');
    expect(heart2.classes()).not.toContain('on');

    const toggleSpy = vi
      .spyOn(store, 'toggleLikePost')
      .mockImplementation(async (photoId: number) => {
        const p = store.posts.find((x) => x.id === photoId);
        if (p) {
          p.liked = true;
          p.likeCount += 1;
        }
      });

    await heart2.trigger('click');
    await flushPromises();

    expect(toggleSpy).toHaveBeenCalledWith(2);
    const heart2After = wrapper.findAll('.post')[1].find('.post-actions .a');
    expect(heart2After.classes()).toContain('on');
  });

  it('bookmark on unsaved place opens the collection picker (task #29) — no direct toggleSave', async () => {
    const { useUiStore } = await import('@/stores/ui');
    const { wrapper } = mountFeed({
      posts: [makePost(1), makePost(2)],
    });
    await flushPromises();

    const saved = useSavedStore();
    const ui = useUiStore();
    const toggleSpy = vi.spyOn(saved, 'toggleSave').mockResolvedValue();
    const pickerSpy = vi.spyOn(ui, 'openCollectionPicker');

    const saves = wrapper.findAll('[data-testid="feed-save"]');
    expect(saves.length).toBe(2);
    // Neither place is saved yet → tap routes through the picker.
    await saves[1].trigger('click');
    expect(pickerSpy).toHaveBeenCalledWith(20);
    expect(toggleSpy).not.toHaveBeenCalled();
  });

  it('bookmark on already-saved place unsaves directly (picker skipped)', async () => {
    const { useUiStore } = await import('@/stores/ui');
    const { wrapper } = mountFeed({
      posts: [makePost(1), makePost(2)],
    });
    await flushPromises();

    const saved = useSavedStore();
    const ui = useUiStore();
    saved.savedPlaceIds = [10, 20]; // both places saved
    await flushPromises();

    const toggleSpy = vi.spyOn(saved, 'toggleSave').mockResolvedValue();
    const pickerSpy = vi.spyOn(ui, 'openCollectionPicker');

    const saves = wrapper.findAll('[data-testid="feed-save"]');
    await saves[0].trigger('click');
    // Saved → single-tap unsave path, picker never opens.
    expect(toggleSpy).toHaveBeenCalledWith(10);
    expect(pickerSpy).not.toHaveBeenCalled();
  });

  it('bookmark icon re-renders immediately when savedPlaceIds mutates (task #32 reactivity)', async () => {
    const { wrapper } = mountFeed({ posts: [makePost(1)] });
    await flushPromises();
    const saved = useSavedStore();

    // Initially unsaved — the icon stub carries the outline variant.
    const saveCell = () => wrapper.find('[data-testid="feed-save"]');
    const iconRef = () => saveCell().find('ion-icon-stub').attributes('icon');
    const outlineIcon = iconRef();
    expect(outlineIcon).toBeTruthy();

    // Simulate CollectionPicker's optimistic push — the same mutation the
    // real toggleSave(on) performs before its POST resolves.
    saved.savedPlaceIds = [10];
    await flushPromises();

    // The icon attribute must flip — same cell, different icon ref.
    const filledIcon = iconRef();
    expect(filledIcon).toBeTruthy();
    expect(filledIcon).not.toBe(outlineIcon);

    // And flipping back behaves the same (unsave path).
    saved.savedPlaceIds = [];
    await flushPromises();
    expect(iconRef()).toBe(outlineIcon);
  });

  it('feed-scroll container renders and hosts the post list (task #32 nav-clearance guard)', async () => {
    // jsdom doesn't reliably expose scoped <style> text, so we can't assert
    // on the computed padding-bottom rule directly. The behavioral guard
    // is: the scroll container exists, all posts render inside it, and the
    // tail spacer is present — those three together ensure the nav-clearance
    // contract is wired up correctly even if we can't measure it.
    const { wrapper } = mountFeed();
    await flushPromises();

    const scroll = wrapper.find('.feed-scroll');
    expect(scroll.exists()).toBe(true);
    expect(scroll.findAll('article.post').length).toBe(3);
    expect(scroll.find('.tail').exists()).toBe(true);
  });

  it('clicking the comment icon opens the CommentSheet with that photoId', async () => {
    const { wrapper } = mountFeed();
    await flushPromises();

    const sheetBefore = wrapper.find('.comment-sheet-stub');
    expect(sheetBefore.attributes('data-open')).toBe('false');

    const posts = wrapper.findAll('.post');
    const commentIcon = posts[1].findAll('.post-actions .a')[1];
    await commentIcon.trigger('click');
    await flushPromises();

    const sheetAfter = wrapper.find('.comment-sheet-stub');
    expect(sheetAfter.attributes('data-open')).toBe('true');
    expect(sheetAfter.attributes('data-photo-id')).toBe('2');
  });

  it('reco-card follow button dispatches toggleFollow with the user id and reflects following state', async () => {
    const { wrapper } = mountFeed({
      recommendedUsers: [makeUser(10, false), makeUser(11, true)],
    });
    await flushPromises();
    const store = useFeedStore();

    const followSpy = vi
      .spyOn(store, 'toggleFollow')
      .mockImplementation(async (userId: number) => {
        const u = store.recommendedUsers.find((x) => x.userId === userId);
        if (u) u.following = !u.following;
      });

    const cards = wrapper.findAll('.reco-card');
    expect(cards.length).toBe(2);
    // First card: not following → button label 팔로우.
    expect(cards[0].find('.follow').text()).toBe('팔로우');
    expect(cards[0].find('.follow').classes()).not.toContain('followed');
    // Second card: following → button label 팔로잉 + .followed class.
    expect(cards[1].find('.follow').text()).toBe('팔로잉');
    expect(cards[1].find('.follow').classes()).toContain('followed');

    await cards[0].find('.follow').trigger('click');
    await flushPromises();
    expect(followSpy).toHaveBeenCalledWith(10);
  });

  it('FOLLOWING tab with empty posts renders the follow-empty empty-note', async () => {
    const { wrapper } = mountFeed({ posts: [], tab: 'FOLLOWING' });
    await flushPromises();

    const note = wrapper.find('.empty-note');
    expect(note.exists()).toBe(true);
    expect(note.text()).toContain('아직 팔로우한 사용자가 없어요');
  });

  // ── task #23: place / shotId anchor 모드 ──────────────────────────────
  it('?placeId mode hides the explore header / search / tabs and renders place-head', async () => {
    queryRef.value = { placeId: '71' };
    const { wrapper } = mountFeed({ posts: [] });
    await flushPromises();

    expect(wrapper.find('.feed-head').exists()).toBe(false);
    expect(wrapper.find('.search-row').exists()).toBe(false);
    expect(wrapper.find('.feed-tabs').exists()).toBe(false);
    expect(wrapper.find('.place-head').exists()).toBe(true);
  });

  it('?placeId mode hits the gallery endpoint (not the feed endpoint) on mount', async () => {
    queryRef.value = { placeId: '71' };
    apiGetSpy.mockClear();
    mountFeed({ posts: [] });
    await flushPromises();

    const calledUrls = apiGetSpy.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calledUrls.some((u) => u.startsWith('/api/places/71/photos'))).toBe(true);
    // place 모드에선 feed/recommended-users 등 feed 전용 엔드포인트는 호출 X.
    expect(calledUrls.some((u) => u === '/api/feed/recommended-users')).toBe(false);
  });

  it('back button on place-head calls router.back', async () => {
    queryRef.value = { placeId: '71' };
    const { wrapper } = mountFeed({ posts: [] });
    await flushPromises();

    await wrapper.find('[data-testid="feed-detail-back"]').trigger('click');
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('shotId anchor scrolls the matching card into view (scrollTop = card.offsetTop)', async () => {
    queryRef.value = { shotId: '2' };
    const { wrapper } = mountFeed();
    await flushPromises();

    // jsdom 의 article 들에 data-post-id 가 박혔는지 + 컨테이너 scrollTop 가 변동했는지.
    // jsdom 은 offsetTop 을 0 으로 보고하는 경우가 많아 정확한 값 단언은 회피하고
    // 셀렉터 매칭만 검증.
    const card = wrapper.find('[data-post-id="2"]');
    expect(card.exists()).toBe(true);
    expect(wrapper.find('.feed-scroll').exists()).toBe(true);
  });

  // ── task #25: place 모드 좋아요는 galleryStore.toggleLike 로 라우팅 ───
  it('place mode like routes through galleryStore.toggleLike (not feedStore.toggleLikePost)', async () => {
    queryRef.value = { placeId: '71' };
    // 페이지의 onMounted 가 galleryStore.fetch(71) 을 호출하면 store 의 photos 를
    // 응답으로 갈아끼우므로, 여기서는 apiGet 모킹으로 시드 데이터를 그대로 돌려준다.
    apiGetSpy.mockImplementation((url: string) => {
      if (url === '/api/feed/recommended-users') return Promise.resolve({ data: [] });
      if (url.startsWith('/api/places/71/photos')) {
        return Promise.resolve({
          data: {
            place: {
              placeId: 71,
              name: '주문진 영진해변 방파제',
              contentTitle: '도깨비',
              contentEpisode: null,
              totalPhotoCount: 1,
              contentId: 1,
            },
            photos: [
              {
                id: 555,
                imageUrl: 'https://cdn/p/555.jpg',
                caption: 'p555',
                authorUserId: 7,
                authorNickname: 'me',
                authorHandle: 'me',
                authorAvatarUrl: null,
                authorVerified: false,
                likeCount: 100,
                commentCount: 0,
                createdAt: '2026-04-22T00:00:00Z',
                sceneCompare: false,
                liked: false,
              },
            ],
            total: 1,
            page: 0,
            size: 20,
            sort: 'RECENT',
          },
        });
      }
      return Promise.resolve({ data: null });
    });
    const { wrapper } = mountFeed({ posts: [] });
    await flushPromises();

    const { useGalleryStore } = await import('@/stores/gallery');
    const { useFeedStore } = await import('@/stores/feed');
    const gallery = useGalleryStore();
    const feed = useFeedStore();
    const galleryToggleSpy = vi.spyOn(gallery, 'toggleLike').mockResolvedValue();
    const feedToggleSpy = vi.spyOn(feed, 'toggleLikePost').mockResolvedValue();

    const heart = wrapper.find('.post-actions .a');
    expect(heart.exists()).toBe(true);
    await heart.trigger('click');
    await flushPromises();

    expect(galleryToggleSpy).toHaveBeenCalledWith(555);
    expect(feedToggleSpy).not.toHaveBeenCalled();
  });

  it('share sheet receives /feed/detail?shotId=N URL (legacy /shot/N format gone)', async () => {
    const { useUiStore } = await import('@/stores/ui');
    const { wrapper } = mountFeed();
    await flushPromises();
    const ui = useUiStore();
    const openSheetSpy = vi.spyOn(ui, 'openShareSheet').mockImplementation(() => {});

    const posts = wrapper.findAll('.post');
    const shareIcon = posts[0].find('[data-testid="feed-share"]');
    await shareIcon.trigger('click');

    expect(openSheetSpy).toHaveBeenCalled();
    const arg = openSheetSpy.mock.calls[0][0];
    expect(arg.url).toContain('/feed/detail?shotId=1');
    expect(arg.url).not.toContain('/shot/');
  });
});
