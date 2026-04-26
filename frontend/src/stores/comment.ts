import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

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
  // 인증샷 댓글의 첨부 이미지 정적 경로(`/uploads/comments/...`).
  // 첨부 없는 댓글은 null.
  imageUrl: string | null;
  // 답글이면 부모 댓글 id, 아니면 null. 1단계 깊이만 허용 (답글의 답글 X).
  parentId: number | null;
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
  // 새 슬롯을 만들 때 로컬 raw 객체를 그대로 리턴하면, 호출자가 그걸로
  // s.loading = true 같은 mutation 을 하면 Pinia 의 reactive proxy 를 우회해서
  // 알림이 안 간다. SET 으로 commentsByPhoto[id] 를 채운 뒤 다시 GET 으로
  // 받아오면 Vue 가 raw 를 reactive proxy 로 wrap 한 결과가 와서, 이후 모든
  // mutation 이 proxy SET trap 을 거쳐 컴포넌트 computed 가 정상적으로
  // 재평가된다.
  if (!state.commentsByPhoto[photoId]) {
    state.commentsByPhoto[photoId] = {
      items: [],
      hasMore: false,
      nextCursor: null,
      loading: false,
      error: null,
    };
  }
  return state.commentsByPhoto[photoId];
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
    async create(
      photoId: number,
      content: string,
      image?: File | null,
      parentId?: number | null,
    ): Promise<Comment | null> {
      const trimmed = content.trim();
      // 백엔드 contract: content 는 NotBlank. 이미지만 보내는 케이스는 막아야 한다.
      if (trimmed.length === 0) return null;
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('댓글 작성은 로그인 후 이용할 수 있어요.');
        return null;
      }
      const s = ensure(this, photoId);
      s.error = null;
      try {
        // 항상 multipart/form-data 로 전송. Content-Type 은 직접 세팅하지 않고
        // 브라우저가 boundary 까지 채우도록 둔다(axios 가 FormData 를 자동 감지).
        const form = new FormData();
        form.append('content', trimmed);
        if (image) form.append('image', image);
        if (parentId != null) form.append('parentId', String(parentId));
        const { data } = await api.post<Comment>(
          `/api/photos/${photoId}/comments`,
          form,
        );
        s.items.push(data);
        return data;
      } catch (e) {
        s.error = e instanceof Error ? e.message : 'Failed to post comment';
        return null;
      }
    },
    async remove(commentId: number, photoId: number): Promise<boolean> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('댓글 관리는 로그인 후 이용할 수 있어요.');
        return false;
      }
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
