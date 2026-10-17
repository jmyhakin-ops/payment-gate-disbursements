import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Shield, Globe, CheckCircle, XCircle, Clock, Ban,
  Edit2, Save, X, Plus, Trash2, RefreshCw, Loader2, AlertTriangle,
  Phone, Mail, MapPin, Users, CreditCard, Zap
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogFooter, ConfirmDialog } from '../../components/ui/dialog';
import { Select, Input, Textarea } from '../../components/ui/select';
import { useToast } from '../../components/ui/toaster';
import { formatDate, formatCurrency, cn } from '../../lib/utils';

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
  { value: 'GUARDIAN', label: 'Guardian Bank' },
  { value: 'I&M', label: 'I&M Bank' },
  { value: 'NIC', label: 'NIC Bank' },
  { value: 'PRIME', label: 'Prime Bank' },
  { value: 'SIDIAN', label: 'Sidian Bank' },
];

const PAYMENT_RAILS = [
  { key: 'mpesaB2C', label: 'M-Pesa B2C', icon: '📱', desc: 'Pay customers directly to phone' },
  { key: 'mpesaB2B', label: 'M-Pesa B2B', icon: '🏪', desc: 'Paybill & Buy Goods Till payments' },
  { key: 'pesalink', label: 'PesaLink', icon: '🏦', desc: 'Interbank transfer up to KES 999,999' },
  { key: 'rtgs', label: 'RTGS', icon: '💸', desc: 'Large value bank transfers' },
  { key: 'equityJenga', label: 'Equity Jenga', icon: '🔷', desc: 'Equity Bank Open API' },
  { key: 'kcbOpenBanking', label: 'KCB Open Banking', icon: '🟩', desc: 'KCB Bank API' },
];

