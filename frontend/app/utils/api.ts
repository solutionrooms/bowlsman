import axios from 'axios';

// Get the base URL from environment or use localhost as fallback
const apiBaseUrl = typeof window !== 'undefined' 
  ? (window as any).__NEXT_DATA__?.runtimeConfig?.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010'
  : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

const api = axios.create({
  baseURL: `${apiBaseUrl}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      if (!config.headers) {
        config.headers = {};
      }
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api; 