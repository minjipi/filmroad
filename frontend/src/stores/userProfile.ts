import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

// Matches backend `GET /api/users/:id` final shape (task #42). Endpoint
// is permitAll — anonymous viewers get { isMe: false, following: false }.
export interface UserProfileStats {
  visitedCount: number;
  photoCount: number;
  followersCount: number;
  followingCount: number;
  collectedWorksCount: number;
}

export interface UserProfilePhoto {
  id: number;
  imageUrl: string;
  workTitle: string | null;
  placeName: string;
}

export interface UserProfileCollectedWork {
  id: number;
  title: string;
  posterUrl: string | null;
  collectedCount: number;
  totalCount: number;
}

export interface UserProfile {
  id: number;
  nickname: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  verified: boolean;
  level: number;
  levelName: string;
  points: number;
  streakDays: number;
  stats: UserProfileStats;
  /** true when this is the current signed-in user; UI should route to /profile instead. */
  isMe: boolean;
  /** Whether the current viewer is already following this user. */
  following: boolean;
  topPhotos: UserProfilePhoto[];
  recentCollectedWorks: UserProfileCollectedWork[];
}

interface State {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  /** In-flight marker so the follow button can disable itself. */
  followPending: boolean;
}

export const useUserProfileStore = defineStore('userProfile', {
  state: (): State => ({
    user: null,
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
        this.user = data;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load user';
      } finally {
        this.loading = false;
      }
    },
    async toggleFollow(): Promise<void> {
      if (!this.user) return;
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('팔로우는 로그인 후 이용할 수 있어요.');
        return;
      }
      if (this.user.isMe) return; // no-op on your own profile
      const userId = this.user.id;
      const wasFollowing = this.user.following;
      // Optimistic flip so the button re-renders on the same tick.
      this.user.following = !wasFollowing;
      this.user.stats.followersCount += wasFollowing ? -1 : 1;
      this.followPending = true;
      try {
        const { data } = await api.post<{
          following: boolean;
          followersCount: number;
          followingCount: number;
        }>(`/api/users/${userId}/follow`);
        // Reconcile with the authoritative server state.
        if (this.user) {
          this.user.following = data.following;
          this.user.stats.followersCount = data.followersCount;
        }
      } catch (e) {
        // Rollback on failure so the UI stays honest.
        if (this.user) {
          this.user.following = wasFollowing;
          this.user.stats.followersCount += wasFollowing ? 1 : -1;
        }
        this.error = e instanceof Error ? e.message : 'Failed to toggle follow';
      } finally {
        this.followPending = false;
      }
    },
    reset(): void {
      this.user = null;
      this.loading = false;
      this.error = null;
      this.followPending = false;
    },
  },
});
