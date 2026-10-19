import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitMerge, Play, CheckCircle, XCircle, Clock, Loader2,
  Download, RefreshCw, AlertTriangle, Info, Calendar
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogFooter } from '../../components/ui/dialog';
import { DateRangePicker } from '../../components/ui/DatePicker';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { useToast } from '../../components/ui/toaster';

export default function ReconciliationPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [runOpen, setRunOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [filters, setFilters] = useState({ page: 1, limit: 20 });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['reconciliations', filters],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) });
      return api.get(`/reports/reconciliations?${p}`).then(r => r.data);
    },
  });

  const runMutation = useMutation({
    mutationFn: (body: any) => api.post('/reports/reconcile', body).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Reconciliation Started', description: 'Processing in background. Results will appear below.' });
      qc.invalidateQueries(['reconciliations']);
      setRunOpen(false);
    },
    onError: () => toast({ type: 'error', title: 'Reconciliation failed to start' }),
  });

  const reconciliations: any[] = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, pages: 1 };

  const statusVariant: Record<string, any> = {
    COMPLETED: 'success', FAILED: 'destructive', RUNNING: 'warning', PENDING: 'secondary',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <GitMerge className="w-7 h-7 text-indigo-600" />
            Reconciliation
          </h1>
          <p className="text-sm text-slate-500 mt-1">Match system transactions against M-Pesa and bank records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries(['reconciliations'])}>
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </Button>
          <Button onClick={() => setRunOpen(true)}>
            <Play className="w-4 h-4" /> Run Reconciliation
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-400">
          <p className="font-semibold">What is Reconciliation?</p>
          <p className="mt-0.5">Reconciliation compares your system's transaction records against actual M-Pesa statements and bank API responses to identify discrepancies, missing transactions, or status mismatches.</p>
        </div>
      </div>

      {/* Reconciliation History Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Reconciliation History</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                {['Run Date', 'Period', 'Status', 'Records', 'Matched', 'Discrepancies', 'Run By', 'Duration', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {isLoading ? (
                <tr><td colSpan={9} className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></td></tr>
              ) : reconciliations.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center">
                  <GitMerge className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No reconciliation runs yet. Click "Run Reconciliation" to start.</p>
                </td></tr>
              ) : reconciliations.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                    <p>{r.periodFrom ? formatDate(r.periodFrom) : '—'}</p>
                    <p>{r.periodTo ? `to ${formatDate(r.periodTo)}` : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[r.status] ?? 'secondary'}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">{r.totalRecords ?? '—'}</td>
                  <td className="px-4 py-3 text-center font-semibold text-green-600">{r.matchedRecords ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {(r.discrepancies ?? 0) > 0 ? (
                      <span className="flex items-center gap-1 text-red-600 font-semibold justify-center">
                        <AlertTriangle className="w-3.5 h-3.5" /> {r.discrepancies}
                      </span>
                    ) : (
                      <span className="text-green-600 font-semibold">{r.discrepancies ?? 0}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.initiatedBy?.firstName ?? 'System'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {r.durationSeconds ? `${r.durationSeconds}s` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.reportUrl && (
                      <Button size="sm" variant="ghost" onClick={() => window.open(r.reportUrl, '_blank')}>
                        <Download className="w-3.5 h-3.5" /> Report
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500">{pagination.total} reconciliation runs</p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>Previous</Button>
              <Button size="sm" variant="outline" disabled={filters.page >= pagination.pages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Run Reconciliation Modal */}
      <Dialog open={runOpen} onClose={() => setRunOpen(false)} title="Run Reconciliation" description="Select a date range to reconcile transactions" size="md">
        <div className="space-y-4">
          <DateRangePicker
            startDate={dateFrom}
            endDate={dateTo}
            onChange={(s, e) => { setDateFrom(s); setDateTo(e); }}
            label="Reconciliation Period *"
          />
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400 space-y-1">
            <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Note:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Reconciliation may take several minutes for large date ranges</li>
              <li>System will compare records against M-Pesa and bank APIs</li>
              <li>Discrepancies will be flagged for manual review</li>
              <li>Results will be emailed to finance team on completion</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRunOpen(false)}>Cancel</Button>
          <Button
            onClick={() => runMutation.mutate({ dateFrom: dateFrom?.toISOString(), dateTo: dateTo?.toISOString() })}
            loading={runMutation.isLoading}
            disabled={!dateFrom || !dateTo}
          >
            <Play className="w-4 h-4" /> Start Reconciliation
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
