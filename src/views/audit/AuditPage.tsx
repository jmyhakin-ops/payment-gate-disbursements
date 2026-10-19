import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText, Search, Filter, Download, RefreshCw, Loader2,
  X, User, Calendar, Activity, Shield
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, Input } from '../../components/ui/select';
import { DateRangePicker } from '../../components/ui/DatePicker';
import { formatDate, cn } from '../../lib/utils';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'PAYMENT_CREATED', label: 'Payment Created' },
  { value: 'PAYMENT_APPROVED', label: 'Payment Approved' },
  { value: 'PAYMENT_REJECTED', label: 'Payment Rejected' },
  { value: 'PAYMENT_COMPLETED', label: 'Payment Completed' },
  { value: 'DIRECTOR_APPROVED', label: 'Director Approved' },
  { value: 'DIRECTOR_REJECTED', label: 'Director Rejected' },
  { value: 'USER_CREATED', label: 'User Created' },
  { value: 'USER_SUSPENDED', label: 'User Suspended' },
  { value: 'CREDENTIALS_SAVED', label: 'Credentials Saved' },
  { value: 'SETTINGS_CHANGED', label: 'Settings Changed' },
  { value: 'ORG_ACTIVATED', label: 'Org Activated' },
];

const SEVERITY_OPTIONS = [
  { value: '', label: 'All Severities' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'ERROR', label: 'Error' },
  { value: 'CRITICAL', label: 'Critical' },
];

const severityColor: Record<string, any> = {
  INFO: 'secondary', WARNING: 'warning', ERROR: 'destructive', CRITICAL: 'destructive',
};

const severityDot: Record<string, string> = {
  INFO: 'bg-blue-400', WARNING: 'bg-yellow-400', ERROR: 'bg-red-500', CRITICAL: 'bg-red-700',
};

export default function AuditPage() {
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    severity: '',
    userId: '',
    dateFrom: null as Date | null,
    dateTo: null as Date | null,
    sort: 'createdAt_desc',
    page: 1,
    limit: 50,
  });
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = (key: string, value: any) => setFilters(prev => ({ ...prev, [key]: value, page: 1 }));

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['audit', filters],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filters.search) p.set('search', filters.search);
      if (filters.action) p.set('action', filters.action);
      if (filters.severity) p.set('severity', filters.severity);
      if (filters.userId) p.set('userId', filters.userId);
      if (filters.dateFrom) p.set('dateFrom', filters.dateFrom.toISOString());
      if (filters.dateTo) p.set('dateTo', filters.dateTo.toISOString());
      p.set('page', String(filters.page));
      p.set('limit', String(filters.limit));
      return api.get(`/audit?${p}`).then(r => r.data);
    },
    keepPreviousData: true,
  });

  const logs: any[] = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, pages: 1 };

  const exportCSV = () => {
    const rows = [
      ['Timestamp', 'Action', 'User', 'IP', 'Severity', 'Description', 'Resource'].join(','),
      ...logs.map(l => [
        formatDate(l.createdAt),
        l.action,
        `"${l.user?.firstName ?? ''} ${l.user?.lastName ?? ''}".trim()`,
        l.ipAddress ?? '',
        l.severity ?? 'INFO',
        `"${l.description ?? ''}"`,
        `"${l.resourceType ?? ''} ${l.resourceId ?? ''}"`,
      ].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  const hasFilters = filters.search || filters.action || filters.severity || filters.userId || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-7 h-7 text-indigo-600" />
            Audit Trail
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete, tamper-evident log of all system actions and events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4" /> Export CSV</Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} /></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: data?.stats?.total ?? '—', color: 'text-slate-700' },
          { label: 'Today', value: data?.stats?.today ?? '—', color: 'text-indigo-600' },
          { label: 'Warnings', value: data?.stats?.warnings ?? '—', color: 'text-yellow-600' },
          { label: 'Errors', value: data?.stats?.errors ?? '—', color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by action, user, IP, description..."
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {filters.search && <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => updateFilter('search', '')}><X className="w-3.5 h-3.5 text-slate-400" /></button>}
          </div>
          <Select value={filters.action} onChange={v => updateFilter('action', v)} options={ACTION_OPTIONS} className="w-48" />
          <Select value={filters.severity} onChange={v => updateFilter('severity', v)} options={SEVERITY_OPTIONS} className="w-36" />
          <Button variant={showFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(v => !v)}>
            <Filter className="w-4 h-4" />
            {hasFilters && <span className="ml-1 w-2 h-2 rounded-full bg-red-500 inline-block" />}
          </Button>
          <Select
            value={String(filters.limit)}
            onChange={v => updateFilter('limit', Number(v))}
            options={[25, 50, 100, 250].map(n => ({ value: String(n), label: `${n} per page` }))}
            className="w-36"
          />
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <DateRangePicker
                startDate={filters.dateFrom}
                endDate={filters.dateTo}
                onChange={(s, e) => { updateFilter('dateFrom', s); updateFilter('dateTo', e); }}
                label="Date & Time Range"
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => setFilters({
                search: '', action: '', severity: '', userId: '',
                dateFrom: null, dateTo: null, sort: 'createdAt_desc', page: 1, limit: 50,
              })}>
                <X className="w-4 h-4" /> Clear All Filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Severity', 'Timestamp', 'Action', 'User', 'IP Address', 'Description', 'Resource'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {isLoading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center">
                  <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No audit entries found</p>
                  <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
                </td></tr>
              ) : logs.map((log: any) => (
                <tr key={log.id} className={cn(
                  'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors',
                  log.severity === 'CRITICAL' && 'bg-red-50/30 dark:bg-red-900/5',
                )}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', severityDot[log.severity ?? 'INFO'])} />
                      <Badge variant={severityColor[log.severity ?? 'INFO']}>{log.severity ?? 'INFO'}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(log.createdAt)}</p>
                    <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {log.user ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {log.user.firstName?.[0]}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{log.user.firstName} {log.user.lastName}</p>
                          <p className="text-xs text-slate-400">{log.user.role}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-slate-500">{log.ipAddress ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate" title={log.description}>
                      {log.description ?? '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {log.resourceType && (
                      <div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{log.resourceType}</p>
                        <p className="text-xs font-mono text-slate-400 truncate max-w-[100px]">{log.resourceId}</p>
                      </div>
                    )}
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
              Showing {((filters.page - 1) * filters.limit) + 1}–{Math.min(filters.page * filters.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => updateFilter('page', filters.page - 1)}>Previous</Button>
              <span className="px-3 text-xs text-slate-500">Page {filters.page} / {pagination.pages}</span>
              <Button size="sm" variant="outline" disabled={filters.page >= pagination.pages} onClick={() => updateFilter('page', filters.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
