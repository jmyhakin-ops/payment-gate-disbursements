import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { paymentsApi } from '@/services/api';
import { formatCurrency, formatRelative, cn, extractApiError } from '@/lib/utils';
import { Shield, CheckCircle, XCircle, Eye, Loader2, AlertTriangle, BadgeCheck } from 'lucide-react';

export default function DirectorApprovalsPage() {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['director-approvals'],
    queryFn: () => paymentsApi.directorApprovals().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      paymentsApi.directorAction(id, { action, note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['director-approvals'] }); },
    onError: (err: unknown) => setError(extractApiError(err)),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Director Final Approval</h1>
          <p className="text-gray-500 text-sm">Your authorization is required before funds are disbursed</p>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-900 text-sm">Important Notice</p>
          <p className="text-red-700 text-sm">By approving a transaction, you are personally authorizing the disbursement of funds. All approvals are cryptographically logged with your IP address, timestamp, and signature for audit and compliance purposes.</p>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>
      ) : !data?.length ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <BadgeCheck className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">No pending approvals</h3>
          <p className="text-gray-400 text-sm">All transactions have been reviewed</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.map((tx: {
            id: string; reference: string; recipientName: string; recipientPhone?: string; recipientAccountNo?: string; recipientBankName?: string;
            rail: string; amount: number; currency: string; netAmount: number; charges: number; description: string; narration?: string;
            maker: { firstName: string; lastName: string; email: string };
            approvalWorkflow: { checker?: { firstName: string; lastName: string }; checkerNote?: string; checkerAt?: string; directorsApproved: number; minDirectors: number; directorApprovals: Array<{ director: { firstName: string; lastName: string }; action: string; approvedAt: string }> };
            wallet: { name: string }; createdAt: string;
          }) => (
            <div key={tx.id} className="bg-white rounded-xl border-2 border-orange-200 p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-sm text-orange-600 font-bold">{tx.reference}</span>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(tx.amount, tx.currency)}</h3>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {tx.approvalWorkflow?.directorsApproved}/{tx.approvalWorkflow?.minDirectors} director approvals received
                  </div>
                </div>
                <Link to={`/payments/${tx.id}`} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                  <Eye className="w-4 h-4" /> Full Details
                </Link>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-orange-50 rounded-lg p-4">
                {[
                  ['Recipient', tx.recipientName],
                  ['Rail', tx.rail.replace(/_/g, ' ')],
                  ['Account/Phone', tx.recipientPhone || tx.recipientAccountNo || '—'],
                  ['Bank', tx.recipientBankName || '—'],
                  ['Amount', formatCurrency(tx.amount)],
                  ['Charges', formatCurrency(tx.charges)],
                  ['Total Debit', formatCurrency(tx.netAmount)],
                  ['Source Wallet', tx.wallet?.name],
                  ['Submitted', formatRelative(tx.createdAt)],
                ].map(([k, v]) => (
                  <div key={k}><p className="text-xs text-orange-600 font-medium">{k}</p><p className="text-sm font-semibold text-gray-800">{v}</p></div>
                ))}
              </div>

              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">Purpose</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{tx.description}</p>
              </div>

              {/* Checker approval */}
              {tx.approvalWorkflow?.checker && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3">
                  <CheckCircle className="w-4 h-4" />
                  <span>Checker approved by <strong>{tx.approvalWorkflow.checker.firstName} {tx.approvalWorkflow.checker.lastName}</strong></span>
                  {tx.approvalWorkflow.checkerNote && <span className="text-gray-400">· "{tx.approvalWorkflow.checkerNote}"</span>}
                </div>
              )}

              {/* Director note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Director Authorization Note (optional)</label>
                <textarea
                  value={notes[tx.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [tx.id]: e.target.value }))}
                  rows={2}
                  placeholder="Add your authorization note..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => mutation.mutate({ id: tx.id, action: 'APPROVED', note: notes[tx.id] })}
                  disabled={mutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  ✅ Approve & Authorize Disbursement
                </button>
                <button
                  onClick={() => mutation.mutate({ id: tx.id, action: 'REJECTED', note: notes[tx.id] })}
                  disabled={mutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  <XCircle className="w-4 h-4" /> ❌ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
