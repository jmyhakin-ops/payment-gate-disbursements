import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, Download, TrendingUp, TrendingDown, RefreshCw,
  Filter, DollarSign, CheckCircle, XCircle, Clock, Loader2,
  Activity, Search, X, Calendar, CreditCard, Smartphone,
  Building2, ArrowUpRight, ArrowDownRight, Receipt, Users,
  AlertCircle, ShieldCheck, Banknote, Hash, Phone, Mail,
  ChevronLeft, ChevronRight, ChevronDown, FileText, Zap,
  PieChart as PieChartIcon, LayoutGrid, List, Eye
} from 'lucide-react';
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  ComposedChart, Line, LineChart,
} from 'recharts';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, Input } from '../../components/ui/select';
import { formatCurrency, formatDate, cn } from '../../lib/utils';

// ════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════

const BRAND_COLORS = {
  indigo:  ['#6366f1', '#818cf8', '#a5b4fc'],
  emerald: ['#10b981', '#34d399', '#6ee7b7'],
  amber:   ['#f59e0b', '#fbbf24', '#fcd34d'],
  rose:    ['#f43f5e', '#fb7185', '#fda4af'],
  purple:  ['#8b5cf6', '#a78bfa', '#c4b5fd'],
  cyan:    ['#06b6d4', '#22d3ee', '#67e8f9'],
};

const PIE_PALETTE = [
  '#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6',
];

