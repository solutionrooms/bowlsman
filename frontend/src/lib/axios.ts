import axios from "axios";

// Function to get the API URL
const getApiUrl = () => {
  console.log('Initializing API URL configuration...');
  console.log('Runtime environment:', {
    NODE_ENV: process.env.NODE_ENV,
    isServer: typeof window === 'undefined',
    hasNextData: typeof window !== 'undefined' && !!(window as any).__NEXT_DATA__,
    windowLocation: typeof window !== 'undefined' ? window.location.origin : 'not in browser'
  });

  // Try to get from window.__NEXT_DATA__
  if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.runtimeConfig?.NEXT_PUBLIC_API_URL) {
    const nextDataUrl = (window as any).__NEXT_DATA__.runtimeConfig.NEXT_PUBLIC_API_URL;
    console.log('Found API URL in Next.js runtime config:', nextDataUrl);
    return nextDataUrl;
  }
  
  // Fallback to process.env, ensure it's HTTP
  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';
  const httpUrl = envUrl.replace('https://', 'http://');
  console.log('Using API URL from process.env:', httpUrl);
  return httpUrl;
};

const apiUrl = getApiUrl();

// Debug environment variable
console.log('Final API configuration:', {
  NEXT_PUBLIC_API_URL: apiUrl,
  NODE_ENV: process.env.NODE_ENV,
  window_location: typeof window !== 'undefined' ? window.location.origin : 'not in browser',
  window_next_data: typeof window !== 'undefined' ? (window as any).__NEXT_DATA__ : undefined
});

// Create axios instance with the API URL
const instance = axios.create({
  baseURL: apiUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

// Debug instance config
console.log('Axios instance created with config:', {
  baseURL: instance.defaults.baseURL,
  headers: instance.defaults.headers
});

instance.interceptors.request.use((config) => {
  console.log('Request interceptor starting...', {
    originalUrl: config.url,
    originalBaseURL: config.baseURL,
    fullConfig: config
  });

  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Token ${token}`;
    console.log('Added authorization token to request');
  }
  
  // Ensure config.baseURL is set
  if (!config.baseURL) {
    console.log('No baseURL found in request config, setting to:', apiUrl);
    config.baseURL = apiUrl;
  }
  
  if (config.url) {
    // Log before any transformation
    console.log('URL before transformation:', config.url);
    
    // Remove any leading slashes and ensure api prefix
    const originalUrl = config.url;
    config.url = config.url.replace(/^\/+/, '').replace(/^api\//, '');
    config.url = `api/${config.url}`;
    
    // Ensure trailing slash for Django
    if (!config.url.endsWith('/')) {
      config.url = `${config.url}/`;
    }

    console.log('URL transformation complete:', {
      original: originalUrl,
      withoutSlashes: originalUrl.replace(/^\/+/, ''),
      withPrefix: `api/${originalUrl.replace(/^\/+/, '').replace(/^api\//, '')}`,
      final: config.url
    });
  }

  // Log the full URL for debugging
  console.log("Final request configuration:", {
    method: config.method,
    url: config.url,
    baseURL: config.baseURL,
    headers: config.headers,
    data: config.data
  });

  const fullUrl = new URL(
    config.url || '',
    config.baseURL || apiUrl
  ).toString();
  
  console.log("Making request to:", fullUrl);

  return config;
});

// Add response interceptor for debugging
instance.interceptors.response.use(
  (response) => {
    console.log("Response received:", {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers,
      config: {
        method: response.config.method,
        url: response.config.url,
        baseURL: response.config.baseURL
      }
    });
    return response;
  },
  (error) => {
    console.error("Request error:", {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      } : 'No response',
      request: error.request ? {
        responseURL: error.request.responseURL,
        status: error.request.status,
        statusText: error.request.statusText
      } : 'No request',
      config: error.config ? {
        method: error.config.method,
        url: error.config.url,
        baseURL: error.config.baseURL,
        data: error.config.data
      } : 'No config'
    });
    return Promise.reject(error);
  }
);

export default instance;
