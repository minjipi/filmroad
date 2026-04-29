import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { requestLocation, type Coords, type LocationFailReason } from '@/composables/useGeolocation';
import { useToast } from '@/composables/useToast';

// RECENT = time-sorted feed (task #33, the new default). POPULAR keeps the
// engagement-ranked view; FOLLOWING scopes to accounts the user follows;
// NEARBY orders by distance when coordinates are available; BY_CONTENT filters
// to a single work id (paired with `contentId`).
export type FeedTab = 'RECENT' | 'POPULAR' | 'FOLLOWING' | 'NEARBY' | 'BY_CONTENT';

export interface FeedAuthor {
  userId: number;
  handle: string;
  nickname: string;
  avatarUrl: string | null;
  verified: boolean;
  /** viewer 가 이 author 를 follow 중인지. 비로그인 / fallback (userId=null) 면 false. */
  following: boolean;
}

export interface FeedPlace {
  id: number;
  name: string;
  regionLabel: string;
}

export interface FeedContent {
  id: number;
  title: string;
  contentEpisode: string | null;
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
  content: FeedContent;
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
  contentTitle: string | null;
  stampCountForContent: number;
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
  contentId: number | null;
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

function nearbyFailMessage(reason: LocationFailReason): string {
  // reason 별 한국어 UX 카피. Toast 한 줄에 들어갈 길이로 제한.
  switch (reason) {
    case 'denied':
      return '위치 권한이 차단되어 있어요. 주소창 자물쇠 → 권한 설정에서 허용해 주세요';
    case 'timeout':
      return '위치 확인이 지연됐어요. 잠시 후 다시 시도해 주세요';
    case 'unavailable':
    default:
      return 'GPS 또는 네트워크를 사용할 수 없어요';
  }
}

export const useFeedStore = defineStore('feed', {
  state: (): State => ({
    posts: [],
    recommendedUsers: [],
    // Default tab is RECENT (task #33) — most users want the newest posts
    // first when landing on /feed. POPULAR is still available as a tab.
    tab: 'RECENT',
    contentId: null,
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
        if (this.contentId !== null) params.contentId = this.contentId;
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
        if (this.contentId !== null) params.contentId = this.contentId;
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
    async fetchRecommended(contentId?: number): Promise<void> {
      try {
        const params: Record<string, string | number> = { limit: 4 };
        if (typeof contentId === 'number') params.contentId = contentId;
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
        const result = await requestLocation();
        if (result.ok) {
          this.nearbyCoords = result.coords;
        } else {
          // reason 별로 안내 메시지가 달라 — 'denied' 는 권한 설정 안내,
          // 'unavailable' 은 GPS/네트워크, 'timeout' 은 재시도 유도.
          await useToast().showError(nearbyFailMessage(result.reason));
        }
      }
      await this.fetch();
    },
    // Explicit re-request — invalidates the cache and re-prompts the
    // browser. Called by the UI if the user taps a "다시 시도" button
    // after the initial denial.
    async refreshNearbyCoords(): Promise<void> {
      this.nearbyCoords = null;
      const result = await requestLocation();
      if (result.ok) this.nearbyCoords = result.coords;
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
      // 같은 userId 가 등장하는 모든 surface(추천 카드 + 포스트 작성자) 를 한 번에
      // 동기화. optimistic flip — 즉시 UI 반영, 실패 시 일괄 rollback.
      const reco = this.recommendedUsers.find((u) => u.userId === userId);
      const matchingPosts = this.posts.filter(
        (p) => p.author.userId != null && p.author.userId === userId,
      );
      const wasFollowing = reco?.following ?? matchingPosts[0]?.author.following ?? false;
      if (reco) reco.following = !wasFollowing;
      for (const p of matchingPosts) p.author.following = !wasFollowing;
      try {
        const { data } = await api.post<FollowToggleResponse>(
          `/api/users/${userId}/follow`,
        );
        if (reco) reco.following = data.following;
        for (const p of matchingPosts) p.author.following = data.following;
      } catch (e) {
        if (reco) reco.following = wasFollowing;
        for (const p of matchingPosts) p.author.following = wasFollowing;
        this.error = e instanceof Error ? e.message : 'Failed to toggle follow';
      }
    },
  },
});
