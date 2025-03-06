import axios from "axios";

// Function to get the API URL
const getApiUrl = () => {
  // Try to get from window.__NEXT_DATA__
  if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.runtimeConfig?.NEXT_PUBLIC_API_URL) {
    const nextDataUrl = (window as any).__NEXT_DATA__.runtimeConfig.NEXT_PUBLIC_API_URL;
    return nextDataUrl;
  }
  
  // Fallback to process.env, ensure it's HTTP
  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';
  const httpUrl = envUrl.replace('https://', 'http://');
  return httpUrl;
};

const apiUrl = getApiUrl();

// Create axios instance with the API URL
const instance = axios.create({
  baseURL: apiUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

instance.interceptors.request.use((config) => {
  // Only access localStorage in browser context
  if (typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem("token");
      if (token && config.headers) {
        config.headers.Authorization = `Token ${token}`;
      }
    } catch (e) {
      // Silently handle localStorage errors
      console.warn("Could not access localStorage for token");
    }
  }
  
  // Ensure config.baseURL is set
  if (!config.baseURL) {
    config.baseURL = apiUrl;
  }
  
  if (config.url) {
    // Remove any leading slashes
    const originalUrl = config.url;
    config.url = config.url.replace(/^\/+/, '');
    
    // Ensure api prefix without duplication
    if (!config.url.startsWith('api/')) {
      config.url = `api/${config.url}`;
    }
    
    // Ensure trailing slash for Django
    if (!config.url.endsWith('/')) {
      config.url = `${config.url}/`;
    }
  }

  return config;
});

// Add response interceptor with proper error handling
instance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Limit console error output in production
    const isDev = process.env.NODE_ENV !== 'production';
    
    try {
      if (isDev) {
        const status = error.response?.status;
        const url = error.config?.url;
        const method = error.config?.method?.toUpperCase();
        
        // Avoid recursive logging
        const MAX_LOG_LENGTH = 500; // Truncate long error objects
        const errorData = error.response?.data;
        const errorMsg = typeof errorData === 'object' 
          ? JSON.stringify(errorData).substring(0, MAX_LOG_LENGTH) 
          : (errorData || error.message || 'Unknown error');
          
        console.error(
          `API Error: ${status} ${method} ${url}`,
          errorMsg
        );
      }
    } catch (e) {
      // Prevent error in error handler from causing additional issues
      if (isDev) {
        console.error("Error in axios error handler", e);
      }
    }
    
    return Promise.reject(error);
  }
);

export default instance;
