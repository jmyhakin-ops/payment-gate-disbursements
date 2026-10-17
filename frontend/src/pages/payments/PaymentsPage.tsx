import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { paymentsApi } from '@/services/api';
import { DateRangePicker } from '@/components/ui/DatePicker';
import {
  formatCurrency, formatDateTime, formatRelative, statusColors,
  railLabels, railColors, cn, extractApiError,
} from '@/lib/utils';
import {
  CreditCard, Search, Filter, Download, Plus, Eye, ChevronLeft, ChevronRight,
  RefreshCw, X, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare,
  Square, AlertTriangle, Loader2, SlidersHorizontal, BarChart3, TrendingUp,
  Copy, ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';

const STATUSES = [
  { value: '', label: 'All Statuses', color: 'bg-gray-100 text-gray-700' },
  { value: 'DRAFT', label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  { value: 'PENDING_CHECKER', label: 'Pending Checker', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'CHECKER_APPROVED', label: 'Checker Approved', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'CHECKER_REJECTED', label: 'Checker Rejected', color: 'bg-red-100 text-red-800' },
  { value: 'PENDING_DIRECTOR', label: 'Pending Director', color: 'bg-orange-100 text-orange-800' },
  { value: 'DIRECTOR_APPROVED', label: 'Director Approved', color: 'bg-teal-100 text-teal-800' },
  { value: 'DIRECTOR_REJECTED', label: 'Director Rejected', color: 'bg-red-100 text-red-700' },
  { value: 'PROCESSING', label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'FAILED', label: 'Failed', color: 'bg-red-100 text-red-800' },
  { value: 'REVERSED', label: 'Reversed', color: 'bg-purple-100 text-purple-800' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
];

const RAILS = [
  { value: '', label: 'All Rails' },
  { value: 'MPESA_B2C', label: 'M-Pesa B2C' },
  { value: 'MPESA_B2B_PAYBILL', label: 'M-Pesa Paybill' },
  { value: 'MPESA_B2B_TILL', label: 'M-Pesa Till' },
  { value: 'PESALINK', label: 'PesaLink' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'EQUITY_JENGA', label: 'Equity Jenga' },
  { value: 'KCB_OPEN_BANKING', label: 'KCB Open Banking' },
];

const AMOUNT_RANGES = [
  { value: '', label: 'Any Amount' },
  { value: '0-1000', label: 'Below KES 1,000' },
  { value: '1000-10000', label: 'KES 1,000 – 10,000' },
  { value: '10000-100000', label: 'KES 10,000 – 100,000' },
  { value: '100000-1000000', label: 'KES 100,000 – 1M' },
  { value: '1000000-', label: 'Above KES 1M' },
];

type SortField = 'createdAt' | 'amount' | 'recipientName' | 'status';
type SortDir = 'asc' | 'desc';

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [rail, setRail] = useState('');
  const [amountRange, setAmountRange] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const activeFilters = [status, rail, amountRange, startDate, endDate].filter(Boolean).length;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['payments', page, limit, search, status, rail, startDate, endDate, sortField, sortDir],
    queryFn: () => paymentsApi.list({
      page, limit,
      search: search || undefined,
      status: status || undefined,
      rail: rail || undefined,
      startDate: startDate ? startDate.toISOString() : undefined,
      endDate: endDate ? endDate.toISOString() : undefined,
    }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  // Summary stats
  const { data: summary } = useQuery({
    queryKey: ['payments-summary'],
    queryFn: () => paymentsApi.dashboard().then((r) => r.data.data),
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selected.size === data?.data?.length) setSelected(new Set());
    else setSelected(new Set(data?.data?.map((t: { id: string }) => t.id) || []));
  };

  const clearFilters = () => {
    setStatus(''); setRail(''); setAmountRange('');
    setStartDate(null); setEndDate(null); setSearch(''); setPage(1);
  };

  const copyRef = async (ref: string) => {
    await navigator.clipboard.writeText(ref);
    setCopiedRef(ref);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const exportCSV = () => {
    const rows = data?.data || [];
    const headers = ['Reference','Recipient','Phone/Account','Rail','Amount','Charges','Status','Maker','Date'];
    const lines = rows.map((tx: any) => [
      tx.reference, tx.recipientName, tx.recipientPhone || tx.recipientAccountNo || '',
      railLabels[tx.rail] || tx.rail, tx.amount, tx.charges,
      tx.status, `${tx.maker?.firstName} ${tx.maker?.lastName}`,
      formatDateTime(tx.createdAt),
    ].map(String).join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payments-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />;
  };

  return (
    <div className="space-y-5">
      {/* ─── Page Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Manage all disbursements · {data?.total ? <span className="font-medium text-gray-700">{data.total.toLocaleString()} total</span> : '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => refetch()} disabled={isFetching} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            Refresh
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <Link to="/payments/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" /> New Payment
          </Link>
        </div>
      </div>

      {/* ─── KPI Strip ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Today's Payments", val: summary?.today?.transactions || 0, sub: formatCurrency(summary?.today?.amount || 0), color: 'text-blue-600' },
          { label: 'Completed (Month)', val: summary?.month?.completed || 0, sub: formatCurrency(summary?.month?.amount || 0), color: 'text-green-600' },
          { label: 'Pending Checker', val: summary?.pending?.checker || 0, sub: 'Need review', color: 'text-amber-600' },
          { label: 'Pending Director', val: summary?.pending?.director || 0, sub: 'Final approval', color: 'text-orange-600' },
        ].map(({ label, val, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 truncate">{label}</p>
              <p className={cn('text-xl font-bold', color)}>{val}</p>
              <p className="text-xs text-gray-500 truncate">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Search + Filter Bar ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, reference, phone, account…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Status Pills */}
          <div className="flex gap-1.5 flex-wrap">
            {['', 'PENDING_CHECKER', 'PENDING_DIRECTOR', 'COMPLETED', 'FAILED'].map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  status === s
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                {s ? STATUSES.find((x) => x.value === s)?.label : 'All'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn('flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
              showFilters || activeFilters > 0 ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilters > 0 && (
              <span className="ml-0.5 w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center">{activeFilters}</span>
            )}
          </button>

          {activeFilters > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                  className="w-full appearance-none px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white pr-8"
                >
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Rail */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Payment Rail</label>
              <div className="relative">
                <select
                  value={rail}
                  onChange={(e) => { setRail(e.target.value); setPage(1); }}
                  className="w-full appearance-none px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white pr-8"
                >
                  {RAILS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Amount Range */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Amount Range</label>
              <div className="relative">
                <select
                  value={amountRange}
                  onChange={(e) => { setAmountRange(e.target.value); setPage(1); }}
                  className="w-full appearance-none px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white pr-8"
                >
                  {AMOUNT_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Rows per page */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Rows per Page</label>
              <div className="relative">
                <select
                  value={limit}
                  onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
                  className="w-full appearance-none px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white pr-8"
                >
                  {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} rows</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Date Range - spans 2 columns */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date Range</label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartChange={(d) => { setStartDate(d); setPage(1); }}
                onEndChange={(d) => { setEndDate(d); setPage(1); }}
              />
            </div>

            {/* Active filter tags */}
            {activeFilters > 0 && (
              <div className="col-span-4 flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                <span className="text-xs text-gray-400 font-medium self-center">Active:</span>
                {status && (
                  <FilterTag label={STATUSES.find((s) => s.value === status)?.label || status} onRemove={() => setStatus('')} color="blue" />
                )}
                {rail && (
                  <FilterTag label={RAILS.find((r) => r.value === rail)?.label || rail} onRemove={() => setRail('')} color="green" />
                )}
                {amountRange && (
                  <FilterTag label={AMOUNT_RANGES.find((r) => r.value === amountRange)?.label || amountRange} onRemove={() => setAmountRange('')} color="purple" />
                )}
                {startDate && endDate && (
                  <FilterTag label={`${format(startDate, 'dd MMM')} – ${format(endDate, 'dd MMM yyyy')}`} onRemove={() => { setStartDate(null); setEndDate(null); }} color="orange" />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Bulk Actions bar ─── */}
      {selected.size > 0 && (
        <div className="bg-blue-600 text-white rounded-xl px-5 py-3 flex items-center justify-between animate-fade-in">
          <span className="text-sm font-semibold">{selected.size} transaction{selected.size > 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Export Selected
            </button>
            <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs">Clear</button>
          </div>
        </div>
      )}

      {/* ─── Table ─── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="w-10 px-4 py-3">
                  <button onClick={toggleAll} className="text-gray-400 hover:text-blue-600 transition-colors">
                    {selected.size === data?.data?.length && data?.data?.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 transition-colors">
                    Reference <SortIcon field="createdAt" />
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('recipientName')} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Recipient <SortIcon field="recipientName" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rail</th>
                <th className="text-right px-4 py-3">
                  <button onClick={() => toggleSort('amount')} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 ml-auto">
                    Amount <SortIcon field="amount" />
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('status')} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Status <SortIcon field="status" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Maker</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? Array.from({ length: limit }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={9} className="px-4 py-3.5">
                        <div className="h-4 bg-gray-100 rounded-full shimmer" style={{ width: `${60 + Math.random() * 40}%` }} />
                      </td>
                    </tr>
                  ))
                : data?.data?.map((tx: any) => (
                    <tr
                      key={tx.id}
                      className={cn(
                        'transition-colors group',
                        selected.has(tx.id) ? 'bg-blue-50' : 'hover:bg-gray-50/70',
                      )}
                    >
                      <td className="w-10 px-4 py-3.5">
                        <button onClick={() => toggleSelect(tx.id)} className="text-gray-300 hover:text-blue-500">
                          {selected.has(tx.id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-blue-600 font-semibold">{tx.reference}</span>
                          <button onClick={() => copyRef(tx.reference)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-gray-600">
                            {copiedRef === tx.reference ? <span className="text-green-500 text-xs">✓</span> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        {tx.externalReference && (
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{tx.externalReference}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium text-gray-800 leading-tight">{tx.recipientName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{tx.recipientPhone || tx.recipientAccountNo || '—'}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', railColors[tx.rail] || 'bg-gray-100 text-gray-600')}>
                          {railLabels[tx.rail] || tx.rail}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(tx.amount, tx.currency)}</p>
                        {tx.charges > 0 && <p className="text-xs text-amber-500">+{formatCurrency(tx.charges)} fee</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', statusColors[tx.status] || 'bg-gray-100')}>
                          {tx.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs text-gray-600 font-medium">{tx.maker?.firstName} {tx.maker?.lastName}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs text-gray-600 whitespace-nowrap">{formatDateTime(tx.createdAt)}</p>
                        <p className="text-xs text-gray-400">{formatRelative(tx.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            to={`/payments/${tx.id}`}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => window.open(`/payments/${tx.id}`, '_blank')}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Open in new tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {!isLoading && (!data?.data || data.data.length === 0) && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="font-semibold text-gray-700 mb-1">No payments found</h3>
            <p className="text-gray-400 text-sm mb-4">
              {activeFilters > 0 ? 'Try adjusting your filters' : 'Start by creating your first payment'}
            </p>
            {activeFilters > 0 ? (
              <button onClick={clearFilters} className="text-blue-600 text-sm hover:underline">Clear filters</button>
            ) : (
              <Link to="/payments/new" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                Create Payment
              </Link>
            )}
          </div>
        )}

        {/* ─── Pagination ─── */}
        {data?.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">
                Showing <span className="font-semibold text-gray-700">{((page - 1) * limit) + 1}</span>–<span className="font-semibold text-gray-700">{Math.min(page * limit, data.total)}</span> of{' '}
                <span className="font-semibold text-gray-700">{data.total.toLocaleString()}</span> payments
              </p>
              {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page <= 1} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-white text-gray-500 text-xs px-2">«</button>
              <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-white">
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              {Array.from({ length: Math.min(7, data.pages) }, (_, i) => {
                let p = page <= 4 ? i + 1 : page >= data.pages - 3 ? data.pages - 6 + i : page - 3 + i;
                if (p < 1) p = i + 1;
                return (
                  <button key={p} onClick={() => setPage(p)} className={cn(
                    'w-8 h-8 rounded-lg text-sm font-medium transition-colors border',
                    p === page ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-white'
                  )}>{p}</button>
                );
              })}
              <button onClick={() => setPage(page + 1)} disabled={page >= data.pages} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-white">
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
              <button onClick={() => setPage(data.pages)} disabled={page >= data.pages} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-white text-gray-500 text-xs px-2">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterTag({ label, onRemove, color }: { label: string; onRemove: () => void; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border', colors[color] || colors.blue)}>
      {label}
      <button onClick={onRemove} className="hover:opacity-70 ml-0.5"><X className="w-3 h-3" /></button>
    </span>
  );
}
