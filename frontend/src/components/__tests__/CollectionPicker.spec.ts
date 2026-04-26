import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
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

import CollectionPicker from '@/components/saved/CollectionPicker.vue';
import { useUiStore } from '@/stores/ui';
import { useSavedStore } from '@/stores/saved';
import { mountWithStubs } from '@/views/__tests__/__helpers__/mount';

// Teleport-aware lookup — CollectionPicker portals itself into document.body.
function qsBody<T extends Element = HTMLElement>(selector: string): T | null {
  return document.body.querySelector<T>(selector);
}

const savedSeed = {
  collections: [
    { id: 1, name: '다음 여행 · 강릉', coverImageUrls: ['https://img/c1.jpg'], count: 8, gradient: null },
    { id: 2, name: '도깨비 컴플리트', coverImageUrls: ['https://img/c2.jpg'], count: 24, gradient: null },
  ],
  items: [],
  savedPlaceIds: [],
  totalCount: 0,
  suggestion: null,
  loading: false,
  error: null as string | null,
};

function mountPicker() {
  return mountWithStubs(CollectionPicker, {
    initialState: { saved: { ...savedSeed } },
  });
}

describe('CollectionPicker.vue', () => {
  beforeEach(() => {
    toastCreateSpy.mockClear();
    // Clear any leftover portaled DOM from the previous test.
    document.body
      .querySelectorAll('[data-testid^="cp-"], [data-testid="collection-picker"], [data-testid="collection-picker-backdrop"]')
      .forEach((el) => el.remove());
  });

  it('stays hidden when pickerOpen is false', async () => {
    mountPicker();
    await flushPromises();

    expect(qsBody('[data-testid="collection-picker"]')).toBeNull();
  });

  it('renders default row + one row per user collection when open', async () => {
    mountPicker();
    await flushPromises();
    const ui = useUiStore();
    ui.openCollectionPicker(42);
    await flushPromises();

    expect(qsBody('[data-testid="collection-picker"]')).not.toBeNull();
    expect(qsBody('[data-testid="cp-row-default"]')).not.toBeNull();
    const rows = document.body.querySelectorAll('[data-testid="cp-row-collection"]');
    expect(rows.length).toBe(2);
    // Ordering matches the store.
    expect(rows[0].textContent).toContain('다음 여행 · 강릉');
    expect(rows[0].textContent).toContain('8곳');
    expect(rows[1].textContent).toContain('도깨비 컴플리트');
    expect(rows[1].textContent).toContain('24곳');
  });

  it('tapping the 기본 row calls savedStore.toggleSave(placeId, null) and closes picker', async () => {
    mountPicker();
    await flushPromises();
    const saved = useSavedStore();
    const toggleSpy = vi.spyOn(saved, 'toggleSave').mockResolvedValue();
    const ui = useUiStore();
    ui.openCollectionPicker(42);
    await flushPromises();

    qsBody<HTMLElement>('[data-testid="cp-row-default"]')!.click();
    await flushPromises();

    expect(toggleSpy).toHaveBeenCalledWith(42, null);
    // Picker closes immediately, before the network round-trip.
    expect(ui.collectionPickerOpen).toBe(false);
  });

  it('tapping a user collection row calls toggleSave(placeId, collectionId)', async () => {
    mountPicker();
    await flushPromises();
    const saved = useSavedStore();
    const toggleSpy = vi.spyOn(saved, 'toggleSave').mockResolvedValue();
    const ui = useUiStore();
    ui.openCollectionPicker(42);
    await flushPromises();

    const rows = document.body.querySelectorAll<HTMLElement>(
      '[data-testid="cp-row-collection"]',
    );
    rows[1].click(); // 도깨비 컴플리트 (id=2)
    await flushPromises();

    expect(toggleSpy).toHaveBeenCalledWith(42, 2);
  });

  it('tapping "새 컬렉션 만들기" opens the shared new-collection modal via uiStore', async () => {
    mountPicker();
    await flushPromises();
    const ui = useUiStore();
    const openModalSpy = vi.spyOn(ui, 'openNewCollectionModal');
    ui.openCollectionPicker(42);
    await flushPromises();

    qsBody<HTMLElement>('[data-testid="cp-new-collection"]')!.click();
    await flushPromises();

    expect(openModalSpy).toHaveBeenCalledTimes(1);
    // Picker stays open so the newly-created collection can be selected.
    expect(ui.collectionPickerOpen).toBe(true);
  });

  it('clicking the backdrop closes the picker without calling toggleSave', async () => {
    mountPicker();
    await flushPromises();
    const saved = useSavedStore();
    const toggleSpy = vi.spyOn(saved, 'toggleSave').mockResolvedValue();
    const ui = useUiStore();
    ui.openCollectionPicker(42);
    await flushPromises();

    qsBody<HTMLElement>('[data-testid="collection-picker-backdrop"]')!.click();
    await flushPromises();

    expect(ui.collectionPickerOpen).toBe(false);
    expect(toggleSpy).not.toHaveBeenCalled();
  });
});
