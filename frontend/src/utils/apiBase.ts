const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3002').replace(/\/$/, '');

export const API_URL = `${API_BASE.replace(/\/api$/, '')}/api`;

export default API_URL;
