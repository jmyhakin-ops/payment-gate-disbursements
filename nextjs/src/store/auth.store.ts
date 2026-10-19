import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'FINANCE_MANAGER' | 'MAKER' | 'CHECKER' | 'DIRECTOR' | 'VIEWER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: string | null;
  twoFactorEnabled: boolean;
  avatarUrl?: string;
  organization?: {
    id: string;
    name: string;
    status: string;
    logoUrl?: string;
    allowedRails: string[];
  };
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  setAuth: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  canApprove: () => boolean;
  isDirector: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setAuth: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user, isAuthenticated: true }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setUser: (user) => set({ user }),

      logout: () => {
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
        localStorage.removeItem('kenyapay-auth');
        window.location.href = '/login';
      },

      hasRole: (...roles) => {
        const { user } = get();
        return !!user && roles.includes(user.role);
      },

      canApprove: () => {
        const { user } = get();
        return !!user && ['CHECKER', 'FINANCE_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(user.role);
      },

      isDirector: () => {
        const { user } = get();
        return !!user && ['DIRECTOR', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(user.role);
      },
    }),
    {
      name: 'kenyapay-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
