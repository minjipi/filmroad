import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

/**
 * 백엔드 FollowUserDto 와 1:1. row 단위 follow 상태를 들고 있어 같은 리스트
 * 안에서도 follow / unfollow 토글 가능.
 */
export interface FollowListUser {
  id: number;
  nickname: string;
  handle: string;
  avatarUrl: string | null;
  following: boolean;
  isMe: boolean;
}

export type FollowTab = 'followers' | 'following';

interface TabState {
  users: FollowListUser[];
  hasMore: boolean;
  nextCursor: number | null;
  loading: boolean;
  /** row-level follow toggle 락. user id 별로 in-flight 요청 추적 — 동시에 여러 row
   *  눌러도 각자 정상 동작하게. */
  togglingIds: Set<number>;
  loaded: boolean;
}

interface State {
  /** userId 별, tab 별 state. 같은 사용자의 followers/following 페이지 상호 이동
   *  시 캐시 적중 (재진입에 다시 fetch 안 함). */
  byUser: Record<number, { followers: TabState; following: TabState } | undefined>;
  error: string | null;
}

const DEFAULT_LIMIT = 20;

function emptyTab(): TabState {
  return {
    users: [],
    hasMore: false,
    nextCursor: null,
    loading: false,
    togglingIds: new Set(),
    loaded: false,
  };
}

function ensure(state: State, userId: number) {
  if (!state.byUser[userId]) {
    state.byUser[userId] = { followers: emptyTab(), following: emptyTab() };
  }
  // ensure() 가 새 슬롯을 만들 때 raw 객체를 그대로 리턴하면 Pinia 의 reactive
  // proxy 를 우회하는 commentStore 회귀 (#?) 와 동일 사고가 가능. 한번 SET 후
  // GET 으로 받아 proxy 로 리턴.
  return state.byUser[userId]!;
}

interface FollowListResponse {
  users: FollowListUser[];
  hasMore: boolean;
  nextCursor: number | null;
}

export const useFollowListStore = defineStore('followList', {
  state: (): State => ({
    byUser: {},
    error: null,
  }),
  getters: {
    tabFor: (state) => (userId: number, tab: FollowTab): TabState => {
      const slot = state.byUser[userId];
      return slot ? slot[tab] : emptyTab();
    },
  },
  actions: {
    async fetch(userId: number, tab: FollowTab): Promise<void> {
      const slot = ensure(this, userId);
      const t = slot[tab];
      if (t.loading) return;
      t.loading = true;
      this.error = null;
      try {
        const path = tab === 'followers'
          ? `/api/users/${userId}/followers`
          : `/api/users/${userId}/following`;
        const { data } = await api.get<FollowListResponse>(path, {
          params: { limit: DEFAULT_LIMIT },
        });
        t.users = data.users;
        t.hasMore = data.hasMore;
        t.nextCursor = data.nextCursor;
        t.loaded = true;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load list';
      } finally {
        t.loading = false;
      }
    },
    async loadMore(userId: number, tab: FollowTab): Promise<void> {
      const slot = ensure(this, userId);
      const t = slot[tab];
      if (!t.hasMore || t.loading) return;
      t.loading = true;
      try {
        const path = tab === 'followers'
          ? `/api/users/${userId}/followers`
          : `/api/users/${userId}/following`;
        const params: Record<string, string | number> = { limit: DEFAULT_LIMIT };
        if (t.nextCursor !== null) params.cursor = t.nextCursor;
        const { data } = await api.get<FollowListResponse>(path, { params });
        t.users = [...t.users, ...data.users];
        t.hasMore = data.hasMore;
        t.nextCursor = data.nextCursor;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load more';
      } finally {
        t.loading = false;
      }
    },
    /**
     * 리스트 안에서 한 row 의 follow 상태 토글. optimistic — UI 즉시 flip,
     * 실패 시 rollback. row 의 isMe 면 noop. 비로그인 viewer 면 prompt.
     */
    async toggleFollowRow(userId: number, tab: FollowTab, rowUserId: number): Promise<void> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('팔로우는 로그인 후 이용할 수 있어요.');
        return;
      }
      const slot = ensure(this, userId);
      const t = slot[tab];
      const row = t.users.find((u) => u.id === rowUserId);
      if (!row || row.isMe) return;
      if (t.togglingIds.has(rowUserId)) return;

      const wasFollowing = row.following;
      row.following = !wasFollowing;
      // togglingIds 는 Set — Vue reactive 가 mutate 추적이 약해서 매번 새 Set 으로
      // 교체해 동기화 신호를 명확히.
      t.togglingIds = new Set([...t.togglingIds, rowUserId]);
      try {
        await api.post<{
          following: boolean;
          followersCount: number;
          followingCount: number;
        }>(`/api/users/${rowUserId}/follow`);
      } catch (e) {
        row.following = wasFollowing;
        this.error = e instanceof Error ? e.message : 'Failed to toggle follow';
      } finally {
        const next = new Set(t.togglingIds);
        next.delete(rowUserId);
        t.togglingIds = next;
      }
    },
    reset(userId: number): void {
      delete this.byUser[userId];
      this.error = null;
    },
  },
});
