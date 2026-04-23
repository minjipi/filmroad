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

import GalleryPage from '@/views/GalleryPage.vue';
import { useGalleryStore } from '@/stores/gallery';
import { mountWithStubs } from './__helpers__/mount';

function makePhoto(id: number) {
  return {
    id,
    imageUrl: `https://cdn/p/${id}.jpg`,
    caption: `photo-${id}`,
    authorNickname: '김미루',
    authorHandle: 'miru',
    authorAvatarUrl: 'https://img/ava.jpg',
    authorVerified: true,
    createdAt: '2026-04-22T00:00:00Z',
    likeCount: 120,
    commentCount: 3,
    sceneCompare: id === 1,
  };
}

const galleryState = {
  placeHeader: {
    placeId: 10,
    name: '주문진 영진해변 방파제',
    workId: 1,
    workTitle: '도깨비',
    workEpisode: '1회',
    totalPhotoCount: 3,
  },
  photos: [makePhoto(1), makePhoto(2), makePhoto(3)],
  total: 3,
  sort: 'RECENT' as const,
  viewMode: 'FEED' as const,
  page: 0,
  size: 20,
  loading: false,
  error: null as string | null,
};

function mountGallery() {
  return mountWithStubs(GalleryPage, {
    props: { placeId: 10 },
    initialState: { gallery: { ...galleryState } },
    stubs: {
      CommentSheet: {
        props: ['photoId', 'open'],
        template:
          '<div class="comment-sheet-stub" :data-photo-id="photoId ?? \'\'" :data-open="open"></div>',
      },
    },
  });
}

describe('GalleryPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
  });

  it('top bar renders placeHeader.name and totalPhotoCount summary', async () => {
    const { wrapper } = mountGallery();
    await flushPromises();

    const h1 = wrapper.find('.top h1');
    expect(h1.text()).toContain('주문진 영진해변 방파제');
    expect(h1.text()).toContain('3개');
    expect(h1.text()).toContain('도깨비');
    expect(h1.text()).toContain('1회');
  });

  it('clicking a sort chip dispatches setSort on the store', async () => {
    const { wrapper } = mountGallery();
    await flushPromises();
    const store = useGalleryStore();
    const setSortSpy = vi.spyOn(store, 'setSort').mockResolvedValue();

    const chips = wrapper.findAll('.filter-row .chips .ch');
    // 4 chips: 전체/인기순/친구만/장면 비교.
    expect(chips.length).toBe(4);
    // RECENT is active by default.
    expect(chips[0].classes()).toContain('on');

    await chips[1].trigger('click'); // 인기순 → POPULAR
    expect(setSortSpy).toHaveBeenCalledWith('POPULAR');
  });

  it('view toggle dispatches setViewMode with FEED / GRID', async () => {
    const { wrapper } = mountGallery();
    await flushPromises();
    const store = useGalleryStore();
    const setViewModeSpy = vi.spyOn(store, 'setViewMode');

    const toggles = wrapper.findAll('.view-toggle .vi');
    expect(toggles.length).toBe(2);
    await toggles[1].trigger('click');
    expect(setViewModeSpy).toHaveBeenCalledWith('GRID');

    await toggles[0].trigger('click');
    expect(setViewModeSpy).toHaveBeenCalledWith('FEED');
  });

  it('FEED view renders one .post per photo', async () => {
    const { wrapper } = mountGallery();
    await flushPromises();

    const posts = wrapper.findAll('.gal-feed .post');
    expect(posts.length).toBe(galleryState.photos.length);
    // .grid-view is not rendered in FEED mode.
    expect(wrapper.find('.grid-view').exists()).toBe(false);
  });

  it('clicking a post comment icon opens the CommentSheet with that photoId', async () => {
    const { wrapper } = mountGallery();
    await flushPromises();

    const sheetBefore = wrapper.find('.comment-sheet-stub');
    expect(sheetBefore.attributes('data-open')).toBe('false');

    const posts = wrapper.findAll('.gal-feed .post');
    const commentIcon = posts[1].findAll('.post-actions .a')[1];
    await commentIcon.trigger('click');
    await flushPromises();

    const sheetAfter = wrapper.find('.comment-sheet-stub');
    expect(sheetAfter.attributes('data-open')).toBe('true');
    expect(sheetAfter.attributes('data-photo-id')).toBe(String(galleryState.photos[1].id));
  });
});
