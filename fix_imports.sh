#!/bin/bash

# Create a temporary file with the updated axios.ts content
cat > axios_temp.ts << 'EOF'
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
EOF

# Copy the temporary file to all necessary locations
docker cp axios_temp.ts bowlsman-frontend-1:/app/app/src/lib/axios.ts
docker cp axios_temp.ts bowlsman-frontend-1:/app/src/lib/axios.ts

# Remove the temporary file
rm axios_temp.ts

# Clear the Next.js cache and restart the frontend container
docker exec -it bowlsman-frontend-1 rm -rf /app/.next
docker restart bowlsman-frontend-1 