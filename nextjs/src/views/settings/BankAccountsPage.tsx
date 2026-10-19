import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Plus, Trash2, CheckCircle, XCircle, RefreshCw, Loader2
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogFooter, ConfirmDialog } from '../../components/ui/dialog';
import { Select, Input } from '../../components/ui/select';
import { useToast } from '../../components/ui/toaster';
import { formatDate } from '../../lib/utils';

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
];

export default function BankAccountsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ bankCode: '', accountNumber: '', accountName: '', bankBranch: '', swiftCode: '', type: 'PESALINK' });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api.get('/settings/bank-accounts').then(r => r.data.data),
  });

  const accounts: any[] = data ?? [];

  const addMutation = useMutation({
    mutationFn: (body: any) => api.post('/settings/bank-accounts', body).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Bank Account Added' });
      qc.invalidateQueries(['bank-accounts']);
      setAddOpen(false);
      setForm({ bankCode: '', accountNumber: '', accountName: '', bankBranch: '', swiftCode: '', type: 'PESALINK' });
    },
    onError: () => toast({ type: 'error', title: 'Failed to add bank account' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/bank-accounts/${id}`).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Account removed' });
      qc.invalidateQueries(['bank-accounts']);
      setConfirmDelete(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/settings/bank-accounts/${id}/activate`).then(r => r.data),
    onSuccess: () => { toast({ type: 'success', title: 'Account activated' }); qc.invalidateQueries(['bank-accounts']); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-indigo-600" />
            Bank Accounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">Organization bank accounts for PesaLink, RTGS, and funding</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries(['bank-accounts'])}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" /> Add Bank Account
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <BookOpen className="w-14 h-14 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No bank accounts added</p>
          <Button className="mt-4" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> Add First Account</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc: any) => (
            <div key={acc.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex items-center gap-5">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-2xl flex-shrink-0">
                🏦
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 dark:text-slate-100">{acc.accountName}</p>
                  <Badge variant={acc.isActive ? 'success' : 'secondary'}>{acc.isActive ? 'Active' : 'Inactive'}</Badge>
                  <Badge variant="outline">{acc.type}</Badge>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{acc.bankCode} · Account: {acc.accountNumber}</p>
                {acc.bankBranch && <p className="text-xs text-slate-400">Branch: {acc.bankBranch}</p>}
                {acc.swiftCode && <p className="text-xs text-slate-400">SWIFT: {acc.swiftCode}</p>}
              </div>
              <div className="flex items-center gap-2">
                {!acc.isActive && (
                  <Button size="sm" variant="outline" onClick={() => activateMutation.mutate(acc.id)}>
                    <CheckCircle className="w-4 h-4 text-green-500" /> Activate
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(acc.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add Bank Account" size="md">
        <div className="space-y-4">
          <Select label="Bank *" value={form.bankCode} onChange={v => setForm(f => ({ ...f, bankCode: v }))} options={KENYAN_BANKS} placeholder="Select Kenyan Bank..." />
          <Input label="Account Number *" value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} placeholder="Enter account number" />
          <Input label="Account Name *" value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} placeholder="As on bank records" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Branch" value={form.bankBranch} onChange={e => setForm(f => ({ ...f, bankBranch: e.target.value }))} placeholder="e.g. Nairobi CBD" />
            <Input label="SWIFT Code" value={form.swiftCode} onChange={e => setForm(f => ({ ...f, swiftCode: e.target.value }))} placeholder="e.g. KCBLKENX" />
          </div>
          <Select label="Account Type" value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))} options={[
            { value: 'PESALINK', label: 'PesaLink', description: 'Interbank up to KES 999,999' },
            { value: 'RTGS', label: 'RTGS', description: 'Large value transfers' },
            { value: 'FUNDING', label: 'Funding Account', description: 'Source of funds' },
          ]} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button onClick={() => addMutation.mutate(form)} loading={addMutation.isLoading} disabled={!form.bankCode || !form.accountNumber || !form.accountName}>
            <Plus className="w-4 h-4" /> Add Account
          </Button>
        </DialogFooter>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
        title="Remove Bank Account"
        description="This will remove the bank account from your organization. Existing transactions will not be affected."
        confirmLabel="Remove Account"
        loading={deleteMutation.isLoading}
      />
    </div>
  );
}
