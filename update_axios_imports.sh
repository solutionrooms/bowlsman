#!/bin/bash

# Update profile/page.tsx
docker exec -it bowlsman-frontend-1 sed -i 's|import api from '\''../../../src/lib/axios'\''|import axios from '\''axios'\''\n\nconst api = axios.create({\n  baseURL: process.env.NEXT_PUBLIC_API_URL,\n  headers: {\n    "Content-Type": "application/json",\n  },\n});\n\napi.interceptors.request.use((config) => {\n  const token = localStorage.getItem("token");\n  if (token && config.headers) {\n    config.headers.Authorization = `Token ${token}`;\n  }\n  \n  if (config.url) {\n    // Remove any leading slashes and ensure api prefix\n    const cleanUrl = config.url.replace(/^\\/+/, "").replace(/^api\\//, "");\n    config.url = `api/${cleanUrl}`;\n  }\n\n  return config;\n});|' /app/app/profile/page.tsx

# Update competition/manage/page.tsx
docker exec -it bowlsman-frontend-1 sed -i 's|import api from '\''../../../src/lib/axios'\''|import axios from '\''axios'\''\n\nconst api = axios.create({\n  baseURL: process.env.NEXT_PUBLIC_API_URL,\n  headers: {\n    "Content-Type": "application/json",\n  },\n});\n\napi.interceptors.request.use((config) => {\n  const token = localStorage.getItem("token");\n  if (token && config.headers) {\n    config.headers.Authorization = `Token ${token}`;\n  }\n  \n  if (config.url) {\n    // Remove any leading slashes and ensure api prefix\n    const cleanUrl = config.url.replace(/^\\/+/, "").replace(/^api\\//, "");\n    config.url = `api/${cleanUrl}`;\n  }\n\n  return config;\n});|' /app/app/competition/manage/page.tsx

# Update competition/create/page.tsx
docker exec -it bowlsman-frontend-1 sed -i 's|import api from '\''../../../src/lib/axios'\''|import axios from '\''axios'\''\n\nconst api = axios.create({\n  baseURL: process.env.NEXT_PUBLIC_API_URL,\n  headers: {\n    "Content-Type": "application/json",\n  },\n});\n\napi.interceptors.request.use((config) => {\n  const token = localStorage.getItem("token");\n  if (token && config.headers) {\n    config.headers.Authorization = `Token ${token}`;\n  }\n  \n  if (config.url) {\n    // Remove any leading slashes and ensure api prefix\n    const cleanUrl = config.url.replace(/^\\/+/, "").replace(/^api\\//, "");\n    config.url = `api/${cleanUrl}`;\n  }\n\n  return config;\n});|' /app/app/competition/create/page.tsx

# Clear the Next.js cache and restart the frontend container
docker exec -it bowlsman-frontend-1 rm -rf /app/.next
docker restart bowlsman-frontend-1 