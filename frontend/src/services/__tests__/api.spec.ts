import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import {
  ApiError,
  handleResponseError,
  __resetRefreshState,
} from '@/services/api';

// -----------------------------------------------------------------------------
// Helpers: fabricate a minimal axios-like instance so we can drive the error
// handler without standing up a real HTTP adapter. The instance is a callable
// function (matching axios's `axios(config)` signature for retry) with a
// `.post` method that stands in for the refresh call.
// -----------------------------------------------------------------------------

interface FakeInstance {
  (config: InternalAxiosRequestConfig): Promise<AxiosResponse<unknown>>;
  post: ReturnType<typeof vi.fn>;
  // Utilities for tests:
  _calls: InternalAxiosRequestConfig[];
  _mockRetryOnce: (response: AxiosResponse<unknown>) => void;
  _mockRetryAlways: (response: AxiosResponse<unknown>) => void;
}

function makeFakeInstance(): FakeInstance {
  const queue: Array<AxiosResponse<unknown>> = [];
  let always: AxiosResponse<unknown> | null = null;
  const calls: InternalAxiosRequestConfig[] = [];
  const fn = ((config: InternalAxiosRequestConfig) => {
    calls.push(config);
    if (queue.length > 0) return Promise.resolve(queue.shift() as AxiosResponse<unknown>);
    if (always) return Promise.resolve(always);
    return Promise.reject(new Error('fake instance: no queued response'));
  }) as FakeInstance;
  fn.post = vi.fn();
  fn._calls = calls;
  fn._mockRetryOnce = (r) => queue.push(r);
  fn._mockRetryAlways = (r) => {
    always = r;
  };
  return fn;
}

function makeAxiosError(
  status: number,
  url: string,
  data?: { message?: string; code?: number },
): AxiosError {
  const config = {
    url,
    method: 'get',
    headers: {} as Record<string, string>,
  } as InternalAxiosRequestConfig;
  return {
    isAxiosError: true,
    config,
    response: {
      status,
      statusText: '',
      headers: {},
      config,
      data,
    } as AxiosResponse,
    request: {},
    message: `http ${status}`,
    name: 'AxiosError',
    toJSON: () => ({}),
  } as AxiosError;
}

const TOKEN_KEY = 'filmroad_access_token';

describe('api.ts response interceptor — 401 refresh-and-retry', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    __resetRefreshState();
  });

  it('401 on a protected endpoint triggers POST /api/auth/refresh and retries the original request', async () => {
    const fake = makeFakeInstance();
    fake.post.mockResolvedValueOnce({
      data: { accessToken: 'new-token' },
    } as AxiosResponse);
    fake._mockRetryOnce({
      data: { place: { id: 1, name: 'retried' } },
      status: 200,
    } as AxiosResponse<unknown>);

    const err = makeAxiosError(401, '/api/places/1');
    const result = await handleResponseError(
      fake as unknown as Parameters<typeof handleResponseError>[0],
      err as AxiosError<never>,
    );

    expect(fake.post).toHaveBeenCalledWith('/api/auth/refresh');
    expect(fake._calls.length).toBe(1);
    expect(fake._calls[0].url).toBe('/api/places/1');
    expect(result).toMatchObject({ data: { place: { id: 1, name: 'retried' } } });
    // Refresh body's accessToken is persisted so the retry's Bearer contents.
    expect(localStorage.getItem(TOKEN_KEY)).toBe('new-token');
  });

  it('refresh failure clears the stored token + auth store user and surfaces the original 401', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale-token');
    const fake = makeFakeInstance();
    fake.post.mockRejectedValueOnce(new Error('refresh rejected'));

    const err = makeAxiosError(401, '/api/places/1', { message: 'unauthorized', code: 42 });
    await expect(
      handleResponseError(
        fake as unknown as Parameters<typeof handleResponseError>[0],
        err as AxiosError<never>,
      ),
    ).rejects.toMatchObject({
      // Falls back to the original 401 — we don't mask it with the refresh error.
      status: 401,
    });

    // Session cleared.
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    const { useAuthStore } = await import('@/stores/auth');
    expect(useAuthStore().user).toBeNull();
    expect(useAuthStore().accessToken).toBeNull();
    // Original request was NOT retried after refresh failed.
    expect(fake._calls.length).toBe(0);
  });

  it('two concurrent 401s share one refresh call (singleton) and each get retried once', async () => {
    const fake = makeFakeInstance();
    // Hold the refresh until we've kicked off both handlers so both observe
    // `refreshInFlight` as non-null.
    let resolveRefresh!: (v: AxiosResponse) => void;
    fake.post.mockReturnValueOnce(
      new Promise<AxiosResponse>((r) => {
        resolveRefresh = r;
      }),
    );
    fake._mockRetryAlways({ data: 'ok', status: 200 } as AxiosResponse<unknown>);

    const err1 = makeAxiosError(401, '/api/places/1');
    const err2 = makeAxiosError(401, '/api/places/2');
    const p1 = handleResponseError(
      fake as unknown as Parameters<typeof handleResponseError>[0],
      err1 as AxiosError<never>,
    );
    const p2 = handleResponseError(
      fake as unknown as Parameters<typeof handleResponseError>[0],
      err2 as AxiosError<never>,
    );

    resolveRefresh({ data: { accessToken: 'post-refresh' } } as AxiosResponse);
    await Promise.all([p1, p2]);

    expect(fake.post).toHaveBeenCalledTimes(1); // singleton refresh
    expect(fake._calls.length).toBe(2); // both originals retried
    expect(fake._calls.map((c) => c.url).sort()).toEqual([
      '/api/places/1',
      '/api/places/2',
    ]);
  });

  it('401 on an /api/auth/* endpoint does NOT trigger refresh (would loop)', async () => {
    const fake = makeFakeInstance();
    const err = makeAxiosError(401, '/api/auth/login');

    await expect(
      handleResponseError(
        fake as unknown as Parameters<typeof handleResponseError>[0],
        err as AxiosError<never>,
      ),
    ).rejects.toBeInstanceOf(ApiError);

    expect(fake.post).not.toHaveBeenCalled();
    expect(fake._calls.length).toBe(0);
  });

  it('a request already marked _filmroadRetry=true is not refreshed again', async () => {
    const fake = makeFakeInstance();
    const err = makeAxiosError(401, '/api/places/1');
    // Simulate a retry that still 401s — we must not loop.
    (err.config as unknown as Record<string, unknown>)._filmroadRetry = true;

    await expect(
      handleResponseError(
        fake as unknown as Parameters<typeof handleResponseError>[0],
        err as AxiosError<never>,
      ),
    ).rejects.toMatchObject({ status: 401 });

    expect(fake.post).not.toHaveBeenCalled();
    expect(fake._calls.length).toBe(0);
  });

  it('non-401 errors bubble up as ApiError with server-provided message and code', async () => {
    const fake = makeFakeInstance();
    const err = makeAxiosError(500, '/api/places/1', { message: 'boom', code: 9 });

    await expect(
      handleResponseError(
        fake as unknown as Parameters<typeof handleResponseError>[0],
        err as AxiosError<never>,
      ),
    ).rejects.toMatchObject({
      status: 500,
      code: 9,
      message: 'boom',
    });
    expect(fake.post).not.toHaveBeenCalled();
  });
});
