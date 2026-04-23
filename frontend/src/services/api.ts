import axios, { AxiosError, AxiosResponse } from 'axios';

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
