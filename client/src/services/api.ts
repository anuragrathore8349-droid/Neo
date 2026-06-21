export type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003';
const AUTH_STORAGE_KEY = 'neofin_auth';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

function getStoredAuth(): { accessToken?: string; refreshToken?: string; user?: unknown } | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = response.ok ? await response.json() : null;

      if (response.ok && data?.data?.accessToken) {
        const newToken = data.data.accessToken;

        // Update stored token, preserving the rest of the auth object (user, etc.)
        const auth = getStoredAuth();
        if (auth) {
          auth.accessToken = newToken;
          if (data.data.refreshToken) {
            auth.refreshToken = data.data.refreshToken;
          }
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
        }

        return newToken;
      }

      // Refresh token is invalid/expired - clear the stale session
      clearStoredAuth();
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      clearStoredAuth();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const getAccessToken = () => {
    if (typeof window === 'undefined') return null;
    return getStoredAuth()?.accessToken || null;
  };

  let accessToken = getAccessToken();

  const makeRequest = async (token: string | null) => {
    return fetch(`${API_BASE_URL}${path}`, {
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(headers || {})
      },
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest
    });
  };

  let response = await makeRequest(accessToken);

  // If 401, try to refresh the token once and retry the original request
  if (response.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      accessToken = newToken;
      response = await makeRequest(newToken);
    }
    // If refresh failed, fall through and let the original 401 response
    // surface as an error below - callers (or ProtectedRoute on next
    // render) are responsible for redirecting to /login.
  }

  const text = await response.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (parseError) {
    if (text?.startsWith('<!')) {
      const error = new Error(
        `Server returned HTML instead of JSON (HTTP ${response.status}). ` +
        `The API endpoint may not exist or the server may be returning an error page. ` +
        `Requested: ${API_BASE_URL}${path}`
      );
      const fetchError = error as Error & { status?: number; response?: unknown };
      fetchError.status = response.status;
      fetchError.response = { error: 'Invalid response format - HTML received' };
      throw fetchError;
    }

    const error = new Error(`Invalid JSON response: ${(parseError as Error).message}`);
    const fetchError = error as Error & { status?: number; response?: unknown };
    fetchError.status = response.status;
    fetchError.response = { error: 'Invalid response format' };
    throw fetchError;
  }

  if (!response.ok) {
    let message = data?.message || data?.error || `${response.status} ${response.statusText}`;

    if (data?.errors) {
      let errorDetails = '';
      if (Array.isArray(data.errors)) {
        errorDetails = data.errors
          .map((err: any) => `${err.field || 'field'}: ${err.message}`)
          .join(', ');
      } else if (typeof data.errors === 'object') {
        errorDetails = Object.entries(data.errors)
          .map(([field, err]: [string, any]) => {
            if (typeof err === 'object' && err.message) {
              return `${field}: ${err.message}`;
            }
            return `${field}: ${err}`;
          })
          .join(', ');
      }

      if (errorDetails) {
        message = `${message} (${errorDetails})`;
      }
    }

    const error = new Error(message);
    const fetchError = error as Error & { status?: number; response?: unknown };
    fetchError.status = response.status;
    fetchError.response = data;
    throw fetchError;
  }

  return data as T;
}
