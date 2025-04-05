import axios, { InternalAxiosRequestConfig, AxiosHeaders } from "axios";

// Function to get the API URL based on deployment mode
export const getApiUrl = () => {
  // Try to get from window.__NEXT_DATA__
  if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.runtimeConfig?.NEXT_PUBLIC_API_URL) {
    const nextDataUrl = (window as any).__NEXT_DATA__.runtimeConfig.NEXT_PUBLIC_API_URL;
    return nextDataUrl;
  }
  
  // Always use environment variable if available
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Check deployment mode - defaults to local if not specified
  const deploymentMode = process.env.DEPLOYMENT_MODE || 'local';
  
  // Choose API URL based on deployment mode
  switch (deploymentMode) {
    case 'local':
      return 'http://localhost:8000';
    case 'docker':
      return 'http://localhost:8010';
    default:
      return 'https://api.bowlshub.fridaydigital.co.uk';
  }
};

// Create axios instance with dynamic baseURL
const instance = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Get the current API URL for each request
  const currentApiUrl = getApiUrl();
  
  // Set or update the baseURL
  config.baseURL = `${currentApiUrl}/api`;
  
  // Only access localStorage in browser context
  if (typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        // Ensure headers exist and are of type AxiosHeaders
        if (!config.headers) {
          config.headers = new AxiosHeaders();
        }
        config.headers.set('Authorization', `Token ${token}`);
      }
    } catch (e) {
      // Silently handle localStorage errors
      console.warn("Could not access localStorage for token");
    }
  }
  
  if (config.url) {
    // Remove any leading slashes
    config.url = config.url.replace(/^\/+/, '');
    
    // Fix URLs with query parameters
    if (config.url.includes('?')) {
      // Split the URL into path and query parts
      const [path, query] = config.url.split('?', 2);
      
      // Ensure the path has a trailing slash
      const pathWithSlash = path.endsWith('/') ? path : `${path}/`;
      
      // Reconstruct the URL properly
      config.url = `${pathWithSlash}?${query}`;
    } 
    // URLs without query parameters
    else if (!config.url.endsWith('/')) {
      config.url = `${config.url}/`;
    }
    
    // Log all API requests to console
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    console.log(`Full URL: ${config.baseURL}/${config.url}`);
  }

  return config;
});

// Add response interceptor with proper error handling
instance.interceptors.response.use(
  (response) => {
    // Log successful responses with full data
    const method = response.config.method?.toUpperCase();
    const url = response.config.url;
    console.group(`API Response (${response.status}): ${method} ${url}`);
    console.log('Response Data:', response.data);
    console.log('Full URL:', `${response.config.baseURL}/${url}`);
    console.groupEnd();
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
