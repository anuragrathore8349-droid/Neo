export type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003';
const AUTH_STORAGE_KEY = 'neofin_auth';
const API_VERSION = '/v1';
const CSRF_ENDPOINT = '/api/csrf-token';

function versioned(path: string) {
  if (!path) return path;
  // If path already contains API version, return as-is
  if (path.startsWith('/api/v') || path.startsWith('/api/v1') || path.startsWith('/api/v2')) return path;
  // Replace leading '/api' with '/api/v1'
  if (path.startsWith('/api/')) return path.replace('/api/', `/api${API_VERSION}/`);
  if (path === '/api') return `/api${API_VERSION}`;
  return path;
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string | null> | null = null;

function isSafeMethod(method?: string): boolean {
  if (!method) return true;
  const normalized = method.toUpperCase();
  return ['GET', 'HEAD', 'OPTIONS'].includes(normalized);
}

function getStoredAuth(): { accessToken?: string; refreshToken?: string; user?: unknown } | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

async function fetchCsrfToken(): Promise<string | null> {
  if (csrfToken) {
    return csrfToken;
  }

  if (csrfTokenPromise) {
    return csrfTokenPromise;
  }

  csrfTokenPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${versioned(CSRF_ENDPOINT)}`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Unable to fetch CSRF token: ${response.status}`);
      }

      const data = await response.json();
      csrfToken = data?.csrfToken || null;
      return csrfToken;
    } catch (error) {
      csrfToken = null;
      console.error('Failed to fetch CSRF token:', error);
      return null;
    } finally {
      csrfTokenPromise = null;
    }
  })();

  return csrfTokenPromise;
}

async function ensureCsrfToken(method?: string): Promise<string | null> {
  if (isSafeMethod(method)) {
    return csrfToken;
  }
  return csrfToken || fetchCsrfToken();
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
      const csrf = await ensureCsrfToken('POST');
      const response = await fetch(`${API_BASE_URL}${versioned('/api/auth/refresh-token')}`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {})
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
  const method = rest.method ? String(rest.method).toUpperCase() : 'GET';
  const isFormData = body instanceof FormData;

  const getAccessToken = () => {
    if (typeof window === 'undefined') return null;
    return getStoredAuth()?.accessToken || null;
  };

  let accessToken = getAccessToken();
  const csrf = await ensureCsrfToken(method);

  const makeRequest = async (token: string | null) => {
    return fetch(`${API_BASE_URL}${versioned(path)}`, {
      mode: 'cors',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(headers || {})
      },
      credentials: 'include',
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
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