const RAIL_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  MPESA_B2C:       { label: 'M-Pesa B2C',       icon: Smartphone,  color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  MPESA_B2B_PAYBILL: { label: 'M-Pesa Paybill', icon: Building2,   color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200' },
  MPESA_B2B_TILL:  { label: 'M-Pesa Till',       icon: CreditCard,  color: 'text-teal-700',   bg: 'bg-teal-50 border-teal-200' },
  PESALINK:        { label: 'PesaLink',           icon: Banknote,    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  RTGS:            { label: 'RTGS / EFT',         icon: Building2,   color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  EQUITY_JENGA:    { label: 'Equity Jenga',       icon: CreditCard,  color: 'text-rose-700',   bg: 'bg-rose-50 border-rose-200' },
  KCB_OPEN_BANKING:{ label: 'KCB OpenBanking',   icon: Banknote,    color: 'text-cyan-700',   bg: 'bg-cyan-50 border-cyan-200' },
};

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  COMPLETED:        { label: 'Completed',       color: 'bg-green-100 text-green-800',   dot: 'bg-green-500' },
  FAILED:           { label: 'Failed',           color: 'bg-red-100 text-red-800',       dot: 'bg-red-500' },
  PENDING_CHECKER:  { label: 'Pending Checker',  color: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-500' },
  PENDING_DIRECTOR: { label: 'Pending Director', color: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  PROCESSING:       { label: 'Processing',       color: 'bg-blue-100 text-blue-800',     dot: 'bg-blue-500' },
  DRAFT:            { label: 'Draft',            color: 'bg-slate-100 text-slate-800',   dot: 'bg-slate-400' },
  CANCELLED:        { label: 'Cancelled',        color: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-400' },
  REVERSED:         { label: 'Reversed',         color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
};

const PERIOD_PILLS = [
  { label: 'Today',    value: '1d'  },
  { label: '7 Days',   value: '7d'  },
  { label: '30 Days',  value: '30d' },
  { label: '90 Days',  value: '90d' },
  { label: '6 Months', value: '6m'  },
  { label: '1 Year',   value: '1y'  },
  { label: 'Custom',   value: 'custom' },
];

// ════════════════════════════════════════════════════════════════
// Custom Tooltip
// ════════════════════════════════════════════════════════════════

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 shadow-xl rounded-xl p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1 text-slate-500">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold text-slate-800">
            {typeof p.value === 'number' && p.value > 1000
              ? formatCurrency(p.value)
              : p.value?.toLocaleString?.() ?? p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Stat Card
// ════════════════════════════════════════════════════════════════

interface StatCardProps {
  label: string;
  value: string | number;
  icon: any;
  gradient: string;
  trend?: number;
  sub?: string;
  loading?: boolean;
}

function StatCard({ label, value, icon: Icon, gradient, trend, sub, loading }: StatCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg`}>
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white" />
        <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-white" />
      </div>
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-1">{label}</p>
            <p className="text-3xl font-black tracking-tight">
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : value}
            </p>
            {sub && <p className="text-xs text-white/60 mt-1">{sub}</p>}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-3 flex items-center gap-1">
            {trend >= 0
              ? <ArrowUpRight className="w-3.5 h-3.5 text-white/80" />
              : <ArrowDownRight className="w-3.5 h-3.5 text-white/80" />}
            <span className="text-xs font-semibold text-white/80">
              {Math.abs(trend).toFixed(1)}% vs last period
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Status Badge
// ════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// Rail Badge
// ════════════════════════════════════════════════════════════════

function RailBadge({ rail }: { rail: string }) {
  const meta = RAIL_META[rail] ?? { label: rail, icon: CreditCard, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${meta.bg} ${meta.color}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════

export default function ReportsPage() {
  // ── Period / Date state ──────────────────────────────────────
  const [period, setPeriod] = useState('30d');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Transaction filters ──────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRail, setFilterRail] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<'table' | 'grid'>('table');

  // ── Selected transaction detail ──────────────────────────────
  const [selectedTx, setSelectedTx] = useState<any>(null);

  // ── Build query params ───────────────────────────────────────
  const summaryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (period !== 'custom') p.period = period;
    else { if (dateFrom) p.dateFrom = dateFrom; if (dateTo) p.dateTo = dateTo; }
    return p;
  }, [period, dateFrom, dateTo]);

  const txParams = useMemo(() => {
    const p: Record<string, any> = { page, limit: 15 };
    if (filterStatus) p.status = filterStatus;
    if (filterRail) p.rail = filterRail;
    if (filterType) p.type = filterType;
    if (search) p.search = search;
    if (period !== 'custom') p.period = period;
    else { if (dateFrom) p.dateFrom = dateFrom; if (dateTo) p.dateTo = dateTo; }
    return p;
  }, [page, filterStatus, filterRail, filterType, search, period, dateFrom, dateTo]);

  // ── Queries ──────────────────────────────────────────────────
  const {
    data: summary, isLoading: summaryLoading, refetch: refetchSummary, isFetching: summaryFetching
  } = useQuery({
    queryKey: ['reports-summary', summaryParams],
    queryFn: () => api.get('/reports', { params: { ...summaryParams, action: 'summary' } }).then(r => r.data.data),
    staleTime: 60_000,
  });

  const {
    data: txData, isLoading: txLoading, isFetching: txFetching
  } = useQuery({
    queryKey: ['reports-transactions', txParams],
    queryFn: () => api.get('/payments', { params: txParams }).then(r => r.data),
    staleTime: 30_000,
  });

  const transactions: any[] = txData?.data ?? [];
  const txMeta = txData?.meta ?? { total: 0, page: 1, pages: 1 };

  // ── Reset page on filter change ──────────────────────────────
  const resetPage = useCallback(() => setPage(1), []);

  // ── Export CSV ───────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Reference', 'Date', 'Recipient', 'Phone', 'Rail', 'Type', 'Amount (KES)', 'Charges', 'Net', 'Status', 'M-Pesa Receipt', 'Description'];
    const rows = transactions.map(tx => [
      tx.reference ?? '',
      formatDate(tx.createdAt),
      tx.recipientName ?? '',
      tx.recipientPhone ?? '',
      tx.rail ?? '',
      tx.type ?? '',
      tx.amount ?? 0,
      tx.charges ?? 0,
      tx.netAmount ?? 0,
      tx.status ?? '',
      tx.mpesaReceiptNumber ?? '',
      `"${(tx.description ?? '').replace(/"/g, "'")}"`,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `payment-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const isLoading = summaryLoading;

  // ── KPI cards config ─────────────────────────────────────────
  const kpis = [
    {
      label: 'Total Volume',
      value: formatCurrency(summary?.totalVolume ?? 0),
      icon: DollarSign,
      gradient: 'from-indigo-500 via-indigo-600 to-violet-700',
      trend: summary?.trends?.volume,
      sub: `${summary?.totalTransactions ?? 0} transactions`,
    },
    {
      label: 'Disbursed (Completed)',
      value: formatCurrency(summary?.completedVolume ?? 0),
      icon: CheckCircle,
      gradient: 'from-emerald-500 via-green-500 to-teal-600',
      trend: summary?.trends?.completed,
      sub: `${summary?.successful ?? 0} successful`,
    },
    {
      label: 'Failed Amount',
      value: formatCurrency(summary?.failedVolume ?? 0),
      icon: XCircle,
      gradient: 'from-rose-500 via-red-500 to-pink-600',
      trend: summary?.trends?.failed,
      sub: `${summary?.failed ?? 0} transactions`,
    },
    {
      label: 'Pending Approval',
      value: summary?.pending ?? 0,
      icon: Clock,
      gradient: 'from-amber-500 via-orange-500 to-yellow-600',
      sub: 'Awaiting checker / director',
    },
    {
      label: 'Success Rate',
      value: `${((summary?.successRate ?? 0) * 100).toFixed(1)}%`,
      icon: ShieldCheck,
      gradient: 'from-cyan-500 via-sky-500 to-blue-600',
      trend: summary?.trends?.successRate,
    },
    {
      label: 'Avg Transaction',
      value: formatCurrency(summary?.avgAmount ?? 0),
      icon: BarChart2,
      gradient: 'from-purple-500 via-violet-500 to-fuchsia-600',
    },
  ];

  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 p-6 text-white shadow-2xl">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-indigo-500 opacity-10 blur-3xl" />
          <div className="absolute -left-10 -bottom-10 w-48 h-48 rounded-full bg-purple-500 opacity-10 blur-2xl" />
        </div>
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tight">Payment Reports</h1>
            </div>
            <p className="text-slate-400 text-sm ml-13">
              Real-time analytics · Disbursement insights · Kenya Payment Rails
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { refetchSummary(); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
            >
              <RefreshCw className={cn('w-4 h-4', summaryFetching && 'animate-spin')} />
              Refresh
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all text-sm font-semibold shadow-lg"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Period Pills */}
        <div className="relative mt-4 flex items-center gap-2 flex-wrap">
          {PERIOD_PILLS.map(p => (
            <button
              key={p.value}
              onClick={() => { setPeriod(p.value); resetPage(); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                period === p.value
                  ? 'bg-white text-indigo-700 shadow-md'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              )}
            >
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); resetPage(); }}
                className="px-2 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/40"
              />
              <span className="text-white/50 text-xs">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); resetPage(); }}
                className="px-2 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/40"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(kpi => (
          <StatCard key={kpi.label} {...kpi} loading={isLoading} />
        ))}
      </div>

      {/* ── Charts Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Volume Over Time (2/3 width) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Volume Over Time</h2>
              <p className="text-xs text-slate-400 mt-0.5">KES disbursements per day</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
              <span className="text-xs text-slate-400">Volume</span>
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block ml-2" />
              <span className="text-xs text-slate-400">Count</span>
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={summary?.dailyVolume ?? []}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area yAxisId="left" type="monotone" dataKey="volume" name="Volume (KES)" stroke="#6366f1" fill="url(#volGrad)" strokeWidth={2.5} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="count" name="Transactions" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By Rail Donut (1/3 width) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">By Payment Rail</h2>
            <p className="text-xs text-slate-400 mt-0.5">Volume distribution</p>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={(summary?.byRail ?? []).map((r: any) => ({
                      name: RAIL_META[r.rail]?.label ?? r.rail,
                      value: r.volume ?? r._sum?.amount ?? 0,
                    }))}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {(summary?.byRail ?? []).map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {(summary?.byRail ?? []).slice(0, 5).map((r: any, i: number) => (
                  <div key={r.rail} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: PIE_PALETTE[i] }} />
                      <span className="text-slate-600 dark:text-slate-400">{RAIL_META[r.rail]?.label ?? r.rail}</span>
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatCurrency(r.volume ?? r._sum?.amount ?? 0)}
                    </span>
                  </div>
                ))}
                {!(summary?.byRail?.length) && (
                  <p className="text-center text-slate-400 text-xs py-4">No data</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Charts Row 2 ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Status Bar Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Transactions by Status</h2>
            <p className="text-xs text-slate-400 mt-0.5">Count per transaction status</p>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name: 'Completed', count: summary?.successful ?? 0, fill: '#10b981' },
                { name: 'Failed',    count: summary?.failed ?? 0,     fill: '#ef4444' },
                { name: 'Pending',   count: summary?.pending ?? 0,    fill: '#f59e0b' },
                { name: 'Cancelled', count: summary?.cancelled ?? 0,  fill: '#94a3b8' },
              ]} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Count" radius={[6, 6, 0, 0]}>
                  {[{ fill: '#10b981' }, { fill: '#ef4444' }, { fill: '#f59e0b' }, { fill: '#94a3b8' }].map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Recipients */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Top Recipients</h2>
              <p className="text-xs text-slate-400 mt-0.5">Highest payment recipients this period</p>
            </div>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {(summary?.topRecipients ?? []).slice(0, 6).map((r: any, i: number) => {
                const maxVol = summary?.topRecipients?.[0]?.volume ?? 1;
                const pct = Math.round(((r.volume ?? 0) / maxVol) * 100);
                return (
                  <div key={r.identifier ?? i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ background: PIE_PALETTE[i] }}
                        >{i + 1}</div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{r.name ?? r.recipientName ?? r.identifier}</span>
                        <span className="text-slate-400 flex-shrink-0">× {r.count}</span>
                      </div>
                      <span className="font-bold text-indigo-600 flex-shrink-0 ml-2">{formatCurrency(r.volume ?? 0)}</span>
                    </div>
                    <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: PIE_PALETTE[i] }} />
                    </div>
                  </div>
                );
              })}
              {!(summary?.topRecipients?.length) && (
                <p className="text-center text-slate-400 text-sm py-8">No data for this period</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Transaction Table ────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Table Header / Filters */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                Payment Transactions
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{txMeta.total.toLocaleString()} records</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView(v => v === 'table' ? 'grid' : 'table')}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {view === 'table' ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowFilters(f => !f)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
                  showFilters
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700'
                    : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                Filters
                {(filterStatus || filterRail || filterType) && (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">
                    {[filterStatus, filterRail, filterType].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage(); }}
              placeholder="Search by reference, recipient name, phone, M-Pesa receipt..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => { setSearch(''); resetPage(); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="mt-3 grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-600">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Status</label>
                <select
                  value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value); resetPage(); }}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-700 dark:text-slate-300"
                >
                  <option value="">All Statuses</option>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Payment Rail</label>
                <select
                  value={filterRail}
                  onChange={e => { setFilterRail(e.target.value); resetPage(); }}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-700 dark:text-slate-300"
                >
                  <option value="">All Rails</option>
                  {Object.entries(RAIL_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Type</label>
                <select
                  value={filterType}
                  onChange={e => { setFilterType(e.target.value); resetPage(); }}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-700 dark:text-slate-300"
                >
                  <option value="">All Types</option>
                  <option value="B2C">B2C (Person)</option>
                  <option value="B2B">B2B (Business)</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="BULK_PAYMENT">Bulk Payment</option>
                </select>
              </div>
              {(filterStatus || filterRail || filterType) && (
                <div className="col-span-3 flex justify-end">
                  <button
                    onClick={() => { setFilterStatus(''); setFilterRail(''); setFilterType(''); resetPage(); }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        {view === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/40 border-b border-slate-200 dark:border-slate-700">
                  {['Reference', 'Date & Time', 'Recipient', 'Rail', 'Amount', 'Charges', 'Net', 'Status', 'Receipt / Ref'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {txLoading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
                      <p className="text-slate-400 text-xs mt-2">Loading transactions...</p>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm font-medium">No transactions found</p>
                      <p className="text-slate-300 text-xs mt-1">Try adjusting your filters</p>
                    </td>
                  </tr>
                ) : (
                  transactions.map(tx => (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors group"
                    >
                      {/* Reference */}
                      <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400 font-semibold whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3 opacity-60" />
                          {tx.reference}
                        </div>
                        {tx.externalReference && (
                          <div className="text-slate-400 text-[10px] mt-0.5 truncate max-w-[120px]">{tx.externalReference}</div>
                        )}
                      </td>
                      {/* Date */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="font-medium">{new Date(tx.createdAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div className="text-slate-400 text-[10px]">{new Date(tx.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                      </td>
                      {/* Recipient */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{tx.recipientName}</div>
                        {tx.recipientPhone && (
                          <div className="text-slate-400 text-[10px] flex items-center gap-1 mt-0.5">
                            <Phone className="w-2.5 h-2.5" />{tx.recipientPhone}
                          </div>
                        )}
                        {tx.recipientEmail && (
                          <div className="text-slate-400 text-[10px] flex items-center gap-1 mt-0.5">
                            <Mail className="w-2.5 h-2.5" />{tx.recipientEmail}
                          </div>
                        )}
                        {tx.recipientAccountNo && (
                          <div className="text-slate-400 text-[10px] font-mono mt-0.5">{tx.recipientAccountNo}</div>
                        )}
                      </td>
                      {/* Rail */}
                      <td className="px-4 py-3 whitespace-nowrap"><RailBadge rail={tx.rail} /></td>
                      {/* Amount */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(tx.amount)}</span>
                      </td>
                      {/* Charges */}
                      <td className="px-4 py-3 text-right whitespace-nowrap text-slate-500">
                        {tx.charges > 0 ? formatCurrency(tx.charges) : <span className="text-slate-300">—</span>}
                      </td>
                      {/* Net */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-semibold text-emerald-600">{formatCurrency(tx.netAmount ?? tx.amount)}</span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={tx.status} /></td>
                      {/* Receipt */}
                      <td className="px-4 py-3">
                        {tx.mpesaReceiptNumber ? (
                          <div className="font-mono text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded-md border border-green-200 inline-block">
                            {tx.mpesaReceiptNumber}
                          </div>
                        ) : tx.pesaLinkRef ? (
                          <div className="font-mono text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-200 inline-block">
                            {tx.pesaLinkRef}
                          </div>
                        ) : tx.rtgsRef ? (
                          <div className="font-mono text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded-md border border-purple-200 inline-block">
                            {tx.rtgsRef}
                          </div>
                        ) : tx.failureReason ? (
                          <div className="text-[10px] text-rose-500 max-w-[120px] truncate" title={tx.failureReason}>
                            {tx.failureReason}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {txLoading ? (
              <div className="col-span-3 py-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
              </div>
            ) : transactions.map(tx => (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer bg-white dark:bg-slate-800"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{tx.recipientName}</p>
                    <p className="font-mono text-[10px] text-indigo-500 mt-0.5">#{tx.reference}</p>
                  </div>
                  <StatusBadge status={tx.status} />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">{formatCurrency(tx.amount)}</div>
                <div className="flex items-center justify-between">
                  <RailBadge rail={tx.rail} />
                  <span className="text-[10px] text-slate-400">{new Date(tx.createdAt).toLocaleDateString('en-KE')}</span>
                </div>
                {tx.mpesaReceiptNumber && (
                  <div className="mt-2 font-mono text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100">
                    {tx.mpesaReceiptNumber}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination + Totals Footer */}
        {!txLoading && transactions.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-700/20">
            {/* Totals */}
            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-slate-400">Page total: </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(transactions.reduce((s, tx) => s + (tx.amount ?? 0), 0))}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Net disbursed: </span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(transactions.filter(tx => tx.status === 'COMPLETED').reduce((s, tx) => s + (tx.netAmount ?? tx.amount ?? 0), 0))}
                </span>
              </div>
              <div className="text-slate-400">
                Page <span className="font-semibold text-slate-700">{txMeta.page}</span> of <span className="font-semibold text-slate-700">{txMeta.pages ?? Math.ceil(txMeta.total / 15)}</span>
                {' '}· <span className="font-semibold text-slate-700">{txMeta.total.toLocaleString()}</span> total
              </div>
            </div>
            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              {Array.from({ length: Math.min(5, txMeta.pages ?? Math.ceil(txMeta.total / 15)) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      'w-7 h-7 rounded-lg text-xs font-semibold transition-colors',
                      page === p
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page >= (txMeta.pages ?? Math.ceil(txMeta.total / 15))}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Transaction Detail Drawer ────────────────────────── */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto flex flex-col">
            {/* Drawer Header */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 p-5 flex items-start justify-between text-white">
              <div>
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Transaction Detail</p>
                <p className="font-mono text-lg font-bold">#{selectedTx.reference}</p>
                <StatusBadge status={selectedTx.status} />
              </div>
              <button onClick={() => setSelectedTx(null)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Amount Hero */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Amount</p>
              <p className="text-4xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(selectedTx.amount)}</p>
              {selectedTx.charges > 0 && (
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span>Charges: <b>{formatCurrency(selectedTx.charges)}</b></span>
                  <span>Net: <b className="text-emerald-600">{formatCurrency(selectedTx.netAmount)}</b></span>
                </div>
              )}
            </div>
            {/* Details */}
            <div className="p-5 space-y-4">
              {[
                { label: 'Recipient Name', value: selectedTx.recipientName },
                { label: 'Phone', value: selectedTx.recipientPhone },
                { label: 'Email', value: selectedTx.recipientEmail },
                { label: 'Account No.', value: selectedTx.recipientAccountNo },
                { label: 'Bank', value: selectedTx.recipientBankName ? `${selectedTx.recipientBankName} (${selectedTx.recipientBankCode})` : null },
                { label: 'Payment Rail', value: RAIL_META[selectedTx.rail]?.label ?? selectedTx.rail },
                { label: 'Type', value: selectedTx.type },
                { label: 'Currency', value: selectedTx.currency },
                { label: 'Description', value: selectedTx.description },
                { label: 'Narration', value: selectedTx.narration },
                { label: 'M-Pesa Receipt', value: selectedTx.mpesaReceiptNumber, mono: true },
                { label: 'M-Pesa Conversation', value: selectedTx.mpesaConversationId, mono: true },
                { label: 'PesaLink Ref', value: selectedTx.pesaLinkRef, mono: true },
                { label: 'RTGS Ref', value: selectedTx.rtgsRef, mono: true },
                { label: 'External Reference', value: selectedTx.externalReference, mono: true },
                { label: 'Created', value: new Date(selectedTx.createdAt).toLocaleString('en-KE') },
                { label: 'Processed', value: selectedTx.processedAt ? new Date(selectedTx.processedAt).toLocaleString('en-KE') : null },
                { label: 'Completed', value: selectedTx.completedAt ? new Date(selectedTx.completedAt).toLocaleString('en-KE') : null },
                { label: 'Failure Reason', value: selectedTx.failureReason, danger: true },
              ].filter(f => f.value).map(f => (
                <div key={f.label} className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                  <span className="text-xs text-slate-400 uppercase tracking-wide flex-shrink-0 pt-0.5">{f.label}</span>
                  <span className={cn(
                    'text-xs text-right break-all',
                    f.mono ? 'font-mono text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200 font-medium',
                    (f as any).danger ? '!text-rose-600' : ''
                  )}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
