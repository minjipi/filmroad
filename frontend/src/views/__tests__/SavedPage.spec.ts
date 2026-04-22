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
import type { NearbyRouteSuggestion } from '@/stores/saved';
import { mountWithStubs } from './__helpers__/mount';

const savedState: {
  collections: Array<{ id: number; name: string; coverImageUrl: string | null; count: number; gradient: string | null }>;
  items: Array<{
    placeId: number;
    name: string;
    regionLabel: string;
    coverImageUrl: string;
    workId: number;
    workTitle: string;
    distanceKm: number | null;
    likeCount: number;
    visited: boolean;
    collectionId: number | null;
  }>;
  totalCount: number;
  suggestion: NearbyRouteSuggestion | null;
  loading: boolean;
  error: string | null;
} = {
  collections: [
    { id: 1, name: '다음 여행 · 강릉', coverImageUrl: 'https://img/c1.jpg', count: 8, gradient: null },
    { id: 2, name: '도깨비 컴플리트', coverImageUrl: 'https://img/c2.jpg', count: 24, gradient: null },
  ],
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
  suggestion: {
    title: '근처 성지 4곳, 하루에 돌 수 있어요',
    subtitle: 'AI가 자동으로 루트를 짜드려요',
    placeCount: 4,
  },
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

  it('renders one collection card per entry plus the "new" card', async () => {
    const { wrapper } = mountSaved();
    await flushPromises();

    const colls = wrapper.findAll('.coll');
    // 2 collections + 1 "new" = 3.
    expect(colls.length).toBe(3);
    expect(colls.find((c) => c.classes().includes('new'))).toBeTruthy();
  });

  it('renders the nearby-route banner when suggestion is set and hides it when null', async () => {
    const { wrapper } = mountSaved();
    await flushPromises();

    const banner = wrapper.find('.banner');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('근처 성지 4곳');
    expect(banner.text()).toContain('AI가 자동으로 루트를 짜드려요');

    // Mount again with null suggestion → banner should not render.
    const { wrapper: wrapper2 } = mountSaved({ suggestion: null });
    await flushPromises();
    expect(wrapper2.find('.banner').exists()).toBe(false);
  });

  it('saved-list renders one row per item with visited-specific action class', async () => {
    const { wrapper } = mountSaved();
    await flushPromises();

    const rows = wrapper.findAll('.saved');
    expect(rows.length).toBe(2);
    // First item not visited → primary action, no visited flag.
    expect(rows[0].find('.saved-action').classes()).toContain('primary');
    expect(rows[0].find('.visited-flag').exists()).toBe(false);
    // Second item visited → mint action + visited flag rendered.
    expect(rows[1].find('.saved-action').classes()).toContain('mint');
    expect(rows[1].find('.visited-flag').exists()).toBe(true);

    // Clicking the row pushes /place/:id.
    await rows[0].trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/place/10');
  });
});
