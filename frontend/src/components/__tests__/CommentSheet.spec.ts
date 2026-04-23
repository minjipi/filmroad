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

function makeComment(id: number, authorId: number): Comment {
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

    // onSubmit trims before dispatching create.
    expect(createSpy).toHaveBeenCalledWith(10, 'hi there');
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
});
