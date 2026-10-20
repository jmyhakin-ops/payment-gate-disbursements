import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Store, Plus, Search, Filter, Download, Eye, RefreshCw, Loader2, X,
  Phone, Mail, Building2, Hash, TrendingUp, CreditCard, CheckCircle,
  AlertCircle, MoreHorizontal, Pencil, Trash2, Send, Users, Wallet,
  ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Copy,
  Banknote, Smartphone, ShoppingCart, CircleDollarSign, LayoutGrid,
  LayoutList, BadgeCheck, Ban, Clock, Star
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogFooter, ConfirmDialog } from '../../components/ui/dialog';
import { Select, Input, Textarea } from '../../components/ui/select';
import { useToast } from '../../components/ui/toaster';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

// ─── Constants ─────────────────────────────────────────────────────────────────
const SUPPLIER_TYPES = [
  { value: 'MPESA_B2C',    label: 'M-Pesa B2C (Phone)',   icon: Smartphone,        color: 'text-green-600 bg-green-50 border-green-200' },
  { value: 'MPESA_PAYBILL',label: 'M-Pesa Paybill',       icon: Building2,         color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { value: 'MPESA_TILL',   label: 'Buy Goods Till',        icon: ShoppingCart,      color: 'text-teal-600 bg-teal-50 border-teal-200' },
  { value: 'BANK',         label: 'Bank Transfer',         icon: Banknote,          color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'RTGS',         label: 'RTGS / EFT',            icon: CircleDollarSign,  color: 'text-purple-600 bg-purple-50 border-purple-200' },
];

const CATEGORIES = ['Supplier','Employee','Contractor','Vendor','Consultant','Partner','Individual'];

const KENYAN_BANKS = [
  { value: 'KCB',              label: 'KCB Bank Kenya' },
  { value: 'EQUITY',           label: 'Equity Bank' },
  { value: 'COOP',             label: 'Co-operative Bank' },
  { value: 'ABSA',             label: 'Absa Bank Kenya' },
  { value: 'STANDARD_CHARTERED',label: 'Standard Chartered' },
  { value: 'STANBIC',          label: 'Stanbic Bank' },
  { value: 'NCBA',             label: 'NCBA Bank' },
  { value: 'DTB',              label: 'Diamond Trust Bank' },
  { value: 'FAMILY',           label: 'Family Bank' },
  { value: 'IM',               label: 'I&M Bank' },
  { value: 'PRIME',            label: 'Prime Bank' },
  { value: 'SIDIAN',           label: 'Sidian Bank' },
];

const STATUS_OPTS = [
  { value: '',         label: 'All Statuses' },
  { value: 'ACTIVE',   label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'BLOCKED',  label: 'Blocked' },
];

const SORT_OPTS = [
  { value: 'totalPaid_desc',        label: 'Highest Paid First' },
  { value: 'totalPaid_asc',         label: 'Lowest Paid First' },
  { value: 'createdAt_desc',        label: 'Newest First' },
  { value: 'createdAt_asc',         label: 'Oldest First' },
  { value: 'name_asc',              label: 'Name A–Z' },
  { value: 'transactionCount_desc', label: 'Most Transactions' },
];

const emptyForm = {
  name: '', type: 'MPESA_B2C', phone: '', email: '', kraPin: '',
  bankCode: '', accountNumber: '', accountName: '', branchName: '',
  paybillNumber: '', tillNumber: '', accountRef: '',
  category: 'Supplier', notes: '', contactPerson: '', contactPhone: '',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function avatarColor(name: string) {
  const colors = ['from-indigo-500 to-purple-600','from-green-500 to-emerald-600','from-blue-500 to-cyan-600','from-rose-500 to-pink-600','from-amber-500 to-orange-600','from-teal-500 to-green-600'];
  return colors[name.charCodeAt(0) % colors.length];
}
function typeInfo(type: string) {
  return SUPPLIER_TYPES.find(t => t.value === type) || SUPPLIER_TYPES[0];
}
function formatPhone(p: string) {
  if (!p) return '—';
  const clean = p.replace(/\D/g, '');
  if (clean.startsWith('254') && clean.length === 12) return `+${clean}`;
  if (clean.startsWith('0') && clean.length === 10) return `+254${clean.slice(1)}`;
  return p;
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, gradient, trend }: any) {
  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity bg-gradient-to-br ${gradient}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={cn('flex items-center gap-1 mt-3 text-xs font-medium', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
          {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  );
}

// ─── Supplier Form ──────────────────────────────────────────────────────────────
function SupplierForm({ form, setForm, errors }: { form: any; setForm: any; errors: any }) {
  const sf = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const ti = typeInfo(form.type);
  const TIcon = ti.icon;

  return (
    <div className="space-y-5">
      {/* Basic Info */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Basic Information</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Supplier / Beneficiary Name *" value={form.name} onChange={e => sf('name', e.target.value)} error={errors.name} placeholder="e.g. John Kamau or ACME Ltd" />
          </div>
          <Select label="Category" value={form.category} onChange={v => sf('category', v)}
            options={CATEGORIES.map(c => ({ value: c, label: c }))} />
          <Input label="KRA PIN" value={form.kraPin} onChange={e => sf('kraPin', e.target.value)} placeholder="e.g. A123456789B" />
          <Input label="Contact Person" value={form.contactPerson} onChange={e => sf('contactPerson', e.target.value)} placeholder="Full name" />
          <Input label="Contact Phone" value={form.contactPhone} onChange={e => sf('contactPhone', e.target.value)} placeholder="+254..." />
          <div className="col-span-2">
            <Input label="Email" type="email" value={form.email} onChange={e => sf('email', e.target.value)} placeholder="supplier@example.co.ke" />
          </div>
        </div>
      </div>

      {/* Payment Channel */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Payment Channel</p>
        <Select label="Payment Type *" value={form.type} onChange={v => sf('type', v)}
          options={SUPPLIER_TYPES.map(t => ({ value: t.value, label: t.label }))} />

        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <TIcon className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-500">{ti.label} Details</span>
          </div>

          {form.type === 'MPESA_B2C' && (
            <Input label="M-Pesa Phone Number *" type="tel" value={form.phone} onChange={e => sf('phone', e.target.value)}
              error={errors.phone} placeholder="e.g. 0712 345 678" hint="Safaricom registered number only" />
          )}

          {form.type === 'MPESA_PAYBILL' && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Paybill Number *" value={form.paybillNumber} onChange={e => sf('paybillNumber', e.target.value)} error={errors.paybillNumber} placeholder="e.g. 522522" />
              <Input label="Account Reference" value={form.accountRef} onChange={e => sf('accountRef', e.target.value)} placeholder="e.g. INV-001" />
            </div>
          )}

          {form.type === 'MPESA_TILL' && (
            <Input label="Buy Goods Till Number *" value={form.tillNumber} onChange={e => sf('tillNumber', e.target.value)} error={errors.tillNumber} placeholder="e.g. 123456" />
          )}

          {(form.type === 'BANK' || form.type === 'RTGS') && (
            <div className="space-y-3">
              <Select label="Bank *" value={form.bankCode} onChange={v => sf('bankCode', v)} options={KENYAN_BANKS} placeholder="Select Bank..." />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Account Number *" value={form.accountNumber} onChange={e => sf('accountNumber', e.target.value)} error={errors.accountNumber} placeholder="Account number" />
                <Input label="Account Name *" value={form.accountName} onChange={e => sf('accountName', e.target.value)} placeholder="As on bank records" />
              </div>
              <Input label="Branch" value={form.branchName} onChange={e => sf('branchName', e.target.value)} placeholder="e.g. Nairobi CBD" />
            </div>
          )}
        </div>
      </div>

      <Textarea label="Notes (optional)" value={form.notes} onChange={e => sf('notes', e.target.value)} rows={2} placeholder="Any additional notes..." />
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({ search: '', type: '', status: '', sort: 'totalPaid_desc', page: 1, limit: 20 });
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [addOpen, setAddOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const uf = (k: string, v: any) => setFilters(p => ({ ...p, [k]: v, page: 1 }));

  // ── Queries ──
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['suppliers', filters],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filters.search) p.set('search', filters.search);
      if (filters.type)   p.set('type', filters.type);
      if (filters.status) p.set('status', filters.status);
      const [sortBy, sortDir] = filters.sort.split('_');
      p.set('sortBy', sortBy === 'totalPaid' ? 'totalPaid' : sortBy);
      p.set('sortDir', sortDir === 'desc' ? 'desc' : 'asc');
      p.set('page', String(filters.page));
      p.set('limit', String(filters.limit));
      return api.get(`/suppliers?${p}`).then(r => r.data);
    },
  });

  const suppliers: any[] = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, pages: 1 };

  // Stats computed from list
  const stats = useMemo(() => ({
    total: pagination.total || suppliers.length,
    totalPaid: suppliers.reduce((s: number, x: any) => s + Number(x.totalPaid || 0), 0),
    active: suppliers.filter((s: any) => s.status === 'ACTIVE').length,
    txCount: suppliers.reduce((s: number, x: any) => s + Number(x.transactionCount || 0), 0),
  }), [suppliers, pagination]);

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/suppliers', body).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: '✅ Supplier Added', description: 'Supplier registered successfully' });
      qc.invalidateQueries(['suppliers']);
      setAddOpen(false);
      setForm(emptyForm);
      setFormErrors({});
    },
    onError: (e: any) => toast({ type: 'error', title: 'Failed', description: e?.response?.data?.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.put(`/suppliers/${id}`, body).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: '✅ Supplier Updated' });
      qc.invalidateQueries(['suppliers']);
      setEditSupplier(null);
      setEditErrors({});
    },
    onError: (e: any) => toast({ type: 'error', title: 'Update Failed', description: e?.response?.data?.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/suppliers/${id}`).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: '🗑️ Supplier Deleted' });
      qc.invalidateQueries(['suppliers']);
      setDeleteId(null);
    },
    onError: (e: any) => toast({ type: 'error', title: 'Delete Failed', description: e?.response?.data?.message }),
  });

  // ── Validation ──
  function validate(f: any, setErr: any) {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Name is required';
    if (f.type === 'MPESA_B2C' && !f.phone) e.phone = 'Phone is required';
    if (f.type === 'MPESA_PAYBILL' && !f.paybillNumber) e.paybillNumber = 'Paybill number is required';
    if (f.type === 'MPESA_TILL' && !f.tillNumber) e.tillNumber = 'Till number is required';
    if ((f.type === 'BANK' || f.type === 'RTGS') && !f.accountNumber) e.accountNumber = 'Account number is required';
    setErr(e);
    return Object.keys(e).length === 0;
  }

  // ── Open Edit ──
  function openEdit(s: any) {
    setEditForm({
      name: s.name || '', type: s.type || 'MPESA_B2C', phone: s.phone || '',
      email: s.email || '', kraPin: s.kraPin || '', bankCode: s.bankCode || '',
      accountNumber: s.accountNumber || '', accountName: s.accountName || '',
      branchName: s.branchName || '', paybillNumber: s.paybillNumber || '',
      tillNumber: s.tillNumber || '', accountRef: s.accountRef || '',
      category: s.category || 'Supplier', notes: s.notes || '',
      contactPerson: s.contactPerson || '', contactPhone: s.contactPhone || '',
    });
    setEditSupplier(s);
    setEditErrors({});
  }

  // ── Copy ──
  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedRef(label);
    toast({ type: 'success', title: `Copied: ${text}` });
    setTimeout(() => setCopiedRef(null), 2000);
  }

  // ── Export CSV ──
  function exportCSV() {
    const rows = [
      ['Name', 'Type', 'Category', 'Phone', 'Email', 'Status', 'Total Paid (KES)', 'Transactions', 'Last Payment'],
      ...suppliers.map((s: any) => [
        s.name, s.type, s.category || '', formatPhone(s.phone || ''), s.email || '',
        s.status, s.totalPaid || 0, s.transactionCount || 0,
        s.lastPaymentAt ? formatDate(s.lastPaymentAt) : '',
      ]),
    ];
    const csv = rows.map(r => r.map((c: any) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'suppliers.csv'; a.click();
    URL.revokeObjectURL(url);
    toast({ type: 'success', title: 'CSV Exported' });
  }

  // ── Status badge ──
  function StatusBadge({ status }: { status: string }) {
    const map: Record<string, any> = {
      ACTIVE:   { label: 'Active',   icon: BadgeCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      INACTIVE: { label: 'Inactive', icon: Clock,      cls: 'bg-slate-50 text-slate-600 border-slate-200' },
      BLOCKED:  { label: 'Blocked',  icon: Ban,        cls: 'bg-red-50 text-red-700 border-red-200' },
    };
    const cfg = map[status] || map.INACTIVE;
    const Icon = cfg.icon;
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', cfg.cls)}>
        <Icon className="w-3 h-3" />{cfg.label}
      </span>
    );
  }

  // ── Type badge ──
  function TypeBadge({ type }: { type: string }) {
    const t = typeInfo(type);
    const TI = t.icon;
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border', t.color)}>
        <TI className="w-3 h-3" />{t.label}
      </span>
    );
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ── Header ── */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 py-8 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <Store className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Suppliers & Beneficiaries</h1>
                  <p className="text-indigo-200 text-sm">Manage all payment recipients in one place</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={exportCSV} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                <Download className="w-4 h-4" /> Export CSV
              </Button>
              <Button onClick={() => setAddOpen(true)} className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold shadow-lg">
                <Plus className="w-4 h-4" /> Add Supplier
              </Button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[
              { label: 'Total Suppliers', value: pagination.total || suppliers.length, icon: Users, sub: 'All registered', col: 'text-indigo-200' },
              { label: 'Total Paid Out', value: `KES ${(stats.totalPaid / 1000).toFixed(0)}K`, icon: Wallet, sub: 'All time', col: 'text-purple-200' },
              { label: 'Active', value: stats.active, icon: CheckCircle, sub: 'On this page', col: 'text-emerald-200' },
              { label: 'Total Transactions', value: stats.txCount, icon: TrendingUp, sub: 'Payments made', col: 'text-blue-200' },
            ].map(({ label, value, icon: Icon, sub, col }) => (
              <div key={label} className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={cn('w-5 h-5', col)} />
                  <span className="text-xs text-white/60">{sub}</span>
                </div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-indigo-200 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Search name, phone, email..."
              value={filters.search}
              onChange={e => uf('search', e.target.value)}
            />
          </div>
          <div className="w-44">
            <Select value={filters.type} onChange={v => uf('type', v)}
              options={[{ value: '', label: 'All Types' }, ...SUPPLIER_TYPES.map(t => ({ value: t.value, label: t.label }))]} />
          </div>
          <div className="w-36">
            <Select value={filters.status} onChange={v => uf('status', v)} options={STATUS_OPTS} />
          </div>
          <div className="w-52">
            <Select value={filters.sort} onChange={v => uf('sort', v)} options={SORT_OPTS} />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setViewMode('table')} className={cn('p-2 rounded-lg border transition', viewMode === 'table' ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'border-slate-200 text-slate-400 hover:text-slate-600')}>
              <LayoutList className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('grid')} className={cn('p-2 rounded-lg border transition', viewMode === 'grid' ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'border-slate-200 text-slate-400 hover:text-slate-600')}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => refetch()} className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 transition">
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="w-10 h-10 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No suppliers found</h3>
            <p className="text-slate-500 mb-6">Add your first supplier or beneficiary to get started</p>
            <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> Add First Supplier</Button>
          </div>
        ) : viewMode === 'table' ? (
          /* ── TABLE VIEW ── */
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier</th>
                    <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Type</th>
                    <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                    <th className="text-right py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total Paid</th>
                    <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Last Payment</th>
                    <th className="text-center py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-center py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {suppliers.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold flex-shrink-0', avatarColor(s.name))}>
                            {getInitials(s.name)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{s.name}</p>
                            {s.category && <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{s.category}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4"><TypeBadge type={s.type} /></td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          {s.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer hover:text-indigo-600 group/copy" onClick={() => copyText(s.phone, s.id + 'phone')}>
                              <Phone className="w-3 h-3" />{formatPhone(s.phone)}
                              <Copy className="w-3 h-3 opacity-0 group-hover/copy:opacity-100 transition" />
                            </div>
                          )}
                          {s.email && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Mail className="w-3 h-3" />{s.email}
                            </div>
                          )}
                          {s.paybillNumber && <div className="flex items-center gap-1.5 text-xs text-slate-500"><Hash className="w-3 h-3" />{s.paybillNumber}{s.accountRef && ` / ${s.accountRef}`}</div>}
                          {s.tillNumber && <div className="flex items-center gap-1.5 text-xs text-slate-500"><Hash className="w-3 h-3" />Till: {s.tillNumber}</div>}
                          {s.accountNumber && <div className="flex items-center gap-1.5 text-xs text-slate-500"><Building2 className="w-3 h-3" />{s.bankCode} · {s.accountNumber}</div>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">KES {Number(s.totalPaid || 0).toLocaleString()}</p>
                        <p className="text-xs text-slate-400">{s.transactionCount || 0} txns</p>
                      </td>
                      <td className="py-3.5 px-4">
                        {s.lastPaymentAt ? (
                          <>
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{formatDate(s.lastPaymentAt)}</p>
                            {s.lastPaymentAmount && <p className="text-xs text-slate-400">KES {Number(s.lastPaymentAmount).toLocaleString()}</p>}
                          </>
                        ) : <span className="text-xs text-slate-400">No payments yet</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center"><StatusBadge status={s.status} /></td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(s)} title="Edit"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-500 transition">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => navigate(`/payments?supplier=${s.id}`)} title="Pay Now"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-500 transition">
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteId(s.id)} title="Delete"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-100 hover:text-red-700 text-slate-500 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <p className="text-xs text-slate-500">
                Showing {(filters.page - 1) * filters.limit + 1}–{Math.min(filters.page * filters.limit, pagination.total)} of <strong>{pagination.total}</strong> suppliers
              </p>
              <div className="flex items-center gap-2">
                <button disabled={filters.page <= 1} onClick={() => uf('page', filters.page - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-slate-700 px-2">Page {filters.page} of {pagination.pages || 1}</span>
                <button disabled={filters.page >= (pagination.pages || 1)} onClick={() => uf('page', filters.page + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── GRID VIEW ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {suppliers.map((s: any) => (
              <div key={s.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn('w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold', avatarColor(s.name))}>
                    {getInitials(s.name)}
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{s.name}</h3>
                {s.category && <p className="text-xs text-slate-400 mb-2">{s.category}</p>}
                <TypeBadge type={s.type} />
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Total Paid</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">KES {Number(s.totalPaid || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Transactions</span>
                    <span className="font-medium text-slate-600">{s.transactionCount || 0}</span>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(s)} className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition flex items-center justify-center gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => navigate(`/payments?supplier=${s.id}`)} className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition flex items-center justify-center gap-1">
                    <Send className="w-3 h-3" /> Pay
                  </button>
                  <button onClick={() => setDeleteId(s.id)} className="py-1.5 px-2 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Dialog ── */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setFormErrors({}); }} title="Add Supplier / Beneficiary"
        description="Register a payment recipient to track their history and generate statements" size="lg">
        <SupplierForm form={form} setForm={setForm} errors={formErrors} />
        <DialogFooter>
          <Button variant="outline" onClick={() => { setAddOpen(false); setFormErrors({}); }}>Cancel</Button>
          <Button onClick={() => { if (validate(form, setFormErrors)) createMutation.mutate(form); }} loading={createMutation.isLoading}>
            <Plus className="w-4 h-4" /> Add Supplier
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editSupplier} onClose={() => { setEditSupplier(null); setEditErrors({}); }}
        title={`Edit — ${editSupplier?.name || ''}`} description="Update supplier information" size="lg">
        <SupplierForm form={editForm} setForm={setEditForm} errors={editErrors} />
        <DialogFooter>
          <Button variant="outline" onClick={() => { setEditSupplier(null); setEditErrors({}); }}>Cancel</Button>
          <Button onClick={() => { if (validate(editForm, setEditErrors)) updateMutation.mutate({ id: editSupplier.id, body: editForm }); }} loading={updateMutation.isLoading}>
            <Pencil className="w-4 h-4" /> Save Changes
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Supplier" description={`Remove this supplier permanently? All payment history will be retained for records.`}
        confirmLabel="Delete Supplier" loading={deleteMutation.isLoading} />
    </div>
  );
}
