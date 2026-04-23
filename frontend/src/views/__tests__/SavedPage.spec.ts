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

import SavedPage from '@/views/SavedPage.vue';
import { useUploadStore } from '@/stores/upload';
import { mountWithStubs } from './__helpers__/mount';

const savedState = {
  collections: [] as Array<unknown>,
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
      placeId: 13,
      name: '단밤 포차',
      regionLabel: '서울 용산구 이태원동',
      coverImageUrl: 'https://img/p13.jpg',
      workId: 2,
      workTitle: '이태원 클라쓰',
      distanceKm: 4.8,
      likeCount: 5100,
      visited: true,
      collectionId: null,
    },
  ],
  totalCount: 2,
  suggestion: null,
  loading: false,
  error: null as string | null,
};

function mountSaved(overrides: Partial<typeof savedState> = {}) {
  return mountWithStubs(SavedPage, {
    initialState: { saved: { ...savedState, ...overrides } },
  });
}

describe('SavedPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
  });

  it('back button triggers router.back() when there is history to go back to', async () => {
    // jsdom default: window.history.length === 1 (about:blank). Push a
    // phantom entry so the guard falls through to router.back().
    window.history.pushState({}, '', '/saved');
    try {
      const { wrapper } = mountSaved();
      await flushPromises();
      backSpy.mockClear();
      pushSpy.mockClear();
      replaceSpy.mockClear();

      await wrapper.find('[data-testid="saved-back"]').trigger('click');
      expect(backSpy).toHaveBeenCalledTimes(1);
      expect(replaceSpy).not.toHaveBeenCalled();
    } finally {
      window.history.back(); // restore — best-effort, jsdom forgives
    }
  });

  it('back button falls back to router.replace("/profile") when there is no history', async () => {
    // Force jsdom's history.length to 1 so the guard picks the fallback.
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      Window.prototype,
      'history',
    );
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { length: 1 } as unknown as History,
    });
    try {
      const { wrapper } = mountSaved();
      await flushPromises();
      backSpy.mockClear();
      replaceSpy.mockClear();

      await wrapper.find('[data-testid="saved-back"]').trigger('click');
      expect(backSpy).not.toHaveBeenCalled();
      expect(replaceSpy).toHaveBeenCalledWith('/profile');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, 'history', originalDescriptor);
      }
    }
  });

  it('search icon pushes /search', async () => {
    const { wrapper } = mountSaved();
    await flushPromises();

    await wrapper.find('button[aria-label="search"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/search');
  });

  it('renders the top bar title and total count in the section header', async () => {
    const { wrapper } = mountSaved();
    await flushPromises();

    expect(wrapper.find('.top h1').text()).toBe('저장한 장소');
    // The second section-h shows "모든 저장 · N곳".
    const sectionHeaders = wrapper.findAll('.section-h h2');
    expect(sectionHeaders.map((h) => h.text())).toEqual([
      '컬렉션',
      '모든 저장 · 2곳',
    ]);
  });

  it('renders the 3 mock collections + "new" card from the design (task #20)', async () => {
    const { wrapper } = mountSaved();
    await flushPromises();

    const cards = wrapper.findAll('[data-testid="coll-card"]');
    expect(cards.length).toBe(3);
    expect(cards[0].find('.name').text()).toBe('다음 여행 · 강릉');
    expect(cards[1].find('.name').text()).toBe('도깨비 컴플리트');
    expect(cards[2].find('.name').text()).toBe('서울 야경 성지');
    expect(wrapper.find('[data-testid="coll-new"]').exists()).toBe(true);
  });

  it('AI 루트 배너는 항상 렌더되고 디자인의 mock 문구를 표시한다', async () => {
    const { wrapper } = mountSaved();
    await flushPromises();

    const banner = wrapper.find('[data-testid="ai-route-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('근처 성지 4곳');
    expect(banner.text()).toContain('AI가 자동으로 루트를 짜드려요');
  });

  it('saved-list renders one row per item with visited-specific action class', async () => {
    const { wrapper } = mountSaved();
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="saved-card"]');
    expect(rows.length).toBe(2);
    // First item not visited → primary action, no visited flag.
    expect(rows[0].find('[data-testid="saved-action"]').classes()).toContain('primary');
    expect(rows[0].find('[data-testid="visited-flag"]').exists()).toBe(false);
    // Second item visited → mint action + visited flag rendered.
    expect(rows[1].find('[data-testid="saved-action"]').classes()).toContain('mint');
    expect(rows[1].find('[data-testid="visited-flag"]').exists()).toBe(true);

    // Clicking the row pushes /place/:id.
    await rows[0].trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/place/10');
  });

  it('미방문 장소의 카메라 아이콘 → uploadStore.beginCapture + push /camera', async () => {
    const { wrapper } = mountSaved();
    await flushPromises();
    const upload = useUploadStore();
    const beginSpy = vi.spyOn(upload, 'beginCapture');

    const actions = wrapper.findAll('[data-testid="saved-action"]');
    await actions[0].trigger('click'); // 1st row: visited=false

    expect(beginSpy).toHaveBeenCalledWith({
      placeId: 10,
      workId: 1,
      workTitle: '도깨비',
      workEpisode: null,
      placeName: '주문진 영진해변 방파제',
      sceneImageUrl: null,
    });
    expect(pushSpy).toHaveBeenCalledWith('/camera');
  });

  it('방문한 장소의 체크 아이콘은 placeholder 토스트만 띄우고 /camera 로 이동하지 않는다', async () => {
    const { wrapper } = mountSaved();
    await flushPromises();
    const upload = useUploadStore();
    const beginSpy = vi.spyOn(upload, 'beginCapture');
    pushSpy.mockClear();

    const actions = wrapper.findAll('[data-testid="saved-action"]');
    await actions[1].trigger('click'); // 2nd row: visited=true
    await flushPromises();

    expect(beginSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalledWith('/camera');
    expect(toastCreateSpy).toHaveBeenCalled();
  });
});
