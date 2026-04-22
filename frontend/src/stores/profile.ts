import { defineStore } from 'pinia';
import api from '@/services/api';

export interface ProfileUser {
  id: number;
  nickname: string;
  handle: string;
  avatarUrl: string;
  bio: string;
  level: number;
  levelName: string;
  points: number;
  streakDays: number;
  followersCount: number;
  followingCount: number;
}

export interface ProfileStats {
  visitedCount: number;
  photoCount: number;
  followersCount: number;
  followingCount: number;
}

export type MiniMapVariant = 'PRIMARY' | 'VIOLET' | 'MINT';

export interface MiniMapPin {
  latitude: number;
  longitude: number;
  variant: MiniMapVariant;
}

export interface ProfileResponse {
  user: ProfileUser;
  stats: ProfileStats;
  miniMapPins: MiniMapPin[];
}

interface State {
  user: ProfileUser | null;
  stats: ProfileStats | null;
  miniMapPins: MiniMapPin[];
  loading: boolean;
  error: string | null;
}

export const useProfileStore = defineStore('profile', {
  state: (): State => ({
    user: null,
    stats: null,
    miniMapPins: [],
    loading: false,
    error: null,
  }),
  actions: {
    async fetch(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<ProfileResponse>('/api/users/me');
        this.user = data.user;
        this.stats = data.stats;
        this.miniMapPins = data.miniMapPins;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load profile';
      } finally {
        this.loading = false;
      }
    },
  },
});
