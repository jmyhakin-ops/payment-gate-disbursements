import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  twoFactorEnabled: boolean;
  organization?: { id: string; name: string; status: string };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;
  setUser: (user: User) => void;
  setTokens: (access: string, refresh: string) => Promise<void>;
  logout: () => Promise<void>;
  setBiometric: (enabled: boolean) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  biometricEnabled: false,

  setUser: (user) => set({ user, isAuthenticated: true }),

  setTokens: async (access, refresh) => {
    await SecureStore.setItemAsync('access_token', access);
    await SecureStore.setItemAsync('refresh_token', refresh);
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  setBiometric: async (enabled) => {
    await SecureStore.setItemAsync('biometric_enabled', enabled ? 'true' : 'false');
    set({ biometricEnabled: enabled });
  },

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const biometric = await SecureStore.getItemAsync('biometric_enabled');
      set({
        isAuthenticated: !!token,
        biometricEnabled: biometric === 'true',
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
