import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { paymentsApi, walletsApi, settingsApi } from '@/services/api';
import { KENYAN_BANKS_LIST, extractApiError, formatCurrency, railLabels } from '@/lib/utils';
import { Loader2, ArrowLeft, SendHorizonal, Info, AlertTriangle } from 'lucide-react';

const RAILS = ['MPESA_B2C','MPESA_B2B_PAYBILL','MPESA_B2B_TILL','PESALINK','RTGS','EQUITY_JENGA','KCB_OPEN_BANKING'];

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

export default function NewPaymentPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ id: string; reference: string } | null>(null);

  const { data: walletData } = useQuery({ queryKey: ['wallets'], queryFn: () => walletsApi.list().then((r) => r.data.data) });
  const { data: orgData } = useQuery({ queryKey: ['org-me'], queryFn: async () => { const { orgsApi } = await import('@/services/api'); return orgsApi.me().then((r) => r.data.data); } });

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rail: 'MPESA_B2C' },
  });

  const rail = watch('rail');
  const amount = watch('amount') || 0;
  const walletId = watch('walletId');

  const selectedWallet = walletData?.find((w: { id: string }) => w.id === walletId);
  const charges = rail === 'PESALINK' ? (amount <= 999 ? 35 : amount <= 9999 ? 55 : 75) : rail === 'RTGS' ? 450 : [  'EQUITY_JENGA','KCB_OPEN_BANKING'].includes(rail) ? 100 : 0;

  const mutation = useMutation({
    mutationFn: (data: FormData) => paymentsApi.initiate({ ...data, amount: Number(data.amount) }),
    onSuccess: (res) => {
      const tx = res.data.data;
      setSuccess({ id: tx.id, reference: tx.reference });
    },
    onError: (err: unknown) => setError(extractApiError(err)),
  });

  if (success) return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <SendHorizonal className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Submitted!</h2>
      <p className="text-gray-500 mb-1">Reference: <span className="font-mono font-semibold text-blue-600">{success.reference}</span></p>
      <p className="text-gray-400 text-sm mb-8">Your payment has been submitted and is awaiting approval.</p>
      <div className="flex gap-3 justify-center">
        <button onClick={() => navigate(`/payments/${success.id}`)} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium">View Transaction</button>
        <button onClick={() => { setSuccess(null); setError(''); }} className="border border-gray-200 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">New Payment</button>
        <button onClick={() => navigate('/payments')} className="text-gray-500 px-5 py-2.5 rounded-lg text-sm hover:bg-gray-50">All Payments</button>
      </div>
    </div>
  );

  const isMpesa = rail.startsWith('MPESA');
  const isBank = ['PESALINK','RTGS','EQUITY_JENGA','KCB_OPEN_BANKING'].includes(rail);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"><ArrowLeft className="w-4 h-4 text-gray-500" /></button>
        <div><h1 className="text-2xl font-bold text-gray-900">New Payment</h1><p className="text-gray-500 text-sm">Initiate a payment disbursement</p></div>
      </div>

      {/* Maker-checker notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-blue-700 text-sm">This payment will go through <strong>Maker → Checker → Director</strong> approval before funds are disbursed. Ensure all details are correct.</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}

      <form onSubmit={handleSubmit((d) => { setError(''); mutation.mutate(d); })} className="space-y-6">
        {/* Section 1: Payment Method */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 pb-2 border-b border-gray-100">Payment Method</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Rail *</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {RAILS.filter((r) => !orgData?.allowedRails || orgData.allowedRails.includes(r)).map((r) => (
                <button key={r} type="button" onClick={() => setValue('rail', r as FormData['rail'])}
                  className={`p-3 rounded-lg border-2 text-xs font-medium text-center transition-all ${rail === r ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
                  {railLabels[r]}
                </button>
              ))}
            </div>
            {errors.rail && <p className="text-red-500 text-xs mt-1">{errors.rail.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Source Wallet *</label>
            <select {...register('walletId')} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="">Select wallet</option>
              {walletData?.map((w: { id: string; name: string; balance: number; currency: string; reservedBalance: number }) => (
                <option key={w.id} value={w.id}>{w.name} — Available: {formatCurrency(w.balance - w.reservedBalance, w.currency)}</option>
              ))}
            </select>
            {errors.walletId && <p className="text-red-500 text-xs mt-1">{errors.walletId.message}</p>}
          </div>
        </div>

        {/* Section 2: Recipient */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 pb-2 border-b border-gray-100">Recipient Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipient Name *</label>
              <input {...register('recipientName')} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Full name or business name" />
              {errors.recipientName && <p className="text-red-500 text-xs mt-1">{errors.recipientName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email (optional)</label>
              <input {...register('recipientEmail')} type="email" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="recipient@example.com" />
            </div>
          </div>

          {isMpesa && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {rail === 'MPESA_B2C' ? 'Phone Number *' : 'Paybill / Till Number *'}
              </label>
              <input {...register(rail === 'MPESA_B2C' ? 'recipientPhone' : 'recipientAccountNo')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={rail === 'MPESA_B2C' ? '0712345678 or +254712345678' : '174379'} />
            </div>
          )}

          {isBank && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Number *</label>
                <input {...register('recipientAccountNo')} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0170283431238" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank *</label>
                <select {...register('recipientBankCode')} onChange={(e) => {
                  const selected = e.target.options[e.target.selectedIndex];
                  setValue('recipientBankCode', e.target.value);
                  setValue('recipientBankName', selected.dataset.name || '');
                }} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="">Select bank</option>
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

        {/* Section 3: Amount */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 pb-2 border-b border-gray-100">Payment Amount</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (KES) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">KES</span>
              <input {...register('amount', { valueAsNumber: true })} type="number" min="1" step="0.01" className="w-full pl-14 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
            </div>
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
          </div>

          {amount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium">{formatCurrency(amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Charges</span><span className="font-medium text-amber-600">+ {formatCurrency(charges)}</span></div>
              <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold text-gray-900"><span>Total Debit</span><span>{formatCurrency(amount + charges)}</span></div>
              {selectedWallet && (amount + charges) > (selectedWallet.balance - selectedWallet.reservedBalance) && (
                <div className="flex items-center gap-1 text-red-600 text-xs pt-1"><AlertTriangle className="w-3.5 h-3.5" />Insufficient funds in selected wallet</div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
            <textarea {...register('description')} rows={3} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Purpose of this payment..." />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Narration (optional)</label>
            <input {...register('narration')} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Additional notes..." />
          </div>
        </div>

        <button type="submit" disabled={mutation.isPending} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-base">
          {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><SendHorizonal className="w-4 h-4" /> Submit for Approval</>}
        </button>
      </form>
    </div>
  );
}
