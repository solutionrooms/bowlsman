import axios from "axios";

// Debug environment variable
console.log('Environment variable check:', {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NODE_ENV: process.env.NODE_ENV
});

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Debug instance config
console.log('Axios instance config:', {
  baseURL: instance.defaults.baseURL
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Token ${token}`;
  }
  
  if (config.url) {
    // Remove any leading slashes and ensure api prefix
    const cleanUrl = config.url.replace(/^\/+/, '').replace(/^api\//, '');
    config.url = `api/${cleanUrl}`;
  }

  // Log the full URL for debugging
  const fullUrl = new URL(
    config.url || '', 
    config.baseURL || window.location.origin
  ).toString();
  console.log("Making request to:", fullUrl);
  console.log("Request config:", {
    method: config.method,
    url: config.url,
    baseURL: config.baseURL,
    headers: config.headers
  });

  return config;
});

export default instance; 