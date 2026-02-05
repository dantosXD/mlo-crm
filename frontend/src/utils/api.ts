import { API_URL } from './apiBase';

/**
 * API client utility for making authenticated requests with CSRF protection
 */

/**
 * Make an authenticated API request with CSRF token
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  // Import auth store dynamically to avoid circular dependencies
  const { useAuthStore } = await import('../stores/authStore');
  const { accessToken, csrfToken, updateCsrfToken } = useAuthStore.getState();

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

  // Add CSRF token for state-changing methods
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    let csrf = csrfToken;

    // If CSRF token is missing but we have an access token, fetch a fresh token
    if (!csrf && accessToken) {
      try {
        const csrfResponse = await fetch(`${API_URL}/auth/me`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const newCsrfToken = csrfResponse.headers.get('X-CSRF-Token');
        if (newCsrfToken) {
          csrf = newCsrfToken;
          updateCsrfToken(newCsrfToken);
        }
      } catch (error) {
        console.warn('Failed to refresh CSRF token:', error);
      }
    }

    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  // Make the request
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Update CSRF token from response headers if present
  const newCsrfToken = response.headers.get('X-CSRF-Token');
  if (newCsrfToken) {
    updateCsrfToken(newCsrfToken);
  }

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

export default api;
