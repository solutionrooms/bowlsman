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
  
  // Add /api prefix to all requests
  if (config.url && !config.url.startsWith('/api')) {
    config.url = `/api${config.url}`;
  }

  if (config.url) {
    console.log("Request URL:", new URL(config.url, config.baseURL || "").toString());
  }
  return config;
});

export default instance; 