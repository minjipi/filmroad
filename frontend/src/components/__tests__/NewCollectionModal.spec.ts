import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const { pushSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy }),
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

import NewCollectionModal from '@/components/saved/NewCollectionModal.vue';
import { useUiStore } from '@/stores/ui';
import { useSavedStore } from '@/stores/saved';
import { mountWithStubs } from '@/views/__tests__/__helpers__/mount';

function qsBody<T extends Element = HTMLElement>(selector: string): T | null {
  return document.body.querySelector<T>(selector);
}
function setInputValue(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function mountModal() {
  return mountWithStubs(NewCollectionModal, {});
}

describe('NewCollectionModal.vue', () => {
  beforeEach(() => {
    toastCreateSpy.mockClear();
    pushSpy.mockClear();
    // Strip any teleported modal content from prior tests.
    document.body
      .querySelectorAll('[data-testid^="new-coll-"]')
      .forEach((el) => el.remove());
  });

  it('stays hidden when uiStore.newCollectionModalOpen is false', async () => {
    mountModal();
    await flushPromises();

    expect(qsBody('[data-testid="new-coll-backdrop"]')).toBeNull();
  });

  it('opens when uiStore.openNewCollectionModal() is called; submit disabled on empty + whitespace', async () => {
    mountModal();
    await flushPromises();
    const ui = useUiStore();
    ui.openNewCollectionModal();
    await flushPromises();

    expect(qsBody('[data-testid="new-coll-backdrop"]')).not.toBeNull();
    const submit = qsBody<HTMLButtonElement>('[data-testid="new-coll-submit"]')!;
    expect(submit.disabled).toBe(true);

    const input = qsBody<HTMLInputElement>('[data-testid="new-coll-input"]')!;
    setInputValue(input, '   ');
    await flushPromises();
    expect(
      qsBody<HTMLButtonElement>('[data-testid="new-coll-submit"]')!.disabled,
    ).toBe(true);
  });

  it('valid input + 만들기 → savedStore.createCollection called and modal closes', async () => {
    mountModal();
    await flushPromises();
    const saved = useSavedStore();
    const createSpy = vi.spyOn(saved, 'createCollection').mockResolvedValue({
      id: 99,
      name: '새 여름',
      coverImageUrls: null,
      count: 0,
      gradient: null,
    });
    const ui = useUiStore();
    ui.openNewCollectionModal();
    await flushPromises();

    const input = qsBody<HTMLInputElement>('[data-testid="new-coll-input"]')!;
    setInputValue(input, '새 여름');
    await flushPromises();
    qsBody<HTMLButtonElement>('[data-testid="new-coll-submit"]')!.click();
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith('새 여름');
    expect(ui.newCollectionModalOpen).toBe(false);
    expect(toastCreateSpy).toHaveBeenCalled();
  });

  it('SavedPage 흐름(picker 닫혀있음): 생성 후 안내 토스트 + /feed 로 이동', async () => {
    mountModal();
    await flushPromises();
    const saved = useSavedStore();
    vi.spyOn(saved, 'createCollection').mockResolvedValue({
      id: 99,
      name: '새 여름',
      coverImageUrls: null,
      count: 0,
      gradient: null,
    });
    const ui = useUiStore();
    ui.openNewCollectionModal();
    await flushPromises();

    setInputValue(qsBody<HTMLInputElement>('[data-testid="new-coll-input"]')!, '새 여름');
    await flushPromises();
    qsBody<HTMLButtonElement>('[data-testid="new-coll-submit"]')!.click();
    await flushPromises();

    expect(toastCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '새 컬렉션이 추가되었어요. 어떤 곳을 저장하러 가볼까?',
      }),
    );
    expect(pushSpy).toHaveBeenCalledWith('/feed');
  });

  it('CollectionPicker 흐름(picker 열려있음): 생성 후 짧은 토스트만, 라우팅 없음', async () => {
    mountModal();
    await flushPromises();
    const saved = useSavedStore();
    vi.spyOn(saved, 'createCollection').mockResolvedValue({
      id: 99,
      name: '새 여름',
      coverImageUrls: null,
      count: 0,
      gradient: null,
    });
    const ui = useUiStore();
    // picker 가 열린 상태 시뮬레이트.
    ui.openCollectionPicker(123);
    ui.openNewCollectionModal();
    await flushPromises();

    setInputValue(qsBody<HTMLInputElement>('[data-testid="new-coll-input"]')!, '새 여름');
    await flushPromises();
    qsBody<HTMLButtonElement>('[data-testid="new-coll-submit"]')!.click();
    await flushPromises();

    expect(toastCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: '컬렉션이 추가되었어요' }),
    );
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('createCollection returning null → modal stays open + error toast surfaces', async () => {
    mountModal();
    await flushPromises();
    const saved = useSavedStore();
    vi.spyOn(saved, 'createCollection').mockImplementation(async () => {
      saved.error = '서버 오류';
      return null;
    });
    const ui = useUiStore();
    ui.openNewCollectionModal();
    await flushPromises();

    const input = qsBody<HTMLInputElement>('[data-testid="new-coll-input"]')!;
    setInputValue(input, '테스트');
    await flushPromises();
    qsBody<HTMLButtonElement>('[data-testid="new-coll-submit"]')!.click();
    await flushPromises();

    expect(ui.newCollectionModalOpen).toBe(true);
    expect(toastCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '서버 오류',
        cssClass: expect.arrayContaining(['fr-toast--danger']),
      }),
    );
  });
});
