import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, UserPlus, Search, Filter, Download, MoreHorizontal,
  Shield, Ban, CheckCircle, Mail, Eye, RefreshCw, ChevronDown,
  X, AlertCircle, Loader2
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogFooter, ConfirmDialog } from '../../components/ui/dialog';
import { Select, Input, Textarea } from '../../components/ui/select';
import { DateRangePicker } from '../../components/ui/DatePicker';
import { useToast } from '../../components/ui/toaster';
import { formatDate, cn } from '../../lib/utils';

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ORG_ADMIN', label: 'Org Admin' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'MAKER', label: 'Maker' },
  { value: 'CHECKER', label: 'Checker' },
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'VIEWER', label: 'Viewer' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'PENDING', label: 'Pending' },
];

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Newest First' },
  { value: 'createdAt_asc', label: 'Oldest First' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'lastLogin_desc', label: 'Recently Active' },
];

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'destructive',
  ORG_ADMIN: 'default',
  FINANCE: 'warning',
  MAKER: 'secondary',
  CHECKER: 'secondary',
  DIRECTOR: 'success',
  VIEWER: 'outline',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  SUSPENDED: 'destructive',
  PENDING: 'warning',
};

interface UserFilters {
  search: string;
  role: string;
  status: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  sort: string;
  page: number;
  limit: number;
}

