const rawBase = (import.meta.env.VITE_API_URL || 'http://localhost:3002').replace(/\/$/, '');

// If VITE_API_URL points to the same host as the frontend (e.g. http://localhost:5173),
// use a relative path so all requests go through the Vite proxy and stay same-origin.
// This ensures CSRF cookies are correctly set and read without cross-port issues.
const isSameOrigin =
  typeof window !== 'undefined' &&
  rawBase.replace(/\/api$/, '') === `${window.location.protocol}//${window.location.host}`;

const API_BASE = isSameOrigin ? '' : rawBase.replace(/\/api$/, '');

export const API_URL = `${API_BASE}/api`;

export default API_URL;
