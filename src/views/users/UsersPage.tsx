'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, UserPlus, Search, Shield, Ban, CheckCircle,
  Mail, Eye, RefreshCw, X, AlertCircle, Loader2,
  ChevronLeft, ChevronRight, Download, Filter,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../components/ui/toaster';
import { cn } from '../../lib/utils';

// ─── Role definitions with descriptions ──────────────────────────────────────
const ROLES = [
  {
    value: 'SUPER_ADMIN',
    label: 'Super Admin',
    description: 'Full platform control — all organizations',
    color: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
  {
    value: 'ORG_ADMIN',
    label: 'Org Admin',
    description: 'Full control within their organization',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
  },
  {
    value: 'FINANCE_MANAGER',
    label: 'Finance Manager',
    description: 'View finances, reports, manage wallets',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  {
    value: 'DIRECTOR',
    label: 'Director',
    description: 'Final authorization — approves payments for disbursement',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  {
    value: 'CHECKER',
    label: 'Checker',
    description: 'Validates & forwards maker payments to Director',
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    dot: 'bg-cyan-500',
  },
  {
    value: 'MAKER',
    label: 'Maker',
    description: 'Creates payment requests — needs approval to disburse',
    color: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500',
  },
  {
    value: 'VIEWER',
    label: 'Viewer',
    description: 'Read-only access — can view reports and payments',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: 'bg-gray-400',
  },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 border-green-200',
  INACTIVE: 'bg-gray-100 text-gray-500 border-gray-200',
  SUSPENDED: 'bg-red-100 text-red-700 border-red-200',
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

function RoleBadge({ role }: { role: string }) {
  const def = ROLES.find((r) => r.value === role);
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', def?.color ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
      <span className={cn('w-1.5 h-1.5 rounded-full', def?.dot ?? 'bg-gray-400')} />
      {def?.label ?? role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border', STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
      {status}
    </span>
  );
}

function Avatar({ firstName, lastName, size = 'md' }: { firstName: string; lastName: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-2xl' };
  return (
    <div className={cn('rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0', sizes[size])}>
      {firstName?.[0]}{lastName?.[0]}
    </div>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'MAKER', department: '', jobTitle: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => api.post('/users?action=invite', { email: form.email, role: form.role, department: form.department, jobTitle: form.jobTitle }),
    onSuccess: () => {
      toast({ type: 'success', title: 'Invitation Sent!', description: `Invite emailed to ${form.email}` });
      onSuccess();
      onClose();
      setForm({ email: '', firstName: '', lastName: '', role: 'MAKER', department: '', jobTitle: '' });
    },
    onError: (e: any) => toast({ type: 'error', title: 'Failed to Invite', description: e?.response?.data?.message ?? 'Please try again.' }),
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.email) errs.email = 'Email is required';
    if (!form.email.includes('@')) errs.email = 'Enter a valid email';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  if (!open) return null;
  const selectedRole = ROLES.find((r) => r.value === form.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Invite New User</h2>
              <p className="text-sm text-gray-500">Send an email invitation to join your organization</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="john.doe@company.co.ke"
              className={cn('w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', errors.email ? 'border-red-400' : 'border-gray-200')}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Department</label>
              <input
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="Finance, Operations..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Job Title</label>
              <input
                value={form.jobTitle}
                onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                placeholder="e.g. Finance Officer"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Assign Role *</label>
            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
              {ROLES.filter((r) => !['SUPER_ADMIN'].includes(r.value)).map((role) => (
                <button
                  key={role.value}
                  onClick={() => setForm((f) => ({ ...f, role: role.value }))}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                    form.role === role.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <span className={cn('w-3 h-3 rounded-full flex-shrink-0', role.dot)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{role.label}</p>
                    <p className="text-xs text-gray-500 truncate">{role.description}</p>
                  </div>
                  {form.role === role.value && <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Selected role description */}
          {selectedRole && (
            <div className={cn('flex items-center gap-2 p-3 rounded-xl border text-sm', selectedRole.color)}>
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span><strong>{selectedRole.label}:</strong> {selectedRole.description}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => validate() && mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Send Invitation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Role Modal ──────────────────────────────────────────────────────────
function EditRoleModal({ user, onClose, onSuccess }: { user: any; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [role, setRole] = useState(user.role);

  const mutation = useMutation({
    mutationFn: () => api.put(`/users?userId=${user.id}`, { role }),
    onSuccess: () => {
      toast({ type: 'success', title: 'Role Updated', description: `${user.firstName}'s role changed to ${role}` });
      onSuccess();
      onClose();
    },
    onError: (e: any) => toast({ type: 'error', title: 'Failed', description: e?.response?.data?.message ?? 'Please try again.' }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Change Role</h2>
            <p className="text-sm text-gray-500">{user.firstName} {user.lastName} · {user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-2 max-h-80 overflow-y-auto">
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRole(r.value)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                role === r.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-300'
              )}
            >
              <span className={cn('w-3 h-3 rounded-full flex-shrink-0', r.dot)} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{r.label}</p>
                <p className="text-xs text-gray-500">{r.description}</p>
              </div>
              {role === r.value && <CheckCircle className="w-4 h-4 text-indigo-600" />}
            </button>
          ))}
        </div>
        <div className="flex gap-3 p-6 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || role === user.role}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save Role
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Users Page ──────────────────────────────────────────────────────────
export default function UsersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [detailUser, setDetailUser] = useState<any>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['users', search, roleFilter, statusFilter, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) p.set('search', search);
      if (roleFilter) p.set('role', roleFilter);
      if (statusFilter) p.set('status', statusFilter);
      return api.get(`/users?${p}`).then((r) => r.data);
    },
    keepPreviousData: true,
  } as any);

  const users: any[] = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, pages: 1 };

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.put(`/users?userId=${id}&action=${action}`),
    onSuccess: (_, { action }) => {
      toast({ type: 'success', title: `User ${action}d` });
      qc.invalidateQueries({ queryKey: ['users'] });
      setDetailUser(null);
    },
    onError: () => toast({ type: 'error', title: 'Action failed' }),
  });

  const exportCSV = () => {
    const rows = [
      ['Name', 'Email', 'Role', 'Status', 'Department', 'Last Login', 'Created'].join(','),
      ...users.map((u) => [
        `"${u.firstName} ${u.lastName}"`, u.email, u.role, u.status,
        u.department ?? '', u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never',
        new Date(u.createdAt).toLocaleDateString(),
      ].join(',')),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' }));
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            User Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage team members, roles and access levels. Invite users — they set their own password.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setInviteOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm">
            <UserPlus className="w-4 h-4" /> Invite User
          </button>
        </div>
      </div>

      {/* Role legend cards */}
      <div className="grid grid-cols-7 gap-2">
        {ROLES.map((role) => (
          <button
            key={role.value}
            onClick={() => setRoleFilter(roleFilter === role.value ? '' : role.value)}
            className={cn(
              'p-3 rounded-xl border-2 text-center transition-all hover:shadow-sm',
              roleFilter === role.value
                ? 'border-indigo-500 bg-indigo-50 shadow-md'
                : 'border-gray-100 bg-white hover:border-gray-300'
            )}
          >
            <span className={cn('w-2.5 h-2.5 rounded-full mx-auto block mb-1', role.dot)} />
            <p className="text-xs font-semibold text-gray-700 leading-tight">{role.label}</p>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: meta.total ?? 0, icon: Users, color: 'text-slate-700', bg: 'bg-slate-100' },
          { label: 'Active', value: users.filter((u) => u.status === 'ACTIVE').length, icon: CheckCircle, color: 'text-green-700', bg: 'bg-green-100' },
          { label: 'Suspended', value: users.filter((u) => u.status === 'SUSPENDED').length, icon: Ban, color: 'text-red-700', bg: 'bg-red-100' },
          { label: 'Pending Invite', value: users.filter((u) => u.status === 'PENDING').length, icon: Mail, color: 'text-yellow-700', bg: 'bg-yellow-100' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', stat.bg)}>
              <stat.icon className={cn('w-5 h-5', stat.color)} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{stat.label}</p>
              <p className={cn('text-2xl font-bold mt-0.5', stat.color)}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="PENDING">Pending</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['users'] })} className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50">
          <RefreshCw className={cn('w-4 h-4 text-slate-500', isFetching && 'animate-spin')} />
        </button>
        {(search || roleFilter || statusFilter) && (
          <button onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setPage(1); }}
            className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['User', 'Role', 'Status', '2FA', 'Department', 'Last Login', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={7} className="py-20 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                  <p className="text-slate-400 text-sm">Loading users...</p>
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="py-20 text-center">
                  <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600 font-semibold">No users found</p>
                  <p className="text-slate-400 text-xs mt-1">Try adjusting your filters or invite a new user</p>
                </td></tr>
              ) : users.map((user) => (
                <tr key={user.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar firstName={user.firstName} lastName={user.lastName} />
                      <div>
                        <p className="font-semibold text-slate-900">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                        {user.jobTitle && <p className="text-xs text-slate-400">{user.jobTitle}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><RoleBadge role={user.role} /></td>
                  <td className="px-5 py-4"><StatusBadge status={user.status} /></td>
                  <td className="px-5 py-4">
                    {user.twoFactorEnabled
                      ? <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" />Enabled</span>
                      : <span className="flex items-center gap-1 text-slate-400 text-xs"><AlertCircle className="w-3.5 h-3.5" />Off</span>}
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs">{user.department ?? '—'}</td>
                  <td className="px-5 py-4 text-slate-500 text-xs">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : <span className="text-slate-300">Never</span>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setDetailUser(user)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="View details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditUser(user)} className="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-600" title="Change role">
                        <Shield className="w-4 h-4" />
                      </button>
                      {user.status === 'ACTIVE'
                        ? <button onClick={() => actionMutation.mutate({ id: user.id, action: 'suspend' })} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500" title="Suspend"><Ban className="w-4 h-4" /></button>
                        : <button onClick={() => actionMutation.mutate({ id: user.id, action: 'activate' })} className="p-1.5 rounded-lg hover:bg-green-100 text-green-600" title="Activate"><CheckCircle className="w-4 h-4" /></button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500">Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, meta.total)} of {meta.total} users</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-white">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(meta.pages, 7) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className={cn('w-8 h-8 rounded-lg text-sm font-medium', p === page ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-white')}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(meta.pages, p + 1))} disabled={page >= meta.pages} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-white">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ['users'] })} />
      {editUser && <EditRoleModal user={editUser} onClose={() => setEditUser(null)} onSuccess={() => qc.invalidateQueries({ queryKey: ['users'] })} />}

      {/* Detail sheet */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">User Details</h2>
              <button onClick={() => setDetailUser(null)} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex items-center gap-4">
              <Avatar firstName={detailUser.firstName} lastName={detailUser.lastName} size="lg" />
              <div>
                <h3 className="text-xl font-bold">{detailUser.firstName} {detailUser.lastName}</h3>
                <p className="text-sm text-gray-500">{detailUser.email}</p>
                <div className="flex gap-2 mt-2"><RoleBadge role={detailUser.role} /><StatusBadge status={detailUser.status} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Phone', value: detailUser.phone ?? '—' },
                { label: 'Department', value: detailUser.department ?? '—' },
                { label: 'Job Title', value: detailUser.jobTitle ?? '—' },
                { label: '2FA', value: detailUser.twoFactorEnabled ? '✅ Enabled' : '❌ Disabled' },
                { label: 'Email Verified', value: detailUser.emailVerified ? 'Yes' : 'No' },
                { label: 'Last Login', value: detailUser.lastLoginAt ? new Date(detailUser.lastLoginAt).toLocaleString('en-KE') : 'Never' },
                { label: 'Organization', value: detailUser.organization?.name ?? '—' },
                { label: 'Member Since', value: new Date(detailUser.createdAt).toLocaleDateString('en-KE') },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
                  <p className="font-semibold text-slate-800 text-sm mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDetailUser(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Close</button>
              <button onClick={() => { setDetailUser(null); setEditUser(detailUser); }} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold">Change Role</button>
              {detailUser.status === 'ACTIVE'
                ? <button onClick={() => actionMutation.mutate({ id: detailUser.id, action: 'suspend' })} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold">Suspend</button>
                : <button onClick={() => actionMutation.mutate({ id: detailUser.id, action: 'activate' })} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold">Activate</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
