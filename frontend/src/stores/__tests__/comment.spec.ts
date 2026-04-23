import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '@/services/api';
import { useCommentStore, type Comment } from '@/stores/comment';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function makeComment(id: number): Comment {
  return {
    id,
    content: `comment-${id}`,
    createdAt: '2026-04-22T00:00:00Z',
    author: {
      userId: id,
      handle: `user${id}`,
      nickname: `닉${id}`,
      avatarUrl: null,
      verified: false,
    },
  };
}

const page1 = {
  comments: [makeComment(1), makeComment(2)],
  hasMore: true,
  nextCursor: 2,
};

const page2 = {
  comments: [makeComment(3)],
  hasMore: false,
  nextCursor: null,
};

describe('comment store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockApi.delete.mockReset();
  });

  it('fetch populates items/hasMore/nextCursor for the photo and hits GET /api/photos/:id/comments', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page1 });
    const store = useCommentStore();
    await store.fetch(10);

    expect(store.itemsFor(10)).toEqual(page1.comments);
    expect(store.hasMoreFor(10)).toBe(true);
    const [url, opts] = mockApi.get.mock.calls[0];
    expect(url).toBe('/api/photos/10/comments');
    expect(opts?.params).toMatchObject({ limit: 20 });
  });

  it('loadMore appends comments and forwards cursor', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page1 });
    const store = useCommentStore();
    await store.fetch(10);
    mockApi.get.mockClear();

    mockApi.get.mockResolvedValueOnce({ data: page2 });
    await store.loadMore(10);

    expect(store.itemsFor(10).map((c) => c.id)).toEqual([1, 2, 3]);
    expect(store.hasMoreFor(10)).toBe(false);
    const [, opts] = mockApi.get.mock.calls[0];
    expect(opts?.params).toMatchObject({ cursor: 2 });
  });

  it('create trims content, posts, and pushes the new comment into items', async () => {
    const created = makeComment(99);
    mockApi.post.mockResolvedValueOnce({ data: created });
    const store = useCommentStore();
    await store.create(10, '  hello  ');

    const [url, body] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/photos/10/comments');
    expect(body).toEqual({ content: 'hello' });
    expect(store.itemsFor(10).at(-1)?.id).toBe(99);
  });

  it('create returns null and skips post when content is empty/whitespace', async () => {
    const store = useCommentStore();
    const result = await store.create(10, '   ');
    expect(result).toBeNull();
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('remove deletes the comment and drops it from items on 204', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page1 });
    const store = useCommentStore();
    await store.fetch(10);
    mockApi.delete.mockResolvedValueOnce({});

    const ok = await store.remove(1, 10);
    expect(ok).toBe(true);
    const [url] = mockApi.delete.mock.calls[0];
    expect(url).toBe('/api/comments/1');
    expect(store.itemsFor(10).map((c) => c.id)).toEqual([2]);
  });

  it('clear drops the per-photo state entry', async () => {
    mockApi.get.mockResolvedValueOnce({ data: page1 });
    const store = useCommentStore();
    await store.fetch(10);
    expect(store.itemsFor(10).length).toBe(2);

    store.clear(10);
    expect(store.itemsFor(10).length).toBe(0);
  });
});
