import { defineStore } from 'pinia';
import api, { ApiError } from '@/services/api';
import type { ProfileUser } from '@/stores/profile';

interface State {
  user: ProfileUser | null;
  loading: boolean;
  error: string | null;
}

interface MeResponse {
  user: ProfileUser;
}

function isUnauthorized(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
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
        // Missing/expired session is the normal pre-login state, not a user-facing error.
        if (isUnauthorized(e)) {
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
        // Already-expired sessions return 401 on logout — still treat as success.
        if (!isUnauthorized(e)) {
          this.error = e instanceof Error ? e.message : 'Failed to logout';
        }
      } finally {
        this.user = null;
      }
    },
  },
});
