const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export const API_URL = `${API_BASE.replace(/\/api$/, '')}/api`;

export default API_URL;
