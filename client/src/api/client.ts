import axios from 'axios';

// Base API configuration
const apiClient = axios.create({
  baseURL: '/api/',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

// Interceptor to attach user_token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('user_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = token;

    if (config.data instanceof FormData) {
      if (!config.data.has('user_token')) {
        config.data.append('user_token', token);
      }
      // CRITICAL: delete Content-Type so browser sets multipart/form-data with boundary
      delete config.headers['Content-Type'];
    } else if (typeof config.data === 'object' && config.data !== null) {
      if (!config.data.user_token) {
        config.data.user_token = token;
      }
    } else if (!config.data) {
      config.data = { user_token: token };
    }
  } else if (config.data instanceof FormData) {
    config.headers = config.headers || {};
    delete config.headers['Content-Type'];
  }

  // Convert object payload to URLSearchParams for PHP x-www-form-urlencoded parsing
  if (
    config.data &&
    !(config.data instanceof FormData) &&
    typeof config.data === 'object'
  ) {
    const params = new URLSearchParams();
    Object.entries(config.data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });
    config.data = params;
  }

  return config;
});

// Interceptor for response parsing
apiClient.interceptors.response.use(
  (response) => {
    // If backend returns plain text (e.g. "Done" or string JSON), parse it
    if (typeof response.data === 'string') {
      try {
        response.data = JSON.parse(response.data.trim());
      } catch {
        // Keep string response (e.g. validateToken might return "success")
      }
    }
    return response;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default apiClient;
