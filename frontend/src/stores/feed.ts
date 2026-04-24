import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { getCurrentCoords, type Coords } from '@/composables/useGeolocation';
import { useToast } from '@/composables/useToast';

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
  // Cached coords for the NEARBY tab (task #37). Captured once per session
  // via `getCurrentCoords()` when the user first enters the tab, then reused
  // by subsequent fetch / loadMore so we don't re-prompt for permission on
  // every scroll. null = unknown (not yet requested OR request failed).
  nearbyCoords: Coords | null;
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
    nearbyCoords: null,
  }),
  actions: {
    async fetch(opts: FetchOptions = {}): Promise<void> {
      this.loading = true;
      this.error = null;
      this.cursor = null;
      try {
        const params: Record<string, string | number> = { tab: this.tab, limit: DEFAULT_LIMIT };
        if (this.workId !== null) params.workId = this.workId;
        // NEARBY reuses cached coords (populated by setTab). Explicit opts
        // still win so tests and the map-aware caller can force values.
        const lat = this.resolveLat(opts);
        const lng = this.resolveLng(opts);
        if (lat !== undefined) params.lat = lat;
        if (lng !== undefined) params.lng = lng;
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
        // Same coord-reuse as fetch() so scroll pagination returns spatially
        // consistent results (task #37).
        const lat = this.resolveLat();
        const lng = this.resolveLng();
        if (lat !== undefined) params.lat = lat;
        if (lng !== undefined) params.lng = lng;
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
    // Coord resolution helper — explicit opts override cache; cache only
    // applies to NEARBY. Other tabs that pass no coords → server-side
    // ordering kicks in.
    resolveLat(opts: FetchOptions = {}): number | undefined {
      if (typeof opts.lat === 'number') return opts.lat;
      if (this.tab === 'NEARBY' && this.nearbyCoords) return this.nearbyCoords.lat;
      return undefined;
    },
    resolveLng(opts: FetchOptions = {}): number | undefined {
      if (typeof opts.lng === 'number') return opts.lng;
      if (this.tab === 'NEARBY' && this.nearbyCoords) return this.nearbyCoords.lng;
      return undefined;
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
      // NEARBY needs coordinates — try cache first, fall back to
      // navigator.geolocation (task #37). Failure is non-fatal: we still
      // fetch with no lat/lng (backend returns [] for NEARBY without coords)
      // and surface a polite toast so the user knows why the list is empty.
      if (tab === 'NEARBY' && this.nearbyCoords == null) {
        const coords = await getCurrentCoords();
        if (coords) {
          this.nearbyCoords = coords;
        } else {
          await useToast().showError('위치 정보를 가져올 수 없어요');
        }
      }
      await this.fetch();
    },
    // Explicit re-request — invalidates the cache and re-prompts the
    // browser. Called by the UI if the user taps a "다시 시도" button
    // after the initial denial.
    async refreshNearbyCoords(): Promise<void> {
      this.nearbyCoords = null;
      const coords = await getCurrentCoords();
      if (coords) this.nearbyCoords = coords;
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
