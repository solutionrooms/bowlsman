import axios, { InternalAxiosRequestConfig, AxiosHeaders } from 'axios';

// Get the base URL from environment or use localhost as fallback
const apiBaseUrl = typeof window !== 'undefined' 
  ? (window as any).__NEXT_DATA__?.runtimeConfig?.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${apiBaseUrl}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      // Ensure headers exist and are of type AxiosHeaders
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      }
      config.headers.set('Authorization', `Token ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api; 