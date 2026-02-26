// Always use a relative path in development so requests go through the Vite proxy
// and cookies remain same-origin. In production VITE_API_URL should point to the
// actual backend host (e.g. https://api.example.com).
const rawBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '').replace(/\/api$/, '');

export const API_URL = rawBase ? `${rawBase}/api` : '/api';

export default API_URL;
