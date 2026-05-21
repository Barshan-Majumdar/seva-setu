import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

let tokenProvider = null;

export const setTokenProvider = (provider) => {
  tokenProvider = provider;
};

api.interceptors.request.use(async (config) => {
  // Try dynamic provider first (guarantees fresh token from Clerk)
  if (tokenProvider) {
    try {
      const token = await tokenProvider();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      }
    } catch (err) {
      console.error('Token provider failed:', err);
    }
  }

  // Fallback to localStorage (for SSR or legacy compatibility)
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const API_SECONDARY_BASE_URL = import.meta.env.VITE_API_SECONDARY_BASE_URL || 'http://localhost:5001/api';

const SERVERS = [API_BASE_URL, API_SECONDARY_BASE_URL];

// Load assigned server from storage, or pick one randomly for proper 50/50 load balancing
let currentBaseUrl = localStorage.getItem('assigned_server');

if (!currentBaseUrl || !SERVERS.includes(currentBaseUrl)) {
  // Flip a coin to distribute load evenly across both servers
  currentBaseUrl = SERVERS[Math.floor(Math.random() * SERVERS.length)];
  localStorage.setItem('assigned_server', currentBaseUrl);
}

// Set the initial base URL for this user's session
api.defaults.baseURL = currentBaseUrl;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if error is due to server unavailability (network error, timeout, or 5xx)
    const isNetworkOrServerError = !error.response || (error.response && error.response.status >= 500);

    if (isNetworkOrServerError && originalRequest && !originalRequest._retryCount) {
      originalRequest._retryCount = 1;
      
      // Identify which server actually failed
      const failedUrl = originalRequest.baseURL;
      
      // Pick the other server
      const alternativeUrl = failedUrl === API_BASE_URL ? API_SECONDARY_BASE_URL : API_BASE_URL;
      
      // Update our state to the alternative server
      currentBaseUrl = alternativeUrl;
      api.defaults.baseURL = currentBaseUrl;
      originalRequest.baseURL = currentBaseUrl;
      localStorage.setItem('assigned_server', currentBaseUrl);
      
      return api(originalRequest);
    }

    if (error?.response?.status === 401) {
      // Only clear stale credentials — do NOT force-navigate.
      // Navigation is handled by React components (ProtectedRoute)
      // which read Clerk's live auth state.
      // The old window.location.assign('/login') was creating an
      // infinite reload loop because it raced with Clerk's token sync.
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
    }
    return Promise.reject(error);
  }
);

export const pollStatus = async (endpoint, condition, interval = 500, maxAttempts = 120) => {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const { data } = await api.get(endpoint);
    if (condition(data)) return data;
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error('Verification timed out. Please check the dashboard later.');
};

export default api;
