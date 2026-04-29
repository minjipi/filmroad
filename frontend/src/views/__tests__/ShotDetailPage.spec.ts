import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

// API mock — default resolves with the fixture for happy-path rendering.
// Individual tests override via mockResolvedValueOnce / mockRejectedValueOnce.
vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import api from '@/services/api';

const { pushSpy, replaceSpy, backSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  replaceSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy, back: backSpy }),
}));

const { toastCreateSpy, actionSheetCreateSpy, alertCreateSpy } = vi.hoisted(() => ({
  toastCreateSpy: vi
    .fn()
    .mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
  // 더보기 메뉴(actionSheet) / 삭제 확인(alert) 은 Ionic controller 기반.
  // 테스트는 buttons 배열을 직접 캡처해 handler 호출로 분기 검증한다.
  actionSheetCreateSpy: vi
    .fn()
    .mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
  alertCreateSpy: vi
    .fn()
    .mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@ionic/vue', async () => {
  const actual = await vi.importActual<typeof import('@ionic/vue')>('@ionic/vue');
  return {
    ...actual,
    toastController: { create: toastCreateSpy },
    actionSheetController: { create: actionSheetCreateSpy },
    alertController: { create: alertCreateSpy },
  };
});

import ShotDetailPage from '@/views/ShotDetailPage.vue';
import type { ShotDetail } from '@/stores/shotDetail';
import { mountWithStubs } from './__helpers__/mount';

const fixture: ShotDetail = {
  id: 77,
  imageUrl: 'https://cdn/p/77.jpg',
  sceneImageUrl: 'https://cdn/scene/77.jpg',
  caption: '메밀꽃 한 다발 들고 기다렸어요 🌾',
  tags: ['도깨비', '주문진'],
  createdAt: '2026-04-20T10:00:00Z',
  visibility: 'PUBLIC',
  likeCount: 1248,
  commentCount: 89,
  liked: true,
  saved: false,
  author: {
    id: 1,
    nickname: '김소연',
    handle: 'soyeon_film',
    avatarUrl: 'https://img/ava1.jpg',
    verified: true,
    isMe: true,
    following: false,
  },
  place: {
    id: 10,
    name: '주문진 영진해변 방파제',
    regionLabel: '강원 강릉시 주문진읍',
    latitude: 37.89,
    longitude: 128.83,
  },
  work: {
    id: 1,
    title: '도깨비',
    network: 'tvN',
    episode: '1회',
    sceneTimestamp: '00:15:24',
  },
  images: [{ id: 77, imageUrl: 'https://cdn/p/77.jpg', imageOrderIndex: 0 }],
  topComments: [
    {
      id: 1,
      content: '와 이 구도 대박…',
      authorHandle: 'trip_hj',
      authorAvatarUrl: 'https://img/ava2.jpg',
      createdAt: '2026-04-20T11:00:00Z',
      likeCount: 24,
      liked: true,
      isReply: false,
    },
    {
      id: 2,
      content: '원본이랑 나란히 보니까 소름 돋아요',
      authorHandle: 'dokkaebi.love',
      authorAvatarUrl: null,
      createdAt: '2026-04-20T12:00:00Z',
      likeCount: 18,
      liked: false,
      isReply: false,
    },
  ],
  moreCommentsCount: 85,
};

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const COMMENT_SHEET_STUB = {
  props: ['photoId', 'open'],
  template:
    '<div class="comment-sheet-stub" :data-photo-id="photoId ?? \'\'" :data-open="open"></div>',
};

function mountPage(id: string | number = '77') {
  return mountWithStubs(ShotDetailPage, {
    props: { id },
    initialState: {
      shotDetail: { shot: fixture, loading: false, error: null },
      // Seed a signed-in auth state so toggleLike/toggleSave don't short-circuit
      // at the login prompt.
      auth: {
        user: { id: 1, nickname: 'me', handle: 'me', avatarUrl: null },
      },
    },
    stubs: {
      CommentSheet: COMMENT_SHEET_STUB,
    },
  });
}

describe('ShotDetailPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
    actionSheetCreateSpy.mockClear();
    alertCreateSpy.mockClear();
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.patch.mockReset();
    mockApi.delete.mockReset();
    // Default mock: the onMounted fetchShot hits the API; return the same
    // fixture so the initialState seed isn't clobbered post-fetch.
    mockApi.get.mockResolvedValue({ data: fixture });
  });

  it('mounted → GET /api/photos/:id is called with the route param (task #39)', async () => {
    mountPage('77');
    await flushPromises();

    const called = mockApi.get.mock.calls.some(
      (call) => String(call[0]) === '/api/photos/77',
    );
    expect(called).toBe(true);
  });

  it('renders the loaded shell when shot is populated (not loading/error)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="sd-loaded"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="sd-loading"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="sd-error"]').exists()).toBe(false);
  });

  it('renders the loading placeholder while shot is null + loading=true', async () => {
    // onMounted fires fetchShot; make the api.get hang so the loading state
    // survives past flushPromises and the placeholder can be asserted.
    mockApi.get.mockReset();
    mockApi.get.mockImplementation(() => new Promise(() => undefined));
    const { wrapper } = mountWithStubs(ShotDetailPage, {
      props: { id: '77' },
      initialState: {
        shotDetail: { shot: null, loading: true, error: null },
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="sd-loading"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="sd-loaded"]').exists()).toBe(false);
  });

  it('renders the error placeholder when fetch fails (shot=null + error set)', async () => {
    // Override the default mock: this test wants a 404-style failure.
    mockApi.get.mockReset();
    mockApi.get.mockRejectedValueOnce(new Error('Not Found'));
    const { wrapper } = mountWithStubs(ShotDetailPage, {
      props: { id: '999' },
      initialState: {
        shotDetail: { shot: null, loading: false, error: 'Not Found' },
      },
    });
    await flushPromises();

    const err = wrapper.find('[data-testid="sd-error"]');
    expect(err.exists()).toBe(true);
    expect(err.text()).toContain('Not Found');
  });

  it('hero scene-meta + compare row render work title + episode + timestamp from store', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const sceneMeta = wrapper.find('.scene-meta').text();
    expect(sceneMeta).toContain('도깨비');
    expect(sceneMeta).toContain('1회');
    expect(sceneMeta).toContain('00:15:24');

    // Compare row pulls the drama-scene image for the top layer + the user
    // image for the bottom layer.
    const imgs = wrapper.findAll('section.compare img');
    expect(imgs.length).toBe(2);
    expect(imgs[0].attributes('src')).toBe('https://cdn/scene/77.jpg');
    expect(imgs[1].attributes('src')).toBe('https://cdn/p/77.jpg');
  });

  it('renders the multi-image carousel when images.length > 1 (task #44/#45)', async () => {
    const multi = {
      ...fixture,
      images: [
        { id: 77, imageUrl: 'https://cdn/p/77.jpg', imageOrderIndex: 0 },
        { id: 78, imageUrl: 'https://cdn/p/78.jpg', imageOrderIndex: 1 },
        { id: 79, imageUrl: 'https://cdn/p/79.jpg', imageOrderIndex: 2 },
      ],
    };
    mockApi.get.mockResolvedValueOnce({ data: multi });

    const { wrapper } = mountPage();
    await flushPromises();

    // Carousel track + three slides + three dots.
    expect(wrapper.find('[data-testid="sd-carousel"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="sd-slide"]').length).toBe(3);
    expect(wrapper.findAll('[data-testid="sd-dots"] .dot').length).toBe(3);
    expect(wrapper.find('[data-testid="sd-count"]').text()).toContain('1 / 3');
  });

  it('renders the plain compare hero when images.length === 1 (single-image post)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    expect(wrapper.find('[data-testid="sd-carousel"]').exists()).toBe(false);
    expect(wrapper.find('section.compare').exists()).toBe(true);
  });

  it('user meta row shows author nickname + place + verified badge', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const user = wrapper.find('.sd-user');
    expect(user.text()).toContain('김소연');
    expect(user.text()).toContain('주문진 영진해변 방파제');
    expect(user.find('.verified').exists()).toBe(true);
  });

  it('author-action button is hidden when shot.author.isMe (no self follow / placeholder)', async () => {
    // 기본 fixture 의 isMe=true — 본인 사진 컨텍스트.
    const { wrapper } = mountPage();
    await flushPromises();
    expect(wrapper.find('[data-testid="sd-author-action"]').exists()).toBe(false);
  });

  it('author-action button is visible with 팔로우/팔로잉 label when shot.author is someone else', async () => {
    // beforeEach 가 fixture (isMe=true) 를 mockResolvedValue 로 깔아두기 때문에
    // onMounted 의 fetch 가 initialState 를 덮어쓴다. 다른 사람 시나리오로
    // 가려면 mock 자체를 isMe=false 인 변형으로 한 번 갈아끼우면 충분.
    const otherUserFixture: ShotDetail = {
      ...fixture,
      author: { ...fixture.author, isMe: false, following: false },
    };
    mockApi.get.mockReset();
    mockApi.get.mockResolvedValue({ data: otherUserFixture });

    const { wrapper } = mountPage();
    await flushPromises();
    const btn = wrapper.find('[data-testid="sd-author-action"]');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toBe('팔로우');
    expect(btn.classes()).not.toContain('on');
  });

  it('caption + tags render verbatim (no v-html; tags prefixed with #)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const caption = wrapper.find('.sd-caption .body');
    expect(caption.text()).toContain('메밀꽃 한 다발 들고 기다렸어요');

    const tags = wrapper.findAll('.sd-caption .tag');
    expect(tags.map((t) => t.text())).toEqual(['#도깨비', '#주문진']);
  });

  it('inline preview shows at most 1 top comment + "모두 보기" link with full commentCount', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    // 인라인 preview 는 항상 1건만 노출 — 나머지는 "모두 보기" 로 모달 진입.
    const comments = wrapper.findAll('[data-testid="sd-comment"]');
    expect(comments.length).toBe(1);
    expect(comments[0].find('.nm').text()).toBe('trip_hj');

    // see-more 는 commentCount(89) 를 그대로 보여줌 — moreCommentsCount(85) 는
    // backend 가 지금까지 잘라서 알려주는 값이지만, inline 은 1건만 보여주니
    // "전체 N개" 가 사용자에게 더 직관적.
    expect(wrapper.find('.see-more').text()).toContain('89');
  });

  it('like button reflects shot.liked and tap calls POST /api/photos/:id/like (task #39)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const btn = wrapper.find('[data-testid="sd-like-btn"]');
    expect(btn.classes()).toContain('liked'); // fixture.liked = true

    mockApi.post.mockResolvedValueOnce({ data: { liked: false, likeCount: 1247 } });
    await btn.trigger('click');
    await flushPromises();

    expect(mockApi.post).toHaveBeenCalledTimes(1);
    const [url] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/photos/77/like');
  });

  it('save button routes through uiStore.openCollectionPicker for an unsaved place (task #29 parity)', async () => {
    const { useUiStore } = await import('@/stores/ui');
    const { wrapper } = mountPage();
    await flushPromises();
    const ui = useUiStore();
    const pickerSpy = vi.spyOn(ui, 'openCollectionPicker');

    await wrapper.find('[data-testid="sd-save-btn"]').trigger('click');
    await flushPromises();

    expect(pickerSpy).toHaveBeenCalledWith(10);
  });

  // task #13: loc-card 와 scene-card 두 섹션이 사용자 결정으로 제거됨.
  // 장소 진입 / 원본 장면 재생 버튼 둘 다 더 이상 페이지에 존재하지 않음 —
  // 회귀 단언 자체가 의미를 잃어 spec 에서 제거. 향후 진입점이 다시
  // 생기면 그 시점에 새 spec 으로 커버.
  it('task #13: loc-card and scene-card sections are no longer rendered', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    expect(wrapper.find('.loc-card').exists()).toBe(false);
    expect(wrapper.find('.scene-card').exists()).toBe(false);
  });

  it('clicking the sticky comment trigger opens the CommentSheet for this shot', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    // Initially the sheet stays closed (open=false, photoId=null).
    let stub = wrapper.find('.comment-sheet-stub');
    expect(stub.exists()).toBe(true);
    expect(stub.attributes('data-open')).toBe('false');
    expect(stub.attributes('data-photo-id')).toBe('');

    await wrapper.find('[data-testid="sd-cmt-trigger"]').trigger('click');
    await flushPromises();

    stub = wrapper.find('.comment-sheet-stub');
    expect(stub.attributes('data-open')).toBe('true');
    expect(stub.attributes('data-photo-id')).toBe('77');
  });

  it('compare hero toggles data-mode + aria-pressed + label on click (task #12)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const compare = wrapper.find('section.compare');
    expect(compare.exists()).toBe(true);
    // Default = "shot": user's photo on top, toggle aria-pressed=false.
    expect(compare.attributes('data-mode')).toBe('shot');

    const toggle = wrapper.find('[data-testid="sd-compare-toggle"]');
    expect(toggle.exists()).toBe(true);
    expect(toggle.attributes('aria-pressed')).toBe('false');
    expect(toggle.text()).toContain('가이드 보기');

    await toggle.trigger('click');
    await flushPromises();

    expect(wrapper.find('section.compare').attributes('data-mode')).toBe('guide');
    const toggleAfter = wrapper.find('[data-testid="sd-compare-toggle"]');
    expect(toggleAfter.attributes('aria-pressed')).toBe('true');
    expect(toggleAfter.text()).toContain('원본으로');

    // Tap again → returns to shot.
    await toggleAfter.trigger('click');
    await flushPromises();
    expect(wrapper.find('section.compare').attributes('data-mode')).toBe('shot');
  });

  it('compare toggle is hidden when sceneImageUrl is null (no guide image to flip to)', async () => {
    const noScene = { ...fixture, sceneImageUrl: null };
    mockApi.get.mockResolvedValueOnce({ data: noScene });
    const { wrapper } = mountWithStubs(ShotDetailPage, {
      props: { id: '77' },
      initialState: {
        shotDetail: { shot: noScene, loading: false, error: null },
        auth: { user: { id: 1, nickname: 'me', handle: 'me', avatarUrl: null } },
      },
      stubs: { CommentSheet: COMMENT_SHEET_STUB },
    });
    await flushPromises();

    expect(wrapper.find('section.compare').exists()).toBe(true);
    expect(wrapper.find('[data-testid="sd-compare-toggle"]').exists()).toBe(false);
  });

  // task #15 — infinite scroll wiring. The page mounts an IntersectionObserver
  // on a sentinel below the comment input; firing intersection triggers
  // shotStore.loadNext() and the response posts render as feed cards.
  it('IntersectionObserver intersection on sentinel calls loadNext + renders feed cards (task #15)', async () => {
    let observerCallback: IntersectionObserverCallback | null = null;
    const observeSpy = vi.fn();
    const disconnectSpy = vi.fn();
    const ObserverMock = vi
      .fn()
      .mockImplementation((cb: IntersectionObserverCallback) => {
        observerCallback = cb;
        return {
          observe: observeSpy,
          unobserve: vi.fn(),
          disconnect: disconnectSpy,
          takeRecords: vi.fn().mockReturnValue([]),
          root: null,
          rootMargin: '',
          thresholds: [],
        };
      });
    const originalObserver = (window as unknown as { IntersectionObserver?: typeof IntersectionObserver })
      .IntersectionObserver;
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = ObserverMock;

    try {
      const { wrapper } = mountPage();
      await flushPromises();

      // Observer was constructed against the sentinel.
      expect(ObserverMock).toHaveBeenCalled();
      expect(observeSpy).toHaveBeenCalled();

      // Stub the feed endpoint with one post so loadNext renders a card.
      const feedPost = {
        id: 76,
        imageUrl: 'https://cdn/p/76.jpg',
        caption: '다음 인증샷',
        createdAt: '2026-04-19T10:00:00Z',
        sceneCompare: true,
        dramaSceneImageUrl: 'https://cdn/scene/76.jpg',
        author: {
          userId: 2,
          handle: 'trip_hj',
          nickname: 'trip_hj',
          avatarUrl: null,
          verified: false,
          following: false,
        },
        place: { id: 11, name: '강릉 안목해변', regionLabel: '강원 강릉시' },
        work: { id: 1, title: '도깨비', workEpisode: '2회', sceneTimestamp: '00:25:01' },
        likeCount: 100,
        commentCount: 12,
        liked: false,
        saved: false,
        visitedAt: null,
      };
      mockApi.get.mockResolvedValueOnce({
        data: { posts: [feedPost], hasMore: true, nextCursor: '75' },
      });

      // Fire intersection.
      expect(observerCallback).toBeTruthy();
      observerCallback!(
        [
          { isIntersecting: true, target: document.createElement('div') } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
      await flushPromises();

      // /api/feed was called with the seed cursor (the primary shot id).
      const feedCall = mockApi.get.mock.calls.find((c) => String(c[0]) === '/api/feed');
      expect(feedCall).toBeTruthy();

      // Feed card rendered with the post's caption + handle.
      const cards = wrapper.findAll('[data-testid="sd-feed-card"]');
      expect(cards.length).toBe(1);
      expect(cards[0].text()).toContain('다음 인증샷');
      expect(cards[0].text()).toContain('trip_hj');
    } finally {
      if (originalObserver) {
        (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = originalObserver;
      } else {
        delete (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
      }
    }
  });

  // task #17 — appended cards use the same 5-section markup as the primary
  // shot (.compare / .sd-user / .sd-stats / .sd-caption / .cmt-input-wrap).
  // task #18 — buttons are now fully interactive (only 공유 stays disabled).
  it('appended feed cards render the same 5-section structure as the primary shot (task #17/#18)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const { useShotDetailStore } = await import('@/stores/shotDetail');
    const store = useShotDetailStore();
    store.appendedShots.push({
      id: 76,
      imageUrl: 'https://cdn/p/76.jpg',
      caption: '안목해변에서',
      createdAt: '2026-04-19T10:00:00Z',
      sceneCompare: true,
      dramaSceneImageUrl: 'https://cdn/scene/76.jpg',
      author: {
        userId: 2,
        handle: 'trip_hj',
        nickname: 'trip_hj',
        avatarUrl: null,
        verified: true,
        following: true,
      },
      place: { id: 11, name: '강릉 안목해변', regionLabel: '강원 강릉시' },
      work: { id: 1, title: '도깨비', workEpisode: '2회', sceneTimestamp: '00:25:01' },
      likeCount: 100,
      commentCount: 12,
      liked: false,
      saved: false,
      visitedAt: null,
    });
    await flushPromises();

    const cards = wrapper.findAll('[data-testid="sd-feed-card"]');
    expect(cards.length).toBe(1);
    const card = cards[0];

    // 5 sections — same class names as primary so styles cascade through.
    expect(card.find('section.compare').exists()).toBe(true);
    expect(card.find('section.sd-user').exists()).toBe(true);
    expect(card.find('section.sd-stats').exists()).toBe(true);
    expect(card.find('section.sd-caption').exists()).toBe(true);
    expect(card.find('button.cmt-input-wrap').exists()).toBe(true);

    // compare-hero — two imgs (drama + shot) + scene-meta with work info.
    const compareImgs = card.findAll('section.compare img');
    expect(compareImgs.length).toBe(2);
    expect(compareImgs[0].attributes('src')).toBe('https://cdn/scene/76.jpg');
    expect(compareImgs[1].attributes('src')).toBe('https://cdn/p/76.jpg');
    expect(card.find('section.compare .scene-meta').text()).toContain('도깨비');
    expect(card.find('section.compare .scene-meta').text()).toContain('2회');

    // sd-user — nickname + place + verified, all interactive (task #18).
    expect(card.find('.sd-user .nm').text()).toContain('trip_hj');
    expect(card.find('.sd-user .verified').exists()).toBe(true);
    expect(card.find('.sd-user .sub').text()).toContain('강릉 안목해변');
    expect((card.find('.sd-user .nm').element as HTMLButtonElement).disabled).toBe(false);
    expect((card.find('.sd-user .follow').element as HTMLButtonElement).disabled).toBe(false);

    // sd-stats — 4 buttons. 좋아요/댓글/저장 interactive (task #18), 공유 disabled.
    const statBtns = card.findAll('.sd-stat-btn');
    expect(statBtns.length).toBe(4);
    expect((statBtns[0].element as HTMLButtonElement).disabled).toBe(false); // 좋아요
    expect((statBtns[1].element as HTMLButtonElement).disabled).toBe(false); // 댓글
    expect((statBtns[2].element as HTMLButtonElement).disabled).toBe(false); // 저장
    expect((statBtns[3].element as HTMLButtonElement).disabled).toBe(true); // 공유 (no real endpoint)

    // sd-caption — caption text only (FeedPost has no tags).
    expect(card.find('.sd-caption .body').text()).toContain('안목해변에서');
    expect(card.findAll('.sd-caption .tag').length).toBe(0);

    // cmt-input-wrap — interactive (task #18).
    expect((card.find('button.cmt-input-wrap').element as HTMLButtonElement).disabled).toBe(false);
  });

  // task #18 — appended-card interaction wiring.
  function seedAppended(extra: Partial<{
    id: number;
    likeCount: number;
    liked: boolean;
    saved: boolean;
    following: boolean;
    userId: number;
    placeId: number;
  }> = {}) {
    return {
      id: extra.id ?? 76,
      imageUrl: 'https://cdn/p/76.jpg',
      caption: '안목해변에서',
      createdAt: '2026-04-19T10:00:00Z',
      sceneCompare: true,
      dramaSceneImageUrl: 'https://cdn/scene/76.jpg',
      author: {
        userId: extra.userId ?? 2,
        handle: 'trip_hj',
        nickname: 'trip_hj',
        avatarUrl: null,
        verified: false,
        following: extra.following ?? false,
      },
      place: { id: extra.placeId ?? 11, name: '강릉 안목해변', regionLabel: '강원 강릉시' },
      work: { id: 1, title: '도깨비', workEpisode: '2회', sceneTimestamp: '00:25:01' },
      likeCount: extra.likeCount ?? 100,
      commentCount: 12,
      liked: extra.liked ?? false,
      saved: extra.saved ?? false,
      visitedAt: null,
    };
  }

  it('appended card 좋아요 click → POST /api/photos/:id/like + optimistic flip (task #18)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    const { useShotDetailStore } = await import('@/stores/shotDetail');
    const store = useShotDetailStore();
    store.appendedShots.push(seedAppended({ id: 76, likeCount: 100, liked: false }));
    await flushPromises();

    mockApi.post.mockResolvedValueOnce({ data: { liked: true, likeCount: 101 } });

    const card = wrapper.find('[data-testid="sd-feed-card"]');
    const likeBtn = card.findAll('.sd-stat-btn')[0];
    await likeBtn.trigger('click');
    await flushPromises();

    const calls = mockApi.post.mock.calls;
    const likeCall = calls.find((c) => String(c[0]) === '/api/photos/76/like');
    expect(likeCall).toBeTruthy();
    expect(store.appendedShots[0].liked).toBe(true);
    expect(store.appendedShots[0].likeCount).toBe(101);
  });

  it('appended card 저장 click for an unsaved place → opens collection picker (task #18)', async () => {
    const { useUiStore } = await import('@/stores/ui');
    const { wrapper } = mountPage();
    await flushPromises();
    const { useShotDetailStore } = await import('@/stores/shotDetail');
    const store = useShotDetailStore();
    store.appendedShots.push(seedAppended({ placeId: 22 }));
    await flushPromises();

    const ui = useUiStore();
    const pickerSpy = vi.spyOn(ui, 'openCollectionPicker');

    const card = wrapper.find('[data-testid="sd-feed-card"]');
    const saveBtn = card.findAll('.sd-stat-btn')[2];
    await saveBtn.trigger('click');
    await flushPromises();

    expect(pickerSpy).toHaveBeenCalledWith(22);
  });

  it('appended card 팔로우 click → POST /api/users/:userId/follow + optimistic flip (task #18)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    const { useShotDetailStore } = await import('@/stores/shotDetail');
    const store = useShotDetailStore();
    store.appendedShots.push(seedAppended({ userId: 9, following: false }));
    await flushPromises();

    mockApi.post.mockResolvedValueOnce({
      data: { following: true, followersCount: 1, followingCount: 1 },
    });

    const card = wrapper.find('[data-testid="sd-feed-card"]');
    await card.find('.sd-user .follow').trigger('click');
    await flushPromises();

    const calls = mockApi.post.mock.calls;
    const followCall = calls.find((c) => String(c[0]) === '/api/users/9/follow');
    expect(followCall).toBeTruthy();
    expect(store.appendedShots[0].author.following).toBe(true);
  });

  it('appended card cmt-input-wrap click → opens CommentSheet for that post id (task #18)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    const { useShotDetailStore } = await import('@/stores/shotDetail');
    const store = useShotDetailStore();
    store.appendedShots.push(seedAppended({ id: 76 }));
    await flushPromises();

    // 초기엔 시트 닫힘.
    let stub = wrapper.find('.comment-sheet-stub');
    expect(stub.attributes('data-open')).toBe('false');

    const card = wrapper.find('[data-testid="sd-feed-card"]');
    await card.find('button.cmt-input-wrap').trigger('click');
    await flushPromises();

    stub = wrapper.find('.comment-sheet-stub');
    expect(stub.attributes('data-open')).toBe('true');
    // primary shot id (77) 가 아닌 appended post id (76) 로 시트 열림.
    expect(stub.attributes('data-photo-id')).toBe('76');
  });

  // task #21 — avatar / sub(place) 클릭 라우팅. avatar 는 nm 와 동일 동작
  // (작성자 프로필), sub 는 신규 동작 (/map?selectedId=<placeId>).
  it('primary avatar click → router.push /user/:authorId (task #21)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('[data-testid="sd-avatar"]').trigger('click');
    await flushPromises();
    // fixture.author.id = 1
    expect(pushSpy).toHaveBeenCalledWith('/user/1');
  });

  it('primary sub(place) click → router.push /map?selectedId=:placeId (task #21)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('[data-testid="sd-place-link"]').trigger('click');
    await flushPromises();
    // fixture.place.id = 10 → query.selectedId = "10"
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/map',
      query: { selectedId: '10' },
    });
  });

  it('appended card avatar click → router.push /user/:userId (task #21)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    const { useShotDetailStore } = await import('@/stores/shotDetail');
    const store = useShotDetailStore();
    store.appendedShots.push(seedAppended({ userId: 9 }));
    await flushPromises();

    pushSpy.mockClear();
    const card = wrapper.find('[data-testid="sd-feed-card"]');
    await card.find('.avatar').trigger('click');
    await flushPromises();

    expect(pushSpy).toHaveBeenCalledWith('/user/9');
  });

  it('appended card sub(place) click → router.push /map?selectedId=:placeId (task #21)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    const { useShotDetailStore } = await import('@/stores/shotDetail');
    const store = useShotDetailStore();
    store.appendedShots.push(seedAppended({ placeId: 22 }));
    await flushPromises();

    pushSpy.mockClear();
    const card = wrapper.find('[data-testid="sd-feed-card"]');
    await card.find('.sub').trigger('click');
    await flushPromises();

    expect(pushSpy).toHaveBeenCalledWith({
      path: '/map',
      query: { selectedId: '22' },
    });
  });

  it('appended card 닉네임 click → router.push /user/:userId (task #18)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    const { useShotDetailStore } = await import('@/stores/shotDetail');
    const store = useShotDetailStore();
    store.appendedShots.push(seedAppended({ userId: 9 }));
    await flushPromises();

    pushSpy.mockClear();
    const card = wrapper.find('[data-testid="sd-feed-card"]');
    await card.find('.sd-user .nm').trigger('click');
    await flushPromises();

    expect(pushSpy).toHaveBeenCalledWith('/user/9');
  });

  it('end-of-feed status renders after loadNext returns hasMore=false + posts already loaded (task #15)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    // Manually drive the store into "end-reached after loading 1 post" state.
    const { useShotDetailStore } = await import('@/stores/shotDetail');
    const store = useShotDetailStore();
    store.appendedShots.push({
      id: 76,
      imageUrl: 'https://cdn/p/76.jpg',
      caption: 'last',
      createdAt: '2026-04-19T10:00:00Z',
      sceneCompare: false,
      dramaSceneImageUrl: null,
      author: {
        userId: 2,
        handle: 'trip_hj',
        nickname: 'trip_hj',
        avatarUrl: null,
        verified: false,
        following: false,
      },
      place: { id: 11, name: '강릉 안목해변', regionLabel: '강원 강릉시' },
      work: { id: 1, title: '도깨비', workEpisode: null, sceneTimestamp: null },
      likeCount: 0,
      commentCount: 0,
      liked: false,
      saved: false,
      visitedAt: null,
    });
    store.nextEndReached = true;
    await flushPromises();

    expect(wrapper.find('[data-testid="sd-infinite-end"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="sd-infinite-end"]').text()).toContain('마지막');
  });

  // task #26 — sticky header 의 more 버튼 제거 + 카드별 .card-more 신설.
  // primary 와 추가 카드 모두 우상단 .card-more 가 렌더되고, 헤더에는 back 만 남는다.
  it('sticky header has no more button (task #26)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const sticky = wrapper.find('.sd-top');
    expect(sticky.exists()).toBe(true);
    // back 버튼 1개만 — 우측 more 영역 사라짐.
    expect(sticky.findAll('button').length).toBe(1);
    expect(sticky.find('button[aria-label="back"]').exists()).toBe(true);
    expect(sticky.find('button[aria-label="more"]').exists()).toBe(false);
  });

  it('primary card renders .card-more button at top-right with Korean aria-label (task #26)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const compare = wrapper.find('section.compare');
    expect(compare.exists()).toBe(true);
    const more = compare.find('[data-testid="sd-card-more"]');
    expect(more.exists()).toBe(true);
    expect(more.attributes('aria-label')).toBe('더보기');
    // 기존 "내 인증샷" 라벨은 사라졌어야 함.
    expect(compare.find('.lbl-chip.r').exists()).toBe(false);
  });

  it('appended feed cards each render their own .card-more button (task #26)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const { useShotDetailStore } = await import('@/stores/shotDetail');
    const store = useShotDetailStore();
    store.appendedShots.push({
      id: 76,
      imageUrl: 'https://cdn/p/76.jpg',
      caption: 'next',
      createdAt: '2026-04-19T10:00:00Z',
      sceneCompare: true,
      dramaSceneImageUrl: 'https://cdn/scene/76.jpg',
      author: {
        userId: 2,
        handle: 'trip_hj',
        nickname: 'trip_hj',
        avatarUrl: null,
        verified: false,
        following: false,
      },
      place: { id: 11, name: '강릉 안목해변', regionLabel: '강원 강릉시' },
      work: { id: 1, title: '도깨비', workEpisode: '2회', sceneTimestamp: '00:25:01' },
      likeCount: 0,
      commentCount: 0,
      liked: false,
      saved: false,
      visitedAt: null,
    });
    await flushPromises();

    const card = wrapper.find('[data-testid="sd-feed-card"]');
    expect(card.exists()).toBe(true);
    // 카드 내부의 .card-more — 셀렉터를 카드로 좁혀 primary 와 충돌 회피.
    const more = card.find('.card-more');
    expect(more.exists()).toBe(true);
    expect(more.attributes('aria-label')).toBe('더보기');
  });

  it('back button calls router.back()', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    backSpy.mockClear();

    await wrapper.find('button[aria-label="back"]').trigger('click');
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  describe('owner more menu — edit / delete', () => {
    it('isMe=true 작성자 카드 더보기 → actionSheet 가 수정/삭제/취소 buttons 로 present', async () => {
      const { wrapper } = mountPage();
      await flushPromises();

      await wrapper.find('[data-testid="sd-card-more"]').trigger('click');
      await flushPromises();

      expect(actionSheetCreateSpy).toHaveBeenCalledTimes(1);
      const opts = actionSheetCreateSpy.mock.calls[0][0] as {
        header?: string;
        buttons: Array<{ text: string; role?: string }>;
      };
      expect(opts.header).toBe('인증샷');
      expect(opts.buttons.map((b) => b.text)).toEqual(['수정', '삭제', '취소']);
      expect(opts.buttons[1].role).toBe('destructive');
    });

    it('isMe=false 인 다른 사람 카드 → actionSheet 안 뜨고 placeholder toast 만', async () => {
      // 다른 사람 인증샷 시나리오: fetch 응답을 isMe=false 로 갈아끼움.
      mockApi.get.mockReset();
      mockApi.get.mockResolvedValue({
        data: { ...fixture, author: { ...fixture.author, isMe: false } },
      });
      const { wrapper } = mountPage();
      await flushPromises();

      await wrapper.find('[data-testid="sd-card-more"]').trigger('click');
      await flushPromises();

      expect(actionSheetCreateSpy).not.toHaveBeenCalled();
      expect(toastCreateSpy).toHaveBeenCalled();
    });

    it('수정 행 handler → 수정 모달이 열리고 textarea/visibility 가 현재 값으로 시드', async () => {
      const { wrapper } = mountPage();
      await flushPromises();
      await wrapper.find('[data-testid="sd-card-more"]').trigger('click');
      await flushPromises();

      const buttons = (actionSheetCreateSpy.mock.calls[0][0] as {
        buttons: Array<{ text: string; handler?: () => void }>;
      }).buttons;
      buttons.find((b) => b.text === '수정')!.handler!();
      await flushPromises();

      // Teleport 가 body 에 시트를 박아두므로 document.body 에서 직접 조회.
      const sheet = document.body.querySelector('[data-testid="sd-edit-sheet"]');
      expect(sheet).not.toBeNull();
      const textarea = sheet?.querySelector<HTMLTextAreaElement>(
        '[data-testid="sd-edit-caption"]',
      );
      expect(textarea?.value).toBe(fixture.caption);
      const radio = sheet?.querySelector<HTMLInputElement>(
        '[data-testid="sd-edit-visibility-PUBLIC"]',
      );
      expect(radio?.checked).toBe(true);
    });

    it('수정 모달 저장 → PATCH /api/photos/:id 호출 + 새 응답으로 store 갱신', async () => {
      const { wrapper } = mountPage();
      await flushPromises();
      await wrapper.find('[data-testid="sd-card-more"]').trigger('click');
      await flushPromises();
      const buttons = (actionSheetCreateSpy.mock.calls[0][0] as {
        buttons: Array<{ text: string; handler?: () => void }>;
      }).buttons;
      buttons.find((b) => b.text === '수정')!.handler!();
      await flushPromises();

      // 사용자 입력 시뮬레이션: 캡션 변경 + 공개범위 PRIVATE.
      const textarea = document.body.querySelector<HTMLTextAreaElement>(
        '[data-testid="sd-edit-caption"]',
      )!;
      textarea.value = '바뀐 캡션';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      const privateRadio = document.body.querySelector<HTMLInputElement>(
        '[data-testid="sd-edit-visibility-PRIVATE"]',
      )!;
      privateRadio.checked = true;
      privateRadio.dispatchEvent(new Event('change', { bubbles: true }));
      await flushPromises();

      mockApi.patch.mockResolvedValueOnce({
        data: { ...fixture, caption: '바뀐 캡션', visibility: 'PRIVATE' },
      });
      const saveBtn = document.body.querySelector<HTMLButtonElement>(
        '[data-testid="sd-edit-save"]',
      )!;
      saveBtn.click();
      await flushPromises();

      const [url, body] = mockApi.patch.mock.calls[0];
      expect(url).toBe('/api/photos/77');
      expect(body).toMatchObject({ caption: '바뀐 캡션', visibility: 'PRIVATE' });
    });

    it('삭제 행 handler → alert present + 확인 시 DELETE 호출 + router.back', async () => {
      const { wrapper } = mountPage();
      await flushPromises();
      await wrapper.find('[data-testid="sd-card-more"]').trigger('click');
      await flushPromises();
      const sheetButtons = (actionSheetCreateSpy.mock.calls[0][0] as {
        buttons: Array<{ text: string; handler?: () => void }>;
      }).buttons;
      sheetButtons.find((b) => b.text === '삭제')!.handler!();
      await flushPromises();

      expect(alertCreateSpy).toHaveBeenCalledTimes(1);
      const alertButtons = (alertCreateSpy.mock.calls[0][0] as {
        buttons: Array<{ text: string; role?: string; handler?: () => void }>;
      }).buttons;

      mockApi.delete.mockResolvedValueOnce({ data: null });
      backSpy.mockClear();
      alertButtons.find((b) => b.text === '삭제')!.handler!();
      await flushPromises();

      expect(mockApi.delete).toHaveBeenCalledWith('/api/photos/77');
      expect(backSpy).toHaveBeenCalledTimes(1);
    });
  });

  // Teleport 시트가 document.body 에 머물러 다음 테스트로 새는 걸 막는 cleanup.
  afterEach(() => {
    document.body
      .querySelectorAll('[data-testid="sd-edit-sheet"], [data-testid="sd-edit-backdrop"]')
      .forEach((el) => el.remove());
  });
});
