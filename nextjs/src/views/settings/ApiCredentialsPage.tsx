import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings, Save, RefreshCw, Key, TestTube, Eye, EyeOff, CheckCircle,
  XCircle, Plus, Trash2, AlertTriangle, Shield, Loader2, ExternalLink,
  Wifi, WifiOff, Copy, RotateCcw
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogFooter, ConfirmDialog } from '../../components/ui/dialog';
import { Select, Input } from '../../components/ui/select';
import { useToast } from '../../components/ui/toaster';
import { cn } from '../../lib/utils';

const RAILS = [
  {
    key: 'MPESA_B2C', label: 'M-Pesa B2C', icon: '📱', color: 'from-green-500 to-emerald-600',
    description: 'Safaricom Daraja API — Pay customers directly to M-Pesa wallets',
    docs: 'https://developer.safaricom.co.ke',
    fields: [
      { key: 'consumerKey', label: 'Consumer Key', type: 'text', required: true },
      { key: 'consumerSecret', label: 'Consumer Secret', type: 'password', required: true },
      { key: 'shortcode', label: 'Shortcode (Initiator)', type: 'text', required: true },
      { key: 'initiatorName', label: 'Initiator Name', type: 'text', required: true },
      { key: 'initiatorPassword', label: 'Security Credential (Encrypted)', type: 'password', required: true },
      { key: 'passkey', label: 'Lipa Na M-Pesa Passkey', type: 'password', required: false },
      { key: 'b2cResultUrl', label: 'B2C Result URL', type: 'url', required: true },
      { key: 'b2cQueueTimeoutUrl', label: 'Queue Timeout URL', type: 'url', required: true },
      { key: 'baseUrl', label: 'API Base URL', type: 'url', required: true },
      { key: 'environment', label: 'Environment', type: 'select', options: ['sandbox', 'production'], required: true },
    ],
  },
  {
    key: 'MPESA_B2B', label: 'M-Pesa B2B', icon: '🏪', color: 'from-emerald-500 to-teal-600',
    description: 'Safaricom Daraja API — Pay to Paybill & Buy Goods tills',
    docs: 'https://developer.safaricom.co.ke',
    fields: [
      { key: 'consumerKey', label: 'Consumer Key', type: 'text', required: true },
      { key: 'consumerSecret', label: 'Consumer Secret', type: 'password', required: true },
      { key: 'shortcode', label: 'Shortcode', type: 'text', required: true },
      { key: 'initiatorName', label: 'Initiator Name', type: 'text', required: true },
      { key: 'initiatorPassword', label: 'Initiator Password', type: 'password', required: true },
      { key: 'b2bResultUrl', label: 'Result URL', type: 'url', required: true },
      { key: 'environment', label: 'Environment', type: 'select', options: ['sandbox', 'production'], required: true },
    ],
  },
  {
    key: 'PESALINK', label: 'PesaLink (KEPSS)', icon: '🏦', color: 'from-blue-500 to-indigo-600',
    description: 'Kenya Bankers Association — Real-time interbank transfers up to KES 999,999',
    docs: 'https://pesalink.co.ke',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
      { key: 'institutionCode', label: 'Institution Code', type: 'text', required: true },
      { key: 'accountNumber', label: 'Debit Account Number', type: 'text', required: true },
      { key: 'callbackUrl', label: 'Callback URL', type: 'url', required: true },
      { key: 'environment', label: 'Environment', type: 'select', options: ['sandbox', 'production'], required: true },
    ],
  },
  {
    key: 'EQUITY_JENGA', label: 'Equity Jenga API', icon: '🔷', color: 'from-red-500 to-rose-600',
    description: 'Equity Bank Open API — Account transfers and bank payments',
    docs: 'https://developer.jengahq.io',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
      { key: 'merchantCode', label: 'Merchant Code', type: 'text', required: true },
      { key: 'privateKey', label: 'RSA Private Key (PEM)', type: 'textarea', required: true },
      { key: 'accountNumber', label: 'Debit Account Number', type: 'text', required: true },
      { key: 'callbackUrl', label: 'Callback URL', type: 'url', required: true },
      { key: 'environment', label: 'Environment', type: 'select', options: ['uat', 'production'], required: true },
    ],
  },
  {
    key: 'KCB_OPENBANKING', label: 'KCB Open Banking', icon: '🟩', color: 'from-green-600 to-green-700',
    description: 'KCB Bank API — Account-to-account transfers',
    docs: 'https://developer.kcbgroup.com',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { key: 'accountNumber', label: 'Debit Account Number', type: 'text', required: true },
      { key: 'callbackUrl', label: 'Callback URL', type: 'url', required: true },
      { key: 'environment', label: 'Environment', type: 'select', options: ['uat', 'production'], required: true },
    ],
  },
  {
    key: 'RTGS', label: 'RTGS / EFT', icon: '💸', color: 'from-violet-500 to-purple-600',
    description: 'Kenya Electronic Payment & Settlement System — Large value transfers',
    docs: 'https://centralbank.go.ke',
    fields: [
      { key: 'bankCode', label: 'Bank Code (CBK)', type: 'text', required: true },
      { key: 'branchCode', label: 'Branch Code', type: 'text', required: true },
      { key: 'accountNumber', label: 'Account Number', type: 'text', required: true },
      { key: 'apiKey', label: 'SWIFT API Key', type: 'password', required: true },
      { key: 'callbackUrl', label: 'Callback URL', type: 'url', required: true },
    ],
  },
  {
    key: 'SMTP', label: 'Email (SMTP)', icon: '📧', color: 'from-slate-500 to-slate-600',
    description: 'Outbound email for notifications, alerts, and reports',
    docs: '',
    fields: [
      { key: 'host', label: 'SMTP Host', type: 'text', required: true },
      { key: 'port', label: 'Port', type: 'text', required: true },
      { key: 'username', label: 'Username / Email', type: 'text', required: true },
      { key: 'password', label: 'Password / App Token', type: 'password', required: true },
      { key: 'fromName', label: 'From Name', type: 'text', required: true },
      { key: 'fromEmail', label: 'From Email', type: 'email', required: true },
      { key: 'secure', label: 'TLS/SSL', type: 'select', options: ['true', 'false'], required: false },
    ],
  },
  {
    key: 'AFRICAS_TALKING', label: "Africa's Talking (SMS)", icon: '📨', color: 'from-orange-500 to-amber-600',
    description: "Africa's Talking SMS gateway for alerts and OTP delivery",
    docs: 'https://africastalking.com',
    fields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'senderId', label: 'Sender ID', type: 'text', required: false },
      { key: 'environment', label: 'Environment', type: 'select', options: ['sandbox', 'production'], required: true },
    ],
  },
];

