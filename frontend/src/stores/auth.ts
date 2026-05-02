import { defineStore, getActivePinia, type Pinia } from 'pinia';
import api, { ApiError } from '@/services/api';
import type { ProfileUser } from '@/stores/profile';

/**
 * 다른 사용자로 로그인하거나 로그아웃 했을 때 이전 사용자의 데이터(좋아요/저장/
 * 피드/프로필 등) 가 화면에 잔류하지 않도록 auth 외 모든 store 를 $reset.
 *
 * Pinia 의 `_s` 는 활성 store 들을 담은 Map 으로, 공식 plugin 가이드에서도
 * 사용되는 안정적인 internal API. 매 호출 시점에 등록돼 있는 store 만 리셋
 * 하므로 lazy-load 된 store 도 자연스럽게 포함된다.
 *
 * `auth` 자체는 호출자(login/signup/logout 액션)가 직후에 user/token 을
 * 명시적으로 갱신하므로 제외 — 여기서 함께 리셋하면 진행 중인 액션의 결과를
 * 곧바로 덮어쓰는 race 가 발생.
 *
 * `ui` 는 진행 중인 모달/시트 상태를 담고 있어 로그아웃 직후 사라지면 사용자
 * 입장에서 "방금 누른 액션이 그냥 닫혔다" 처럼 보임. 모달 자체가 인증 의존
 * 이라면 컴포넌트가 자체 처리하도록 두고 여기선 보존.
 */
function resetUserScopedStores(): void {
  const pinia = getActivePinia() as (Pinia & { _s?: Map<string, { $reset?: () => void }> }) | null;
  if (!pinia?._s) return;
  for (const [id, store] of pinia._s) {
    if (id === 'auth' || id === 'ui') continue;
    if (typeof store.$reset === 'function') store.$reset();
  }
}

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
    // Apply tokens delivered via OAuth deep link on native (Capacitor) flow.
    // Custom Tabs and the in-app webview have separate cookie stores, so the
    // backend can't write HttpOnly cookies that the webview will see. Instead
    // the success handler appends tokens to a `filmroad://oauth/callback`
    // deep link; here we mirror them into both localStorage (so the axios
    // Bearer interceptor picks them up) and document.cookie (so the existing
    // cookie-based /api/auth/refresh endpoint keeps working).
    applyOAuthDeepLinkTokens(accessToken: string, refreshToken: string): void {
      resetUserScopedStores();
      this.setToken(accessToken);
      if (typeof document !== 'undefined') {
        // SameSite=Lax matches the dev/prod cookie format so the refresh call
        // (same-origin GET/POST) carries them. HttpOnly cannot be set from JS;
        // that's the documented trade-off of the deep-link flow.
        const oneWeek = 7 * 24 * 3600;
        const halfHour = 30 * 60;
        document.cookie = `ATOKEN=${accessToken}; Path=/; SameSite=Lax; Secure; Max-Age=${halfHour}`;
        document.cookie = `RTOKEN=${refreshToken}; Path=/; SameSite=Lax; Secure; Max-Age=${oneWeek}`;
      }
      // Reset the memoized session probe so /api/users/me runs again with the
      // new credentials. fetchMe will be triggered by the next ensureSessionReady.
      this.sessionReady = null;
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
        // 직전 익명 / 다른 사용자 세션이 남긴 store 데이터를 먼저 비우고 신규
        // 가입자 user 를 set — 후속 fetch 가 stale 데이터를 덮지 못하는 race
        // 차단.
        resetUserScopedStores();
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
        // 다른 사용자로 갈아탔을 때 직전 사용자의 home/feed/saved/profile 등이
        // 그대로 남아있으면 신규 fetch 가 끝나기 전까지 화면이 stale 한 채로
        // 보임. 명시적으로 비운 뒤 새 user 를 set.
        resetUserScopedStores();
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
        // 모든 user-scoped store 초기화. 직전 사용자의 home places, saved
        // 컬렉션, feed posts, profile 사진 등이 다음 user (또는 익명 viewer)
        // 화면에 잔류하지 않도록.
        resetUserScopedStores();
        this.user = null;
        this.setToken(null);
        // 다음 사용자가 로그인했을 때 fetchMe 가 새로 트리거되도록 sessionReady
        // memoization 도 비운다 (로그아웃 후 재로그인 시 첫 진입에서 stale
        // promise 가 anonymous 결과를 캐시한 채로 남아있는 것 방지).
        this.sessionReady = null;
      }
    },
  },
});
