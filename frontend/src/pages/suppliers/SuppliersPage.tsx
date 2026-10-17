import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Store, Plus, Search, Filter, Download, Eye, RefreshCw,
  Loader2, X, Phone, Mail, Building2, Hash, Wallet, TrendingUp,
  CreditCard, CheckCircle, AlertCircle, MoreHorizontal
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogFooter } from '../../components/ui/dialog';
import { Select, Input, Textarea } from '../../components/ui/select';
import { DateRangePicker } from '../../components/ui/DatePicker';
import { useToast } from '../../components/ui/toaster';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

const SUPPLIER_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'MPESA_B2C', label: 'M-Pesa B2C (Phone)' },
  { value: 'MPESA_PAYBILL', label: 'M-Pesa Paybill' },
  { value: 'MPESA_TILL', label: 'M-Pesa Buy Goods Till' },
  { value: 'BANK', label: 'Bank Account' },
  { value: 'RTGS', label: 'RTGS / EFT' },
];

const KENYAN_BANKS = [
  { value: 'KCB', label: 'KCB Bank Kenya' },
  { value: 'EQUITY', label: 'Equity Bank' },
  { value: 'COOP', label: 'Co-operative Bank' },
  { value: 'ABSA', label: 'Absa Bank Kenya' },
  { value: 'STANDARD_CHARTERED', label: 'Standard Chartered' },
  { value: 'STANBIC', label: 'Stanbic Bank' },
  { value: 'NCBA', label: 'NCBA Bank' },
  { value: 'DTB', label: 'Diamond Trust Bank' },
  { value: 'FAMILY', label: 'Family Bank' },
  { value: 'I&M', label: 'I&M Bank' },
  { value: 'EQUITY_JENGA', label: 'Equity Jenga API' },
  { value: 'KCB_OPENBANKING', label: 'KCB Open Banking' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'BLOCKED', label: 'Blocked' },
];

const typeIcon: Record<string, string> = {
  MPESA_B2C: '📱', MPESA_PAYBILL: '🏦', MPESA_TILL: '🛒', BANK: '🏛️', RTGS: '💸',
};

