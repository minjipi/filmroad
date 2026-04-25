import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

// API mock — default resolves with the fixture for happy-path rendering.
// Individual tests override via mockResolvedValueOnce / mockRejectedValueOnce.
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
  },
  place: {
    id: 10,
    name: '주문진 영진해변 방파제',
    regionLabel: '강원 강릉시 주문진읍',
    address: '강원 강릉시 주문진읍 교항리 산51-2',
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
      author: {
        id: 2,
        nickname: '여행지현',
        handle: 'trip_hj',
        avatarUrl: 'https://img/ava2.jpg',
        verified: false,
      },
      createdAt: '2026-04-20T11:00:00Z',
      likeCount: 24,
      liked: true,
      parentId: null,
    },
    {
      id: 2,
      content: '원본이랑 나란히 보니까 소름 돋아요',
      author: {
        id: 3,
        nickname: '도깨비 러브',
        handle: 'dokkaebi.love',
        avatarUrl: null,
        verified: false,
      },
      createdAt: '2026-04-20T12:00:00Z',
      likeCount: 18,
      liked: false,
      parentId: null,
    },
  ],
  moreCommentsCount: 85,
};

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
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
  });
}

describe('ShotDetailPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
    mockApi.get.mockReset();
    mockApi.post.mockReset();
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

  it('caption + tags render verbatim (no v-html; tags prefixed with #)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const caption = wrapper.find('.sd-caption .body');
    expect(caption.text()).toContain('메밀꽃 한 다발 들고 기다렸어요');

    const tags = wrapper.findAll('.sd-caption .tag');
    expect(tags.map((t) => t.text())).toEqual(['#도깨비', '#주문진']);
  });

  it('top comments render one entry per topComments; "see-more" shows moreCommentsCount', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const comments = wrapper.findAll('[data-testid="sd-comment"]');
    expect(comments.length).toBe(2);
    expect(comments[0].find('.nm').text()).toBe('trip_hj');
    expect(comments[1].find('.nm').text()).toBe('dokkaebi.love');

    expect(wrapper.find('.see-more').text()).toContain('85');
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

  it('loc-card click pushes /place/:id for the shot\'s place', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('.loc-card').trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/place/10');
  });

  it('back button calls router.back()', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    backSpy.mockClear();

    await wrapper.find('button[aria-label="back"]').trigger('click');
    expect(backSpy).toHaveBeenCalledTimes(1);
  });
});
