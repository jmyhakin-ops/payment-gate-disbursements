import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, Download, TrendingUp, TrendingDown, RefreshCw,
  Filter, DollarSign, CheckCircle, XCircle, Clock, Loader2,
  PieChart, Activity
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { DateRangePicker } from '../../components/ui/DatePicker';
import { formatCurrency, formatDate, cn } from '../../lib/utils';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last 12 Months' },
  { value: 'custom', label: 'Custom Range' },
];

const RAIL_LABELS: Record<string, string> = {
  MPESA_B2C: 'M-Pesa B2C', MPESA_B2B: 'M-Pesa B2B',
  PESALINK: 'PesaLink', RTGS: 'RTGS',
  EQUITY_JENGA: 'Equity Jenga', KCB_OPENBANKING: 'KCB Open Banking',
};

export default function ReportsPage() {
  const [period, setPeriod] = useState('30d');
  const [showCustom, setShowCustom] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const params = new URLSearchParams();
  if (period !== 'custom') params.set('period', period);
  else {
    if (dateFrom) params.set('dateFrom', dateFrom.toISOString());
    if (dateTo) params.set('dateTo', dateTo.toISOString());
  }

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['reports', period, dateFrom, dateTo],
    queryFn: () => api.get(`/reports/summary?${params}`).then(r => r.data.data),
  });

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'].join(','),
      ['Total Transactions', data.totalTransactions],
      ['Total Volume (KES)', data.totalVolume],
      ['Successful', data.successful],
      ['Failed', data.failed],
      ['Pending', data.pending],
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  const kpis = [
    { label: 'Total Volume', value: formatCurrency(data?.totalVolume ?? 0), icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', trend: '+12.4%' },
    { label: 'Transactions', value: data?.totalTransactions ?? 0, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', trend: '+8.1%' },
    { label: 'Successful', value: data?.successful ?? 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', trend: '+15.2%' },
    { label: 'Failed', value: data?.failed ?? 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', trend: '-3.1%' },
    { label: 'Success Rate', value: `${((data?.successRate ?? 0) * 100).toFixed(1)}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', trend: '+2.1%' },
    { label: 'Avg Amount', value: formatCurrency(data?.avgAmount ?? 0), icon: BarChart2, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', trend: '+4.7%' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-indigo-600" />
            Analytics & Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1">Payment insights, volume trends, and disbursement analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4" /> Export</Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} /></Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Period:</span>
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setPeriod(opt.value); setShowCustom(opt.value === 'custom'); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                period === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {showCustom && (
          <div className="ml-2">
            <DateRangePicker
              startDate={dateFrom}
              endDate={dateTo}
              onChange={(s, e) => { setDateFrom(s); setDateTo(e); }}
            />
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg, trend }) => (
          <div key={label} className={`${bg} rounded-xl p-5 border border-opacity-20`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{isLoading ? '—' : value}</p>
            <p className={cn('text-xs mt-1', trend.startsWith('+') ? 'text-green-600' : 'text-red-500')}>
              {trend} vs previous period
            </p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-6">
        {/* Volume by Day */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Transaction Volume Over Time</h2>
          {isLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data?.dailyVolume ?? []}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Area type="monotone" dataKey="volume" stroke="#6366f1" fill="url(#volumeGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By Rail Pie */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Volume by Payment Rail</h2>
          {isLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <RPieChart>
                <Pie
                  data={(data?.byRail ?? []).map((r: any) => ({ name: RAIL_LABELS[r.rail] ?? r.rail, value: r.volume }))}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {(data?.byRail ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Legend iconSize={10} />
              </RPieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Transactions by Status</h2>
          {isLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name: 'Completed', count: data?.successful ?? 0 },
                { name: 'Failed', count: data?.failed ?? 0 },
                { name: 'Pending', count: data?.pending ?? 0 },
                { name: 'Cancelled', count: data?.cancelled ?? 0 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Recipients */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Top Recipients</h2>
          {isLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : (
            <div className="space-y-3">
              {(data?.topRecipients ?? []).slice(0, 5).map((r: any, i: number) => (
                <div key={r.identifier} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: COLORS[i] }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{r.name ?? r.identifier}</p>
                    <p className="text-xs text-slate-400">{r.count} transactions</p>
                  </div>
                  <p className="text-sm font-bold text-indigo-600">{formatCurrency(r.volume)}</p>
                </div>
              ))}
              {(data?.topRecipients?.length ?? 0) === 0 && (
                <p className="text-center text-slate-400 text-sm py-8">No data for this period</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
