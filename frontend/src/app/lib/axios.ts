import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',  // This should make all requests go to /api/...
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  console.log('Making request to:', `${config.baseURL}${config.url}`);
  return config;
});

export default api; 