export default function OrganizationPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'rails' | 'limits' | 'directors' | 'bank-accounts'>('profile');
  const [addDirectorOpen, setAddDirectorOpen] = useState(false);
  const [addBankOpen, setAddBankOpen] = useState(false);
  const [directorForm, setDirectorForm] = useState({ userId: '', nationalId: '', phone: '', signatureAuthority: '' });
  const [bankForm, setBankForm] = useState({ bankCode: '', accountNumber: '', accountName: '', bankBranch: '', swiftCode: '', type: 'PESALINK' });
  const [confirmRemove, setConfirmRemove] = useState<{ type: string; id: string; name: string } | null>(null);

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => api.get('/organizations/me').then(r => r.data.data),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-select'],
    queryFn: () => api.get('/users?limit=100').then(r => r.data.data),
  });

  const [editForm, setEditForm] = useState<any>({});

  React.useEffect(() => {
    if (org && !editing) {
      setEditForm({
        name: org.name ?? '',
        legalName: org.legalName ?? '',
        registrationNumber: org.registrationNumber ?? '',
        taxPin: org.taxPin ?? '',
        phone: org.phone ?? '',
        email: org.email ?? '',
        website: org.website ?? '',
        physicalAddress: org.physicalAddress ?? '',
        county: org.county ?? '',
      });
    }
  }, [org, editing]);

  const updateMutation = useMutation({
    mutationFn: (body: any) => api.put('/organizations/me', body).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Organization Updated' });
      qc.invalidateQueries(['organization']);
      setEditing(false);
    },
    onError: () => toast({ type: 'error', title: 'Update failed' }),
  });

  const toggleRailMutation = useMutation({
    mutationFn: ({ rail, enabled }: { rail: string; enabled: boolean }) =>
      api.patch('/organizations/me/rails', { rail, enabled }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries(['organization']),
  });

  const addDirectorMutation = useMutation({
    mutationFn: (body: any) => api.post('/organizations/me/directors', body).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Director Added' });
      qc.invalidateQueries(['organization']);
      setAddDirectorOpen(false);
      setDirectorForm({ userId: '', nationalId: '', phone: '', signatureAuthority: '' });
    },
    onError: () => toast({ type: 'error', title: 'Failed to add director' }),
  });

  const removeDirectorMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/organizations/me/directors/${id}`).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Director Removed' });
      qc.invalidateQueries(['organization']);
      setConfirmRemove(null);
    },
  });

  const addBankMutation = useMutation({
    mutationFn: (body: any) => api.post('/settings/bank-accounts', body).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Bank Account Added' });
      qc.invalidateQueries(['organization']);
      setAddBankOpen(false);
      setBankForm({ bankCode: '', accountNumber: '', accountName: '', bankBranch: '', swiftCode: '', type: 'PESALINK' });
    },
    onError: () => toast({ type: 'error', title: 'Failed to add bank account' }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  const directors: any[] = org?.directors ?? [];
  const bankAccounts: any[] = org?.bankAccounts ?? [];
  const enabledRails: string[] = org?.enabledRails ?? [];

  const statusVariant = { ACTIVE: 'success', PENDING: 'warning', SUSPENDED: 'destructive', INACTIVE: 'secondary' }[org?.status ?? 'INACTIVE'] as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {org?.name?.[0] ?? 'O'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{org?.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusVariant}>{org?.status}</Badge>
              {org?.activatedAt && <span className="text-xs text-slate-400">Active since {formatDate(org.activatedAt)}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button onClick={() => setEditing(true)}><Edit2 className="w-4 h-4" /> Edit Profile</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}><X className="w-4 h-4" /> Cancel</Button>
              <Button onClick={() => updateMutation.mutate(editForm)} loading={updateMutation.isLoading}>
                <Save className="w-4 h-4" /> Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {[
          { key: 'profile', label: 'Profile', icon: Building2 },
          { key: 'rails', label: 'Payment Rails', icon: Zap },
          { key: 'limits', label: 'Limits', icon: Shield },
          { key: 'directors', label: 'Directors', icon: Users },
          { key: 'bank-accounts', label: 'Bank Accounts', icon: CreditCard },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" /> Company Information
            </h2>
            {editing ? (
              <div className="space-y-4">
                <Input label="Trading Name *" value={editForm.name} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} />
                <Input label="Legal Name" value={editForm.legalName} onChange={e => setEditForm((f: any) => ({ ...f, legalName: e.target.value }))} />
                <Input label="Registration Number (CAK/BRS)" value={editForm.registrationNumber} onChange={e => setEditForm((f: any) => ({ ...f, registrationNumber: e.target.value }))} />
                <Input label="KRA PIN" value={editForm.taxPin} onChange={e => setEditForm((f: any) => ({ ...f, taxPin: e.target.value }))} />
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { label: 'Trading Name', value: org?.name },
                  { label: 'Legal Name', value: org?.legalName ?? '—' },
                  { label: 'Registration No.', value: org?.registrationNumber ?? '—' },
                  { label: 'KRA PIN', value: org?.taxPin ?? '—' },
                  { label: 'Plan', value: org?.plan ?? 'STANDARD' },
                  { label: 'Member Since', value: formatDate(org?.createdAt) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-right">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-500" /> Contact Details
            </h2>
            {editing ? (
              <div className="space-y-4">
                <Input label="Phone" type="tel" placeholder="+254..." value={editForm.phone} onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))} />
                <Input label="Email" type="email" value={editForm.email} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} />
                <Input label="Website" type="url" placeholder="https://..." value={editForm.website} onChange={e => setEditForm((f: any) => ({ ...f, website: e.target.value }))} />
                <Textarea label="Physical Address" value={editForm.physicalAddress} onChange={e => setEditForm((f: any) => ({ ...f, physicalAddress: e.target.value }))} rows={2} />
                <Input label="County" value={editForm.county} onChange={e => setEditForm((f: any) => ({ ...f, county: e.target.value }))} />
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { label: 'Phone', value: org?.phone ?? '—', icon: Phone },
                  { label: 'Email', value: org?.email ?? '—', icon: Mail },
                  { label: 'Website', value: org?.website ?? '—', icon: Globe },
                  { label: 'Address', value: org?.physicalAddress ?? '—', icon: MapPin },
                  { label: 'County', value: org?.county ?? '—', icon: MapPin },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-start gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Rails Tab */}
      {activeTab === 'rails' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Payment Rails Configuration</h2>
          <p className="text-sm text-slate-500 mb-6">Enable or disable payment channels. API credentials must be configured in Settings → API Credentials before use.</p>
          <div className="grid grid-cols-2 gap-4">
            {PAYMENT_RAILS.map(rail => {
              const enabled = enabledRails.includes(rail.key);
              return (
                <div key={rail.key} className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border-2 transition-colors',
                  enabled
                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30'
                )}>
                  <span className="text-3xl">{rail.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{rail.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{rail.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleRailMutation.mutate({ rail: rail.key, enabled: !enabled })}
                    className={cn(
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                      enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                    )}
                  >
                    <span className={cn(
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Limits Tab */}
      {activeTab === 'limits' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-6">Transaction Limits</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'M-Pesa B2C Max', value: org?.mpesaB2CMaxAmount ?? 'KES 70,000', key: 'mpesaB2CMax' },
              { label: 'M-Pesa B2B Max', value: org?.mpesaB2BMaxAmount ?? 'KES 999,999', key: 'mpesaB2BMax' },
              { label: 'PesaLink Max', value: org?.pesaLinkMaxAmount ?? 'KES 999,999', key: 'pesaLinkMax' },
              { label: 'RTGS Minimum', value: org?.rtgsMinAmount ?? 'KES 100,000', key: 'rtgsMin' },
              { label: 'Single Payment Max', value: org?.singlePaymentMax ?? 'KES 10,000,000', key: 'singleMax' },
              { label: 'Daily Limit', value: org?.dailyLimit ?? 'KES 50,000,000', key: 'dailyLimit' },
              { label: 'Director Approval Threshold', value: org?.directorApprovalThreshold ?? 'KES 100,000', key: 'directorThreshold' },
              { label: 'Checker Required Above', value: org?.checkerThreshold ?? 'KES 10,000', key: 'checkerThreshold' },
              { label: 'Approval Timeout (hrs)', value: org?.approvalTimeoutHours ?? '48', key: 'approvalTimeout' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Transaction limits are enforced by the system. Contact your system administrator to modify limits.
            </p>
          </div>
        </div>
      )}

      {/* Directors Tab */}
      {activeTab === 'directors' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Board Directors</h2>
              <p className="text-sm text-slate-500 mt-0.5">Directors provide final authorization before funds are disbursed</p>
            </div>
            <Button onClick={() => setAddDirectorOpen(true)}>
              <Plus className="w-4 h-4" /> Add Director
            </Button>
          </div>
          <div className="space-y-3">
            {directors.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">No directors configured</p>
                <p className="text-sm text-slate-400 mt-1">Add at least one director to enable the approval workflow</p>
              </div>
            ) : directors.map((dir: any) => (
              <div key={dir.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {dir.user?.firstName?.[0]}{dir.user?.lastName?.[0]}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {dir.user?.firstName} {dir.user?.lastName}
                  </p>
                  <p className="text-xs text-slate-400">{dir.user?.email} · ID: {dir.nationalId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={dir.isActive ? 'success' : 'secondary'}>{dir.isActive ? 'Active' : 'Inactive'}</Badge>
                  {dir.signatureAuthority && (
                    <Badge variant="outline">{dir.signatureAuthority}</Badge>
                  )}
                </div>
                <Button size="icon" variant="ghost" onClick={() => setConfirmRemove({ type: 'director', id: dir.id, name: `${dir.user?.firstName} ${dir.user?.lastName}` })}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bank Accounts Tab */}
      {activeTab === 'bank-accounts' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Organization Bank Accounts</h2>
              <p className="text-sm text-slate-500 mt-0.5">Registered funding and payout bank accounts</p>
            </div>
            <Button onClick={() => setAddBankOpen(true)}>
              <Plus className="w-4 h-4" /> Add Bank Account
            </Button>
          </div>
          <div className="space-y-3">
            {bankAccounts.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">No bank accounts added</p>
              </div>
            ) : bankAccounts.map((acc: any) => (
              <div key={acc.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  🏦
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{acc.accountName}</p>
                  <p className="text-xs text-slate-400">{acc.bankCode} · {acc.accountNumber}</p>
                </div>
                <Badge variant="secondary">{acc.type}</Badge>
                <Badge variant={acc.isActive ? 'success' : 'secondary'}>{acc.isActive ? 'Active' : 'Inactive'}</Badge>
                <Button size="icon" variant="ghost" onClick={() => setConfirmRemove({ type: 'bank', id: acc.id, name: acc.accountName })}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Director Modal */}
      <Dialog open={addDirectorOpen} onClose={() => setAddDirectorOpen(false)} title="Add Director" size="md">
        <div className="space-y-4">
          <Select
            label="Select User *"
            value={directorForm.userId}
            onChange={v => setDirectorForm(f => ({ ...f, userId: v }))}
            options={(usersData ?? []).map((u: any) => ({ value: u.id, label: `${u.firstName} ${u.lastName} (${u.email})` }))}
            placeholder="Choose a system user..."
          />
          <Input
            label="National ID Number *"
            placeholder="e.g. 12345678"
            value={directorForm.nationalId}
            onChange={e => setDirectorForm(f => ({ ...f, nationalId: e.target.value }))}
          />
          <Input
            label="Director Phone *"
            type="tel"
            placeholder="+254..."
            value={directorForm.phone}
            onChange={e => setDirectorForm(f => ({ ...f, phone: e.target.value }))}
          />
          <Select
            label="Signature Authority"
            value={directorForm.signatureAuthority}
            onChange={v => setDirectorForm(f => ({ ...f, signatureAuthority: v }))}
            options={[
              { value: 'SOLE', label: 'Sole Signatory', description: 'Can authorize alone' },
              { value: 'JOINT', label: 'Joint Signatory', description: 'Requires another director' },
              { value: 'ANY_TWO', label: 'Any Two Directors', description: 'Any two must approve' },
            ]}
          />
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-400">
            ℹ️ Directors must have a verified account. They will receive approval notifications via email and SMS.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAddDirectorOpen(false)}>Cancel</Button>
          <Button onClick={() => addDirectorMutation.mutate(directorForm)} loading={addDirectorMutation.isLoading}>
            <Plus className="w-4 h-4" /> Add Director
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Add Bank Account Modal */}
      <Dialog open={addBankOpen} onClose={() => setAddBankOpen(false)} title="Add Bank Account" size="md">
        <div className="space-y-4">
          <Select
            label="Bank *"
            value={bankForm.bankCode}
            onChange={v => setBankForm(f => ({ ...f, bankCode: v }))}
            options={KENYAN_BANKS}
            placeholder="Select Kenyan Bank..."
          />
          <Input
            label="Account Number *"
            placeholder="Enter account number"
            value={bankForm.accountNumber}
            onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value }))}
          />
          <Input
            label="Account Name *"
            placeholder="As appearing on bank records"
            value={bankForm.accountName}
            onChange={e => setBankForm(f => ({ ...f, accountName: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Branch"
              placeholder="e.g. Nairobi CBD"
              value={bankForm.bankBranch}
              onChange={e => setBankForm(f => ({ ...f, bankBranch: e.target.value }))}
            />
            <Input
              label="SWIFT Code"
              placeholder="e.g. KCBLKENX"
              value={bankForm.swiftCode}
              onChange={e => setBankForm(f => ({ ...f, swiftCode: e.target.value }))}
            />
          </div>
          <Select
            label="Account Type"
            value={bankForm.type}
            onChange={v => setBankForm(f => ({ ...f, type: v }))}
            options={[
              { value: 'PESALINK', label: 'PesaLink', description: 'For PesaLink transfers up to KES 999,999' },
              { value: 'RTGS', label: 'RTGS', description: 'For large value transfers' },
              { value: 'FUNDING', label: 'Funding Account', description: 'Source of funds' },
            ]}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAddBankOpen(false)}>Cancel</Button>
          <Button onClick={() => addBankMutation.mutate(bankForm)} loading={addBankMutation.isLoading}>
            <Plus className="w-4 h-4" /> Add Account
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Confirm Remove */}
      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (!confirmRemove) return;
          if (confirmRemove.type === 'director') removeDirectorMutation.mutate(confirmRemove.id);
        }}
        title={`Remove ${confirmRemove?.type === 'director' ? 'Director' : 'Bank Account'}`}
        description={`Are you sure you want to remove ${confirmRemove?.name}? This cannot be undone.`}
        variant="destructive"
        loading={removeDirectorMutation.isLoading}
      />
    </div>
  );
}
