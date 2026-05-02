import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

export interface ApiEnvelope<T> {
  success: boolean;
  code: number;
  message: string;
  results: T;
}

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: number | null;
  constructor(message: string, status: number | null, code: number | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';

export const api = axios.create({
  baseURL,
  timeout: 10_000,
  withCredentials: true,
});

// Read/write the access token lazily from localStorage so this module stays
// loadable before Pinia is installed (e.g. inside Vitest setup). The auth
// store owns writes via setToken() from its own code path; the refresh
// flow here also has to keep the stored token in sync after a successful
// /api/auth/refresh so the retry request picks up the new Bearer.
const TOKEN_STORAGE_KEY = 'filmroad_access_token';
function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token === null) window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    else window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    /* localStorage unavailable */
  }
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = readAccessToken();
  if (token) {
    // Back-compat with axios v1: headers may be an AxiosHeaders instance.
    if (config.headers && typeof (config.headers as { set?: unknown }).set === 'function') {
      (config.headers as { set: (k: string, v: string) => void }).set(
        'Authorization',
        `Bearer ${token}`,
      );
    } else {
      (config.headers as Record<string, string>) = {
        ...(config.headers as Record<string, string>),
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return config;
});

function isAuthRequest(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('/api/auth/');
}
// Kept for back-compat with the old behavior: /api/users/me is a session
// probe that should silently fail rather than opening the login prompt.
function isSessionProbe(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('/api/users/me') || isAuthRequest(url);
}

// Lazily import the ui store so the api module stays loadable before Pinia
// is installed (e.g. inside Vitest setup before createTestingPinia).
async function openLoginPromptFromInterceptor(): Promise<void> {
  try {
    const { useUiStore } = await import('@/stores/ui');
    useUiStore().showLoginPrompt();
  } catch {
    // Pinia not ready yet — no-op; the next user action will retry.
  }
}

async function clearSessionFromInterceptor(): Promise<void> {
  // Best-effort session cleanup after refresh fails. Keeps the same
  // semantics as authStore.logout() minus the server POST.
  writeAccessToken(null);
  try {
    const { useAuthStore } = await import('@/stores/auth');
    const auth = useAuthStore();
    auth.user = null;
    auth.accessToken = null;
  } catch {
    /* Pinia not ready — storage cleared, next load will reconcile */
  }
}

// ----- 401 refresh-and-retry -----
// Concurrent 401s from parallel requests must not fan out into N refresh
// calls; a singleton promise coalesces them. Cleared after settle so a
// subsequent expiry (hours later) starts a fresh refresh.
let refreshInFlight: Promise<AxiosResponse<{ accessToken?: string } | unknown>> | null = null;

function ensureRefresh(
  instance: AxiosInstance,
): Promise<AxiosResponse<{ accessToken?: string } | unknown>> {
  if (!refreshInFlight) {
    refreshInFlight = instance
      .post<{ accessToken?: string }>('/api/auth/refresh')
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Flag we stamp on a retried config so we never loop indefinitely if the
// refreshed token still 401s (server-side invalidation race etc.).
const RETRY_FLAG = '_filmroadRetry' as const;

type RetriableConfig = InternalAxiosRequestConfig & {
  [RETRY_FLAG]?: boolean;
};

/**
 * Exported for unit tests — the module-level interceptor below is a thin
 * closure over `api` that just forwards to this handler. Tests build a
 * fake instance (`post` + callable) and drive this directly; that lets us
 * assert the full 401 → refresh → retry path without an HTTP adapter.
 */
export async function handleResponseError(
  instance: AxiosInstance,
  error: AxiosError<ApiEnvelope<unknown>>,
): Promise<AxiosResponse<unknown>> {
  const status = error.response?.status ?? null;
  const cfg = error.config as RetriableConfig | undefined;
  const requestUrl = cfg?.url;

  // Path 1: 401 on a non-auth endpoint → try refresh + retry once.
  if (status === 401 && cfg && !isAuthRequest(requestUrl) && !cfg[RETRY_FLAG]) {
    cfg[RETRY_FLAG] = true;
    try {
      const refreshRes = await ensureRefresh(instance);
      // Envelope is already unwrapped by the success interceptor — data
      // is `{ accessToken?, ... }` directly. Sync localStorage so the
      // retry's request interceptor attaches the new Bearer.
      const body = (refreshRes as AxiosResponse<{ accessToken?: string }>).data;
      if (body && typeof body.accessToken === 'string') {
        writeAccessToken(body.accessToken);
        // Best-effort: keep the auth store's `accessToken` mirror in sync
        // so other reactive consumers see the new token immediately.
        try {
          const { useAuthStore } = await import('@/stores/auth');
          useAuthStore().accessToken = body.accessToken;
        } catch {
          /* Pinia not ready */
        }
      }
      return instance(cfg) as Promise<AxiosResponse<unknown>>;
    } catch {
      // refresh failed — drop the session and fall through to the normal
      // 401 prompt + error surfacing below.
      await clearSessionFromInterceptor();
      void openLoginPromptFromInterceptor();
    }
  } else if (status === 401 && !isSessionProbe(requestUrl)) {
    // Path 2: 401 on an already-retried or a bare-protected endpoint with
    // no refresh available — prompt sign-in but don't loop.
    void openLoginPromptFromInterceptor();
  }

  const body = error.response?.data;
  const msg = body?.message ?? error.message ?? 'Network error';
  const code = body?.code ?? null;
  throw new ApiError(msg, status, code);
}

// Visible for tests only — resets the refresh singleton between cases.
export function __resetRefreshState(): void {
  refreshInFlight = null;
}

// Backend serves uploaded media at relative `/uploads/...`. On the web that's
// same-origin; in the Capacitor shell the webview origin is `https://localhost`
// so an `<img src="/uploads/...">` would 404 against the local webview. Walk
// each response and rewrite leading-`/uploads/` strings to absolute URLs.
const UPLOADS_PREFIX = '/uploads/';
const ABS_BASE = baseURL.replace(/\/+$/, '');
function rewriteUploadsUrls(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.startsWith(UPLOADS_PREFIX) ? ABS_BASE + value : value;
  }
  if (Array.isArray(value)) return value.map(rewriteUploadsUrls);
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k in src) out[k] = rewriteUploadsUrls(src[k]);
    return out;
  }
  return value;
}

// Unwrap { success, code, message, results } envelope; surface message on failure.
api.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope<unknown>>) => {
    const body = response.data;
    if (body && typeof body === 'object' && 'success' in body) {
      if (body.success) {
        return { ...response, data: rewriteUploadsUrls(body.results) } as AxiosResponse<unknown>;
      }
      return Promise.reject(
        new ApiError(body.message || 'Request failed', response.status, body.code ?? null),
      );
    }
    return response;
  },
  (error: AxiosError<ApiEnvelope<unknown>>) => handleResponseError(api, error),
);

export default api;
