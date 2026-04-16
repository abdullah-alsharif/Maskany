/**
 * Axios interceptors for auth (T-026, PRD §2.3, §2.4).
 *
 * Responsibilities:
 *   - Request: attach `Authorization: Bearer <access>` when a token exists.
 *   - Response: on 401, attempt a single refresh, then retry the original
 *     request exactly once. If the refresh or retry fails, report the
 *     failure so the app can clear its session and redirect to /login.
 *
 * Implementation notes:
 *   - Calls to `/auth/refresh` itself bubble up without triggering another
 *     refresh so we never recurse.
 *   - Each original request is tagged with a `_authRetried` flag on its
 *     config so a second 401 falls through to the caller.
 *   - `onRefreshFailed` is called exactly once per original-request failure
 *     (not once per chained interceptor invocation).
 *   - Returns an `eject` function that removes both interceptors — useful
 *     for teardown when the provider unmounts (hot reload, tests).
 */
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

type RetriableConfig = AxiosRequestConfig & { _authRetried?: boolean };

export interface AuthInterceptorOptions {
  getAccessToken: () => string | null;
  onTokenRefreshed: (accessToken: string) => void;
  onRefreshFailed: () => void;
}

const REFRESH_URL = '/auth/refresh';

export function installAuthInterceptors(
  client: AxiosInstance,
  options: AuthInterceptorOptions,
): () => void {
  const requestId = client.interceptors.request.use((config) => {
    const token = options.getAccessToken();
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
    return config;
  });

  const responseId = client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as RetriableConfig | undefined;
      const status = error.response?.status;

      if (status !== 401 || !original) {
        return Promise.reject(error);
      }

      if (original.url === REFRESH_URL || original._authRetried) {
        return Promise.reject(error);
      }

      try {
        const refreshResponse = await client.request({
          url: REFRESH_URL,
          method: 'POST',
        });
        const newAccess = (refreshResponse.data as { accessToken?: string }).accessToken;
        if (!newAccess) {
          options.onRefreshFailed();
          return Promise.reject(error);
        }
        options.onTokenRefreshed(newAccess);

        original._authRetried = true;
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newAccess}`;
        return await client.request(original);
      } catch (retryOrRefreshError) {
        options.onRefreshFailed();
        return Promise.reject(retryOrRefreshError);
      }
    },
  );

  return () => {
    client.interceptors.request.eject(requestId);
    client.interceptors.response.eject(responseId);
  };
}
