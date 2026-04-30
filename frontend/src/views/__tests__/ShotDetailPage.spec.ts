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
  scenes: [
    {
      id: 200,
      imageUrl: 'https://cdn/scene/77.jpg',
      contentEpisode: '1회',
      sceneTimestamp: '00:15:24',
      sceneDescription: null,
      orderIndex: 0,
    },
  ],
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
  content: {
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

  it('drama-badge 가 작품 회차 + scene timestamp 를 노출 (compare-wrap 위)', async () => {
    // /feed/detail 통일 후엔 .scene-meta 가 아니라 .drama-badge 가 그 자리.
    const { wrapper } = mountPage();
    await flushPromises();

    const badge = wrapper.find('.compare-wrap .drama-badge').text();
    expect(badge).toContain('1회');
    expect(badge).toContain('00:15:24');

    // .post-head .loc 에 작품 제목 노출.
    expect(wrapper.find('.post-head .loc').text()).toContain('도깨비');
    expect(wrapper.find('.post-head .loc').text()).toContain('주문진 영진해변 방파제');

    // compare-wrap 의 두 이미지 (드라마 원본 + 내 인증샷).
    const imgs = wrapper.findAll('.compare-wrap img');
    expect(imgs.length).toBe(2);
    expect(imgs[0].attributes('src')).toBe('https://cdn/scene/77.jpg');
    expect(imgs[1].attributes('src')).toBe('https://cdn/p/77.jpg');
  });

  // /feed/detail 마크업 통일로 multi-image carousel 은 제거됨 (첫 이미지만 노출).
  // 향후 carousel 복원 시 별도 테스트로 다시 커버.

  it('compare-wrap 또는 single-img 둘 중 하나가 렌더 (scenes 유무에 따라)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    // fixture 는 sceneImageUrl 가 있어 compare-wrap 사용.
    expect(wrapper.find('.compare-wrap').exists()).toBe(true);
    expect(wrapper.find('.single-img').exists()).toBe(false);
  });

  it('post-head 가 작성자 handle + verified + 작품·장소(.loc)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const head = wrapper.find('.post-head');
    expect(head.text()).toContain('soyeon_film'); // fixture handle
    expect(head.find('.verified').exists()).toBe(true);
    expect(head.find('.loc').text()).toContain('도깨비');
    expect(head.find('.loc').text()).toContain('주문진 영진해변 방파제');
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

  it('post-caption 이 caption 을 handle 과 함께 노출 (tags 는 통일로 제거됨)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const caption = wrapper.find('.post-caption .caption-text');
    expect(caption.text()).toContain('메밀꽃 한 다발 들고 기다렸어요');
    expect(caption.find('b').text()).toBe('soyeon_film');
  });

  // 댓글 inline preview 는 /feed/detail 통일로 제거됨. 댓글 진입은 액션 row 의
  // 댓글 아이콘 → CommentSheet 모달.

  it('like button reflects shot.liked and tap calls POST /api/photos/:id/like', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const btn = wrapper.find('[data-testid="sd-like-btn"]');
    // /feed/detail 통일 후 .post-actions .a 의 active 클래스는 .on (was .liked).
    expect(btn.classes()).toContain('on'); // fixture.liked = true

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

  it('post-actions 의 댓글 아이콘 click → CommentSheet 가 이 shot 으로 열림', async () => {
    // 통일 후 inline cmt-input 대신 액션 row 의 두 번째 .a (댓글) 가 트리거.
    const { wrapper } = mountPage();
    await flushPromises();

    let stub = wrapper.find('.comment-sheet-stub');
    expect(stub.exists()).toBe(true);
    expect(stub.attributes('data-open')).toBe('false');
    expect(stub.attributes('data-photo-id')).toBe('');

    // post-actions: [0]=좋아요, [1]=댓글, [2]=공유, [3]=저장.
    const actions = wrapper.find('[data-testid="sd-primary-card"]').findAll('.post-actions .a');
    await actions[1].trigger('click');
    await flushPromises();

    stub = wrapper.find('.comment-sheet-stub');
    expect(stub.attributes('data-open')).toBe('true');
    expect(stub.attributes('data-photo-id')).toBe('77');
  });

  it('scenes 가 비어있으면 single-img + 좌상단 라벨 (compare-wrap 사용 X)', async () => {
    const noScene = { ...fixture, scenes: [] };
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

    expect(wrapper.find('.compare-wrap').exists()).toBe(false);
    expect(wrapper.find('.single-img').exists()).toBe(true);
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
        content: { id: 1, title: '도깨비', contentEpisode: '2회', sceneTimestamp: '00:25:01' },
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
      content: { id: 1, title: '도깨비', contentEpisode: '2회', sceneTimestamp: '00:25:01' },
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

    // /feed/detail 와 동일한 카드 마크업 (디자인 통일).
    expect(card.find('.post-head').exists()).toBe(true);
    expect(card.find('.post-image').exists()).toBe(true);
    expect(card.find('.post-actions').exists()).toBe(true);
    expect(card.find('.post-caption').exists()).toBe(true);
    expect(card.find('.post-time').exists()).toBe(true);

    // post-image: dramaSceneImageUrl 있으면 compare-wrap, 아니면 single-img.
    expect(card.find('.compare-wrap').exists()).toBe(true);
    const compareImgs = card.findAll('.compare-wrap img');
    expect(compareImgs.length).toBe(2);
    expect(compareImgs[0].attributes('src')).toBe('https://cdn/scene/76.jpg');
    expect(compareImgs[1].attributes('src')).toBe('https://cdn/p/76.jpg');
    expect(card.find('.drama-badge').text()).toContain('2회');

    // post-head: handle / verified / loc(content·place) / follow / more.
    expect(card.find('.nm').text()).toContain('trip_hj');
    expect(card.find('.verified').exists()).toBe(true); // fixture verified=true
    expect(card.find('.loc').text()).toContain('도깨비');
    expect(card.find('.loc').text()).toContain('강릉 안목해변');
    expect(card.find('.author-follow').exists()).toBe(true); // !isOwn (viewer=1, author=2) → 노출
    expect(card.find('.author-follow').text()).toBe('팔로잉'); // following=true
    expect(card.find('.post-head .more').exists()).toBe(true);

    // post-actions: like / comment / share / spacer / save (4 spans + spacer).
    const actions = card.findAll('.post-actions .a');
    expect(actions.length).toBe(4);
    expect(card.find('[data-testid="feed-share"]').exists()).toBe(true);
    expect(card.find('[data-testid="feed-save"]').exists()).toBe(true);

    // post-caption: caption-text wrapping handle + caption. 백엔드가 handle 을
    // 이미 "@xxx" 형태로 저장하므로 프론트가 prefix 추가하지 않음. fixture
    // handle 은 raw 'trip_hj' (운영 데이터는 '@xxx' 형태로 들어옴).
    expect(card.find('.caption-text').text()).toContain('안목해변에서');
    expect(card.find('.caption-text b').text()).toBe('trip_hj');
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
      content: { id: 1, title: '도깨비', contentEpisode: '2회', sceneTimestamp: '00:25:01' },
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
    const likeBtn = card.findAll('.post-actions .a')[0];
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
    const saveBtn = card.find('[data-testid="feed-save"]');
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
    await card.find('.author-follow').trigger('click');
    await flushPromises();

    const calls = mockApi.post.mock.calls;
    const followCall = calls.find((c) => String(c[0]) === '/api/users/9/follow');
    expect(followCall).toBeTruthy();
    expect(store.appendedShots[0].author.following).toBe(true);
  });

  it('appended card 댓글 아이콘 click → opens CommentSheet for that post id', async () => {
    // /feed/detail 통일 후엔 inline cmt-input 대신 post-actions 의 댓글 아이콘이
    // 시트를 연다. (디자인 통일 — 같은 카드를 여러 페이지가 공유)
    const { wrapper } = mountPage();
    await flushPromises();
    const { useShotDetailStore } = await import('@/stores/shotDetail');
    const store = useShotDetailStore();
    store.appendedShots.push(seedAppended({ id: 76 }));
    await flushPromises();

    let stub = wrapper.find('.comment-sheet-stub');
    expect(stub.attributes('data-open')).toBe('false');

    const card = wrapper.find('[data-testid="sd-feed-card"]');
    // 두 번째 a (댓글). [0]=좋아요, [1]=댓글, [2]=공유, [3]=저장.
    const commentBtn = card.findAll('.post-actions .a')[1];
    await commentBtn.trigger('click');
    await flushPromises();

    stub = wrapper.find('.comment-sheet-stub');
    expect(stub.attributes('data-open')).toBe('true');
    // primary shot id (77) 가 아닌 appended post id (76) 로 시트 열림.
    expect(stub.attributes('data-photo-id')).toBe('76');
  });

  // /feed/detail 통일 후 primary 도 avatar / meta 가 작성자 프로필로 이동.
  // sub(place) 클릭 → /map 진입은 제거됨 (feed-detail 패턴엔 없음).
  it('primary avatar click → router.push /user/:authorId', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('[data-testid="sd-avatar"]').trigger('click');
    await flushPromises();
    // fixture.author.id = 1
    expect(pushSpy).toHaveBeenCalledWith('/user/1');
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

  // /feed/detail 디자인 통일로 appended 카드의 sub(place) 클릭 → /map 진입은
  // 제거됨. place 이름은 head 의 .loc 안에 텍스트로만 표시되며, 카드 인터랙션은
  // avatar/meta(작성자) → /user/:id, 본문 → /shot/:id 두 경로로 단순화.

  it('appended card 메타(작성자) click → router.push /user/:userId', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    const { useShotDetailStore } = await import('@/stores/shotDetail');
    const store = useShotDetailStore();
    store.appendedShots.push(seedAppended({ userId: 9 }));
    await flushPromises();

    pushSpy.mockClear();
    const card = wrapper.find('[data-testid="sd-feed-card"]');
    // .meta 전체가 클릭 영역 (avatar 와 동일 동작).
    await card.find('.meta').trigger('click');
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
      content: { id: 1, title: '도깨비', contentEpisode: null, sceneTimestamp: null },
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

  it('primary card 의 더보기 버튼은 .post-head 우측 .more (sd-card-more testid 유지)', async () => {
    // /feed/detail 통일 후 더보기 버튼이 이미지 위 오버레이 → head 우측으로 이동.
    const { wrapper } = mountPage();
    await flushPromises();

    const more = wrapper.find('[data-testid="sd-primary-card"] .post-head .more');
    expect(more.exists()).toBe(true);
    expect(more.attributes('data-testid')).toBe('sd-card-more');
    expect(more.attributes('aria-label')).toBe('more');
  });

  it('appended feed cards each render their own more button (/feed/detail 톤 통일)', async () => {
    // /feed/detail 디자인 통일 후엔 카드 우상단 .card-more 가 아니라 head 우측의
    // .more 버튼이 그 역할을 한다. primary 카드는 여전히 .card-more 를 사용
    // (carousel 위 오버레이라 자리 다름).
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
      content: { id: 1, title: '도깨비', contentEpisode: '2회', sceneTimestamp: '00:25:01' },
      likeCount: 0,
      commentCount: 0,
      liked: false,
      saved: false,
      visitedAt: null,
    });
    await flushPromises();

    const card = wrapper.find('[data-testid="sd-feed-card"]');
    expect(card.exists()).toBe(true);
    const more = card.find('.post-head .more');
    expect(more.exists()).toBe(true);
    expect(more.attributes('aria-label')).toBe('more');
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
