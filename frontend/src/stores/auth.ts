import { defineStore } from 'pinia';
import api, { ApiError } from '@/services/api';
import type { ProfileUser } from '@/stores/profile';

interface State {
  user: ProfileUser | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  // Memoized promise for the first-load session probe. Shared between
  // App.vue's onMounted call and router guards that need to wait for the
  // /api/users/me response before deciding requiresAuth. `null` means
  // "not yet initiated" — ensureSessionReady() starts it.
  sessionReady: Promise<void> | null;
}

// Minimal user shape the /api/auth/{signup,login} endpoints return. The richer
// ProfileUser is fetched afterwards via /api/users/me; we fall back to seeding
// defaults so the app can treat `isAuthenticated` truthfully right away.
interface AuthUser {
  id: number;
  name?: string;
  nickname?: string;
  email?: string;
  handle?: string;
  avatarUrl?: string;
  bio?: string;
  level?: number;
  levelName?: string;
  points?: number;
  streakDays?: number;
  followersCount?: number;
  followingCount?: number;
}

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

interface MeResponse {
  user: ProfileUser;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  agreeAge: boolean;
  agreeTos: boolean;
  agreePrivacy: boolean;
  agreeMarketing: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface CheckEmailResult {
  available: boolean;
  reason?: string | null;
}

export interface UpdateProfilePayload {
  nickname?: string;
  bio?: string;
  avatarUrl?: string;
}

const TOKEN_KEY = 'filmroad_access_token';

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token === null) window.localStorage.removeItem(TOKEN_KEY);
    else window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage unavailable (private mode etc.) — ignore; cookie-based
    // session auth remains the fallback.
  }
}

// Exposed for the axios request interceptor so it can attach a Bearer header
// without pulling in Pinia (which might not be installed yet at module load).
export function getAccessToken(): string | null {
  return readStoredToken();
}

function isUnauthorized(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

function asProfileUser(u: AuthUser): ProfileUser {
  return {
    id: u.id,
    nickname: u.nickname ?? u.name ?? '',
    handle: u.handle ?? '',
    avatarUrl: u.avatarUrl ?? '',
    bio: u.bio ?? '',
    level: u.level ?? 1,
    levelName: u.levelName ?? '입문 순례자',
    points: u.points ?? 0,
    streakDays: u.streakDays ?? 0,
    followersCount: u.followersCount ?? 0,
    followingCount: u.followingCount ?? 0,
  };
}

export const useAuthStore = defineStore('auth', {
  state: (): State => ({
    user: null,
    accessToken: readStoredToken(),
    loading: false,
    error: null,
    sessionReady: null,
  }),
  getters: {
    isAuthenticated: (state): boolean => state.user !== null,
  },
  actions: {
    setToken(token: string | null): void {
      this.accessToken = token;
      writeStoredToken(token);
    },
    // Lazily kicks off — and caches — the first /api/users/me call so the
    // router guard and App.vue's onMounted share a single in-flight promise.
    // Subsequent callers receive the same resolved promise immediately.
    // Not reset on logout (the already-resolved promise stays valid; login /
    // signup actions write the user directly without re-fetching).
    ensureSessionReady(): Promise<void> {
      if (!this.sessionReady) {
        this.sessionReady = this.fetchMe();
      }
      return this.sessionReady;
    },
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
          // Stale token failed — drop it so we stop sending it on every request.
          this.setToken(null);
          return;
        }
        this.error = e instanceof Error ? e.message : 'Failed to load session';
      } finally {
        this.loading = false;
      }
    },
    async signup(payload: SignupPayload): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.post<AuthResponse>('/api/auth/signup', payload);
        this.setToken(data.accessToken);
        this.user = asProfileUser(data.user);
      } catch (e) {
        this.user = null;
        this.setToken(null);
        this.error = e instanceof Error ? e.message : 'Failed to sign up';
        throw e;
      } finally {
        this.loading = false;
      }
    },
    async login(payload: LoginPayload): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.post<AuthResponse>('/api/auth/login', payload);
        this.setToken(data.accessToken);
        this.user = asProfileUser(data.user);
      } catch (e) {
        this.user = null;
        this.setToken(null);
        this.error = e instanceof Error ? e.message : 'Failed to login';
        throw e;
      } finally {
        this.loading = false;
      }
    },
    // Returns { available, reason? }; any network/server failure bubbles up so
    // callers can decide whether to suppress it (debounced UI) or block submit.
    async checkEmail(email: string): Promise<CheckEmailResult> {
      const { data } = await api.get<CheckEmailResult>('/api/auth/check-email', {
        params: { email },
      });
      return data;
    },
    async updateProfile(payload: UpdateProfilePayload): Promise<boolean> {
      this.error = null;
      try {
        const { data } = await api.patch<AuthUser>('/api/users/me', payload);
        this.user = asProfileUser(data);
        return true;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to update profile';
        return false;
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
        this.setToken(null);
      }
    },
  },
});
