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
import { signInForTest } from './__helpers__/auth';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function makeComment(
  id: number,
  imageUrl: string | null = null,
  parentId: number | null = null,
): Comment {
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
    imageUrl,
    parentId,
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
    setActivePinia(createPinia()); signInForTest();
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

  it('create trims content, posts as FormData with content field, and pushes the new comment', async () => {
    const created = makeComment(99);
    mockApi.post.mockResolvedValueOnce({ data: created });
    const store = useCommentStore();
    await store.create(10, '  hello  ');

    const [url, body] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/photos/10/comments');
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('content')).toBe('hello');
    // 첨부 없는 케이스에서는 image 필드를 아예 보내지 않는다.
    expect(form.has('image')).toBe(false);
    expect(store.itemsFor(10).at(-1)?.id).toBe(99);
  });

  it('create attaches the image File as the `image` part when provided', async () => {
    const created = makeComment(100, '/uploads/comments/abc.jpg');
    mockApi.post.mockResolvedValueOnce({ data: created });
    const store = useCommentStore();
    const image = new File(['x'], 'shot.jpg', { type: 'image/jpeg' });
    await store.create(10, '인증샷이에요', image);

    const [url, body] = mockApi.post.mock.calls[0];
    expect(url).toBe('/api/photos/10/comments');
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('content')).toBe('인증샷이에요');
    const sent = form.get('image');
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe('shot.jpg');
    expect((sent as File).type).toBe('image/jpeg');
    // 응답의 imageUrl 이 store 에 그대로 반영되어야 한다.
    expect(store.itemsFor(10).at(-1)?.imageUrl).toBe('/uploads/comments/abc.jpg');
  });

  it('create does NOT set Content-Type — axios derives multipart boundary from FormData', async () => {
    mockApi.post.mockResolvedValueOnce({ data: makeComment(101) });
    const store = useCommentStore();
    await store.create(10, 'hi');

    const opts = mockApi.post.mock.calls[0][2];
    // Content-Type 을 직접 박지 말 것 — boundary 가 누락되어 서버가 파싱 실패한다.
    if (opts && typeof opts === 'object' && 'headers' in opts) {
      const headers = (opts as { headers?: Record<string, string> }).headers;
      if (headers) {
        expect(headers['Content-Type']).toBeUndefined();
        expect(headers['content-type']).toBeUndefined();
      }
    }
  });

  it('create returns null and skips post when content is empty/whitespace', async () => {
    const store = useCommentStore();
    const result = await store.create(10, '   ');
    expect(result).toBeNull();
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('create rejects image-only submission (content empty) without calling the API', async () => {
    const store = useCommentStore();
    const image = new File(['x'], 'shot.jpg', { type: 'image/jpeg' });
    const result = await store.create(10, '   ', image);
    expect(result).toBeNull();
    // 백엔드 NotBlank 와 일관 — 클라에서도 이미지만으로는 보내지 않는다.
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
