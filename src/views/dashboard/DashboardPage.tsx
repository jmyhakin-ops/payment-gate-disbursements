import { useQuery } from '@tanstack/react-query';
import { paymentsApi, walletsApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatRelative, statusColors, railLabels, railColors, cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, CreditCard, Clock, CheckCircle, AlertCircle,
  Wallet, ArrowRight, RefreshCw, ShieldCheck, Users, BarChart3,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => paymentsApi.dashboard().then((r) => r.data.data),
    refetchInterval: 60000,
  });

  const { data: walletData } = useQuery({
    queryKey: ['wallet-summary'],
    queryFn: () => walletsApi.summary().then((r) => r.data.data),
  });

  const { data: txData } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: () => paymentsApi.list({ limit: 8 }).then((r) => r.data),
  });

  const pendingTotal = (summary?.pending?.checker || 0) + (summary?.pending?.director || 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.firstName}! 👋</h1>
          <p className="text-gray-500 text-sm mt-0.5">Here's your payment platform overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/payments/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition">
            <CreditCard className="w-4 h-4" /> New Payment
          </Link>
        </div>
      </div>

      {/* Alert for pending approvals */}
      {pendingTotal > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-900 text-sm">Action Required</p>
              <p className="text-amber-700 text-xs">
                {summary?.pending?.checker > 0 && `${summary.pending.checker} payment(s) awaiting checker review`}
                {summary?.pending?.checker > 0 && summary?.pending?.director > 0 && ' · '}
                {summary?.pending?.director > 0 && `${summary.pending.director} payment(s) awaiting director approval`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {summary?.pending?.checker > 0 && (
              <Link to="/approvals" className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-700">Review</Link>
            )}
            {summary?.pending?.director > 0 && (
              <Link to="/directors/approvals" className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-700">Director Approval</Link>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Today's Volume"
          value={formatCurrency(summary?.today?.amount || 0)}
          sub={`${summary?.today?.transactions || 0} transactions`}
          icon={<CreditCard className="w-5 h-5" />}
          color="blue"
          loading={isLoading}
        />
        <KPICard
          title="Month Volume"
          value={formatCurrency(summary?.month?.amount || 0)}
          sub={`Growth: ${summary?.month?.growth || 0}% vs last month`}
          icon={<BarChart3 className="w-5 h-5" />}
          color="green"
          trend={summary?.month?.growth}
          loading={isLoading}
        />
        <KPICard
          title="Available Balance"
          value={formatCurrency(walletData?.summary?.totalAvailable || 0)}
          sub={`Reserved: ${formatCurrency(walletData?.summary?.totalReserved || 0)}`}
          icon={<Wallet className="w-5 h-5" />}
          color="purple"
          loading={isLoading}
        />
        <KPICard
          title="Pending Approvals"
          value={String(pendingTotal)}
          sub={`${summary?.pending?.checker || 0} checker · ${summary?.pending?.director || 0} director`}
          icon={<Clock className="w-5 h-5" />}
          color={pendingTotal > 0 ? 'amber' : 'gray'}
          loading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Rail Distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Payment Rails (This Month)</h3>
          {summary?.byRail?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={summary.byRail.map((r: { rail: string; _count: { _all: number }; _sum: { amount: number } }) => ({
                    name: railLabels[r.rail] || r.rail,
                    value: r._count._all,
                    amount: r._sum.amount,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {summary.byRail.map((_: unknown, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} txns`]} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Transaction Status</h3>
          {summary?.byStatus?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summary.byStatus.map((s: { status: string; _count: { _all: number } }) => ({ name: s.status.replace('_', '\n'), count: s._count._all }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Wallets */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Wallets</h3>
            <Link to="/wallets" className="text-blue-600 text-xs hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="space-y-3">
            {walletData?.wallets?.slice(0, 4).map((w: { id: string; name: string; type: string; balance: number; reservedBalance: number; currency: string }) => (
              <div key={w.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                    w.type === 'MPESA' ? 'bg-green-100 text-green-700' :
                    w.type === 'BANK' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  )}>
                    {w.type[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{w.name}</p>
                    <p className="text-xs text-gray-400">{w.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(w.balance, w.currency)}</p>
                  {w.reservedBalance > 0 && <p className="text-xs text-amber-600">-{formatCurrency(w.reservedBalance)} reserved</p>}
                </div>
              </div>
            ))}
            {(!walletData?.wallets || walletData.wallets.length === 0) && (
              <div className="text-center text-gray-400 text-sm py-8">
                <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>No wallets configured</p>
                <Link to="/wallets" className="text-blue-600 text-xs mt-1 block">Add wallet</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
          <Link to="/payments" className="text-blue-600 text-sm hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
        </div>
        <div className="divide-y divide-gray-50">
          {txData?.data?.map((tx: { id: string; reference: string; recipientName: string; rail: string; amount: number; currency: string; status: string; createdAt: string }) => (
            <Link key={tx.id} to={`/payments/${tx.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={cn('px-2 py-0.5 rounded-full text-xs font-medium', railColors[tx.rail] || 'bg-gray-100 text-gray-600')}>
                  {railLabels[tx.rail] || tx.rail}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{tx.recipientName}</p>
                  <p className="text-xs text-gray-400">{tx.reference} · {formatRelative(tx.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusColors[tx.status] || 'bg-gray-100')}>
                  {tx.status.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(tx.amount, tx.currency)}</span>
              </div>
            </Link>
          ))}
          {(!txData?.data || txData.data.length === 0) && (
            <div className="text-center py-12 text-gray-400">
              <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No transactions yet</p>
              <Link to="/payments/new" className="text-blue-600 text-sm mt-1 block hover:underline">Make your first payment</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, sub, icon, color, trend, loading }: {
  title: string; value: string; sub?: string; icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'amber' | 'gray'; trend?: number; loading?: boolean;
}) {
  const gradients = {
    blue:   'from-blue-500 to-indigo-600',
    green:  'from-emerald-500 to-green-600',
    purple: 'from-purple-500 to-violet-600',
    amber:  'from-amber-500 to-orange-500',
    gray:   'from-gray-400 to-gray-500',
  };
  const shadows = {
    blue:   'shadow-blue-200',
    green:  'shadow-emerald-200',
    purple: 'shadow-purple-200',
    amber:  'shadow-amber-200',
    gray:   'shadow-gray-200',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 card-hover shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg', gradients[color], shadows[color])}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={cn('flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full', trend >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500')}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      {loading ? (
        <div className="space-y-2"><div className="h-7 bg-gray-100 rounded-lg shimmer" /><div className="h-4 bg-gray-50 rounded shimmer w-3/4" /></div>
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{sub}</p>}
        </>
      )}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3">{title}</p>
    </div>
  );
}
