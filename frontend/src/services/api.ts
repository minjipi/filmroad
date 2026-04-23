import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

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

// Read the access token lazily from localStorage so this module stays
// loadable before Pinia is installed (e.g. inside Vitest setup). The auth
// store owns writes via setToken(); this just mirrors what's persisted.
const TOKEN_STORAGE_KEY = 'filmroad_access_token';
function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
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

function isSessionProbe(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('/api/users/me') || url.includes('/api/auth/');
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

// Unwrap { success, code, message, results } envelope; surface message on failure.
api.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope<unknown>>) => {
    const body = response.data;
    if (body && typeof body === 'object' && 'success' in body) {
      if (body.success) {
        return { ...response, data: body.results } as AxiosResponse<unknown>;
      }
      return Promise.reject(new ApiError(body.message || 'Request failed', response.status, body.code ?? null));
    }
    return response;
  },
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    const status = error.response?.status ?? null;
    const requestUrl = error.config?.url;
    // Protected endpoints return 401 when anonymous; prompt the user to sign in
    // in place rather than yanking them out of their current page. Session probes
    // (/api/users/me, /api/auth/*) are silent since App.vue fires them on load.
    if (status === 401 && !isSessionProbe(requestUrl)) {
      void openLoginPromptFromInterceptor();
    }
    const body = error.response?.data;
    const msg = body?.message ?? error.message ?? 'Network error';
    const code = body?.code ?? null;
    return Promise.reject(new ApiError(msg, status, code));
  },
);

export default api;
