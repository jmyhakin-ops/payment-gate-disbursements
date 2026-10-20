import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { paymentsApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatRelative, cn, extractApiError } from '@/lib/utils';
import { CheckCircle, XCircle, Eye, Clock, Loader2, Edit3, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

type TxRow = {
  id: string; reference: string; recipientName: string; recipientPhone?: string;
  recipientAccountNo?: string; rail: string; amount: number; currency: string;
  netAmount: number; charges: number; description: string;
  maker: { firstName: string; lastName: string; email: string };
  createdAt: string; wallet: { name: string };
};

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({});
  const [showAmountEdit, setShowAmountEdit] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: () => paymentsApi.pendingApprovals().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, action, originalAmount }: { id: string; action: string; originalAmount: number }) => {
      const rawAmt = editAmounts[id];
      const approvedAmount = showAmountEdit[id] && rawAmt
        ? parseFloat(rawAmt) : undefined;
      // Validate
      if (approvedAmount !== undefined && (isNaN(approvedAmount) || approvedAmount <= 0 || approvedAmount >= originalAmount)) {
        throw new Error(`Amount must be between 0 and ${originalAmount}`);
      }
      return paymentsApi.checkerAction(id, { action, note: notes[id], approvedAmount });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      setEditAmounts(prev => { const n = { ...prev }; delete n[vars.id]; return n; });
      setShowAmountEdit(prev => { const n = { ...prev }; delete n[vars.id]; return n; });
      setNotes(prev => { const n = { ...prev }; delete n[vars.id]; return n; });
    },
    onError: (err: unknown) => setError(extractApiError(err)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Checker Approvals</h1>
        <p className="text-gray-500 text-sm mt-0.5">Review and approve or reject payment requests</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : !data?.length ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">All caught up!</h3>
          <p className="text-gray-400 text-sm">No payments pending your review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(data as TxRow[]).map((tx) => {
            const originalAmount = Number(tx.amount);
            const rawAmt = editAmounts[tx.id];
            const newAmt = rawAmt ? parseFloat(rawAmt) : null;
            const isValidNewAmt = newAmt !== null && !isNaN(newAmt) && newAmt > 0 && newAmt < originalAmount;
            const isEditOpen = !!showAmountEdit[tx.id];

            return (
              <div key={tx.id} className="bg-white rounded-xl border-2 border-amber-100 hover:border-amber-300 transition-colors p-6 space-y-4">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 flex-1 min-w-48">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-blue-600 font-semibold">{tx.reference}</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Awaiting Checker
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900 text-xl">{formatCurrency(tx.amount, tx.currency)}</p>
                    <p className="text-gray-600 text-sm">→ <strong>{tx.recipientName}</strong> via {tx.rail.replace(/_/g, ' ')}</p>
                    <p className="text-gray-400 text-xs">{tx.recipientPhone || tx.recipientAccountNo}</p>
                    <p className="text-gray-500 text-sm mt-1">"{tx.description}"</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                      <span>By: {tx.maker?.firstName} {tx.maker?.lastName}</span>
                      <span>·</span>
                      <span>{formatRelative(tx.createdAt)}</span>
                      <span>·</span>
                      <span>Wallet: {tx.wallet?.name}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link to={`/payments/${tx.id}`} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500" title="View details">
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => mutation.mutate({ id: tx.id, action: 'APPROVED', originalAmount })}
                      disabled={mutation.isPending || (isEditOpen && !!rawAmt && !isValidNewAmt)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isValidNewAmt ? `Approve ${formatCurrency(newAmt!)}` : 'Approve'}
                    </button>
                    <button
                      onClick={() => mutation.mutate({ id: tx.id, action: 'RETURNED', originalAmount })}
                      disabled={mutation.isPending}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    >Return</button>
                    <button
                      onClick={() => mutation.mutate({ id: tx.id, action: 'REJECTED', originalAmount })}
                      disabled={mutation.isPending}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>

                {/* Super Admin Amount Override Panel */}
                {isSuperAdmin && (
                  <div className="border-t border-amber-100 pt-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-800 uppercase tracking-wide flex items-center gap-1">
                          ⚡ Super Admin Override
                        </span>
                        <button
                          onClick={() => {
                            setShowAmountEdit(prev => ({ ...prev, [tx.id]: !prev[tx.id] }));
                            setEditAmounts(prev => { const n = { ...prev }; delete n[tx.id]; return n; });
                          }}
                          className="text-xs text-blue-600 hover:text-blue-900 flex items-center gap-1 font-semibold border border-blue-300 px-2 py-1 rounded-lg hover:bg-blue-100"
                        >
                          <Edit3 className="w-3 h-3" />
                          {isEditOpen ? 'Cancel' : 'Edit Amount'}
                        </button>
                      </div>

                      {isEditOpen && (
                        <div className="space-y-2">
                          <label className="text-xs text-blue-700 font-medium">New Approved Amount (KES) — Original: {formatCurrency(originalAmount)}</label>
                          <input
                            type="number"
                            min="1"
                            max={originalAmount - 0.01}
                            step="0.01"
                            value={editAmounts[tx.id] || ''}
                            onChange={(e) => setEditAmounts(prev => ({ ...prev, [tx.id]: e.target.value }))}
                            placeholder={`Enter amount less than ${originalAmount}`}
                            className="w-full px-3 py-2.5 border-2 border-blue-300 rounded-lg text-sm font-mono font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                          {isValidNewAmt && (
                            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-800 font-medium">
                              💰 Reduced by <strong>{formatCurrency(originalAmount - newAmt!)}</strong> → 
                              New amount: <strong className="text-green-700">{formatCurrency(newAmt!)}</strong>. 
                              Difference will be returned to wallet automatically.
                            </div>
                          )}
                          {rawAmt && !isValidNewAmt && (
                            <div className="text-xs text-red-600 font-medium">
                              ⚠️ Amount must be between KES 1 and KES {originalAmount - 0.01}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Note */}
                      <textarea
                        value={notes[tx.id] || ''}
                        onChange={(e) => setNotes(prev => ({ ...prev, [tx.id]: e.target.value }))}
                        placeholder="Add approval note..."
                        rows={1}
                        className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Non-SA note area */}
                {!isSuperAdmin && (
                  <div className="border-t border-gray-100 pt-3">
                    <textarea
                      value={notes[tx.id] || ''}
                      onChange={(e) => setNotes(prev => ({ ...prev, [tx.id]: e.target.value }))}
                      placeholder="Add a note (optional)..."
                      rows={1}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
