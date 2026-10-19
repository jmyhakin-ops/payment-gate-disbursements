import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings, Bell, Shield, Lock, Moon, Sun, Globe, DollarSign,
  Save, RefreshCw, Loader2, AlertTriangle, Clock, Mail, MessageSquare
} from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Select, Input } from '../../components/ui/select';
import { useToast } from '../../components/ui/toaster';
import { cn } from '../../lib/utils';

const TABS = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security & Limits', icon: Shield },
  { key: 'approval', label: 'Approval Workflow', icon: Clock },
  { key: 'localization', label: 'Localization', icon: Globe },
];

const TOGGLE = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className={cn(
      'relative inline-flex h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
      value ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
    )}
  >
    <span className={cn(
      'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
      value ? 'translate-x-5' : 'translate-x-0'
    )} />
  </button>
);

export default function SettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');

  const [settings, setSettings] = useState<Record<string, any>>({
    systemName: 'KenyaPay Platform',
    supportEmail: 'support@kenyapay.co.ke',
    supportPhone: '+254700000000',
    timezone: 'Africa/Nairobi',
    currency: 'KES',
    dateFormat: 'DD/MM/YYYY',
    // Notifications
    emailOnTransaction: true,
    smsOnTransaction: false,
    emailOnApproval: true,
    smsOnApproval: true,
    emailOnFailed: true,
    smsOnFailed: true,
    // Security
    maxLoginAttempts: '5',
    sessionTimeoutMinutes: '60',
    requireTwoFactor: false,
    ipWhitelistEnabled: false,
    // Approval
    makerCheckerEnabled: true,
    directorApprovalEnabled: true,
    checkerThreshold: '10000',
    directorThreshold: '100000',
    approvalTimeoutHours: '48',
    requireTwoDirectors: false,
    autoRejectExpired: true,
    // Localization
    language: 'en',
    phonePrefix: '+254',
  });

  const { isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data.data),
    onSuccess: (data: any) => {
      if (data && typeof data === 'object') {
        setSettings(prev => ({ ...prev, ...data }));
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => api.put('/settings', body).then(r => r.data),
    onSuccess: () => toast({ type: 'success', title: 'Settings saved successfully' }),
    onError: () => toast({ type: 'error', title: 'Failed to save settings' }),
  });

  const set = (key: string, value: any) => setSettings(prev => ({ ...prev, [key]: value }));

  const SettingRow = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <div className="flex-1 mr-6">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
        {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-7 h-7 text-indigo-600" />
            System Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">Configure platform-wide behavior and preferences</p>
        </div>
        <Button onClick={() => saveMutation.mutate(settings)} loading={saveMutation.isLoading}>
          <Save className="w-4 h-4" /> Save All Changes
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Tab Nav */}
        <div className="w-52 flex-shrink-0 space-y-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors text-left',
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Settings Panel */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">General Settings</h2>
              <div className="space-y-0">
                <SettingRow label="System / Platform Name" desc="Displayed in emails, reports, and the mobile app">
                  <Input value={settings.systemName} onChange={e => set('systemName', e.target.value)} className="w-64" />
                </SettingRow>
                <SettingRow label="Support Email" desc="Users can contact this address for help">
                  <Input type="email" value={settings.supportEmail} onChange={e => set('supportEmail', e.target.value)} className="w-64" />
                </SettingRow>
                <SettingRow label="Support Phone" desc="Displayed in notifications and alerts">
                  <Input type="tel" value={settings.supportPhone} onChange={e => set('supportPhone', e.target.value)} className="w-48" />
                </SettingRow>
                <SettingRow label="Default Currency" desc="All amounts displayed in this currency">
                  <Select
                    value={settings.currency}
                    onChange={v => set('currency', v)}
                    options={[{ value: 'KES', label: 'KES — Kenyan Shilling' }, { value: 'USD', label: 'USD — US Dollar' }]}
                    className="w-48"
                  />
                </SettingRow>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Notification Settings</h2>
              <div className="space-y-0">
                <SettingRow label="Email on Transaction Initiated" desc="Send email when payment is created">
                  <TOGGLE value={settings.emailOnTransaction} onChange={v => set('emailOnTransaction', v)} />
                </SettingRow>
                <SettingRow label="SMS on Transaction Initiated" desc="Send SMS alert on new payment">
                  <TOGGLE value={settings.smsOnTransaction} onChange={v => set('smsOnTransaction', v)} />
                </SettingRow>
                <SettingRow label="Email on Approval Required" desc="Notify checker/director when approval needed">
                  <TOGGLE value={settings.emailOnApproval} onChange={v => set('emailOnApproval', v)} />
                </SettingRow>
                <SettingRow label="SMS on Approval Required" desc="SMS alert for pending approvals">
                  <TOGGLE value={settings.smsOnApproval} onChange={v => set('smsOnApproval', v)} />
                </SettingRow>
                <SettingRow label="Email on Failed Payment" desc="Alert admins when a payment fails">
                  <TOGGLE value={settings.emailOnFailed} onChange={v => set('emailOnFailed', v)} />
                </SettingRow>
                <SettingRow label="SMS on Failed Payment" desc="SMS alert for failed disbursements">
                  <TOGGLE value={settings.smsOnFailed} onChange={v => set('smsOnFailed', v)} />
                </SettingRow>
              </div>
            </div>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Security & Access Control</h2>
              <div className="space-y-0">
                <SettingRow label="Require 2FA for All Users" desc="Enforce TOTP two-factor authentication">
                  <TOGGLE value={settings.requireTwoFactor} onChange={v => set('requireTwoFactor', v)} />
                </SettingRow>
                <SettingRow label="IP Whitelist" desc="Restrict access to listed IP addresses only">
                  <TOGGLE value={settings.ipWhitelistEnabled} onChange={v => set('ipWhitelistEnabled', v)} />
                </SettingRow>
                <SettingRow label="Max Login Attempts" desc="Lock account after this many failures">
                  <Select
                    value={settings.maxLoginAttempts}
                    onChange={v => set('maxLoginAttempts', v)}
                    options={['3', '5', '10', '20'].map(n => ({ value: n, label: n + ' attempts' }))}
                    className="w-36"
                  />
                </SettingRow>
                <SettingRow label="Session Timeout" desc="Auto-logout idle sessions after this period">
                  <Select
                    value={settings.sessionTimeoutMinutes}
                    onChange={v => set('sessionTimeoutMinutes', v)}
                    options={[
                      { value: '15', label: '15 minutes' },
                      { value: '30', label: '30 minutes' },
                      { value: '60', label: '1 hour' },
                      { value: '120', label: '2 hours' },
                      { value: '480', label: '8 hours' },
                    ]}
                    className="w-36"
                  />
                </SettingRow>
              </div>
            </div>
          )}

          {/* Approval Workflow */}
          {activeTab === 'approval' && (
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Approval Workflow</h2>
              <p className="text-sm text-slate-500 mb-4">Configure the Maker → Checker → Director authorization chain</p>
              <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 text-sm text-indigo-700 dark:text-indigo-400">
                <p className="font-semibold mb-1">Current Flow:</p>
                <p className="font-mono text-xs">Maker creates → Checker approves → Director approves → Payment processes</p>
              </div>
              <div className="space-y-0">
                <SettingRow label="Enable Maker-Checker" desc="Require checker approval before director step">
                  <TOGGLE value={settings.makerCheckerEnabled} onChange={v => set('makerCheckerEnabled', v)} />
                </SettingRow>
                <SettingRow label="Director Final Approval" desc="Directors must authorize before funds disburse">
                  <TOGGLE value={settings.directorApprovalEnabled} onChange={v => set('directorApprovalEnabled', v)} />
                </SettingRow>
                <SettingRow label="Checker Threshold (KES)" desc="Transactions above this amount require checker">
                  <Input
                    type="number" value={settings.checkerThreshold}
                    onChange={e => set('checkerThreshold', e.target.value)}
                    className="w-36"
                  />
                </SettingRow>
                <SettingRow label="Director Threshold (KES)" desc="Transactions above this need director approval">
                  <Input
                    type="number" value={settings.directorThreshold}
                    onChange={e => set('directorThreshold', e.target.value)}
                    className="w-36"
                  />
                </SettingRow>
                <SettingRow label="Approval Timeout (hours)" desc="Auto-expire pending approvals after this time">
                  <Select
                    value={settings.approvalTimeoutHours}
                    onChange={v => set('approvalTimeoutHours', v)}
                    options={['12', '24', '48', '72', '168'].map(v => ({ value: v, label: v + ' hours' }))}
                    className="w-36"
                  />
                </SettingRow>
                <SettingRow label="Require 2 Directors" desc="Both directors must approve (if applicable)">
                  <TOGGLE value={settings.requireTwoDirectors} onChange={v => set('requireTwoDirectors', v)} />
                </SettingRow>
                <SettingRow label="Auto-reject on Timeout" desc="Automatically reject expired approvals">
                  <TOGGLE value={settings.autoRejectExpired} onChange={v => set('autoRejectExpired', v)} />
                </SettingRow>
              </div>
            </div>
          )}

          {/* Localization */}
          {activeTab === 'localization' && (
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Localization</h2>
              <div className="space-y-0">
                <SettingRow label="System Language" desc="Default UI language">
                  <Select
                    value={settings.language}
                    onChange={v => set('language', v)}
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'sw', label: 'Kiswahili' },
                    ]}
                    className="w-40"
                  />
                </SettingRow>
                <SettingRow label="Timezone" desc="All times displayed in this timezone">
                  <Select
                    value={settings.timezone}
                    onChange={v => set('timezone', v)}
                    options={[
                      { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT +3)' },
                      { value: 'UTC', label: 'UTC' },
                    ]}
                    className="w-52"
                  />
                </SettingRow>
                <SettingRow label="Date Format" desc="How dates are displayed throughout the system">
                  <Select
                    value={settings.dateFormat}
                    onChange={v => set('dateFormat', v)}
                    options={[
                      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (Kenya)' },
                      { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
                      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
                    ]}
                    className="w-48"
                  />
                </SettingRow>
                <SettingRow label="Phone Number Prefix" desc="Default country code for phone fields">
                  <Select
                    value={settings.phonePrefix}
                    onChange={v => set('phonePrefix', v)}
                    options={[{ value: '+254', label: '+254 (Kenya)' }, { value: '+256', label: '+256 (Uganda)' }]}
                    className="w-40"
                  />
                </SettingRow>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
