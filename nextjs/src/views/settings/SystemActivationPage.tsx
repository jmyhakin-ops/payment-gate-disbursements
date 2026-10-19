import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, CheckCircle, XCircle, Clock, AlertTriangle, Shield,
  Key, Copy, RefreshCw, Loader2, Building2, ArrowRight, Sparkles
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/select';
import { useToast } from '../../components/ui/toaster';
import { formatDate, cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';

export default function SystemActivationPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const org = useAuthStore(s => s.organization);

  const [activationCode, setActivationCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const { data: status, isLoading } = useQuery({
    queryKey: ['activation-status'],
    queryFn: () => api.get('/organizations/me').then(r => r.data.data),
    refetchInterval: 10000,
  });

  const activateMutation = useMutation({
    mutationFn: (code: string) => api.post('/organizations/me/activate', { activationCode: code }).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: '🎉 System Activated!', description: 'Your organization is now fully operational.' });
      qc.invalidateQueries(['activation-status']);
      qc.invalidateQueries(['organization']);
    },
    onError: (e: any) => {
      setCodeError(e?.response?.data?.message ?? 'Invalid or expired activation code');
    },
  });

  const handleActivate = () => {
    if (!activationCode.trim()) { setCodeError('Please enter your activation code'); return; }
    if (activationCode.trim().length < 6) { setCodeError('Activation code must be at least 6 characters'); return; }
    setCodeError('');
    activateMutation.mutate(activationCode.trim().toUpperCase());
  };

  const isActive = status?.status === 'ACTIVE';
  const isPending = status?.status === 'PENDING';
  const isSuspended = status?.status === 'SUSPENDED';

  const steps = [
    {
      step: 1, title: 'Organization Registered',
      desc: 'Company details, directors, and bank accounts configured',
      done: true, icon: Building2,
    },
    {
      step: 2, title: 'Admin Review',
      desc: 'Super admin reviews and approves your organization',
      done: !isPending, icon: Shield,
      pending: isPending,
    },
    {
      step: 3, title: 'Receive Activation Code',
      desc: 'An activation code will be emailed to your registered address',
      done: isActive, icon: Key,
      pending: !isActive && !isPending,
    },
    {
      step: 4, title: 'Enter Activation Code',
      desc: 'Enter the code below to activate your system',
      done: isActive, icon: Zap,
    },
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className={cn(
          'w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg',
          isActive ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-indigo-500 to-purple-600'
        )}>
          {isActive ? <CheckCircle className="w-10 h-10 text-white" /> : <Zap className="w-10 h-10 text-white" />}
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isActive ? '✅ System Active' : 'System Activation'}
        </h1>
        <p className="text-slate-500 mt-2">
          {isActive
            ? `${status?.name} is fully operational. All payment rails are enabled.`
            : 'Activate your organization to start processing payments'}
        </p>
      </div>

      {/* Status Card */}
      <div className={cn(
        'rounded-2xl border-2 p-6',
        isActive ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' :
        isSuspended ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' :
        'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
      )}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Organization Status</p>
            <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">{status?.name}</p>
          </div>
          <Badge
            variant={isActive ? 'success' : isSuspended ? 'destructive' : 'warning'}
            className="text-sm px-4 py-1.5"
          >
            {status?.status}
          </Badge>
        </div>
        {status?.activatedAt && (
          <p className="text-sm text-slate-500 mt-3">
            Activated on {formatDate(status.activatedAt)}
          </p>
        )}
        {isSuspended && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Your organization has been suspended. Contact support at support@kenyapay.co.ke
          </div>
        )}
      </div>

      {/* Progress Steps */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-6">Activation Progress</h2>
        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={step.step} className="flex items-start gap-4">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold',
                step.done ? 'bg-green-500 text-white' :
                step.pending ? 'bg-yellow-500 text-white animate-pulse' :
                'bg-slate-200 dark:bg-slate-700 text-slate-400'
              )}>
                {step.done ? <CheckCircle className="w-4 h-4" /> : step.pending ? <Clock className="w-4 h-4" /> : step.step}
              </div>
              <div className="flex-1 pb-4 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <p className={cn('font-semibold text-sm', step.done ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-slate-100')}>
                  {step.title}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activation Form (only if not active) */}
      {!isActive && !isSuspended && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-500" /> Enter Activation Code
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            Enter the activation code sent to your registered email address after admin approval.
          </p>

          <div className="space-y-4">
            <Input
              label="Activation Code"
              placeholder="e.g. KP-XXXX-XXXX-XXXX"
              value={activationCode}
              onChange={e => { setActivationCode(e.target.value.toUpperCase()); setCodeError(''); }}
              error={codeError}
              className="font-mono text-lg tracking-widest text-center uppercase"
              maxLength={20}
            />

            <Button
              className="w-full"
              size="lg"
              onClick={handleActivate}
              loading={activateMutation.isLoading}
              disabled={!activationCode.trim()}
            >
              <Sparkles className="w-5 h-5" />
              Activate System
            </Button>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400 space-y-1">
              <p className="font-semibold flex items-center gap-1.5"><Shield className="w-4 h-4" /> Important Notes:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Activation codes expire after 72 hours</li>
                <li>Codes are single-use — once activated they cannot be reused</li>
                <li>Ensure all directors are configured before activating</li>
                <li>API credentials should be saved before processing payments</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Active — quick links */}
      {isActive && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            🚀 Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Configure API Credentials', href: '/settings/api-credentials', icon: Key },
              { label: 'Add Directors', href: '/organization', icon: Shield },
              { label: 'Make a Payment', href: '/payments/new', icon: Zap },
              { label: 'View Dashboard', href: '/', icon: Sparkles },
            ].map(({ label, href, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
              >
                <Icon className="w-5 h-5 text-indigo-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                <ArrowRight className="w-4 h-4 ml-auto text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
