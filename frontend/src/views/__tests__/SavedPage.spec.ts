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
import { useSavedStore } from '@/stores/saved';
import { useUploadStore } from '@/stores/upload';
import { mountWithStubs } from './__helpers__/mount';

// The new-collection modal uses <Teleport to="body"> so `wrapper.find(...)`
// can't see it — teleported content lives outside the wrapper's subtree.
// These helpers query the document directly (and remember: jsdom keeps body
// across assertions, so we read fresh each time).
function qsBody<T extends Element = HTMLElement>(selector: string): T | null {
  return document.body.querySelector<T>(selector);
}
function qsAllBody<T extends Element = HTMLElement>(selector: string): T[] {
  return Array.from(document.body.querySelectorAll<T>(selector));
}
// Drive v-model on a native <input> without vue-test-utils' DOMWrapper —
// teleported content isn't in the wrapper's subtree, so we dispatch the
// native 'input' event ourselves.
function setInputValue(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const savedState = {
  collections: [] as Array<unknown>,
  items: [
    {
      placeId: 10,
      name: '주문진 영진해변 방파제',
      regionLabel: '강릉시 주문진읍',
      coverImageUrls: ['https://img/p10.jpg'],
      contentId: 1,
      contentTitle: '도깨비',
      distanceKm: 1.2,
      likeCount: 3200,
      visited: false,
      collectionId: null,
    },
    {
      placeId: 13,
      name: '단밤 포차',
      regionLabel: '서울 용산구 이태원동',
      coverImageUrls: ['https://img/p13.jpg'],
      contentId: 2,
      contentTitle: '이태원 클라쓰',
      distanceKm: 4.8,
      likeCount: 5100,
      visited: true,
      collectionId: null,
    },
  ],
  totalCount: 2,
  suggestion: null as null | { title: string; subtitle: string; placeCount: number },
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
    // Strip any teleported modal content left behind by the previous test.
    // mountWithStubs doesn't auto-unmount, so without this the modal's
    // backdrop/input/submit can leak across tests and break qsBody lookups.
    document.body
      .querySelectorAll('[data-testid^="new-coll-"]')
      .forEach((el) => el.remove());
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

  it('collections render from store data — empty store → only the "new" card is visible', async () => {
    const { wrapper } = mountSaved();
    await flushPromises();

    expect(wrapper.findAll('[data-testid="coll-card"]').length).toBe(0);
    expect(wrapper.find('[data-testid="coll-new"]').exists()).toBe(true);
  });

  it('collections render from store data — seeded entries show title + count', async () => {
    const { wrapper } = mountSaved({
      collections: [
        { id: 1, name: '다음 여행 · 강릉', coverImageUrls: ['https://img/c1.jpg'], count: 8, gradient: null },
        { id: 2, name: '도깨비 컴플리트', coverImageUrls: ['https://img/c2.jpg'], count: 24, gradient: null },
      ],
    });
    await flushPromises();

    const cards = wrapper.findAll('[data-testid="coll-card"]');
    expect(cards.length).toBe(2);
    expect(cards[0].find('.name').text()).toBe('다음 여행 · 강릉');
    expect(cards[0].find('.count').text()).toContain('8곳');
    expect(cards[1].find('.name').text()).toBe('도깨비 컴플리트');
  });

  it('collection card click pushes /collection/:id (task #30)', async () => {
    const { wrapper } = mountSaved({
      collections: [
        { id: 7, name: '다음 여행 · 강릉', coverImageUrls: ['https://img/c7.jpg'], count: 8, gradient: null },
      ],
    });
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('[data-testid="coll-card"]').trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/collection/7');
  });

  it('"새 컬렉션" 카드 탭 → uiStore.openNewCollectionModal() 호출 (모달은 App.vue 에 마운트됨)', async () => {
    // task #29 에서 new-collection 모달이 공통 컴포넌트로 빠지고 ui store
    // 액션으로 열리도록 변경됨. SavedPage 책임은 "카드 탭 → 액션 호출"뿐.
    const { useUiStore } = await import('@/stores/ui');
    const { wrapper } = mountSaved();
    await flushPromises();
    const uiStore = useUiStore();
    const openSpy = vi.spyOn(uiStore, 'openNewCollectionModal');

    await wrapper.find('[data-testid="coll-new"]').trigger('click');
    await flushPromises();

    expect(openSpy).toHaveBeenCalledTimes(1);
    // 로컬 모달 DOM 은 더 이상 SavedPage 에서 렌더하지 않는다.
    expect(qsBody('[data-testid="new-coll-backdrop"]')).toBeNull();
  });

  it('AI 루트 배너는 store.suggestion 이 있을 때만 렌더되고 그 문구를 그대로 사용한다', async () => {
    const { wrapper } = mountSaved({
      suggestion: {
        title: '근처 성지 3곳, 하루에 돌 수 있어요',
        subtitle: 'AI가 자동으로 루트를 짜드려요',
        placeCount: 3,
      },
    });
    await flushPromises();

    const banner = wrapper.find('[data-testid="ai-route-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('근처 성지 3곳');
    expect(banner.text()).toContain('AI가 자동으로 루트를 짜드려요');
  });

  it('store.suggestion 이 null 이면 AI 루트 배너를 숨긴다', async () => {
    // Default state 의 suggestion 은 null — 백엔드가 lat/lng 를 못 받았거나
    // 반경 내 saved place 가 2곳 미만이면 null 로 내려옴. 그땐 배너 자체가
    // 보이지 않아야 한다 (이전엔 항상 "근처 성지 4곳" 가짜 문구가 떴음).
    const { wrapper } = mountSaved();
    await flushPromises();

    expect(wrapper.find('[data-testid="ai-route-banner"]').exists()).toBe(false);
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
      contentId: 1,
      contentTitle: '도깨비',
      contentEpisode: null,
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
