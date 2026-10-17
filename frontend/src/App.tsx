import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/toaster';
import { useAuthStore } from './store/auth.store';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { AuthLayout } from './layouts/AuthLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import AcceptInvitationPage from './pages/auth/AcceptInvitationPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';

// Dashboard Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import PaymentsPage from './pages/payments/PaymentsPage';
import NewPaymentPage from './pages/payments/NewPaymentPage';
import PaymentDetailPage from './pages/payments/PaymentDetailPage';
import ApprovalsPage from './pages/approvals/ApprovalsPage';
import DirectorApprovalsPage from './pages/approvals/DirectorApprovalsPage';
import WalletsPage from './pages/wallets/WalletsPage';
import WalletLedgerPage from './pages/wallets/WalletLedgerPage';
import UsersPage from './pages/users/UsersPage';
import OrganizationPage from './pages/organizations/OrganizationPage';
import OrganizationsListPage from './pages/organizations/OrganizationsListPage';
import SettingsPage from './pages/settings/SettingsPage';
import ApiCredentialsPage from './pages/settings/ApiCredentialsPage';
import SystemActivationPage from './pages/settings/SystemActivationPage';
import BankAccountsPage from './pages/settings/BankAccountsPage';
import ReportsPage from './pages/reports/ReportsPage';
import ReconciliationPage from './pages/reports/ReconciliationPage';
import AuditPage from './pages/audit/AuditPage';
import ProfilePage from './pages/profile/ProfilePage';
import SuppliersPage from './pages/suppliers/SuppliersPage';
import SupplierDetailPage from './pages/suppliers/SupplierDetailPage';
import NotFoundPage from './pages/NotFoundPage';

// Stub for UserDetail — redirect to users
const UserDetailStub = () => <Navigate to="/users" replace />;

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
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
  );
}
