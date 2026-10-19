import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  BookOpen, Download, Filter, ArrowUpRight, ArrowDownLeft,
  RefreshCw, Loader2, ChevronLeft, X, TrendingUp, TrendingDown
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { DateRangePicker } from '../../components/ui/DatePicker';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'DEBIT', label: 'Debit (Out)' },
  { value: 'CREDIT', label: 'Credit (In)' },
  { value: 'RESERVE', label: 'Reserved' },
  { value: 'RELEASE', label: 'Released' },
  { value: 'FEE', label: 'Fees' },
];

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Newest First' },
  { value: 'createdAt_asc', label: 'Oldest First' },
  { value: 'amount_desc', label: 'Highest Amount' },
  { value: 'amount_asc', label: 'Lowest Amount' },
];

export default function WalletLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    type: '',
    dateFrom: null as Date | null,
    dateTo: null as Date | null,
    sort: 'createdAt_desc',
    page: 1,
    limit: 50,
  });
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = (key: string, value: any) =>
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));

  const { data: wallet } = useQuery({
    queryKey: ['wallet', id],
    queryFn: () => api.get(`/wallets/${id}`).then(r => r.data.data),
    enabled: !!id,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['ledger', id, filters],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filters.type) p.set('type', filters.type);
      if (filters.dateFrom) p.set('dateFrom', filters.dateFrom.toISOString());
      if (filters.dateTo) p.set('dateTo', filters.dateTo.toISOString());
      const [sortBy, sortDir] = filters.sort.split('_');
      p.set('sortBy', sortBy); p.set('sortDir', sortDir);
      p.set('page', String(filters.page)); p.set('limit', String(filters.limit));
      return api.get(`/wallets/${id}/ledger?${p}`).then(r => r.data);
    },
    enabled: !!id,
    keepPreviousData: true,
  });

  const entries: any[] = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, pages: 1 };

  const exportCSV = () => {
    const rows = [
      ['Date', 'Type', 'Description', 'Reference', 'Debit', 'Credit', 'Balance After'].join(','),
      ...entries.map(e => [
        formatDate(e.createdAt),
        e.type,
        `"${e.description ?? ''}"`,
        e.reference ?? '',
        e.type === 'DEBIT' ? e.amount : '',
        e.type === 'CREDIT' ? e.amount : '',
        e.balanceAfter ?? '',
      ].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ledger-${wallet?.name ?? id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeVariant: Record<string, any> = {
    DEBIT: 'destructive', CREDIT: 'success', RESERVE: 'warning', RELEASE: 'secondary', FEE: 'outline',
  };

  const typeIcon = (type: string) => {
    if (type === 'DEBIT' || type === 'FEE') return <ArrowUpRight className="w-4 h-4 text-red-500" />;
    return <ArrowDownLeft className="w-4 h-4 text-green-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/wallets')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            {wallet?.name ?? 'Wallet'} — Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Double-entry ledger · {pagination.total} entries
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Wallet Summary */}
      {wallet && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Balance', value: formatCurrency(wallet.balance ?? 0), color: 'text-indigo-600' },
            { label: 'Available', value: formatCurrency((wallet.balance ?? 0) - (wallet.reservedAmount ?? 0)), color: 'text-green-600' },
            { label: 'Reserved', value: formatCurrency(wallet.reservedAmount ?? 0), color: 'text-amber-600' },
            { label: 'Total Entries', value: pagination.total, color: 'text-slate-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
              <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Select value={filters.type} onChange={v => updateFilter('type', v)} options={TYPE_OPTIONS} className="w-44" />
          <Select value={filters.sort} onChange={v => updateFilter('sort', v)} options={SORT_OPTIONS} className="w-44" />
          <Button variant={showFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(v => !v)}>
            <Filter className="w-4 h-4" /> Date Range
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setFilters({
            type: '', dateFrom: null, dateTo: null, sort: 'createdAt_desc', page: 1, limit: 50,
          })}>
            <X className="w-4 h-4" /> Clear
          </Button>
          <div className="ml-auto">
            <Select
              value={String(filters.limit)}
              onChange={v => updateFilter('limit', Number(v))}
              options={[25, 50, 100, 250].map(n => ({ value: String(n), label: `${n} per page` }))}
              className="w-36"
            />
          </div>
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <DateRangePicker
              startDate={filters.dateFrom}
              endDate={filters.dateTo}
              onChange={(s, e) => { updateFilter('dateFrom', s); updateFilter('dateTo', e); }}
              label="Transaction Date Range"
            />
          </div>
        )}
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Date & Time', 'Type', 'Description', 'Reference', 'Debit', 'Credit', 'Balance After'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {isLoading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No ledger entries found</p>
                </td></tr>
              ) : entries.map((entry: any) => (
                <tr key={entry.id} className={cn(
                  'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors',
                  entry.type === 'DEBIT' && 'border-l-2 border-l-red-200',
                  entry.type === 'CREDIT' && 'border-l-2 border-l-green-200',
                )}>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{formatDate(entry.createdAt)}</p>
                    <p className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleTimeString()}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {typeIcon(entry.type)}
                      <Badge variant={typeVariant[entry.type] ?? 'secondary'}>{entry.type}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{entry.description ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-mono text-slate-400 truncate max-w-[120px]">{entry.reference ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {['DEBIT', 'FEE', 'RESERVE'].includes(entry.type) ? (
                      <span className="font-semibold text-red-600 tabular-nums">
                        -{formatCurrency(entry.amount)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {['CREDIT', 'RELEASE'].includes(entry.type) ? (
                      <span className="font-semibold text-green-600 tabular-nums">
                        +{formatCurrency(entry.amount)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {entry.balanceAfter !== undefined ? formatCurrency(entry.balanceAfter) : '—'}
                    </span>
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
              {((filters.page - 1) * filters.limit) + 1}–{Math.min(filters.page * filters.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => updateFilter('page', filters.page - 1)}>Previous</Button>
              <span className="px-3 text-sm text-slate-600">Page {filters.page} of {pagination.pages}</span>
              <Button size="sm" variant="outline" disabled={filters.page >= pagination.pages} onClick={() => updateFilter('page', filters.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
