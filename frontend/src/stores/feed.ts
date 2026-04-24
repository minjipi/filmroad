import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

// RECENT = time-sorted feed (task #33, the new default). POPULAR keeps the
// engagement-ranked view; FOLLOWING scopes to accounts the user follows;
// NEARBY orders by distance when coordinates are available; BY_WORK filters
// to a single work id (paired with `workId`).
export type FeedTab = 'RECENT' | 'POPULAR' | 'FOLLOWING' | 'NEARBY' | 'BY_WORK';

export interface FeedAuthor {
  userId: number;
  handle: string;
  nickname: string;
  avatarUrl: string | null;
  verified: boolean;
}

export interface FeedPlace {
  id: number;
  name: string;
  regionLabel: string;
}

export interface FeedWork {
  id: number;
  title: string;
  workEpisode: string | null;
  sceneTimestamp: string | null;
}

export interface FeedPost {
  id: number;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
  sceneCompare: boolean;
  dramaSceneImageUrl: string | null;
  author: FeedAuthor;
  place: FeedPlace;
  work: FeedWork;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  saved: boolean;
  visitedAt: string | null;
}

export interface FeedUser {
  userId: number;
  handle: string;
  nickname: string;
  avatarUrl: string | null;
  verified: boolean;
  workTitle: string | null;
  stampCountForWork: number;
  following: boolean;
}

export interface FollowToggleResponse {
  following: boolean;
  followersCount: number;
  followingCount: number;
}

interface FeedResponse {
  posts: FeedPost[];
  recommendedUsers?: FeedUser[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface FetchOptions {
  lat?: number;
  lng?: number;
}

interface State {
  posts: FeedPost[];
  recommendedUsers: FeedUser[];
  tab: FeedTab;
  workId: number | null;
  cursor: string | null;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

const DEFAULT_LIMIT = 5;

export const useFeedStore = defineStore('feed', {
  state: (): State => ({
    posts: [],
    recommendedUsers: [],
    // Default tab is RECENT (task #33) — most users want the newest posts
    // first when landing on /feed. POPULAR is still available as a tab.
    tab: 'RECENT',
    workId: null,
    cursor: null,
    hasMore: false,
    loading: false,
    error: null,
  }),
  actions: {
    async fetch(opts: FetchOptions = {}): Promise<void> {
      this.loading = true;
      this.error = null;
      this.cursor = null;
      try {
        const params: Record<string, string | number> = { tab: this.tab, limit: DEFAULT_LIMIT };
        if (this.workId !== null) params.workId = this.workId;
        if (typeof opts.lat === 'number') params.lat = opts.lat;
        if (typeof opts.lng === 'number') params.lng = opts.lng;
        const { data } = await api.get<FeedResponse>('/api/feed', { params });
        this.posts = data.posts;
        this.hasMore = data.hasMore;
        this.cursor = data.nextCursor;
        if (data.recommendedUsers && data.recommendedUsers.length > 0) {
          this.recommendedUsers = data.recommendedUsers;
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load feed';
      } finally {
        this.loading = false;
      }
    },
    async loadMore(): Promise<void> {
      if (!this.hasMore || this.loading) return;
      this.loading = true;
      try {
        const params: Record<string, string | number> = { tab: this.tab, limit: DEFAULT_LIMIT };
        if (this.workId !== null) params.workId = this.workId;
        if (this.cursor) params.cursor = this.cursor;
        const { data } = await api.get<FeedResponse>('/api/feed', { params });
        this.posts = [...this.posts, ...data.posts];
        this.hasMore = data.hasMore;
        this.cursor = data.nextCursor;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load more';
      } finally {
        this.loading = false;
      }
    },
    async fetchRecommended(workId?: number): Promise<void> {
      try {
        const params: Record<string, string | number> = { limit: 4 };
        if (typeof workId === 'number') params.workId = workId;
        const { data } = await api.get<FeedUser[]>('/api/feed/recommended-users', { params });
        this.recommendedUsers = data;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load recommendations';
      }
    },
    async setTab(tab: FeedTab): Promise<void> {
      if (this.tab === tab) return;
      this.tab = tab;
      await this.fetch();
    },
    async toggleLikePost(photoId: number): Promise<void> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('좋아요는 로그인 후 이용할 수 있어요.');
        return;
      }
      try {
        const { data } = await api.post<{ liked: boolean; likeCount: number }>(
          `/api/photos/${photoId}/like`,
        );
        const post = this.posts.find((p) => p.id === photoId);
        if (post) {
          post.liked = data.liked;
          post.likeCount = data.likeCount;
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to toggle like';
      }
    },
    async toggleFollow(userId: number): Promise<void> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('팔로우는 로그인 후 이용할 수 있어요.');
        return;
      }
      try {
        const { data } = await api.post<FollowToggleResponse>(
          `/api/users/${userId}/follow`,
        );
        const user = this.recommendedUsers.find((u) => u.userId === userId);
        if (user) user.following = data.following;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to toggle follow';
      }
    },
  },
});
