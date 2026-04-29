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
import { useGalleryStore, type GalleryPhoto } from '@/stores/gallery';
import { useSavedStore } from '@/stores/saved';
import { mountWithStubs } from './__helpers__/mount';

function makePhoto(id: number): GalleryPhoto {
  // GalleryPhoto.authorUserId 는 anonymous 시드 케이스 대비 number | null 이라
  // 명시적 어노테이션이 있어야 anonymous 테스트의 spread 가 타입 통과한다.
  return {
    id,
    imageUrl: `https://cdn/p/${id}.jpg`,
    caption: `photo-${id}`,
    authorUserId: 7,
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

function mountGallery(
  overrides: { photos?: typeof galleryState.photos } = {},
) {
  return mountWithStubs(GalleryPage, {
    props: { placeId: 10 },
    initialState: {
      gallery: {
        ...galleryState,
        photos: overrides.photos ?? galleryState.photos,
      },
    },
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
    // 3 chips: 전체/인기순/장면 비교. ('친구만' 은 백엔드에서 친구 데이터 모델이
    // 없어 그냥 RECENT 로 폴백되던 dead 옵션이라 제거됨.)
    expect(chips.length).toBe(3);
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

  it('post-head ava + handle-block click → /user/:authorUserId', async () => {
    const { wrapper } = mountGallery();
    await flushPromises();
    pushSpy.mockClear();

    const post = wrapper.findAll('.gal-feed .post')[0];
    await post.find('.ava').trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/user/7');

    pushSpy.mockClear();
    await post.find('.handle-block').trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/user/7');
  });

  it('anonymous photo (authorUserId=null) → ava/handle-block click is a no-op', async () => {
    // anonymous 시드 사진처럼 user 가 없는 케이스는 라우팅 자체를 disable.
    // (.clickable 클래스도 안 붙어 cursor 도 default.)
    const anonPhotos = [{ ...galleryState.photos[0], authorUserId: null }];
    const { wrapper } = mountGallery({ photos: anonPhotos });
    await flushPromises();
    pushSpy.mockClear();

    const post = wrapper.findAll('.gal-feed .post')[0];
    expect(post.find('.ava').classes()).not.toContain('clickable');
    expect(post.find('.handle-block').classes()).not.toContain('clickable');
    await post.find('.ava').trigger('click');
    await flushPromises();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('bookmark on a photo row opens the collection picker with the gallery place id (task #29)', async () => {
    const { useUiStore } = await import('@/stores/ui');
    const { wrapper } = mountGallery();
    await flushPromises();
    const saved = useSavedStore();
    const ui = useUiStore();
    const toggleSpy = vi.spyOn(saved, 'toggleSave').mockResolvedValue();
    const pickerSpy = vi.spyOn(ui, 'openCollectionPicker');

    const bookmarks = wrapper.findAll('[data-testid="gallery-save"]');
    // One bookmark per feed-view post.
    expect(bookmarks.length).toBe(galleryState.photos.length);

    await bookmarks[0].trigger('click');
    expect(pickerSpy).toHaveBeenCalledWith(galleryState.placeHeader.placeId);
    expect(toggleSpy).not.toHaveBeenCalled();
    // Any photo in the same gallery opens the picker for the same place.
    await bookmarks[2].trigger('click');
    expect(pickerSpy).toHaveBeenLastCalledWith(galleryState.placeHeader.placeId);
  });

  it('bookmark on already-saved place unsaves directly — picker stays closed', async () => {
    const { useUiStore } = await import('@/stores/ui');
    const { wrapper } = mountGallery();
    await flushPromises();
    const saved = useSavedStore();
    const ui = useUiStore();
    saved.savedPlaceIds = [galleryState.placeHeader.placeId];
    await flushPromises();
    const toggleSpy = vi.spyOn(saved, 'toggleSave').mockResolvedValue();
    const pickerSpy = vi.spyOn(ui, 'openCollectionPicker');

    const bookmarks = wrapper.findAll('[data-testid="gallery-save"]');
    await bookmarks[0].trigger('click');
    expect(toggleSpy).toHaveBeenCalledWith(galleryState.placeHeader.placeId);
    expect(pickerSpy).not.toHaveBeenCalled();
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

  // task #25: 페이지 언마운트 시 store 가 reset 되어 다른 placeId 갤러리 진입
  // 시 이전 데이터가 잠시 잔류하지 않게.
  it('unmount → galleryStore.reset() called (task #25 stale-data guard)', async () => {
    const { wrapper } = mountGallery();
    await flushPromises();
    const store = useGalleryStore();
    const resetSpy = vi.spyOn(store, 'reset');

    wrapper.unmount();
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });
});
