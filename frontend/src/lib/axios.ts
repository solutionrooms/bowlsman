import axios from "axios";

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Token ${token}`;
  }
  
  if (config.url) {
    // Remove any leading slashes to prevent double slashes
    config.url = config.url.replace(/^\/+/, '');
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