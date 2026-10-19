import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { paymentsApi } from '@/services/api';
import { formatCurrency, formatRelative, cn, extractApiError } from '@/lib/utils';
import { CheckCircle, XCircle, Eye, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const [actionId, setActionId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: () => paymentsApi.pendingApprovals().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => paymentsApi.checkerAction(id, { action, note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending-approvals'] }); setActionId(null); setNote(''); },
    onError: (err: unknown) => setError(extractApiError(err)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Checker Approvals</h1>
        <p className="text-gray-500 text-sm mt-0.5">Review and approve or reject payment requests</p>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

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
          {data.map((tx: { id: string; reference: string; recipientName: string; recipientPhone?: string; recipientAccountNo?: string; rail: string; amount: number; currency: string; netAmount: number; description: string; maker: { firstName: string; lastName: string; email: string }; createdAt: string; wallet: { name: string } }) => (
            <div key={tx.id} className="bg-white rounded-xl border-2 border-amber-100 hover:border-amber-300 transition-colors p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1 flex-1 min-w-48">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-blue-600 font-semibold">{tx.reference}</span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Awaiting Checker
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 text-lg">{formatCurrency(tx.amount, tx.currency)}</p>
                  <p className="text-gray-600 text-sm">→ <strong>{tx.recipientName}</strong> via {tx.rail.replace(/_/g, ' ')}</p>
                  <p className="text-gray-400 text-xs">{tx.recipientPhone || tx.recipientAccountNo}</p>
                  <p className="text-gray-500 text-sm mt-1">"{tx.description}"</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
                    <span>By: {tx.maker?.firstName} {tx.maker?.lastName}</span>
                    <span>·</span>
                    <span>{formatRelative(tx.createdAt)}</span>
                    <span>·</span>
                    <span>Wallet: {tx.wallet?.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link to={`/payments/${tx.id}`} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500" title="View details"><Eye className="w-4 h-4" /></Link>
                  <button onClick={() => mutation.mutate({ id: tx.id, action: 'APPROVED' })} disabled={mutation.isPending} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => mutation.mutate({ id: tx.id, action: 'RETURNED' })} disabled={mutation.isPending} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">Return</button>
                  <button onClick={() => mutation.mutate({ id: tx.id, action: 'REJECTED' })} disabled={mutation.isPending} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>

              {actionId === tx.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note..." rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
