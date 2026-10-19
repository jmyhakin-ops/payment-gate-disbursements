import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_BASE = Constants.expoConfig?.extra?.apiUrl ?? 'https://payment-gate-disbursements.vercel.app/api/v1';

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
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string, twoFactorToken?: string) =>
    apiClient.post('/auth/login', { email, password, twoFactorToken }),
  logout: () => apiClient.post('/auth/logout'),
  me: () => apiClient.get('/auth/me'),
};

// ─── Payments ────────────────────────────────────────────────────────────────
export const paymentsApi = {
  list: (params: Record<string, any>) => apiClient.get('/payments', { params }),
  get: (id: string) => apiClient.get(`/payments/${id}`),
  create: (body: any) => apiClient.post('/payments', body),
  initiate: (body: any) => apiClient.post('/payments', body),
  checkerAction: (id: string, action: 'approve' | 'reject', reason?: string) =>
    apiClient.post(`/payments/${id}/checker-action`, { action, reason }),
  directorAction: (
    id: string,
    action: 'approve' | 'reject',
    pin?: string,
    reason?: string,
    approvedAmount?: number
  ) => apiClient.post(`/payments/${id}/director-action`, { action, pin, reason, approvedAmount }),
  cancel: (id: string) => apiClient.post(`/payments/${id}/cancel`),
  pendingApprovals: () => apiClient.get('/payments', { params: { action: 'pending-approvals' } }),
  directorApprovals: () => apiClient.get('/payments', { params: { action: 'director-approvals' } }),
  dashboard: () => apiClient.get('/payments', { params: { action: 'dashboard' } }),
  pendingCounts: () =>
    apiClient
      .get('/payments', { params: { action: 'pending-approvals' } })
      .then((r) => ({
        checker: r.data.data?.checkerCount ?? r.data.data?.length ?? 0,
        director: 0,
      }))
      .catch(() => ({ checker: 0, director: 0 })),
};

// ─── Wallets ─────────────────────────────────────────────────────────────────
export const walletsApi = {
  list: () => apiClient.get('/wallets'),
  summary: () => apiClient.get('/wallets/summary'),
  ledger: (id: string, params: Record<string, any>) =>
    apiClient.get(`/wallets/${id}/ledger`, { params }),
};

// ─── Suppliers (POS reads from payment gateway DB) ────────────────────────────
export const suppliersApi = {
  /** List suppliers — reads live from the web app payment gateway */
  list: (params: Record<string, any> = {}) => apiClient.get('/suppliers', { params }),
  /** Get a single supplier with recent transactions */
  get: (id: string) => apiClient.get(`/suppliers/${id}`),
  /** Create a new supplier */
  create: (body: any) => apiClient.post('/suppliers', body),
  /** Update supplier */
  update: (id: string, body: any) => apiClient.patch(`/suppliers/${id}`, body),
};

// ─── Settings / Payment Gateway Config ───────────────────────────────────────
export const settingsApi = {
  /** Returns which payment rails are active (configured) in the web app gateway.
   *  Used by mobile POS to know which rails to show.
   *  GET /settings?section=configured-rails
   */
  configuredRails: () =>
    apiClient.get('/settings', { params: { section: 'configured-rails' } }),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  /** List all users — reads from web app (same Supabase DB) */
  list: (params?: Record<string, any>) => apiClient.get('/users', { params }),
  /** Suspend a user */
  suspend: (userId: string) => apiClient.put(`/users?userId=${userId}&action=suspend`),
  /** Activate a user */
  activate: (userId: string) => apiClient.put(`/users?userId=${userId}&action=activate`),
  /** Change a user's role */
  changeRole: (userId: string, role: string) => apiClient.put(`/users?userId=${userId}`, { role }),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (params?: Record<string, any>) => apiClient.get('/users/notifications', { params }),
  markAllRead: () => apiClient.post('/users/notifications/mark-all-read'),
};

// Default export for screens that use `import api from '../services/api'`
const api = {
  get: (url: string, config?: any) => apiClient.get(url, config),
  post: (url: string, data?: any, config?: any) => apiClient.post(url, data, config),
  patch: (url: string, data?: any, config?: any) => apiClient.patch(url, data, config),
  delete: (url: string, config?: any) => apiClient.delete(url, config),
};

export default api;
