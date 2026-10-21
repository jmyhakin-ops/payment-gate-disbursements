import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor — attach token ───────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor — auto-refresh on 401 ───────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken: newAccess, refreshToken: newRefresh } = data.data;
        useAuthStore.getState().setTokens(newAccess, newRefresh);
        processQueue(null, newAccess);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Typed API helpers ────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: object) => api.post('/auth/register', data),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) => api.put('/auth/change-password', { currentPassword, newPassword }),
  setup2fa: () => api.post('/auth/2fa/setup'),
  enable2fa: (token: string) => api.post('/auth/2fa/enable', { token }),
  verify2fa: (userId: string, token: string) => api.post('/auth/2fa/verify', { userId, token }),
};

export const usersApi = {
  list: (params?: object) => api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  invite: (data: object) => api.post('/users/invite', data),
  acceptInvitation: (data: object) => api.post('/users/accept-invitation', data),
  update: (id: string, data: object) => api.put(`/users/${id}`, data),
  suspend: (id: string) => api.put(`/users/${id}/suspend`),
  activate: (id: string) => api.put(`/users/${id}/activate`),
  delete: (id: string) => api.delete(`/users/${id}`),
  notifications: (params?: object) => api.get('/users/me/notifications', { params }),
  markAllRead: () => api.put('/users/me/notifications/read-all'),
};

export const orgsApi = {
  list: (params?: object) => api.get('/organizations', { params }),
  me: () => api.get('/organizations/me'),
  create: (data: object) => api.post('/organizations', data),
  update: (data: object) => api.put('/organizations/me', data),
  approve: (id: string) => api.put(`/organizations/${id}/approve`),
  suspend: (id: string, reason: string) => api.put(`/organizations/${id}/suspend`, { reason }),
  activate: (activationCode: string) => api.post('/organizations/me/activate', { activationCode }),
  addDirector: (data: object) => api.post('/organizations/me/directors', data),
  removeDirector: (id: string) => api.delete(`/organizations/me/directors/${id}`),
};

export const settingsApi = {
  list: () => api.get('/settings'),
  update: (data: object) => api.put('/settings', data),
  listCredentials: () => api.get('/settings/api-credentials'),
  saveCredential: (data: object) => api.post('/settings/api-credentials', data),
  activateCredential: (id: string) => api.put(`/settings/api-credentials/${id}/activate`),
  testCredential: (id: string) => api.post(`/settings/api-credentials/${id}/test`),
  deleteCredential: (id: string) => api.delete(`/settings/api-credentials/${id}`),
  listBankAccounts: () => api.get('/settings/bank-accounts'),
  addBankAccount: (data: object) => api.post('/settings/bank-accounts', data),
  removeBankAccount: (id: string) => api.delete(`/settings/bank-accounts/${id}`),
};

export const paymentsApi = {
  initiate: (data: object) => api.post('/payments', data),
  list: (params?: object) => api.get('/payments', { params }),
  get: (id: string) => api.get(`/payments/${id}`),
  checkerAction: (id: string, data: object) => api.post(`/payments/${id}/checker-action`, data),
  directorAction: (id: string, data: object) => api.post(`/payments/${id}/director-action`, data),
  cancel: (id: string, reason: string) => api.post(`/payments/${id}/cancel`, { reason }),
  pendingApprovals: () => api.get('/payments/pending-approvals'),
  directorApprovals: () => api.get('/payments/director-approvals'),
  dashboard: () => api.get('/payments?action=dashboard'),
};

export const walletsApi = {
  list: () => api.get('/wallets'),
  summary: () => api.get('/wallets?action=summary'),
  create: (data: object) => api.post('/wallets', data),
  get: (id: string) => api.get(`/wallets/${id}`),
  ledger: (id: string, params?: object) => api.get(`/wallets/${id}/ledger`, { params }),
};

export const auditApi = {
  list: (params?: object) => api.get('/audit', { params }),
};

export const reportsApi = {
  summary: (params?: object) => api.get('/reports/summary', { params }),
  reconciliations: (params?: object) => api.get('/reports/reconciliation', { params }),
  runReconciliation: (data: object) => api.post('/reports/reconciliation/run', data),
};
