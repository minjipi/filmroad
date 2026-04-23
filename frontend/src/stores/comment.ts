import { defineStore } from 'pinia';
import api from '@/services/api';

export interface CommentAuthor {
  userId: number;
  handle: string;
  nickname: string;
  avatarUrl: string | null;
  verified: boolean;
}

export interface Comment {
  id: number;
  content: string;
  createdAt: string;
  author: CommentAuthor;
}

interface CommentListResponse {
  comments: Comment[];
  hasMore: boolean;
  nextCursor: number | null;
}

interface PhotoCommentState {
  items: Comment[];
  hasMore: boolean;
  nextCursor: number | null;
  loading: boolean;
  error: string | null;
}

interface State {
  commentsByPhoto: Record<number, PhotoCommentState>;
}

const DEFAULT_LIMIT = 20;

function ensure(state: State, photoId: number): PhotoCommentState {
  let s = state.commentsByPhoto[photoId];
  if (!s) {
    s = { items: [], hasMore: false, nextCursor: null, loading: false, error: null };
    state.commentsByPhoto[photoId] = s;
  }
  return s;
}

export const useCommentStore = defineStore('comment', {
  state: (): State => ({
    commentsByPhoto: {},
  }),
  getters: {
    itemsFor: (state) => (photoId: number): Comment[] =>
      state.commentsByPhoto[photoId]?.items ?? [],
    hasMoreFor: (state) => (photoId: number): boolean =>
      state.commentsByPhoto[photoId]?.hasMore ?? false,
    loadingFor: (state) => (photoId: number): boolean =>
      state.commentsByPhoto[photoId]?.loading ?? false,
    errorFor: (state) => (photoId: number): string | null =>
      state.commentsByPhoto[photoId]?.error ?? null,
  },
  actions: {
    async fetch(photoId: number): Promise<void> {
      const s = ensure(this, photoId);
      s.loading = true;
      s.error = null;
      s.nextCursor = null;
      try {
        const { data } = await api.get<CommentListResponse>(
          `/api/photos/${photoId}/comments`,
          { params: { limit: DEFAULT_LIMIT } },
        );
        s.items = data.comments;
        s.hasMore = data.hasMore;
        s.nextCursor = data.nextCursor;
      } catch (e) {
        s.error = e instanceof Error ? e.message : 'Failed to load comments';
      } finally {
        s.loading = false;
      }
    },
    async loadMore(photoId: number): Promise<void> {
      const s = ensure(this, photoId);
      if (!s.hasMore || s.loading) return;
      s.loading = true;
      try {
        const params: Record<string, string | number> = { limit: DEFAULT_LIMIT };
        if (s.nextCursor !== null) params.cursor = s.nextCursor;
        const { data } = await api.get<CommentListResponse>(
          `/api/photos/${photoId}/comments`,
          { params },
        );
        s.items = [...s.items, ...data.comments];
        s.hasMore = data.hasMore;
        s.nextCursor = data.nextCursor;
      } catch (e) {
        s.error = e instanceof Error ? e.message : 'Failed to load more';
      } finally {
        s.loading = false;
      }
    },
    async create(photoId: number, content: string): Promise<Comment | null> {
      const trimmed = content.trim();
      if (trimmed.length === 0) return null;
      const s = ensure(this, photoId);
      s.error = null;
      try {
        const { data } = await api.post<Comment>(
          `/api/photos/${photoId}/comments`,
          { content: trimmed },
        );
        s.items.push(data);
        return data;
      } catch (e) {
        s.error = e instanceof Error ? e.message : 'Failed to post comment';
        return null;
      }
    },
    async remove(commentId: number, photoId: number): Promise<boolean> {
      const s = ensure(this, photoId);
      s.error = null;
      try {
        await api.delete(`/api/comments/${commentId}`);
        s.items = s.items.filter((c) => c.id !== commentId);
        return true;
      } catch (e) {
        s.error = e instanceof Error ? e.message : 'Failed to delete comment';
        return false;
      }
    },
    clear(photoId: number): void {
      delete this.commentsByPhoto[photoId];
    },
  },
});
