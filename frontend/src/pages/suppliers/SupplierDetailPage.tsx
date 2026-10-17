import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Store, ChevronLeft, Download, Filter, RefreshCw, Loader2,
  Phone, Mail, Building2, Hash, Edit2, Ban, CheckCircle, X,
  ArrowUpRight, FileText, Calendar, TrendingUp, Printer
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Dialog, DialogFooter } from '../../components/ui/dialog';
import { DateRangePicker } from '../../components/ui/DatePicker';
import { useToast } from '../../components/ui/toaster';
import { formatCurrency, formatDate, cn } from '../../lib/utils';

const STATUS_MAP: Record<string, any> = {
  COMPLETED: 'success', FAILED: 'destructive', PENDING: 'warning',
  PENDING_CHECKER: 'warning', PENDING_DIRECTOR: 'warning',
  CANCELLED: 'secondary', PROCESSING: 'default',
};

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'history' | 'statement' | 'details'>('history');
  const [filters, setFilters] = useState({
    status: '', dateFrom: null as Date | null, dateTo: null as Date | null,
    sort: 'createdAt_desc', page: 1, limit: 25,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [statementPeriod, setStatementPeriod] = useState({ from: null as Date | null, to: null as Date | null });

  const updateFilter = (key: string, value: any) => setFilters(prev => ({ ...prev, [key]: value, page: 1 }));

  const { data: supplier, isLoading: loadingSupplier } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => api.get(`/suppliers/${id}`).then(r => r.data.data),
    enabled: !!id,
  });

  const { data: txData, isLoading: loadingTx, isFetching } = useQuery({
    queryKey: ['supplier-payments', id, filters],
    queryFn: () => {
      const p = new URLSearchParams({ supplierId: id!, page: String(filters.page), limit: String(filters.limit) });
      if (filters.status) p.set('status', filters.status);
      if (filters.dateFrom) p.set('dateFrom', filters.dateFrom.toISOString());
      if (filters.dateTo) p.set('dateTo', filters.dateTo.toISOString());
      const [sortBy, sortDir] = filters.sort.split('_');
      p.set('sortBy', sortBy); p.set('sortDir', sortDir);
      return api.get(`/payments?${p}`).then(r => r.data);
    },
    enabled: !!id,
    keepPreviousData: true,
  });

  const payments: any[] = txData?.data ?? [];
  const pagination = txData?.pagination ?? { total: 0, pages: 1 };

  const exportCSV = () => {
    const rows = [
      ['Date', 'Reference', 'Description', 'Rail', 'Status', 'Amount', 'Fees'].join(','),
      ...payments.map(p => [
        formatDate(p.createdAt), p.reference, `"${p.description ?? ''}"`,
        p.rail, p.status, p.amount, p.fees ?? 0,
      ].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${supplier?.name ?? 'supplier'}-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const printStatement = () => {
    window.print();
  };

  if (loadingSupplier) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  if (!supplier) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Supplier not found</p>
        <Button className="mt-4" onClick={() => navigate('/suppliers')}>Back to Suppliers</Button>
      </div>
    );
  }

  const typeIcon: Record<string, string> = {
    MPESA_B2C: '📱', MPESA_PAYBILL: '🏦', MPESA_TILL: '🛒', BANK: '🏛️', RTGS: '💸',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/suppliers')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center text-2xl shadow">
            {typeIcon[supplier.type] ?? '💼'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{supplier.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{supplier.type?.replace('MPESA_', 'M-Pesa ').replace('_', ' ')}</Badge>
              <Badge variant={supplier.status === 'ACTIVE' ? 'success' : 'destructive'}>{supplier.status}</Badge>
              {supplier.category && <Badge variant="outline">{supplier.category}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={printStatement}>
            <Printer className="w-4 h-4" /> Statement
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => navigate(`/payments/new?supplierId=${id}`)}>
            <ArrowUpRight className="w-4 h-4" /> Pay Now
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Paid', value: formatCurrency(supplier.totalPaid ?? 0), color: 'text-indigo-600' },
          { label: 'This Month', value: formatCurrency(supplier.thisMonth ?? 0), color: 'text-green-600' },
          { label: 'Transactions', value: supplier.transactionCount ?? 0, color: 'text-slate-700 dark:text-slate-300' },
          { label: 'Last Payment', value: supplier.lastPaymentAt ? formatDate(supplier.lastPaymentAt) : 'Never', color: 'text-slate-600 dark:text-slate-400' },
          { label: 'Avg per Txn', value: formatCurrency(supplier.avgPayment ?? 0), color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{s.label}</p>
            <p className={`text-lg font-bold mt-1 ${s.color} truncate`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {[
          { key: 'history', label: 'Payment History' },
          { key: 'statement', label: 'Statement' },
          { key: 'details', label: 'Supplier Details' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Payment History Tab */}
      {activeTab === 'history' && (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Select
                value={filters.status}
                onChange={v => updateFilter('status', v)}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'FAILED', label: 'Failed' },
                  { value: 'PENDING_DIRECTOR', label: 'Pending Director' },
                  { value: 'PENDING_CHECKER', label: 'Pending Checker' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                ]}
                className="w-48"
              />
              <Select
                value={filters.sort}
                onChange={v => updateFilter('sort', v)}
                options={[
                  { value: 'createdAt_desc', label: 'Newest First' },
                  { value: 'createdAt_asc', label: 'Oldest First' },
                  { value: 'amount_desc', label: 'Highest Amount' },
                  { value: 'amount_asc', label: 'Lowest Amount' },
                ]}
                className="w-44"
              />
              <Button variant={showFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(v => !v)}>
                <Filter className="w-4 h-4" /> Date Filter
              </Button>
              <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries(['supplier-payments', id])}>
                <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
              </Button>
              <div className="ml-auto">
                <Select
                  value={String(filters.limit)}
                  onChange={v => updateFilter('limit', Number(v))}
                  options={[25, 50, 100].map(n => ({ value: String(n), label: `${n} per page` }))}
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
                  label="Payment Date Range"
                />
              </div>
            )}
          </div>

          {/* Payments Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {['Date', 'Reference', 'Description', 'Rail', 'Status', 'Amount', 'Fees', 'Approved By'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {loadingTx ? (
                    <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></td></tr>
                  ) : payments.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center">
                      <ArrowUpRight className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500">No payments to this supplier yet</p>
                      <Button className="mt-3" size="sm" onClick={() => navigate(`/payments/new?supplierId=${id}`)}>
                        Make First Payment
                      </Button>
                    </td></tr>
                  ) : payments.map((p: any) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/payments/${p.id}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(p.createdAt)}</p>
                        <p className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleTimeString()}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.reference}</td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{p.description ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{p.rail?.replace('MPESA_', 'M-Pesa ')}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_MAP[p.status] ?? 'secondary'}>{p.status?.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3 font-bold text-indigo-600 whitespace-nowrap">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {p.fees ? formatCurrency(p.fees) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {p.approvedBy ? `${p.approvedBy.firstName} ${p.approvedBy.lastName}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Totals footer */}
                {payments.length > 0 && (
                  <tfoot className="bg-slate-50 dark:bg-slate-900/50 border-t-2 border-slate-200 dark:border-slate-700">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                        Page Total
                      </td>
                      <td className="px-4 py-3 font-bold text-indigo-700 dark:text-indigo-400">
                        {formatCurrency(payments.reduce((s, p) => s + (p.status === 'COMPLETED' ? p.amount : 0), 0))}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-xs">
                        {formatCurrency(payments.reduce((s, p) => s + (p.fees ?? 0), 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500">
                  {((filters.page - 1) * filters.limit) + 1}–{Math.min(filters.page * filters.limit, pagination.total)} of {pagination.total} payments
                </p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => updateFilter('page', filters.page - 1)}>Prev</Button>
                  <span className="px-2 text-xs text-slate-500">Page {filters.page}/{pagination.pages}</span>
                  <Button size="sm" variant="outline" disabled={filters.page >= pagination.pages} onClick={() => updateFilter('page', filters.page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Statement Tab */}
      {activeTab === 'statement' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-6 print:shadow-none">
          {/* Statement Header */}
          <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 pb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Supplier Payment Statement</h2>
              <p className="text-sm text-slate-500 mt-1">Generated: {new Date().toLocaleDateString('en-KE', { dateStyle: 'full' })}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{supplier.name}</p>
              <p className="text-xs text-slate-400">{supplier.phone ?? supplier.accountNumber ?? '—'}</p>
              {supplier.kraPin && <p className="text-xs text-slate-400">KRA PIN: {supplier.kraPin}</p>}
            </div>
          </div>

          {/* Date Range for statement */}
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <DateRangePicker
                startDate={statementPeriod.from}
                endDate={statementPeriod.to}
                onChange={(s, e) => setStatementPeriod({ from: s, to: e })}
                label="Statement Period"
              />
            </div>
            <Button onClick={printStatement}>
              <Printer className="w-4 h-4" /> Print / Save PDF
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Disbursed', value: formatCurrency(supplier.totalPaid ?? 0) },
              { label: 'Total Transactions', value: supplier.transactionCount ?? 0 },
              { label: 'Success Rate', value: `${((supplier.successRate ?? 1) * 100).toFixed(0)}%` },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Statement note */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
            <p className="font-semibold">Statement Disclaimer</p>
            <p className="text-xs mt-0.5">This statement is system-generated. For official statements, please contact your finance team. All amounts in Kenyan Shillings (KES).</p>
          </div>
        </div>
      )}

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Contact Information</h3>
            <div className="space-y-3">
              {[
                { label: 'Email', value: supplier.email ?? '—', icon: Mail },
                { label: 'Phone', value: supplier.contactPhone ?? supplier.phone ?? '—', icon: Phone },
                { label: 'Contact Person', value: supplier.contactPerson ?? '—', icon: Building2 },
                { label: 'KRA PIN', value: supplier.kraPin ?? '—', icon: Hash },
                { label: 'Notes', value: supplier.notes ?? '—', icon: FileText },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-start gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Payment Details</h3>
            <div className="space-y-3">
              {[
                { label: 'Payment Type', value: supplier.type?.replace('MPESA_', 'M-Pesa ').replace('_', ' ') },
                { label: 'M-Pesa Phone', value: supplier.phone ?? '—' },
                { label: 'Paybill Number', value: supplier.paybillNumber ?? '—' },
                { label: 'Till Number', value: supplier.tillNumber ?? '—' },
                { label: 'Account Reference', value: supplier.accountRef ?? '—' },
                { label: 'Bank', value: supplier.bankCode ?? '—' },
                { label: 'Account Number', value: supplier.accountNumber ?? '—' },
                { label: 'Account Name', value: supplier.accountName ?? '—' },
                { label: 'Branch', value: supplier.branchName ?? '—' },
                { label: 'Added On', value: formatDate(supplier.createdAt) },
              ].filter(f => f.value !== '—').map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-right font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
