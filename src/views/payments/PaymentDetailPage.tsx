import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatDateTime, statusColors, railLabels, cn, extractApiError } from '@/lib/utils';
import { ArrowLeft, CheckCircle, XCircle, RotateCcw, User, Wallet, Clock, Shield, AlertTriangle, Loader2, FileText, Edit3 } from 'lucide-react';

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, canApprove, isDirector } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [checkerNote, setCheckerNote] = useState('');
  const [directorNote, setDirectorNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [error, setError] = useState('');

  // Super Admin amount override states
  const [overrideCheckerAmount, setOverrideCheckerAmount] = useState<string>('');
  const [overrideDirectorAmount, setOverrideDirectorAmount] = useState<string>('');
  const [showCheckerAmountEdit, setShowCheckerAmountEdit] = useState(false);
  const [showDirectorAmountEdit, setShowDirectorAmountEdit] = useState(false);

  const { data: tx, isLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => paymentsApi.get(id!).then((r) => r.data.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['payment', id] });

  const checkerMutation = useMutation({
    mutationFn: (action: 'APPROVED' | 'REJECTED' | 'RETURNED') => {
      const approvedAmount = action === 'APPROVED' && overrideCheckerAmount
        ? parseFloat(overrideCheckerAmount) : undefined;
      return paymentsApi.checkerAction(id!, { action, note: checkerNote, approvedAmount });
    },
    onSuccess: () => { invalidate(); setOverrideCheckerAmount(''); setShowCheckerAmountEdit(false); },
    onError: (err: unknown) => setError(extractApiError(err)),
  });

  const directorMutation = useMutation({
    mutationFn: (action: 'APPROVED' | 'REJECTED') => {
      const approvedAmount = action === 'APPROVED' && overrideDirectorAmount
        ? parseFloat(overrideDirectorAmount) : undefined;
      return paymentsApi.directorAction(id!, { action, note: directorNote, approvedAmount });
    },
    onSuccess: () => { invalidate(); setOverrideDirectorAmount(''); setShowDirectorAmountEdit(false); },
    onError: (err: unknown) => setError(extractApiError(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => paymentsApi.cancel(id!, cancelReason),
    onSuccess: () => { invalidate(); setShowCancel(false); },
    onError: (err: unknown) => setError(extractApiError(err)),
  });

  if (isLoading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (!tx) return <div className="text-center py-24 text-gray-500">Transaction not found</div>;

  // Super Admin can approve even their own transactions
  const canCheckerAct = canApprove() && tx.status === 'PENDING_CHECKER' && (isSuperAdmin || tx.maker?.id !== user?.id);
  const canDirectorAct = isDirector() && tx.status === 'PENDING_DIRECTOR';
  const canCancel = (isSuperAdmin || tx.makerId === user?.id) && ['DRAFT','PENDING_CHECKER','PENDING_DIRECTOR'].includes(tx.status);
  const isCompleted = tx.status === 'COMPLETED';
  const isFailed = tx.status === 'FAILED' || tx.status.includes('REJECTED');

  const originalAmount = Number(tx.amount);
  const checkerNewAmount = overrideCheckerAmount ? parseFloat(overrideCheckerAmount) : null;
  const directorNewAmount = overrideDirectorAmount ? parseFloat(overrideDirectorAmount) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"><ArrowLeft className="w-4 h-4 text-gray-500" /></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 font-mono">{tx.reference}</h1>
          <p className="text-gray-500 text-sm">{formatDateTime(tx.createdAt)}</p>
        </div>
        <span className={cn('px-3 py-1.5 rounded-full text-sm font-semibold', statusColors[tx.status] || 'bg-gray-100')}>
          {tx.status.replace(/_/g, ' ')}
        </span>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5" />{error}</div>}

      {/* Approval Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-blue-600" /> Approval Timeline</h2>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            <TimelineStep icon={<User className="w-3.5 h-3.5" />} label="Submitted by Maker" name={`${tx.maker?.firstName} ${tx.maker?.lastName}`} date={tx.createdAt} status="done" />
            <TimelineStep
              icon={<CheckCircle className="w-3.5 h-3.5" />}
              label="Checker Review"
              name={tx.approvalWorkflow?.checker ? `${tx.approvalWorkflow.checker.firstName} ${tx.approvalWorkflow.checker.lastName}` : 'Pending'}
              date={tx.approvalWorkflow?.checkerAt}
              status={tx.approvalWorkflow?.checkerAction === 'APPROVED' ? 'done' : tx.approvalWorkflow?.checkerAction === 'REJECTED' ? 'rejected' : 'pending'}
              note={tx.approvalWorkflow?.checkerNote}
              badge={tx.approvalWorkflow?.checkerAction}
            />
            {tx.approvalWorkflow?.requiresDirector && (
              <>
                {tx.approvalWorkflow?.directorApprovals?.map((da: { id: string; director: { firstName: string; lastName: string }; action: string; note?: string; approvedAt: string }) => (
                  <TimelineStep key={da.id}
                    icon={<Shield className="w-3.5 h-3.5" />}
                    label="Director Approval"
                    name={`${da.director.firstName} ${da.director.lastName}`}
                    date={da.approvedAt}
                    status={da.action === 'APPROVED' ? 'done' : 'rejected'}
                    note={da.note}
                    badge={da.action}
                  />
                ))}
                {tx.status === 'PENDING_DIRECTOR' && (
                  <TimelineStep icon={<Clock className="w-3.5 h-3.5" />} label="Awaiting Director Approval" name={`${tx.approvalWorkflow?.directorsApproved || 0} of ${tx.approvalWorkflow?.minDirectors} directors approved`} status="pending" />
                )}
              </>
            )}
            <TimelineStep
              icon={isCompleted ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              label={isCompleted ? 'Payment Completed' : isFailed ? 'Payment Failed' : 'Funds Disbursement'}
              name={isCompleted ? `External Ref: ${tx.externalReference || tx.mpesaReceiptNumber || 'N/A'}` : isFailed ? tx.failureReason || 'Failed' : 'Pending'}
              date={tx.completedAt}
              status={isCompleted ? 'done' : isFailed ? 'rejected' : 'pending'}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transaction Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" /> Transaction Details</h2>
          <dl className="space-y-3 text-sm">
            {[
              ['Rail', <span className="font-medium">{railLabels[tx.rail] || tx.rail}</span>],
              ['Recipient', <span className="font-medium">{tx.recipientName}</span>],
              ['Phone / Account', <span className="font-mono">{tx.recipientPhone || tx.recipientAccountNo || '—'}</span>],
              ['Bank', tx.recipientBankName ? <span>{tx.recipientBankName} ({tx.recipientBankCode})</span> : '—'],
              ['Amount', <span className="font-semibold text-gray-900">{formatCurrency(tx.amount, tx.currency)}</span>],
              ['Charges', <span className="text-amber-600">{formatCurrency(tx.charges)}</span>],
              ['Net Debit', <span className="font-bold text-red-600">{formatCurrency(tx.netAmount)}</span>],
              ['Description', <span className="text-gray-600">{tx.description}</span>],
              ...(tx.narration ? [['Narration', tx.narration]] : []),
              ['External Ref', <span className="font-mono text-xs">{tx.externalReference || tx.mpesaConversationId || '—'}</span>],
              ['M-Pesa Receipt', <span className="font-mono text-xs">{tx.mpesaReceiptNumber || '—'}</span>],
            ].map(([key, val]) => (
              <div key={String(key)} className="flex justify-between gap-4 py-1.5 border-b border-gray-50 last:border-0">
                <dt className="text-gray-400 flex-shrink-0">{key}</dt>
                <dd className="text-right">{val}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Wallet + Action Panels */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-blue-600" /> Source Wallet</h2>
            <p className="text-sm font-medium text-gray-700">{tx.wallet?.name}</p>
            <p className="text-xs text-gray-400">{tx.wallet?.type}</p>
          </div>

          {/* ── CHECKER ACTION ── */}
          {canCheckerAct && (
            <div className="bg-white rounded-xl border-2 border-blue-200 p-6 space-y-3">
              <h2 className="font-semibold text-blue-900 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Checker Review</h2>

              {/* Super Admin Amount Override */}
              {isSuperAdmin && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">⚡ Super Admin — Modify Amount</span>
                    <button
                      onClick={() => { setShowCheckerAmountEdit(!showCheckerAmountEdit); setOverrideCheckerAmount(''); }}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                    >
                      <Edit3 className="w-3 h-3" />
                      {showCheckerAmountEdit ? 'Cancel Edit' : 'Edit Amount'}
                    </button>
                  </div>
                  <div className="text-sm text-blue-700">
                    Original: <strong>{formatCurrency(originalAmount)}</strong>
                  </div>
                  {showCheckerAmountEdit && (
                    <div className="space-y-2">
                      <label className="text-xs text-blue-700 font-medium">New Approved Amount (KES)</label>
                      <input
                        type="number"
                        min="1"
                        max={originalAmount}
                        step="0.01"
                        value={overrideCheckerAmount}
                        onChange={(e) => setOverrideCheckerAmount(e.target.value)}
                        placeholder={`Max: ${originalAmount}`}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm font-mono font-semibold outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      {checkerNewAmount !== null && checkerNewAmount > 0 && checkerNewAmount < originalAmount && (
                        <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-700">
                          ⚠️ Amount reduced by <strong>{formatCurrency(originalAmount - checkerNewAmount)}</strong>. 
                          New amount: <strong className="text-green-700">{formatCurrency(checkerNewAmount)}</strong>. 
                          The difference will be returned to wallet.
                        </div>
                      )}
                      {checkerNewAmount !== null && checkerNewAmount >= originalAmount && (
                        <div className="text-xs text-red-600">Amount must be less than original {formatCurrency(originalAmount)}</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <textarea value={checkerNote} onChange={(e) => setCheckerNote(e.target.value)} rows={2} placeholder="Add notes (optional)..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <div className="flex gap-2">
                <button
                  onClick={() => checkerMutation.mutate('APPROVED')}
                  disabled={checkerMutation.isPending || (showCheckerAmountEdit && !!overrideCheckerAmount && (isNaN(checkerNewAmount!) || checkerNewAmount! <= 0 || checkerNewAmount! >= originalAmount))}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {checkerMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  {showCheckerAmountEdit && checkerNewAmount && checkerNewAmount > 0 && checkerNewAmount < originalAmount
                    ? `Approve ${formatCurrency(checkerNewAmount)}`
                    : 'Approve'}
                </button>
                <button onClick={() => checkerMutation.mutate('RETURNED')} disabled={checkerMutation.isPending} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                  <RotateCcw className="w-3.5 h-3.5" /> Return
                </button>
                <button onClick={() => checkerMutation.mutate('REJECTED')} disabled={checkerMutation.isPending} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </div>
          )}

          {/* ── DIRECTOR ACTION ── */}
          {canDirectorAct && (
            <div className="bg-white rounded-xl border-2 border-orange-200 p-6 space-y-3">
              <h2 className="font-semibold text-orange-900 flex items-center gap-2"><Shield className="w-4 h-4" /> Director Final Approval</h2>
              <div className="bg-orange-50 p-3 rounded-lg text-xs text-orange-700 border border-orange-200">
                ⚠️ By approving, you authorize the disbursement of <strong>{formatCurrency(tx.amount)}</strong> to <strong>{tx.recipientName}</strong>. This action is logged and audited.
              </div>

              {/* Super Admin Director Amount Override */}
              {isSuperAdmin && (
                <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-orange-800 uppercase tracking-wide">⚡ Super Admin — Modify Amount</span>
                    <button
                      onClick={() => { setShowDirectorAmountEdit(!showDirectorAmountEdit); setOverrideDirectorAmount(''); }}
                      className="text-xs text-orange-700 hover:text-orange-900 flex items-center gap-1 font-medium"
                    >
                      <Edit3 className="w-3 h-3" />
                      {showDirectorAmountEdit ? 'Cancel Edit' : 'Edit Amount'}
                    </button>
                  </div>
                  <div className="text-sm text-orange-700">
                    Original: <strong>{formatCurrency(originalAmount)}</strong>
                  </div>
                  {showDirectorAmountEdit && (
                    <div className="space-y-2">
                      <label className="text-xs text-orange-700 font-medium">New Approved Amount (KES)</label>
                      <input
                        type="number"
                        min="1"
                        max={originalAmount}
                        step="0.01"
                        value={overrideDirectorAmount}
                        onChange={(e) => setOverrideDirectorAmount(e.target.value)}
                        placeholder={`Max: ${originalAmount}`}
                        className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm font-mono font-semibold outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      />
                      {directorNewAmount !== null && directorNewAmount > 0 && directorNewAmount < originalAmount && (
                        <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-700">
                          ⚠️ Amount reduced by <strong>{formatCurrency(originalAmount - directorNewAmount)}</strong>. 
                          Final approved: <strong className="text-green-700">{formatCurrency(directorNewAmount)}</strong>. 
                          Difference returned to wallet.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <textarea value={directorNote} onChange={(e) => setDirectorNote(e.target.value)} rows={2} placeholder="Director notes (optional)..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
              <div className="flex gap-2">
                <button
                  onClick={() => directorMutation.mutate('APPROVED')}
                  disabled={directorMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {directorMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  {showDirectorAmountEdit && directorNewAmount && directorNewAmount > 0 && directorNewAmount < originalAmount
                    ? `Approve ${formatCurrency(directorNewAmount)}`
                    : 'Approve & Authorize'}
                </button>
                <button onClick={() => directorMutation.mutate('REJECTED')} disabled={directorMutation.isPending} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </div>
          )}

          {canCancel && !showCancel && (
            <button onClick={() => setShowCancel(true)} className="w-full border border-red-200 text-red-600 hover:bg-red-50 py-2.5 rounded-lg text-sm font-medium">Cancel Transaction</button>
          )}
          {showCancel && (
            <div className="bg-white rounded-xl border-2 border-red-200 p-4 space-y-3">
              <h3 className="font-medium text-red-900">Cancel Transaction</h3>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} placeholder="Reason for cancellation..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-400 resize-none" />
              <div className="flex gap-2">
                <button onClick={() => cancelMutation.mutate()} disabled={!cancelReason.trim() || cancelMutation.isPending} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1">
                  {cancelMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirm Cancel
                </button>
                <button onClick={() => setShowCancel(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm">Back</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ledger */}
      {tx.ledgerEntries?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Ledger Entries</h2>
          <div className="space-y-2">
            {tx.ledgerEntries.map((e: { id: string; type: string; amount: number; balanceBefore: number; balanceAfter: number; description: string; createdAt: string }) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                <div><p className="font-medium text-gray-700">{e.description}</p><p className="text-xs text-gray-400">{formatDateTime(e.createdAt)}</p></div>
                <div className="text-right">
                  <p className={cn('font-semibold', e.type === 'DEBIT' ? 'text-red-600' : 'text-green-600')}>
                    {e.type === 'DEBIT' ? '-' : '+'}{formatCurrency(e.amount)}
                  </p>
                  <p className="text-xs text-gray-400">Balance: {formatCurrency(e.balanceAfter)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineStep({ icon, label, name, date, status, note, badge }: {
  icon: React.ReactNode; label: string; name?: string; date?: string; status: 'done' | 'rejected' | 'pending'; note?: string; badge?: string;
}) {
  const colors = { done: 'bg-green-500', rejected: 'bg-red-500', pending: 'bg-gray-300' };
  return (
    <div className="flex items-start gap-4 relative pl-8">
      <div className={cn('absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-white z-10 flex-shrink-0 border-2 border-white', colors[status])}>
        {icon}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          {badge && <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', badge === 'APPROVED' ? 'bg-green-100 text-green-700' : badge === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}>{badge}</span>}
        </div>
        {name && <p className="text-xs text-gray-500 mt-0.5">{name}</p>}
        {date && <p className="text-xs text-gray-400">{formatDateTime(date)}</p>}
        {note && <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1 italic">"{note}"</p>}
      </div>
    </div>
  );
}
