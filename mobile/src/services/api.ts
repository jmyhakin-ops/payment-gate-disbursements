import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_BASE = Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach access token
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — auto-refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
        await SecureStore.setItemAsync('access_token', data.data.accessToken);
        await SecureStore.setItemAsync('refresh_token', data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return apiClient(original);
      } catch {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        // navigate to login — handled by auth store listener
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// Typed API helpers
export const authApi = {
  login: (email: string, password: string, twoFactorToken?: string) =>
    apiClient.post('/auth/login', { email, password, twoFactorToken }),
  logout: () => apiClient.post('/auth/logout'),
  me: () => apiClient.get('/auth/me'),
};

export const paymentsApi = {
  list: (params: Record<string, any>) => apiClient.get('/payments', { params }),
  get: (id: string) => apiClient.get(`/payments/${id}`),
  create: (body: any) => apiClient.post('/payments', body),
  checkerAction: (id: string, action: 'approve' | 'reject', reason?: string) =>
    apiClient.post(`/payments/${id}/checker-action`, { action, reason }),
  directorAction: (id: string, action: 'approve' | 'reject', pin?: string, reason?: string) =>
    apiClient.post(`/payments/${id}/director-action`, { action, pin, reason }),
  cancel: (id: string) => apiClient.post(`/payments/${id}/cancel`),
  pendingApprovals: () => apiClient.get('/payments/pending-approvals'),
  directorApprovals: () => apiClient.get('/payments/director-approvals'),
  dashboard: () => apiClient.get('/payments/dashboard'),
};

export const walletsApi = {
  list: () => apiClient.get('/wallets'),
  summary: () => apiClient.get('/wallets/summary'),
  ledger: (id: string, params: Record<string, any>) => apiClient.get(`/wallets/${id}/ledger`, { params }),
};

export const suppliersApi = {
  list: (params: Record<string, any>) => apiClient.get('/suppliers', { params }),
  get: (id: string) => apiClient.get(`/suppliers/${id}`),
};

export const notificationsApi = {
  list: (params?: Record<string, any>) => apiClient.get('/users/notifications', { params }),
  markAllRead: () => apiClient.post('/users/notifications/mark-all-read'),
};
