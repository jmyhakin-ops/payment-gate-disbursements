'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/toaster';
import { useAuthStore } from './store/auth.store';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { AuthLayout } from './layouts/AuthLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

// Auth Pages
import LoginPage from './views/auth/LoginPage';
import RegisterPage from './views/auth/RegisterPage';
import ForgotPasswordPage from './views/auth/ForgotPasswordPage';
import ResetPasswordPage from './views/auth/ResetPasswordPage';
import AcceptInvitationPage from './views/auth/AcceptInvitationPage';
import VerifyEmailPage from './views/auth/VerifyEmailPage';

// Dashboard Pages
import DashboardPage from './views/dashboard/DashboardPage';
import PaymentsPage from './views/payments/PaymentsPage';
import NewPaymentPage from './views/payments/NewPaymentPage';
import PaymentDetailPage from './views/payments/PaymentDetailPage';
import ApprovalsPage from './views/approvals/ApprovalsPage';
import DirectorApprovalsPage from './views/approvals/DirectorApprovalsPage';
import WalletsPage from './views/wallets/WalletsPage';
import WalletLedgerPage from './views/wallets/WalletLedgerPage';
import UsersPage from './views/users/UsersPage';
import OrganizationPage from './views/organizations/OrganizationPage';
import OrganizationsListPage from './views/organizations/OrganizationsListPage';
import SettingsPage from './views/settings/SettingsPage';
import ApiCredentialsPage from './views/settings/ApiCredentialsPage';
import SystemActivationPage from './views/settings/SystemActivationPage';
import BankAccountsPage from './views/settings/BankAccountsPage';
import ReportsPage from './views/reports/ReportsPage';
import ReconciliationPage from './views/reports/ReconciliationPage';
import AuditPage from './views/audit/AuditPage';
import ProfilePage from './views/profile/ProfilePage';
import SuppliersPage from './views/suppliers/SuppliersPage';
import SupplierDetailPage from './views/suppliers/SupplierDetailPage';
import NotFoundPage from './views/NotFoundPage';

// Stub for UserDetail — redirect to users
const UserDetailStub = () => <Navigate to="/users" replace />;

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
        <Routes>
          {/* ─── Auth Routes ─── */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
          </Route>

          {/* ─── Protected Dashboard Routes ─── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Payments */}
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/payments/new" element={<NewPaymentPage />} />
              <Route path="/payments/:id" element={<PaymentDetailPage />} />

              {/* Approvals */}
              <Route path="/approvals" element={<ApprovalsPage />} />
              <Route path="/directors/approvals" element={<DirectorApprovalsPage />} />

              {/* Wallets */}
              <Route path="/wallets" element={<WalletsPage />} />
              <Route path="/wallets/:id/ledger" element={<WalletLedgerPage />} />

              {/* Users */}
              <Route path="/users" element={<UsersPage />} />
              <Route path="/users/:id" element={<UserDetailStub />} />

              {/* Suppliers / Beneficiaries */}
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/suppliers/:id" element={<SupplierDetailPage />} />

              {/* Organizations */}
              <Route path="/organizations" element={<OrganizationsListPage />} />
              <Route path="/organization" element={<OrganizationPage />} />
              <Route path="/organization/directors" element={<OrganizationPage />} />

              {/* Settings */}
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/api-credentials" element={<ApiCredentialsPage />} />
              <Route path="/settings/activation" element={<SystemActivationPage />} />
              <Route path="/settings/bank-accounts" element={<BankAccountsPage />} />

              {/* Reports */}
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/reconciliation" element={<ReconciliationPage />} />

              {/* Audit */}
              <Route path="/audit" element={<AuditPage />} />

              {/* Profile */}
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
