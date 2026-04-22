import axios, { AxiosError, AxiosResponse } from 'axios';

export interface ApiEnvelope<T> {
  success: boolean;
  code: number;
  message: string;
  results: T;
}

const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';

export const api = axios.create({
  baseURL,
  timeout: 10_000,
});

// Unwrap { success, code, message, results } envelope; surface message on failure.
api.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope<unknown>>) => {
    const body = response.data;
    if (body && typeof body === 'object' && 'success' in body) {
      if (body.success) {
        return { ...response, data: body.results } as AxiosResponse<unknown>;
      }
      return Promise.reject(new Error(body.message || 'Request failed'));
    }
    return response;
  },
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    const msg = error.response?.data?.message ?? error.message ?? 'Network error';
    return Promise.reject(new Error(msg));
  },
);

export default api;
