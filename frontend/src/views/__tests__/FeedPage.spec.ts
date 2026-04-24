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

import FeedPage from '@/views/FeedPage.vue';
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
    },
    place: { id: id * 10, name: `장소${id}`, regionLabel: '강릉시 주문진읍' },
    work: { id: 1, title: '도깨비', workEpisode: '1회', sceneTimestamp: '00:24:10' },
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
    workTitle: '도깨비',
    stampCountForWork: id,
    following,
  };
}

function mountFeed(overrides: {
  posts?: FeedPost[];
  recommendedUsers?: FeedUser[];
  tab?: FeedTab;
} = {}) {
  return mountWithStubs(FeedPage, {
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
        tab: overrides.tab ?? 'POPULAR',
        workId: null,
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

describe('FeedPage.vue', () => {
  beforeEach(() => {
    toastCreateSpy.mockClear();
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
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
    // Order per FeedPage: 팔로잉 / 인기 / 내 주변 / 작품별.
    expect(tabs.length).toBe(4);
    expect(tabs.map((t) => t.text())).toEqual(['팔로잉', '인기', '내 주변', '작품별']);
    // tab='POPULAR' (index 1) should have .on.
    expect(tabs[0].classes()).not.toContain('on');
    expect(tabs[1].classes()).toContain('on');

    await tabs[2].trigger('click'); // 내 주변 → NEARBY
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
    expect(cards[0].find('.t').text()).toBe('reco10');
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
});