export default function UsersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filters, setFilters] = useState<UserFilters>({
    search: '', role: '', status: '', dateFrom: null, dateTo: null,
    sort: 'createdAt_desc', page: 1, limit: 20,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; userId: string; name: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Invite form state
  const [inviteForm, setInviteForm] = useState({ email: '', firstName: '', lastName: '', role: 'MAKER', message: '' });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  const updateFilter = (key: keyof UserFilters, value: any) =>
    setFilters(prev => ({ ...prev, [key]: value, page: key !== 'page' ? 1 : value }));

  const queryParams = new URLSearchParams();
  if (filters.search) queryParams.set('search', filters.search);
  if (filters.role) queryParams.set('role', filters.role);
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.dateFrom) queryParams.set('dateFrom', filters.dateFrom.toISOString());
  if (filters.dateTo) queryParams.set('dateTo', filters.dateTo.toISOString());
  const [sortField, sortDir] = filters.sort.split('_');
  queryParams.set('sortBy', sortField);
  queryParams.set('sortDir', sortDir);
  queryParams.set('page', String(filters.page));
  queryParams.set('limit', String(filters.limit));

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['users', filters],
    queryFn: () => api.get(`/users?${queryParams}`).then(r => r.data),
    keepPreviousData: true,
  });

  const users: any[] = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, pages: 1 };

  const inviteMutation = useMutation({
    mutationFn: (body: any) => api.post('/users/invite', body).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Invitation Sent', description: `An invite was emailed to ${inviteForm.email}` });
      qc.invalidateQueries(['users']);
      setInviteOpen(false);
      setInviteForm({ email: '', firstName: '', lastName: '', role: 'MAKER', message: '' });
    },
    onError: (e: any) => {
      toast({ type: 'error', title: 'Failed to Send Invite', description: e?.response?.data?.message ?? 'Please try again.' });
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => {
      if (action === 'suspend') return api.post(`/users/${id}/suspend`).then(r => r.data);
      if (action === 'activate') return api.post(`/users/${id}/activate`).then(r => r.data);
      if (action === 'delete') return api.delete(`/users/${id}`).then(r => r.data);
      return Promise.reject();
    },
    onSuccess: (_, { action }) => {
      toast({ type: 'success', title: `User ${action}d successfully` });
      qc.invalidateQueries(['users']);
      setConfirmAction(null);
    },
    onError: () => toast({ type: 'error', title: 'Action failed', description: 'Please try again.' }),
  });

  const handleInvite = () => {
    const errs: Record<string, string> = {};
    if (!inviteForm.email) errs.email = 'Email is required';
    if (!inviteForm.firstName) errs.firstName = 'First name is required';
    if (!inviteForm.lastName) errs.lastName = 'Last name is required';
    if (Object.keys(errs).length) { setInviteErrors(errs); return; }
    setInviteErrors({});
    inviteMutation.mutate(inviteForm);
  };

  const toggleAll = () => {
    if (selectedIds.length === users.length) setSelectedIds([]);
    else setSelectedIds(users.map(u => u.id));
  };

  const exportCSV = () => {
    const rows = [
      ['Name', 'Email', 'Role', 'Status', 'Last Login', 'Created'].join(','),
      ...users.map(u => [
        `"${u.firstName} ${u.lastName}"`, u.email, u.role, u.status,
        u.lastLogin ? formatDate(u.lastLogin) : 'Never', formatDate(u.createdAt),
      ].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'users.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = filters.search || filters.role || filters.status || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            User Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage team members, roles, and access permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4" /> Invite User
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: data?.stats?.total ?? '—', color: 'text-slate-700' },
          { label: 'Active', value: data?.stats?.active ?? '—', color: 'text-green-600' },
          { label: 'Suspended', value: data?.stats?.suspended ?? '—', color: 'text-red-600' },
          { label: 'Pending Invite', value: data?.stats?.pending ?? '—', color: 'text-yellow-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email..."
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {filters.search && (
              <button onClick={() => updateFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
          <Select
            value={filters.role}
            onChange={v => updateFilter('role', v)}
            options={ROLE_OPTIONS}
            className="w-40"
          />
          <Select
            value={filters.status}
            onChange={v => updateFilter('status', v)}
            options={STATUS_OPTIONS}
            className="w-36"
          />
          <Select
            value={filters.sort}
            onChange={v => updateFilter('sort', v)}
            options={SORT_OPTIONS}
            className="w-44"
          />
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter className="w-4 h-4" />
            {hasFilters && <span className="ml-1 bg-white text-indigo-700 rounded-full px-1.5 text-xs font-bold">!</span>}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries(['users'])}>
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </Button>
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[300px]">
                <DateRangePicker
                  startDate={filters.dateFrom}
                  endDate={filters.dateTo}
                  onChange={(s, e) => { updateFilter('dateFrom', s); updateFilter('dateTo', e); }}
                  label="Created Date Range"
                />
              </div>
              <Select
                label="Results Per Page"
                value={String(filters.limit)}
                onChange={v => updateFilter('limit', Number(v))}
                options={[10, 20, 50, 100].map(n => ({ value: String(n), label: `${n} per page` }))}
                className="w-40"
              />
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => setFilters({
                  search: '', role: '', status: '', dateFrom: null, dateTo: null,
                  sort: 'createdAt_desc', page: 1, limit: 20,
                })}>
                  <X className="w-4 h-4" /> Clear All
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Bulk actions */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              {selectedIds.length} selected
            </span>
            <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>Deselect All</Button>
            <Button size="sm" variant="secondary">Bulk Suspend</Button>
            <Button size="sm" variant="secondary">Bulk Activate</Button>
            <Button size="sm" variant="destructive">Bulk Delete</Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === users.length && users.length > 0}
                    onChange={toggleAll}
                    className="rounded border-slate-300"
                  />
                </th>
                {['User', 'Role', 'Status', '2FA', 'Last Login', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {isLoading ? (
                <tr><td colSpan={8} className="py-16 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center">
                  <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No users found</p>
                  <p className="text-slate-400 text-xs mt-1">Try adjusting your filters or invite a new user</p>
                </td></tr>
              ) : users.map(user => (
                <tr key={user.id} className={cn(
                  'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group',
                  selectedIds.includes(user.id) && 'bg-indigo-50/50 dark:bg-indigo-900/10'
                )}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(user.id)}
                      onChange={() => setSelectedIds(prev =>
                        prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]
                      )}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={(roleColors[user.role] as any) ?? 'secondary'}>
                      {user.role?.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={(statusColors[user.status] as any) ?? 'secondary'}>
                      {user.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {user.twoFactorEnabled ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Enabled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-400 text-xs">
                        <AlertCircle className="w-3.5 h-3.5" /> Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {user.lastLogin ? formatDate(user.lastLogin) : (
                      <span className="text-slate-300">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" onClick={() => setSelectedUser(user)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {user.status === 'ACTIVE' ? (
                        <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ type: 'suspend', userId: user.id, name: `${user.firstName} ${user.lastName}` })}>
                          <Ban className="w-4 h-4 text-red-500" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ type: 'activate', userId: user.id, name: `${user.firstName} ${user.lastName}` })}>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost">
                        <Mail className="w-4 h-4 text-blue-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500">
              Showing {((filters.page - 1) * filters.limit) + 1}–{Math.min(filters.page * filters.limit, pagination.total)} of {pagination.total} users
            </p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => updateFilter('page', filters.page - 1)}>
                Previous
              </Button>
              {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map(p => (
                <Button
                  key={p} size="sm"
                  variant={p === filters.page ? 'default' : 'ghost'}
                  onClick={() => updateFilter('page', p)}
                >
                  {p}
                </Button>
              ))}
              <Button size="sm" variant="outline" disabled={filters.page >= pagination.pages} onClick={() => updateFilter('page', filters.page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite New User" description="Send an email invitation to join your organization" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name *"
              placeholder="John"
              value={inviteForm.firstName}
              onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))}
              error={inviteErrors.firstName}
            />
            <Input
              label="Last Name *"
              placeholder="Doe"
              value={inviteForm.lastName}
              onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))}
              error={inviteErrors.lastName}
            />
          </div>
          <Input
            label="Email Address *"
            type="email"
            placeholder="john.doe@company.co.ke"
            value={inviteForm.email}
            onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
            error={inviteErrors.email}
          />
          <Select
            label="Assign Role *"
            value={inviteForm.role}
            onChange={v => setInviteForm(f => ({ ...f, role: v }))}
            options={ROLE_OPTIONS.slice(1).map(r => ({
              value: r.value,
              label: r.label,
              description: {
                ORG_ADMIN: 'Full organization admin access',
                FINANCE: 'View finances and reports',
                MAKER: 'Create payment requests',
                CHECKER: 'Approve maker requests',
                DIRECTOR: 'Final authorization for disbursements',
                VIEWER: 'Read-only access',
              }[r.value] ?? '',
            }))}
          />
          <Textarea
            label="Personal Message (optional)"
            placeholder="Hi John, I'm inviting you to our payment platform..."
            value={inviteForm.message}
            onChange={e => setInviteForm(f => ({ ...f, message: e.target.value }))}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button onClick={handleInvite} loading={inviteMutation.isLoading}>
            <Mail className="w-4 h-4" /> Send Invitation
          </Button>
        </DialogFooter>
      </Dialog>

      {/* User Detail Modal */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onClose={() => setSelectedUser(null)} title="User Details" size="lg">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedUser.firstName} {selectedUser.lastName}</h3>
                <p className="text-sm text-slate-500">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={(roleColors[selectedUser.role] as any) ?? 'secondary'}>{selectedUser.role?.replace('_', ' ')}</Badge>
                  <Badge variant={(statusColors[selectedUser.status] as any) ?? 'secondary'}>{selectedUser.status}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Phone', value: selectedUser.phone ?? '—' },
                { label: 'National ID', value: selectedUser.nationalId ?? '—' },
                { label: '2FA', value: selectedUser.twoFactorEnabled ? 'Enabled' : 'Disabled' },
                { label: 'Email Verified', value: selectedUser.emailVerified ? 'Yes' : 'No' },
                { label: 'Last Login', value: selectedUser.lastLogin ? formatDate(selectedUser.lastLogin) : 'Never' },
                { label: 'Member Since', value: formatDate(selectedUser.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>Close</Button>
            {selectedUser.status === 'ACTIVE' ? (
              <Button variant="destructive" onClick={() => { setSelectedUser(null); setConfirmAction({ type: 'suspend', userId: selectedUser.id, name: `${selectedUser.firstName} ${selectedUser.lastName}` }); }}>
                <Ban className="w-4 h-4" /> Suspend User
              </Button>
            ) : (
              <Button onClick={() => { setSelectedUser(null); setConfirmAction({ type: 'activate', userId: selectedUser.id, name: `${selectedUser.firstName} ${selectedUser.lastName}` }); }}>
                <CheckCircle className="w-4 h-4" /> Activate User
              </Button>
            )}
          </DialogFooter>
        </Dialog>
      )}

      {/* Confirm action */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && actionMutation.mutate({ id: confirmAction.userId, action: confirmAction.type })}
        title={confirmAction?.type === 'suspend' ? 'Suspend User' : confirmAction?.type === 'activate' ? 'Activate User' : 'Delete User'}
        description={`Are you sure you want to ${confirmAction?.type} ${confirmAction?.name}? This action will take effect immediately.`}
        confirmLabel={confirmAction?.type === 'suspend' ? 'Suspend' : confirmAction?.type === 'activate' ? 'Activate' : 'Delete'}
        variant={confirmAction?.type === 'activate' ? 'default' : 'destructive'}
        loading={actionMutation.isLoading}
      />
    </div>
  );
}
