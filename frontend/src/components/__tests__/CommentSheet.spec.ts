import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

import apiDefault from '@/services/api';
const apiMock = apiDefault as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const { toastCreateSpy } = vi.hoisted(() => ({
  toastCreateSpy: vi
    .fn()
    .mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@ionic/vue', async () => {
  const actual = await vi.importActual<typeof import('@ionic/vue')>('@ionic/vue');
  return { ...actual, toastController: { create: toastCreateSpy } };
});

import CommentSheet from '@/components/comment/CommentSheet.vue';
import { useCommentStore, type Comment } from '@/stores/comment';

function makeComment(
  id: number,
  authorId: number,
  imageUrl: string | null = null,
): Comment {
  return {
    id,
    content: `c-${id}`,
    createdAt: '2026-04-22T00:00:00Z',
    author: {
      userId: authorId,
      handle: `u${authorId}`,
      nickname: `닉${authorId}`,
      avatarUrl: null,
      verified: false,
    },
    imageUrl,
  };
}

function mountSheet(opts: {
  open: boolean;
  photoId: number | null;
  userId?: number | null;
  items?: Comment[];
  stubActions?: boolean;
}) {
  const pinia = createTestingPinia({
    stubActions: opts.stubActions ?? true,
    createSpy: vi.fn,
    initialState: {
      auth: {
        user:
          opts.userId != null
            ? {
                id: opts.userId,
                nickname: 'me',
                handle: 'me',
                avatarUrl: '',
                bio: '',
                level: 1,
                levelName: '',
                points: 0,
                streakDays: 0,
                followersCount: 0,
                followingCount: 0,
              }
            : null,
        loading: false,
        error: null,
      },
      comment: {
        commentsByPhoto:
          opts.photoId != null && opts.items
            ? {
                [opts.photoId]: {
                  items: opts.items,
                  hasMore: false,
                  nextCursor: null,
                  loading: false,
                  error: null,
                },
              }
            : {},
      },
    },
  });
  const wrapper = mount(CommentSheet, {
    global: {
      plugins: [pinia],
      stubs: {
        'ion-modal': {
          props: ['isOpen'],
          template: '<div v-if="isOpen" class="ion-modal-stub"><slot /></div>',
        },
        'ion-icon': true,
      },
    },
    props: { open: opts.open, photoId: opts.photoId },
  });
  return { wrapper, store: useCommentStore() };
}

describe('CommentSheet.vue', () => {
  beforeEach(() => {
    toastCreateSpy.mockClear();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.delete.mockReset();
    // Default: no items; individual tests override when they need pre-populated data.
    apiMock.get.mockResolvedValue({ data: { comments: [], hasMore: false, nextCursor: null } });
    apiMock.delete.mockResolvedValue({});
  });

  it('does not render modal contents when open=false', () => {
    const { wrapper } = mountSheet({ open: false, photoId: 10 });
    expect(wrapper.find('.cs-root').exists()).toBe(false);
  });

  it('renders comment items and hides delete button for comments authored by others', async () => {
    const items = [makeComment(1, 7), makeComment(2, 42)];
    const { wrapper } = mountSheet({ open: true, photoId: 10, userId: 7, items });
    await flushPromises();

    const rows = wrapper.findAll('.cs-item');
    expect(rows.length).toBe(2);
    // First comment authored by me (7) → .del visible.
    expect(rows[0].find('.del').exists()).toBe(true);
    // Second comment authored by 42 → no .del.
    expect(rows[1].find('.del').exists()).toBe(false);
  });

  it('submitting the input dispatches commentStore.create with the photoId and trimmed content', async () => {
    const { wrapper, store } = mountSheet({ open: true, photoId: 10, userId: 7 });
    await flushPromises();

    // Override the stubbed action to return a real comment so onSubmit completes.
    const createSpy = store.create as unknown as ReturnType<typeof vi.fn>;
    createSpy.mockResolvedValue(makeComment(99, 7));

    const input = wrapper.find('input.cs-input');
    await input.setValue('  hi there  ');
    await wrapper.find('button.cs-send').trigger('click');
    await flushPromises();

    // onSubmit trims before dispatching create. 이미지 미첨부 케이스는
    // 세 번째 인자가 undefined 로 들어간다.
    expect(createSpy).toHaveBeenCalledWith(10, 'hi there', undefined);
  });

  it('clicking delete on my own comment dispatches commentStore.remove', async () => {
    const items = [makeComment(11, 7)];
    const { wrapper, store } = mountSheet({ open: true, photoId: 10, userId: 7, items });
    await flushPromises();

    const removeSpy = store.remove as unknown as ReturnType<typeof vi.fn>;
    removeSpy.mockResolvedValue(true);
    await wrapper.find('.cs-item .del').trigger('click');
    await flushPromises();

    expect(removeSpy).toHaveBeenCalledWith(11, 10);
  });

  it('renders the image attach button in the footer when authenticated', async () => {
    const { wrapper } = mountSheet({ open: true, photoId: 10, userId: 7 });
    await flushPromises();
    const btn = wrapper.find('[data-testid="cs-attach-btn"]');
    expect(btn.exists()).toBe(true);
    expect((btn.element as HTMLButtonElement).disabled).toBe(false);
  });

  it('picking a file shows the preview and clearing it removes the preview', async () => {
    // jsdom 에 URL.createObjectURL 이 기본 없을 수 있어서 stub.
    const createSpy = vi.fn(() => 'blob:mock-url');
    const revokeSpy = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createSpy as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeSpy as unknown as typeof URL.revokeObjectURL;

    try {
      const { wrapper } = mountSheet({ open: true, photoId: 10, userId: 7 });
      await flushPromises();

      // 처음엔 프리뷰 없음.
      expect(wrapper.find('[data-testid="cs-attach-preview"]').exists()).toBe(false);

      const fileInput = wrapper.find('[data-testid="cs-file-input"]');
      const file = new File(['x'], 'shot.jpg', { type: 'image/jpeg' });
      // jsdom 엔 DataTransfer 가 없어서 input.files 를 defineProperty 로 직접
      // 박는다. 실제 브라우저에서는 사용자 인터랙션을 통해서만 세팅되는 영역.
      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        configurable: true,
      });
      await fileInput.trigger('change');
      await flushPromises();

      expect(createSpy).toHaveBeenCalledWith(file);
      const preview = wrapper.find('[data-testid="cs-attach-preview"]');
      expect(preview.exists()).toBe(true);
      expect(preview.find('img').attributes('src')).toBe('blob:mock-url');

      // X 버튼으로 첨부 취소 → 프리뷰 사라지고 revokeObjectURL 호출.
      await wrapper.find('[data-testid="cs-attach-clear"]').trigger('click');
      await flushPromises();
      expect(wrapper.find('[data-testid="cs-attach-preview"]').exists()).toBe(false);
      expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it('passes the picked File as the third argument to commentStore.create', async () => {
    const createSpy2 = vi.fn(() => 'blob:mock-url');
    const revokeSpy2 = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createSpy2 as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeSpy2 as unknown as typeof URL.revokeObjectURL;

    try {
      const { wrapper, store } = mountSheet({ open: true, photoId: 10, userId: 7 });
      await flushPromises();

      const createSpy = store.create as unknown as ReturnType<typeof vi.fn>;
      createSpy.mockResolvedValue(makeComment(99, 7, '/uploads/comments/x.jpg'));

      // 첨부 + 텍스트 입력.
      const fileInput = wrapper.find('[data-testid="cs-file-input"]');
      const file = new File(['x'], 'shot.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        configurable: true,
      });
      await fileInput.trigger('change');
      await flushPromises();

      await wrapper.find('input.cs-input').setValue('인증샷');
      await wrapper.find('button.cs-send').trigger('click');
      await flushPromises();

      expect(createSpy).toHaveBeenCalledTimes(1);
      const args = createSpy.mock.calls[0];
      expect(args[0]).toBe(10);
      expect(args[1]).toBe('인증샷');
      expect(args[2]).toBeInstanceOf(File);
      expect((args[2] as File).name).toBe('shot.jpg');
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it('renders the attach thumbnail on a comment whose imageUrl is set', async () => {
    const items = [
      makeComment(1, 7, '/uploads/comments/abc.jpg'),
      makeComment(2, 7, null),
    ];
    const { wrapper } = mountSheet({ open: true, photoId: 10, userId: 7, items });
    await flushPromises();

    const thumbs = wrapper.findAll('[data-testid="cs-attach-thumb"]');
    // imageUrl 이 있는 항목 1건에만 썸네일이 노출.
    expect(thumbs.length).toBe(1);
    expect(thumbs[0].find('img').attributes('src')).toBe('/uploads/comments/abc.jpg');
  });
});
