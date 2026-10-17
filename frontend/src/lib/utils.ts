import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Currency Formatting ──────────────────────────────────────────────────────
export function formatCurrency(amount: number, currency = 'KES'): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

// ─── Date Formatting ──────────────────────────────────────────────────────────
export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy');
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy HH:mm:ss');
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

// ─── Status Colors ────────────────────────────────────────────────────────────
export const statusColors: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PENDING_CHECKER: 'bg-yellow-100 text-yellow-800',
  CHECKER_APPROVED: 'bg-cyan-100 text-cyan-800',
  CHECKER_REJECTED: 'bg-red-100 text-red-800',
  PENDING_DIRECTOR: 'bg-orange-100 text-orange-800',
  DIRECTOR_APPROVED: 'bg-teal-100 text-teal-800',
  DIRECTOR_REJECTED: 'bg-red-100 text-red-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-700',
  REVERSED: 'bg-purple-100 text-purple-800',
  DRAFT: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
  SUSPENDED: 'bg-red-100 text-red-800',
  PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  DEACTIVATED: 'bg-gray-100 text-gray-600',
};

// ─── Rail Labels ──────────────────────────────────────────────────────────────
export const railLabels: Record<string, string> = {
  MPESA_B2C: 'M-Pesa B2C',
  MPESA_B2B_PAYBILL: 'M-Pesa Paybill',
  MPESA_B2B_TILL: 'M-Pesa Till',
  PESALINK: 'PesaLink',
  RTGS: 'RTGS',
  EQUITY_JENGA: 'Equity Jenga',
  KCB_OPEN_BANKING: 'KCB Open Banking',
};

export const railColors: Record<string, string> = {
  MPESA_B2C: 'bg-green-100 text-green-800',
  MPESA_B2B_PAYBILL: 'bg-emerald-100 text-emerald-800',
  MPESA_B2B_TILL: 'bg-teal-100 text-teal-800',
  PESALINK: 'bg-blue-100 text-blue-800',
  RTGS: 'bg-indigo-100 text-indigo-800',
  EQUITY_JENGA: 'bg-purple-100 text-purple-800',
  KCB_OPEN_BANKING: 'bg-violet-100 text-violet-800',
};

// ─── Role Labels ──────────────────────────────────────────────────────────────
export const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Org Admin',
  FINANCE_MANAGER: 'Finance Manager',
  MAKER: 'Maker',
  CHECKER: 'Checker',
  DIRECTOR: 'Director',
  VIEWER: 'Viewer',
};

export const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-800',
  ORG_ADMIN: 'bg-purple-100 text-purple-800',
  FINANCE_MANAGER: 'bg-blue-100 text-blue-800',
  MAKER: 'bg-yellow-100 text-yellow-800',
  CHECKER: 'bg-cyan-100 text-cyan-800',
  DIRECTOR: 'bg-orange-100 text-orange-800',
  VIEWER: 'bg-gray-100 text-gray-600',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.slice(0, length)}...` : str;
}

export function maskPhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/(\d{3})\d+(\d{3})/, '$1****$2');
}

export function extractApiError(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosErr = error as { response?: { data?: { error?: { message?: string }; message?: string } } };
    return axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || 'An error occurred';
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}
