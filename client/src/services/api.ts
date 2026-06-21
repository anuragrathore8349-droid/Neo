export type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

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
        
        // Update stored token
        const stored = localStorage.getItem('neofin_auth');
        if (stored) {
          const auth = JSON.parse(stored);
          auth.accessToken = newToken;
          localStorage.setItem('neofin_auth', JSON.stringify(auth));
        }
        
        return newToken;
      }
      
      // Clear auth if refresh fails
      localStorage.removeItem('neofin_auth');
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      localStorage.removeItem('neofin_auth');
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
  console.log('apiFetch START ->', { 
    url: `${API_BASE_URL}${path}`, 
    method: options.method || 'GET',
    body,
    bodyType: typeof body,
    bodyContent: body ? JSON.stringify(body) : 'undefined'
  });

  // Get access token from localStorage if available
  const getAccessToken = () => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('neofin_auth');
    if (!stored) return null;
    try {
      const auth = JSON.parse(stored);
      return auth.accessToken || null;
    } catch {
      return null;
    }
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
  
  // If 401, try to refresh token once
  if (response.status === 401 && accessToken) {
    console.log('Received 401, attempting to refresh token...');
    const newToken = await refreshAccessToken();
    
    if (newToken) {
      console.log('Token refreshed successfully, retrying request...');
      accessToken = newToken;
      response = await makeRequest(newToken);
    } else {
      console.log('Token refresh failed, proceeding with 401 error');
    }
  }

  const text = await response.text();
  let data = null;
  
  try {
    data = text ? JSON.parse(text) : null;
  } catch (parseError) {
    // Response is not valid JSON - likely HTML error page or server error
    console.error('Failed to parse response as JSON:', {
      url: `${API_BASE_URL}${path}`,
      status: response.status,
      responseFirstChars: text?.substring(0, 100),
      isHtml: text?.startsWith('<!'),
      parseError: (parseError as Error).message
    });
    
    // If HTML response, provide helpful error message
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
    
    // For other JSON parse errors
    const error = new Error(
      `Invalid JSON response: ${(parseError as Error).message}`
    );
    const fetchError = error as Error & { status?: number; response?: unknown };
    fetchError.status = response.status;
    fetchError.response = { error: 'Invalid response format' };
    throw fetchError;
  }

  if (!response.ok) {
    let message = data?.message || data?.error || `${response.status} ${response.statusText}`;
    
    // Format validation errors - handle both array and object formats
    if (data?.errors) {
      let errorDetails = '';
      if (Array.isArray(data.errors)) {
        errorDetails = data.errors
          .map((err: any) => `${err.field || 'field'}: ${err.message}`)
          .join(', ');
      } else if (typeof data.errors === 'object') {
        // Handle object format (e.g., {field: {message: ...}})
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
    console.error('apiFetch FAILED ->', { 
      url: `${API_BASE_URL}${path}`, 
      method: options.method || 'GET',
      status: response.status, 
      body,
      responseMessage: data?.message,
      responseErrors: data?.errors,
      responseDebug: data?.debug,
      formattedMessage: message,
      fullResponse: data
    });
    throw fetchError;
  }

  console.log('apiFetch success ->', { url: `${API_BASE_URL}${path}`, status: response.status, data });
  return data;
}
