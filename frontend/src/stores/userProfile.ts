import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

// Matches backend `GET /api/users/:id` (task #42, final shape).
export interface UserProfileUser {
  id: number;
  nickname: string;
  handle: string;
  avatarUrl: string | null;
  /** Optional wide banner — backend nulls for now (entity doesn't carry it). */
  coverUrl: string | null;
  bio: string | null;
  level: number;
  levelName: string;
  verified: boolean;
}

export interface UserProfileStats {
  photoCount: number;
  followersCount: number;
  followingCount: number;
  badgeCount: number;
}

export interface UserProfileStampHighlight {
  workId: number;
  workTitle: string;
  posterUrl: string | null;
  /** Number of stamps collected from this work; no totalCount from backend. */
  count: number;
}

export interface UserProfilePhoto {
  id: number;
  imageUrl: string;
  placeId: number;
  workTitle: string;
  likeCount: number;
  sceneCompare: boolean;
}

export interface UserProfile {
  user: UserProfileUser;
  stats: UserProfileStats;
  /** viewer → target follow status. */
  following: boolean;
  /** true when the viewer is looking at their own profile. */
  isMe: boolean;
  stampHighlights: UserProfileStampHighlight[];
  photos: UserProfilePhoto[];
}

interface State {
  user: UserProfileUser | null;
  stats: UserProfileStats | null;
  following: boolean;
  isMe: boolean;
  stampHighlights: UserProfileStampHighlight[];
  photos: UserProfilePhoto[];
  loading: boolean;
  error: string | null;
  /** In-flight marker so the follow button can disable itself. */
  followPending: boolean;
}

export const useUserProfileStore = defineStore('userProfile', {
  state: (): State => ({
    user: null,
    stats: null,
    following: false,
    isMe: false,
    stampHighlights: [],
    photos: [],
    loading: false,
    error: null,
    followPending: false,
  }),
  actions: {
    async fetchUser(id: number): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<UserProfile>(`/api/users/${id}`);
        this.user = data.user;
        this.stats = data.stats;
        this.following = data.following;
        this.isMe = data.isMe;
        this.stampHighlights = data.stampHighlights;
        this.photos = data.photos;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load user';
      } finally {
        this.loading = false;
      }
    },
    async toggleFollow(): Promise<void> {
      if (!this.user || !this.stats) return;
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('팔로우는 로그인 후 이용할 수 있어요.');
        return;
      }
      if (this.isMe) return; // no-op on your own profile
      const userId = this.user.id;
      const wasFollowing = this.following;
      // Optimistic flip so the button re-renders on the same tick.
      this.following = !wasFollowing;
      this.stats.followersCount += wasFollowing ? -1 : 1;
      this.followPending = true;
      try {
        const { data } = await api.post<{
          following: boolean;
          followersCount: number;
          followingCount: number;
        }>(`/api/users/${userId}/follow`);
        // Reconcile with the authoritative server state.
        this.following = data.following;
        if (this.stats) this.stats.followersCount = data.followersCount;
      } catch (e) {
        // Rollback on failure so the UI stays honest.
        this.following = wasFollowing;
        if (this.stats) {
          this.stats.followersCount += wasFollowing ? 1 : -1;
        }
        this.error = e instanceof Error ? e.message : 'Failed to toggle follow';
      } finally {
        this.followPending = false;
      }
    },
    reset(): void {
      this.user = null;
      this.stats = null;
      this.following = false;
      this.isMe = false;
      this.stampHighlights = [];
      this.photos = [];
      this.loading = false;
      this.error = null;
      this.followPending = false;
    },
  },
});
