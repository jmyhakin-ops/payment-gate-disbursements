import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Search, Filter, CheckCircle, XCircle, Clock,
  Ban, Eye, RefreshCw, Loader2, ChevronDown, X, AlertTriangle,
  TrendingUp, Users, Globe
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogFooter, ConfirmDialog } from '../../components/ui/dialog';
import { Select, Textarea } from '../../components/ui/select';
import { DateRangePicker } from '../../components/ui/DatePicker';
import { useToast } from '../../components/ui/toaster';
import { formatDate, formatCurrency, cn } from '../../lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending Approval' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export default function OrganizationsListPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filters, setFilters] = useState({ search: '', status: '', dateFrom: null as Date | null, dateTo: null as Date | null, page: 1, limit: 20 });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; org: any } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const updateFilter = (key: string, value: any) => setFilters(prev => ({ ...prev, [key]: value, page: 1 }));

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['organizations', filters],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filters.search) p.set('search', filters.search);
      if (filters.status) p.set('status', filters.status);
      if (filters.dateFrom) p.set('dateFrom', filters.dateFrom.toISOString());
      if (filters.dateTo) p.set('dateTo', filters.dateTo.toISOString());
      p.set('page', String(filters.page)); p.set('limit', String(filters.limit));
      return api.get(`/organizations?${p}`).then(r => r.data);
    },
  });

  const orgs: any[] = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, pages: 1 };

  const actionMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: string; reason?: string }) => {
      if (action === 'approve') return api.post(`/organizations/${id}/approve`).then(r => r.data);
      if (action === 'suspend') return api.post(`/organizations/${id}/suspend`, { reason }).then(r => r.data);
      if (action === 'activate') return api.post(`/organizations/${id}/activate`).then(r => r.data);
      return Promise.reject();
    },
    onSuccess: (_, { action }) => {
      toast({ type: 'success', title: `Organization ${action}d successfully` });
      qc.invalidateQueries(['organizations']);
      setConfirmAction(null);
    },
    onError: () => toast({ type: 'error', title: 'Action failed' }),
  });

  const statusVariant: Record<string, any> = {
    ACTIVE: 'success', PENDING: 'warning', SUSPENDED: 'destructive', INACTIVE: 'secondary',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Globe className="w-7 h-7 text-indigo-600" />
            All Organizations
          </h1>
          <p className="text-sm text-slate-500 mt-1">System-wide organization management (Super Admin)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries(['organizations'])}>
          <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: data?.stats?.total ?? '—', color: 'text-slate-700' },
          { label: 'Active', value: data?.stats?.active ?? '—', color: 'text-green-600' },
          { label: 'Pending', value: data?.stats?.pending ?? '—', color: 'text-yellow-600' },
          { label: 'Suspended', value: data?.stats?.suspended ?? '—', color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, registration..."
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Select value={filters.status} onChange={v => updateFilter('status', v)} options={STATUS_OPTIONS} className="w-44" />
          <Button variant={showFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(v => !v)}>
            <Filter className="w-4 h-4" /> Date Filter
          </Button>
        </div>
        {showFilters && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <DateRangePicker
              startDate={filters.dateFrom}
              endDate={filters.dateTo}
              onChange={(s, e) => { updateFilter('dateFrom', s); updateFilter('dateTo', e); }}
              label="Registration Date Range"
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
            <tr>
              {['Organization', 'Registration', 'Contact', 'Status', 'Plan', 'Users', 'Registered', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {isLoading ? (
              <tr><td colSpan={8} className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></td></tr>
            ) : orgs.length === 0 ? (
              <tr><td colSpan={8} className="py-16 text-center">
                <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">No organizations found</p>
              </td></tr>
            ) : orgs.map((org: any) => (
              <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {org.name?.[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{org.name}</p>
                      <p className="text-xs text-slate-400">{org.legalName ?? '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                  <p>BRS: {org.registrationNumber ?? '—'}</p>
                  <p>PIN: {org.taxPin ?? '—'}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                  <p>{org.email ?? '—'}</p>
                  <p>{org.phone ?? '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant[org.status] ?? 'secondary'}>{org.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{org.plan ?? 'STANDARD'}</Badge>
                </td>
                <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">{org._count?.users ?? 0}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDate(org.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" onClick={() => setSelectedOrg(org)}><Eye className="w-4 h-4" /></Button>
                    {org.status === 'PENDING' && (
                      <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ type: 'approve', org })}>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </Button>
                    )}
                    {org.status === 'ACTIVE' && (
                      <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ type: 'suspend', org })}>
                        <Ban className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                    {org.status === 'SUSPENDED' && (
                      <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ type: 'activate', org })}>
                        <CheckCircle className="w-4 h-4 text-blue-500" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500">{pagination.total} organizations total</p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>Previous</Button>
              <Button size="sm" variant="outline" disabled={filters.page >= pagination.pages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Org Detail Modal */}
      {selectedOrg && (
        <Dialog open={!!selectedOrg} onClose={() => setSelectedOrg(null)} title="Organization Details" size="lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Name', value: selectedOrg.name },
                { label: 'Legal Name', value: selectedOrg.legalName ?? '—' },
                { label: 'Registration No.', value: selectedOrg.registrationNumber ?? '—' },
                { label: 'KRA PIN', value: selectedOrg.taxPin ?? '—' },
                { label: 'Email', value: selectedOrg.email ?? '—' },
                { label: 'Phone', value: selectedOrg.phone ?? '—' },
                { label: 'Address', value: selectedOrg.physicalAddress ?? '—' },
                { label: 'County', value: selectedOrg.county ?? '—' },
                { label: 'Status', value: selectedOrg.status },
                { label: 'Plan', value: selectedOrg.plan ?? 'STANDARD' },
                { label: 'Users', value: selectedOrg._count?.users ?? 0 },
                { label: 'Created', value: formatDate(selectedOrg.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrg(null)}>Close</Button>
            {selectedOrg.status === 'PENDING' && (
              <Button onClick={() => { setSelectedOrg(null); setConfirmAction({ type: 'approve', org: selectedOrg }); }}>
                <CheckCircle className="w-4 h-4" /> Approve
              </Button>
            )}
            {selectedOrg.status === 'ACTIVE' && (
              <Button variant="destructive" onClick={() => { setSelectedOrg(null); setConfirmAction({ type: 'suspend', org: selectedOrg }); }}>
                <Ban className="w-4 h-4" /> Suspend
              </Button>
            )}
          </DialogFooter>
        </Dialog>
      )}

      {/* Confirm Action */}
      {confirmAction && (
        <Dialog
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          title={`${confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)} Organization`}
          size="sm"
        >
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {confirmAction.type === 'approve'
              ? `Approve "${confirmAction.org.name}"? They will receive an activation code via email.`
              : confirmAction.type === 'suspend'
              ? `Suspend "${confirmAction.org.name}"? All their users will lose access immediately.`
              : `Reactivate "${confirmAction.org.name}"?`
            }
          </p>
          {confirmAction.type === 'suspend' && (
            <Textarea
              label="Reason for suspension *"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Provide a reason..."
              rows={3}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction.type === 'approve' ? 'default' : confirmAction.type === 'suspend' ? 'destructive' : 'default'}
              loading={actionMutation.isLoading}
              onClick={() => actionMutation.mutate({ id: confirmAction.org.id, action: confirmAction.type, reason: rejectReason })}
            >
              Confirm {confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
