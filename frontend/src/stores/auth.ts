import { defineStore } from 'pinia';
import axios from 'axios';
import api from '@/services/api';
import type { ProfileUser } from '@/stores/profile';

interface State {
  user: ProfileUser | null;
  loading: boolean;
  error: string | null;
}

interface MeResponse {
  user: ProfileUser;
}

export const useAuthStore = defineStore('auth', {
  state: (): State => ({
    user: null,
    loading: false,
    error: null,
  }),
  getters: {
    isAuthenticated: (state): boolean => state.user !== null,
  },
  actions: {
    async fetchMe(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<MeResponse>('/api/users/me');
        this.user = data.user;
      } catch (e) {
        this.user = null;
        if (axios.isAxiosError(e) && e.response?.status === 401) {
          return;
        }
        this.error = e instanceof Error ? e.message : 'Failed to load session';
      } finally {
        this.loading = false;
      }
    },
    async logout(): Promise<void> {
      try {
        await api.post('/api/auth/logout');
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to logout';
      } finally {
        this.user = null;
      }
    },
  },
});