export default function SuppliersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    search: '', type: '', status: '',
    dateFrom: null as Date | null, dateTo: null as Date | null,
    sort: 'totalPaid_desc', page: 1, limit: 20,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'MPESA_B2C', phone: '', email: '', kraPin: '',
    bankCode: '', accountNumber: '', accountName: '', branchName: '',
    paybillNumber: '', tillNumber: '', accountRef: '',
    category: '', notes: '', contactPerson: '', contactPhone: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const updateFilter = (key: string, value: any) => setFilters(prev => ({ ...prev, [key]: value, page: 1 }));

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['suppliers', filters],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filters.search) p.set('search', filters.search);
      if (filters.type) p.set('type', filters.type);
      if (filters.status) p.set('status', filters.status);
      if (filters.dateFrom) p.set('dateFrom', filters.dateFrom.toISOString());
      if (filters.dateTo) p.set('dateTo', filters.dateTo.toISOString());
      const [sortBy, sortDir] = filters.sort.split('_');
      p.set('sortBy', sortBy); p.set('sortDir', sortDir === 'desc' ? 'desc' : 'asc');
      p.set('page', String(filters.page)); p.set('limit', String(filters.limit));
      return api.get(`/suppliers?${p}`).then(r => r.data);
    },
  });

  const suppliers: any[] = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, pages: 1 };

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/suppliers', body).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Supplier/Beneficiary Added' });
      qc.invalidateQueries(['suppliers']);
      setAddOpen(false);
      setForm({
        name: '', type: 'MPESA_B2C', phone: '', email: '', kraPin: '',
        bankCode: '', accountNumber: '', accountName: '', branchName: '',
        paybillNumber: '', tillNumber: '', accountRef: '',
        category: '', notes: '', contactPerson: '', contactPhone: '',
      });
    },
    onError: (e: any) => toast({ type: 'error', title: 'Failed to add supplier', description: e?.response?.data?.message }),
  });

  const exportCSV = () => {
    const rows = [
      ['Name', 'Type', 'Contact', 'Total Paid', 'Transactions', 'Last Payment', 'Status'].join(','),
      ...suppliers.map(s => [
        `"${s.name}"`, s.type, s.phone ?? s.accountNumber ?? '',
        s.totalPaid ?? 0, s.transactionCount ?? 0,
        s.lastPaymentAt ? formatDate(s.lastPaymentAt) : '—', s.status,
      ].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `suppliers-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.type === 'MPESA_B2C' && !form.phone) errs.phone = 'Phone number required';
    if (form.type === 'MPESA_PAYBILL' && !form.paybillNumber) errs.paybillNumber = 'Paybill number required';
    if (form.type === 'MPESA_TILL' && !form.tillNumber) errs.tillNumber = 'Till number required';
    if ((form.type === 'BANK' || form.type === 'RTGS') && !form.accountNumber) errs.accountNumber = 'Account number required';
    if ((form.type === 'BANK' || form.type === 'RTGS') && !form.bankCode) errs.bankCode = 'Bank is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const hasFilters = filters.search || filters.type || filters.status || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Store className="w-7 h-7 text-indigo-600" />
            Suppliers & Beneficiaries
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage payment recipients — track history, statements, and balances per supplier
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries(['suppliers'])}>
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" /> Add Supplier
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Suppliers', value: data?.stats?.total ?? '—', color: 'text-slate-700 dark:text-slate-300' },
          { label: 'Total Paid (All Time)', value: formatCurrency(data?.stats?.totalPaid ?? 0), color: 'text-indigo-600' },
          { label: 'This Month', value: formatCurrency(data?.stats?.thisMonth ?? 0), color: 'text-green-600' },
          { label: 'Active Suppliers', value: data?.stats?.active ?? '—', color: 'text-emerald-600' },
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
              placeholder="Search by name, phone, account, paybill..."
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {filters.search && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => updateFilter('search', '')}>
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
          <Select value={filters.type} onChange={v => updateFilter('type', v)} options={SUPPLIER_TYPE_OPTIONS} className="w-48" />
          <Select value={filters.status} onChange={v => updateFilter('status', v)} options={STATUS_OPTIONS} className="w-36" />
          <Select
            value={filters.sort}
            onChange={v => updateFilter('sort', v)}
            options={[
              { value: 'totalPaid_desc', label: 'Highest Paid' },
              { value: 'totalPaid_asc', label: 'Lowest Paid' },
              { value: 'name_asc', label: 'Name A-Z' },
              { value: 'lastPaymentAt_desc', label: 'Recent Activity' },
              { value: 'transactionCount_desc', label: 'Most Transactions' },
              { value: 'createdAt_desc', label: 'Newest Added' },
            ]}
            className="w-44"
          />
          <Button variant={showFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(v => !v)}>
            <Filter className="w-4 h-4" />
            {hasFilters && <span className="ml-1 w-2 h-2 rounded-full bg-red-500 inline-block" />}
          </Button>
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <DateRangePicker
                startDate={filters.dateFrom}
                endDate={filters.dateTo}
                onChange={(s, e) => { updateFilter('dateFrom', s); updateFilter('dateTo', e); }}
                label="Last Payment Date Range"
              />
            </div>
            <Select
              label="Per Page"
              value={String(filters.limit)}
              onChange={v => updateFilter('limit', Number(v))}
              options={[10, 20, 50, 100].map(n => ({ value: String(n), label: `${n} per page` }))}
              className="w-36"
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => setFilters({
                search: '', type: '', status: '', dateFrom: null, dateTo: null,
                sort: 'totalPaid_desc', page: 1, limit: 20,
              })}>
                <X className="w-4 h-4" /> Clear All
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Suppliers Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {[
                  'Supplier / Beneficiary', 'Payment Channel', 'Account / Phone',
                  'Total Paid', 'Transactions', 'Last Payment', 'Status', 'Actions'
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wide whitespace-nowrap">
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
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center">
                  <Store className="w-14 h-14 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No suppliers found</p>
                  <p className="text-slate-400 text-xs mt-1">Add a supplier to start tracking payment history</p>
                  <Button className="mt-4" size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="w-4 h-4" /> Add First Supplier
                  </Button>
                </td></tr>
              ) : suppliers.map((s: any) => (
                <tr
                  key={s.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/suppliers/${s.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center text-lg flex-shrink-0">
                        {typeIcon[s.type] ?? '💼'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</p>
                        <p className="text-xs text-slate-400">{s.category ?? s.type?.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {s.type?.replace('MPESA_', 'M-Pesa ').replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {s.phone ?? s.paybillNumber ?? s.tillNumber ?? s.accountNumber ?? '—'}
                    {s.accountRef && <span className="block text-slate-400">Ref: {s.accountRef}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-indigo-600">{formatCurrency(s.totalPaid ?? 0)}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                      {s.transactionCount ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {s.lastPaymentAt ? (
                      <>
                        <p className="font-medium">{formatDate(s.lastPaymentAt)}</p>
                        <p className="text-slate-400">{formatCurrency(s.lastPaymentAmount ?? 0)}</p>
                      </>
                    ) : <span className="text-slate-300">Never</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.status === 'ACTIVE' ? 'success' : s.status === 'BLOCKED' ? 'destructive' : 'secondary'}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); navigate(`/suppliers/${s.id}`); }}>
                        <Eye className="w-4 h-4" />
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
              {((filters.page - 1) * filters.limit) + 1}–{Math.min(filters.page * filters.limit, pagination.total)} of {pagination.total} suppliers
            </p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => updateFilter('page', filters.page - 1)}>Previous</Button>
              {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => i + 1).map(p => (
                <Button key={p} size="sm" variant={p === filters.page ? 'default' : 'ghost'} onClick={() => updateFilter('page', p)}>{p}</Button>
              ))}
              <Button size="sm" variant="outline" disabled={filters.page >= pagination.pages} onClick={() => updateFilter('page', filters.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      <Dialog
        open={addOpen}
        onClose={() => { setAddOpen(false); setFormErrors({}); }}
        title="Add Supplier / Beneficiary"
        description="Register a payment recipient to track their history and generate statements"
        size="xl"
      >
        <div className="space-y-5">
          {/* Basic Info */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Basic Information</p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Supplier / Beneficiary Name *"
                placeholder="e.g. Nairobi Supplies Ltd"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                error={formErrors.name}
              />
              <Select
                label="Category"
                value={form.category}
                onChange={v => setForm(f => ({ ...f, category: v }))}
                options={[
                  { value: '', label: 'Select category...' },
                  { value: 'SUPPLIER', label: 'Supplier' },
                  { value: 'CONTRACTOR', label: 'Contractor' },
                  { value: 'EMPLOYEE', label: 'Employee' },
                  { value: 'UTILITY', label: 'Utility Provider' },
                  { value: 'GOVERNMENT', label: 'Government / KRA' },
                  { value: 'CUSTOMER', label: 'Customer Refund' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Input
                label="KRA PIN"
                placeholder="e.g. A123456789B"
                value={form.kraPin}
                onChange={e => setForm(f => ({ ...f, kraPin: e.target.value.toUpperCase() }))}
              />
              <Input
                label="Contact Person"
                placeholder="e.g. Jane Njoroge"
                value={form.contactPerson}
                onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Input
                label="Email"
                type="email"
                placeholder="supplier@example.co.ke"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Contact Phone"
                type="tel"
                placeholder="+254..."
                value={form.contactPhone}
                onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
              />
            </div>
          </div>

          {/* Payment Channel */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Payment Channel</p>
            <Select
              label="Payment Type *"
              value={form.type}
              onChange={v => setForm(f => ({ ...f, type: v }))}
              options={SUPPLIER_TYPE_OPTIONS.slice(1).map(o => ({
                value: o.value, label: o.label,
                description: {
                  MPESA_B2C: 'Direct to personal M-Pesa wallet',
                  MPESA_PAYBILL: 'Pay via M-Pesa Paybill number',
                  MPESA_TILL: 'Pay via M-Pesa Buy Goods Till',
                  BANK: 'PesaLink / EFT bank transfer',
                  RTGS: 'Large-value RTGS transfer',
                }[o.value] ?? '',
              }))}
            />

            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
              {/* M-Pesa B2C */}
              {form.type === 'MPESA_B2C' && (
                <Input
                  label="M-Pesa Phone Number *"
                  type="tel"
                  placeholder="e.g. 0712345678 or +254712345678"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  error={formErrors.phone}
                  hint="Safaricom registered number only"
                />
              )}

              {/* M-Pesa Paybill */}
              {form.type === 'MPESA_PAYBILL' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Paybill Number *"
                    placeholder="e.g. 522522"
                    value={form.paybillNumber}
                    onChange={e => setForm(f => ({ ...f, paybillNumber: e.target.value }))}
                    error={formErrors.paybillNumber}
                  />
                  <Input
                    label="Account Reference"
                    placeholder="e.g. INV-001 or your account"
                    value={form.accountRef}
                    onChange={e => setForm(f => ({ ...f, accountRef: e.target.value }))}
                  />
                </div>
              )}

              {/* M-Pesa Till */}
              {form.type === 'MPESA_TILL' && (
                <Input
                  label="Buy Goods Till Number *"
                  placeholder="e.g. 123456"
                  value={form.tillNumber}
                  onChange={e => setForm(f => ({ ...f, tillNumber: e.target.value }))}
                  error={formErrors.tillNumber}
                />
              )}

              {/* Bank / RTGS */}
              {(form.type === 'BANK' || form.type === 'RTGS') && (
                <div className="space-y-4">
                  <Select
                    label="Bank *"
                    value={form.bankCode}
                    onChange={v => setForm(f => ({ ...f, bankCode: v }))}
                    options={KENYAN_BANKS}
                    placeholder="Select Bank..."
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Account Number *"
                      placeholder="Enter account number"
                      value={form.accountNumber}
                      onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                      error={formErrors.accountNumber}
                    />
                    <Input
                      label="Account Name *"
                      placeholder="As on bank records"
                      value={form.accountName}
                      onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))}
                    />
                  </div>
                  <Input
                    label="Branch"
                    placeholder="e.g. Nairobi CBD"
                    value={form.branchName}
                    onChange={e => setForm(f => ({ ...f, branchName: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>

          <Textarea
            label="Notes (optional)"
            placeholder="Any notes about this supplier..."
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setAddOpen(false); setFormErrors({}); }}>Cancel</Button>
          <Button onClick={() => { if (validateForm()) createMutation.mutate(form); }} loading={createMutation.isLoading}>
            <Plus className="w-4 h-4" /> Add Supplier
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
