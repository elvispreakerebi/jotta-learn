import axios from 'axios';

// Determine if we're in development or production
const isDevelopment = process.env.NODE_ENV === 'development';

// Create axios instance with custom config
const axiosInstance = axios.create({
  // Use localhost for development if needed
  baseURL: isDevelopment ? 'http://localhost:5000' : 'https://jotta.onrender.com',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // Add timeout for long-running requests
});

// Add a request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Check if we have a token in localStorage (fallback for when cookies don't work)
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      // Add the token to the Authorization header
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      console.log('Authentication error detected, redirecting to login');

      // Clear any stored tokens
      localStorage.removeItem('authToken');

      // Remove the Authorization header
      delete axiosInstance.defaults.headers.common['Authorization'];

      // Redirect to login page on authentication error
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;