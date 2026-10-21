import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, Plus, RefreshCw, ArrowUpRight, ArrowDownLeft, Eye,
  TrendingUp, Loader2, DollarSign, CreditCard, Activity, X
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogFooter } from '../../components/ui/dialog';
import { Select, Input } from '../../components/ui/select';
import { useToast } from '../../components/ui/toaster';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function WalletsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', currency: 'KES', type: 'OPERATING', description: '' });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => api.get('/wallets').then(r => r.data),
  });

  const { data: summary } = useQuery({
    queryKey: ['wallet-summary'],
    queryFn: () => api.get('/wallets?action=summary').then(r => r.data.data),
  });

  const wallets: any[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/wallets', body).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Wallet Created' });
      qc.invalidateQueries(['wallets']);
      setCreateOpen(false);
      setForm({ name: '', currency: 'KES', type: 'OPERATING', description: '' });
    },
    onError: () => toast({ type: 'error', title: 'Failed to create wallet' }),
  });

  const walletTypeColor: Record<string, string> = {
    OPERATING: 'from-indigo-500 to-purple-600',
    RESERVE: 'from-emerald-500 to-teal-600',
    ESCROW: 'from-amber-500 to-orange-600',
    COMMISSION: 'from-rose-500 to-pink-600',
  };

  const totalBalance = wallets.reduce((sum, w) => sum + (w.balance ?? 0), 0);
  const totalReserved = wallets.reduce((sum, w) => sum + (w.reservedAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-indigo-600" />
            Wallets & Balances
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage organizational wallets and view real-time balances</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries(['wallets'])}>
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" /> Create Wallet
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Balance', value: formatCurrency(totalBalance), icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Available', value: formatCurrency(totalBalance - totalReserved), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Reserved', value: formatCurrency(totalReserved), icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Active Wallets', value: wallets.filter(w => w.status === 'ACTIVE').length, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-opacity-20 p-5`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className={`text-2xl font-bold mt-2 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Wallet Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : wallets.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <Wallet className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400">No wallets yet</h3>
          <p className="text-slate-400 mt-1 mb-4">Create your first wallet to start managing funds</p>
          <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Create First Wallet</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {wallets.map((wallet: any) => (
            <div
              key={wallet.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Card Header */}
              <div className={`bg-gradient-to-r ${walletTypeColor[wallet.type] ?? 'from-slate-500 to-slate-600'} p-5 text-white`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/80 uppercase tracking-wide">{wallet.type} WALLET</p>
                    <p className="text-xl font-bold mt-0.5">{wallet.name}</p>
                  </div>
                  <Badge variant="outline" className="border-white/40 text-white bg-white/10">
                    {wallet.currency}
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold">{formatCurrency(wallet.balance ?? 0)}</p>
                  <p className="text-sm text-white/70 mt-0.5">Total Balance</p>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Available</p>
                    <p className="font-semibold text-green-600 mt-0.5">
                      {formatCurrency((wallet.balance ?? 0) - (wallet.reservedAmount ?? 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Reserved</p>
                    <p className="font-semibold text-amber-600 mt-0.5">{formatCurrency(wallet.reservedAmount ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Total In</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{formatCurrency(wallet.totalIn ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Total Out</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{formatCurrency(wallet.totalOut ?? 0)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Badge variant={wallet.status === 'ACTIVE' ? 'success' : 'secondary'}>{wallet.status}</Badge>
                  <span className="text-xs text-slate-400">Created {formatDate(wallet.createdAt)}</span>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/wallets/${wallet.id}/ledger`)}
                  >
                    <Eye className="w-3.5 h-3.5" /> View Ledger
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Wallet Modal */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create New Wallet" description="Wallets help you separate and track funds by purpose" size="md">
        <div className="space-y-4">
          <Input
            label="Wallet Name *"
            placeholder="e.g. Operations Fund, Supplier Payments"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Select
            label="Wallet Type *"
            value={form.type}
            onChange={v => setForm(f => ({ ...f, type: v }))}
            options={[
              { value: 'OPERATING', label: 'Operating', description: 'Day-to-day transaction wallet' },
              { value: 'RESERVE', label: 'Reserve', description: 'Emergency / contingency funds' },
              { value: 'ESCROW', label: 'Escrow', description: 'Funds held pending release' },
              { value: 'COMMISSION', label: 'Commission', description: 'Earnings and commissions' },
            ]}
          />
          <Select
            label="Currency"
            value={form.currency}
            onChange={v => setForm(f => ({ ...f, currency: v }))}
            options={[{ value: 'KES', label: 'KES — Kenyan Shilling' }]}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate(form)} loading={createMutation.isLoading} disabled={!form.name}>
            <Plus className="w-4 h-4" /> Create Wallet
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