export default function ApiCredentialsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeRail, setActiveRail] = useState(RAILS[0].key);
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingRail, setTestingRail] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: credentialsData, isLoading } = useQuery({
    queryKey: ['api-credentials'],
    queryFn: () => api.get('/settings/api-credentials').then(r => r.data.data),
    onSuccess: (data: any[]) => {
      const f: Record<string, Record<string, string>> = {};
      data.forEach((cred: any) => {
        if (cred.rail && cred.credentials) {
          f[cred.rail] = cred.credentials;
        }
      });
      setForms(f);
    },
  });

  const credentials: any[] = credentialsData ?? [];

  const saveMutation = useMutation({
    mutationFn: ({ rail, creds }: { rail: string; creds: Record<string, string> }) =>
      api.post('/settings/api-credentials', { rail, credentials: creds }).then(r => r.data),
    onSuccess: (_, { rail }) => {
      toast({ type: 'success', title: `${rail} credentials saved`, description: 'Credentials encrypted with AES-256' });
      qc.invalidateQueries(['api-credentials']);
    },
    onError: () => toast({ type: 'error', title: 'Failed to save credentials' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (rail: string) => api.delete(`/settings/api-credentials/${rail}`).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Credentials deleted' });
      qc.invalidateQueries(['api-credentials']);
      setConfirmDelete(null);
    },
  });

  const testConnection = async (rail: string) => {
    setTestingRail(rail);
    try {
      const res = await api.post(`/settings/api-credentials/${rail}/test`);
      setTestResult(prev => ({ ...prev, [rail]: { ok: true, message: res.data.message ?? 'Connection successful!' } }));
    } catch (e: any) {
      setTestResult(prev => ({ ...prev, [rail]: { ok: false, message: e?.response?.data?.message ?? 'Connection failed' } }));
    } finally {
      setTestingRail(null);
    }
  };

  const activeRailConfig = RAILS.find(r => r.key === activeRail)!;
  const activeCred = credentials.find(c => c.rail === activeRail);
  const form = forms[activeRail] ?? {};

  const setField = (key: string, value: string) => {
    setForms(prev => ({ ...prev, [activeRail]: { ...prev[activeRail], [key]: value } }));
  };

  const toggleSecret = (key: string) => setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Key className="w-7 h-7 text-indigo-600" />
            API Credentials
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            All credentials are encrypted with AES-256 at rest. Configure payment rail APIs here.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2">
          <Shield className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">AES-256 Encrypted Storage</span>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Rail Sidebar */}
        <div className="w-64 flex-shrink-0 space-y-2">
          {RAILS.map(rail => {
            const saved = credentials.some(c => c.rail === rail.key);
            const result = testResult[rail.key];
            return (
              <button
                key={rail.key}
                onClick={() => setActiveRail(rail.key)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                  activeRail === rail.key
                    ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-200'
                )}
              >
                <span className="text-xl">{rail.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{rail.label}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {saved ? (result ? (result.ok ? '✅ Connected' : '❌ Failed') : '🔑 Saved') : '⚠️ Not configured'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Form */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${activeRailConfig.color} flex items-center justify-center text-xl`}>
                {activeRailConfig.icon}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{activeRailConfig.label}</h2>
                <p className="text-sm text-slate-500">{activeRailConfig.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeRailConfig.docs && (
                <Button variant="ghost" size="sm" onClick={() => window.open(activeRailConfig.docs, '_blank')}>
                  <ExternalLink className="w-4 h-4" /> Docs
                </Button>
              )}
              {activeCred && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={testingRail === activeRail}
                    onClick={() => testConnection(activeRail)}
                  >
                    <TestTube className="w-4 h-4" /> Test Connection
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(activeRail)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Test Result Banner */}
          {testResult[activeRail] && (
            <div className={cn(
              'mb-4 p-3 rounded-xl border flex items-center gap-2 text-sm',
              testResult[activeRail].ok
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            )}>
              {testResult[activeRail].ok
                ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                : <XCircle className="w-4 h-4 flex-shrink-0" />
              }
              {testResult[activeRail].message}
            </div>
          )}

          {/* Credential Status Badge */}
          {activeCred && (
            <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              Credentials saved · Last updated {new Date(activeCred.updatedAt).toLocaleDateString()}
              <Badge variant={activeCred.isActive ? 'success' : 'secondary'}>
                {activeCred.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          )}

          <div className="space-y-4">
            {activeRailConfig.fields.map(field => (
              <div key={field.key}>
                {field.type === 'select' ? (
                  <Select
                    label={`${field.label}${field.required ? ' *' : ''}`}
                    value={form[field.key] ?? ''}
                    onChange={v => setField(field.key, v)}
                    options={(field.options ?? []).map(o => ({ value: o, label: o.charAt(0).toUpperCase() + o.slice(1) }))}
                  />
                ) : field.type === 'textarea' ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      {field.label}{field.required && ' *'}
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                      rows={6}
                      placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                      value={form[field.key] ?? ''}
                      onChange={e => setField(field.key, e.target.value)}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      {field.label}{field.required && ' *'}
                    </label>
                    <div className="relative">
                      <input
                        type={field.type === 'password' && !showSecrets[field.key] ? 'password' : (field.type === 'password' ? 'text' : field.type)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-3 py-2 pr-10 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={activeCred && field.type === 'password' ? '••••••••••••••••' : `Enter ${field.label.toLowerCase()}...`}
                        value={form[field.key] ?? ''}
                        onChange={e => setField(field.key, e.target.value)}
                      />
                      {field.type === 'password' && (
                        <button
                          type="button"
                          onClick={() => toggleSecret(field.key)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showSecrets[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              Stored encrypted. Never visible in plaintext after saving.
            </p>
            <Button onClick={() => saveMutation.mutate({ rail: activeRail, creds: form })} loading={saveMutation.isLoading}>
              <Save className="w-4 h-4" /> {activeCred ? 'Update' : 'Save'} Credentials
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
        title="Delete API Credentials"
        description={`Delete all saved credentials for ${RAILS.find(r => r.key === confirmDelete)?.label}? The rail will stop working immediately.`}
        confirmLabel="Delete Credentials"
        loading={deleteMutation.isLoading}
      />
    </div>
  );
}
