import { API_URL } from './apiBase';

/**
 * API client utility for making authenticated requests with CSRF protection.
 * CSRF uses the cookie-based double-submit pattern: the backend sets a
 * non-HttpOnly cookie, and the frontend echoes it in the X-CSRF-Token header.
 */

/**
 * Read a cookie value by name from document.cookie.
 */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Ensure the CSRF cookie exists before the first mutating request in a session.
 * This avoids a deterministic 403 on the first write after login/refresh.
 */
async function ensureCsrfCookie(accessToken: string | null): Promise<string | null> {
  let csrf = getCookie('csrf-token');
  if (csrf || !accessToken) {
    return csrf;
  }

  try {
    await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });
  } catch {
    // If priming fails, continue without blocking the request.
  }

  csrf = getCookie('csrf-token');
  return csrf;
}

/**
 * Make an authenticated API request with CSRF token
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  // Import auth store dynamically to avoid circular dependencies
  const { useAuthStore } = await import('../stores/authStore');
  const { accessToken } = useAuthStore.getState();

  // Prepare headers
  const extraHeaders = options.headers instanceof Headers
    ? Object.fromEntries(options.headers.entries())
    : Array.isArray(options.headers)
      ? Object.fromEntries(options.headers)
      : options.headers;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders ?? {}),
  };

  // Add authorization header if token exists
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Add CSRF token for state-changing methods (read from cookie)
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = await ensureCsrfCookie(accessToken);
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  // Make the request — include credentials so the CSRF cookie is sent
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  return response;
}

/**
 * Convenience methods for common HTTP operations
 */
export const api = {
  get: (endpoint: string, options?: RequestInit) =>
    apiRequest(endpoint, { ...options, method: 'GET' }),

  post: (endpoint: string, data?: any, options?: RequestInit) =>
    apiRequest(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: (endpoint: string, data?: any, options?: RequestInit) =>
    apiRequest(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: (endpoint: string, data?: any, options?: RequestInit) =>
    apiRequest(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: (endpoint: string, options?: RequestInit) =>
    apiRequest(endpoint, { ...options, method: 'DELETE' }),
};

/**
 * Convenience function to get clients
 */
export async function getClients() {
  const response = await api.get('/clients');
  return response.json();
}

export default api;
