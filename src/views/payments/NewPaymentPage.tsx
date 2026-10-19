import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { paymentsApi, walletsApi, api } from '@/services/api';
import { extractApiError, formatCurrency, railLabels, cn } from '@/lib/utils';
import {
  Loader2, ArrowLeft, SendHorizonal, Info, AlertTriangle,
  Search, Store, X, CheckCircle, ChevronRight, Phone, Building2,
  Wallet, CreditCard, Landmark, Zap,
} from 'lucide-react';

const RAILS = [
  { value: 'MPESA_B2C',          label: 'M-Pesa B2C',    icon: Phone,    color: 'text-green-600',  bg: 'bg-green-50', border: 'border-green-300' },
  { value: 'MPESA_B2B_PAYBILL',  label: 'M-Pesa Paybill',icon: Landmark,  color: 'text-green-700',  bg: 'bg-green-50', border: 'border-green-300' },
  { value: 'MPESA_B2B_TILL',     label: 'M-Pesa Till',   icon: CreditCard,color: 'text-green-700',  bg: 'bg-green-50', border: 'border-green-300' },
  { value: 'PESALINK',           label: 'PesaLink',      icon: Landmark,  color: 'text-blue-600',   bg: 'bg-blue-50',  border: 'border-blue-300' },
  { value: 'RTGS',               label: 'RTGS / EFT',    icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50',border: 'border-purple-300' },
  { value: 'EQUITY_JENGA',       label: 'Equity Jenga',  icon: Zap,       color: 'text-red-600',    bg: 'bg-red-50',   border: 'border-red-300' },
  { value: 'KCB_OPEN_BANKING',   label: 'KCB Banking',   icon: Wallet,    color: 'text-orange-600', bg: 'bg-orange-50',border: 'border-orange-300' },
];

const RAIL_TYPE_MAP: Record<string, string> = {
  MPESA_B2C: 'MPESA_B2C', MPESA_B2B_PAYBILL: 'MPESA_PAYBILL', MPESA_B2B_TILL: 'MPESA_TILL',
  PESALINK: 'BANK', RTGS: 'RTGS', EQUITY_JENGA: 'BANK', KCB_OPEN_BANKING: 'BANK',
};

const schema = z.object({
  walletId: z.string().uuid('Select a wallet'),
  rail: z.enum(['MPESA_B2C','MPESA_B2B_PAYBILL','MPESA_B2B_TILL','PESALINK','RTGS','EQUITY_JENGA','KCB_OPEN_BANKING'] as const),
  amount: z.number({ invalid_type_error: 'Enter valid amount' }).positive().min(1),
  description: z.string().min(5, 'Minimum 5 characters').max(500),
  narration: z.string().max(200).optional(),
  recipientName: z.string().min(2, 'Required'),
  recipientPhone: z.string().optional(),
  recipientAccountNo: z.string().optional(),
  recipientBankCode: z.string().optional(),
  recipientBankName: z.string().optional(),
  recipientEmail: z.string().email().optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

/** Supplier search dropdown */
function SupplierPicker({ onSelect, currentRailType }: { onSelect: (s: any) => void; currentRailType: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers-pick', q],
    queryFn: () => api.get(`/suppliers?search=${encodeURIComponent(q)}&status=ACTIVE&limit=12`).then(r => r.data.data ?? []),
    enabled: open,
  });

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleSelect = (s: any) => {
    setSelected(s);
    setOpen(false);
    onSelect(s);
  };

  const typeIcon: Record<string, string> = { MPESA_B2C: '📱', MPESA_PAYBILL: '🏦', MPESA_TILL: '🛒', BANK: '🏛️', RTGS: '💸' };

  return (
    <div className="relative" ref={ref}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        Pay to Supplier <span className="text-gray-400 font-normal">(optional — auto-fills recipient)</span>
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search supplier name, phone, account..."
          value={selected ? selected.name : q}
          onFocus={() => { setOpen(true); if (selected) { setSelected(null); setQ(''); } }}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        />
        {selected && (
          <button type="button" onClick={() => { setSelected(null); setQ(''); }} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {selected && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-lg flex-shrink-0">
            {typeIcon[selected.type] ?? '💼'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-blue-900 text-sm truncate">{selected.name}</p>
            <p className="text-blue-600 text-xs">{selected.phone ?? selected.paybillNumber ?? selected.tillNumber ?? selected.accountNumber ?? ''} · {selected.type?.replace('_', ' ')}</p>
          </div>
          <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
        </div>
      )}

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          ) : !data?.length ? (
            <div className="py-8 text-center">
              <Store className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No suppliers found</p>
              <p className="text-xs text-gray-400 mt-0.5">Add suppliers via the Suppliers page</p>
            </div>
          ) : (
            data.map((s: any) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-0"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-base flex-shrink-0">
                  {typeIcon[s.type] ?? '💼'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.phone ?? s.paybillNumber ?? s.tillNumber ?? s.accountNumber ?? '—'} · {s.type?.replace(/_/g, ' ')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function NewPaymentPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ id: string; reference: string } | null>(null);

  const { data: walletData } = useQuery({ queryKey: ['wallets'], queryFn: () => walletsApi.list().then((r) => r.data.data) });
  const { data: orgData } = useQuery({ queryKey: ['org-me'], queryFn: async () => { const { orgsApi } = await import('@/services/api'); return orgsApi.me().then((r) => r.data.data); } });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rail: 'MPESA_B2C' },
  });

  const rail = watch('rail');
  const amount = watch('amount') || 0;
  const walletId = watch('walletId');

  const selectedWallet = walletData?.find((w: { id: string }) => w.id === walletId);
  const charges = rail === 'PESALINK' ? (amount <= 999 ? 35 : amount <= 9999 ? 55 : 75)
    : rail === 'RTGS' ? 450
    : ['EQUITY_JENGA', 'KCB_OPEN_BANKING'].includes(rail) ? 100 : 0;

  const isMpesa = rail.startsWith('MPESA');
  const isBank = ['PESALINK','RTGS','EQUITY_JENGA','KCB_OPEN_BANKING'].includes(rail);

  // Auto-fill recipient from selected supplier
  const handleSupplierSelect = (s: any) => {
    setValue('recipientName', s.accountName ?? s.name);
    setValue('recipientEmail', s.email ?? '');

    if (s.type === 'MPESA_B2C') {
      setValue('rail', 'MPESA_B2C');
      setValue('recipientPhone', s.phone ?? '');
    } else if (s.type === 'MPESA_PAYBILL') {
      setValue('rail', 'MPESA_B2B_PAYBILL');
      setValue('recipientAccountNo', s.paybillNumber ?? '');
    } else if (s.type === 'MPESA_TILL') {
      setValue('rail', 'MPESA_B2B_TILL');
      setValue('recipientAccountNo', s.tillNumber ?? '');
    } else if (s.type === 'BANK' || s.type === 'RTGS') {
      setValue('rail', s.type === 'RTGS' ? 'RTGS' : 'PESALINK');
      setValue('recipientAccountNo', s.accountNumber ?? '');
      setValue('recipientBankCode', s.bankCode ?? '');
      setValue('recipientBankName', s.bankName ?? '');
    }
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => paymentsApi.initiate({ ...data, amount: Number(data.amount) }),
    onSuccess: (res) => { const tx = res.data.data; setSuccess({ id: tx.id, reference: tx.reference }); },
    onError: (err: unknown) => setError(extractApiError(err)),
  });

  if (success) return (
    <div className="max-w-lg mx-auto text-center py-16 animate-fade-in">
      <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200">
        <CheckCircle className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Submitted!</h2>
      <p className="text-gray-500 mb-1">Reference: <span className="font-mono font-semibold text-blue-600">{success.reference}</span></p>
      <p className="text-gray-400 text-sm mb-8">Your payment is awaiting Checker → Director approval before disbursement.</p>
      <div className="flex gap-3 justify-center">
        <button onClick={() => navigate(`/payments/${success.id}`)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition">View Transaction</button>
        <button onClick={() => { setSuccess(null); setError(''); }} className="border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">New Payment</button>
        <button onClick={() => navigate('/payments')} className="text-gray-500 px-5 py-2.5 rounded-xl text-sm hover:bg-gray-100 transition">All Payments</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-gray-200 hover:bg-white hover:shadow-sm transition">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Payment</h1>
          <p className="text-gray-400 text-sm">Initiate a payment disbursement</p>
        </div>
      </div>

      {/* Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-blue-700 text-sm">This payment follows a <strong>Maker → Checker → Director</strong> approval workflow before funds are disbursed.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => { setError(''); mutation.mutate(d); })} className="space-y-5">

        {/* ── Supplier Picker ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Store className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Select Supplier</h2>
            <span className="ml-auto text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">Auto-fills details</span>
          </div>
          <SupplierPicker onSelect={handleSupplierSelect} currentRailType={RAIL_TYPE_MAP[rail] ?? ''} />
        </div>

        {/* ── Payment Rail ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-green-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Payment Rail</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {RAILS.filter((r) => !orgData?.allowedRails || orgData.allowedRails.includes(r.value)).map((r) => {
              const Icon = r.icon;
              const isSelected = rail === r.value;
              return (
                <button key={r.value} type="button"
                  onClick={() => setValue('rail', r.value as FormData['rail'])}
                  className={cn(
                    'p-3 rounded-xl border-2 text-xs font-semibold text-center transition-all flex flex-col items-center gap-1.5',
                    isSelected
                      ? `${r.border} ${r.bg} ${r.color} shadow-sm`
                      : 'border-gray-200 hover:border-gray-300 text-gray-500 hover:bg-gray-50'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isSelected ? r.color : 'text-gray-400')} />
                  {r.label}
                </button>
              );
            })}
          </div>
          {errors.rail && <p className="text-red-500 text-xs mt-2">{errors.rail.message}</p>}

          {/* Source Wallet */}
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Source Wallet *</label>
            <select {...register('walletId')} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="">Select wallet...</option>
              {walletData?.map((w: { id: string; name: string; balance: number; currency: string; reservedBalance: number }) => (
                <option key={w.id} value={w.id}>{w.name} — Available: {formatCurrency(w.balance - w.reservedBalance, w.currency)}</option>
              ))}
            </select>
            {errors.walletId && <p className="text-red-500 text-xs mt-1">{errors.walletId.message}</p>}
          </div>
        </div>

        {/* ── Recipient Details ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Recipient Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipient Name *</label>
              <input {...register('recipientName')} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Full name or business name" />
              {errors.recipientName && <p className="text-red-500 text-xs mt-1">{errors.recipientName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email (optional)</label>
              <input {...register('recipientEmail')} type="email" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="recipient@example.com" />
            </div>
          </div>

          {isMpesa && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {rail === 'MPESA_B2C' ? 'Phone Number *' : 'Paybill / Till Number *'}
              </label>
              <input {...register(rail === 'MPESA_B2C' ? 'recipientPhone' : 'recipientAccountNo')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={rail === 'MPESA_B2C' ? '0712345678 or +254712345678' : '174379'} />
            </div>
          )}

          {isBank && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Number *</label>
                <input {...register('recipientAccountNo')} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0170283431238" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank *</label>
                <select {...register('recipientBankCode')} onChange={(e) => {
                  const selected = e.target.options[e.target.selectedIndex];
                  setValue('recipientBankCode', e.target.value);
                  setValue('recipientBankName', selected.dataset.name || '');
                }} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="">Select bank...</option>
                  {Object.entries({
                    '49': 'Equity Bank Kenya', '11': 'Co-operative Bank', '01': 'KCB', '02': 'Standard Chartered',
                    '41': 'NCBA Bank', '57': 'I&M Bank', '63': 'Diamond Trust Bank', '70': 'Family Bank',
                    '31': 'Stanbic Bank', '07': 'National Bank', '03': 'ABSA Kenya', '14': 'Oriental Commercial',
                  }).map(([code, name]) => <option key={code} value={code} data-name={name}>{name}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ── Amount ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Payment Amount</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (KES) *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">KES</span>
              <input {...register('amount', { valueAsNumber: true })} type="number" min="1" step="0.01"
                className="w-full pl-14 pr-4 py-3 border border-gray-300 rounded-xl text-sm text-lg font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0.00" />
            </div>
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
          </div>

          {amount > 0 && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4 space-y-2 text-sm border border-gray-100">
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium">{formatCurrency(amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Transaction Charges</span><span className="font-medium text-amber-600">+ {formatCurrency(charges)}</span></div>
              <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-gray-900"><span>Total Debit</span><span className="text-blue-600">{formatCurrency(amount + charges)}</span></div>
              {selectedWallet && (amount + charges) > (selectedWallet.balance - selectedWallet.reservedBalance) && (
                <div className="flex items-center gap-1 text-red-600 text-xs pt-1">
                  <AlertTriangle className="w-3.5 h-3.5" />Insufficient funds in selected wallet
                </div>
              )}
            </div>
          )}

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description / Purpose *</label>
              <textarea {...register('description')} rows={3} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Purpose of this payment..." />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Narration (optional)</label>
              <input {...register('narration')} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Additional notes for the recipient..." />
            </div>
          </div>
        </div>

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-base shadow-lg shadow-blue-200 transition-all"
        >
          {mutation.isPending
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting Payment...</>
            : <><SendHorizonal className="w-5 h-5" /> Submit for Approval</>}
        </button>
      </form>
    </div>
  );
}
