import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const { kakaoMock, copyMock, systemMock } = vi.hoisted(() => ({
  kakaoMock: vi.fn().mockResolvedValue(undefined),
  copyMock: vi.fn().mockResolvedValue(undefined),
  systemMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/composables/useShare', () => ({
  useShare: () => ({
    shareToKakao: kakaoMock,
    copyLink: copyMock,
    shareSystem: systemMock,
  }),
}));

import ShareSheet from '@/components/share/ShareSheet.vue';
import { useUiStore } from '@/stores/ui';
import { mountWithStubs } from '@/views/__tests__/__helpers__/mount';

function qsBody<T extends Element = HTMLElement>(selector: string): T | null {
  return document.body.querySelector<T>(selector);
}

const SAMPLE = {
  title: '컬렉션 A',
  description: '내가 만든 · 5곳',
  imageUrl: 'https://img/c1.jpg',
  url: 'https://filmroad.kr/collection/1',
};

function mountSheet() {
  return mountWithStubs(ShareSheet, {});
}

describe('ShareSheet.vue', () => {
  beforeEach(() => {
    kakaoMock.mockClear();
    copyMock.mockClear();
    systemMock.mockClear();
    document.body
      .querySelectorAll('[data-testid^="share-"]')
      .forEach((el) => el.remove());
  });

  it('stays hidden until openShareSheet is called', async () => {
    mountSheet();
    await flushPromises();
    expect(qsBody('[data-testid="share-sheet"]')).toBeNull();
  });

  it('renders all three channel rows + cancel when sheet opens', async () => {
    mountSheet();
    await flushPromises();
    useUiStore().openShareSheet(SAMPLE);
    await flushPromises();

    expect(qsBody('[data-testid="share-sheet"]')).not.toBeNull();
    expect(qsBody('[data-testid="share-kakao"]')).not.toBeNull();
    expect(qsBody('[data-testid="share-copy"]')).not.toBeNull();
    expect(qsBody('[data-testid="share-system"]')).not.toBeNull();
    expect(qsBody('[data-testid="share-cancel"]')).not.toBeNull();
  });

  it('카카오톡 row → closes sheet then forwards data to shareToKakao', async () => {
    mountSheet();
    await flushPromises();
    const ui = useUiStore();
    ui.openShareSheet(SAMPLE);
    await flushPromises();

    qsBody<HTMLButtonElement>('[data-testid="share-kakao"]')!.click();
    await flushPromises();

    expect(ui.shareSheetOpen).toBe(false);
    expect(kakaoMock).toHaveBeenCalledWith(expect.objectContaining({
      title: SAMPLE.title,
      description: SAMPLE.description,
      url: SAMPLE.url,
    }));
  });

  it('링크 복사 row → forwards just the url to copyLink', async () => {
    mountSheet();
    await flushPromises();
    useUiStore().openShareSheet(SAMPLE);
    await flushPromises();

    qsBody<HTMLButtonElement>('[data-testid="share-copy"]')!.click();
    await flushPromises();

    expect(copyMock).toHaveBeenCalledWith(SAMPLE.url);
  });

  it('다른 앱으로 row → forwards full data to shareSystem', async () => {
    mountSheet();
    await flushPromises();
    useUiStore().openShareSheet(SAMPLE);
    await flushPromises();

    qsBody<HTMLButtonElement>('[data-testid="share-system"]')!.click();
    await flushPromises();

    expect(systemMock).toHaveBeenCalledWith(expect.objectContaining({
      url: SAMPLE.url,
    }));
  });

  it('취소 button + backdrop both close the sheet without invoking any channel', async () => {
    mountSheet();
    await flushPromises();
    const ui = useUiStore();
    ui.openShareSheet(SAMPLE);
    await flushPromises();

    qsBody<HTMLButtonElement>('[data-testid="share-cancel"]')!.click();
    await flushPromises();
    expect(ui.shareSheetOpen).toBe(false);
    expect(kakaoMock).not.toHaveBeenCalled();

    ui.openShareSheet(SAMPLE);
    await flushPromises();
    qsBody<HTMLDivElement>('[data-testid="share-sheet-backdrop"]')!.click();
    await flushPromises();
    expect(ui.shareSheetOpen).toBe(false);
    expect(copyMock).not.toHaveBeenCalled();
    expect(systemMock).not.toHaveBeenCalled();
  });
});
