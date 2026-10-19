import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Lock, Shield, Bell, Camera, QrCode, CheckCircle,
  AlertCircle, Save, Eye, EyeOff, Loader2, Copy, RefreshCw,
  Smartphone, Key, LogOut
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input, Select } from '../../components/ui/select';
import { Dialog, DialogFooter } from '../../components/ui/dialog';
import { useToast } from '../../components/ui/toaster';
import { useAuthStore } from '../../store/auth.store';
import { formatDate, cn } from '../../lib/utils';

const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'security', label: 'Security', icon: Lock },
  { key: 'two-factor', label: '2FA', icon: Shield },
  { key: 'notifications', label: 'Notifications', icon: Bell },
];

export default function ProfilePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const authUser = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  const [activeTab, setActiveTab] = useState('profile');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');

  const [profileForm, setProfileForm] = useState({
    firstName: authUser?.firstName ?? '',
    lastName: authUser?.lastName ?? '',
    phone: authUser?.phone ?? '',
    nationalId: authUser?.nationalId ?? '',
  });

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  const [notifPrefs, setNotifPrefs] = useState({
    emailPaymentCreated: true,
    emailPaymentApproved: true,
    emailPaymentFailed: true,
    smsPaymentCreated: false,
    smsPaymentApproved: true,
    smsPaymentFailed: true,
    pushNotifications: true,
  });

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/auth/me').then(r => r.data.data),
    onSuccess: (data: any) => {
      setProfileForm({
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        phone: data.phone ?? '',
        nationalId: data.nationalId ?? '',
      });
    },
  });

  const { data: setup2FA } = useQuery({
    queryKey: ['2fa-setup'],
    queryFn: () => api.post('/auth/2fa/setup').then(r => r.data.data),
    enabled: show2FASetup && !profile?.twoFactorEnabled,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (body: any) => api.put('/auth/me', body).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Profile Updated' });
      qc.invalidateQueries(['profile']);
    },
    onError: () => toast({ type: 'error', title: 'Update failed' }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (body: any) => api.post('/auth/change-password', body).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: 'Password Changed', description: 'Please log in with your new password.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (e: any) => {
      toast({ type: 'error', title: 'Password change failed', description: e?.response?.data?.message });
    },
  });

  const enable2FAMutation = useMutation({
    mutationFn: (token: string) => api.post('/auth/2fa/enable', { token }).then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: '2FA Enabled! 🔐', description: 'Your account is now protected with two-factor authentication.' });
      qc.invalidateQueries(['profile']);
      setShow2FASetup(false);
      setVerifyCode('');
    },
    onError: () => toast({ type: 'error', title: 'Invalid verification code' }),
  });

  const disable2FAMutation = useMutation({
    mutationFn: () => api.post('/auth/2fa/disable').then(r => r.data),
    onSuccess: () => {
      toast({ type: 'success', title: '2FA Disabled' });
      qc.invalidateQueries(['profile']);
    },
    onError: () => toast({ type: 'error', title: 'Failed to disable 2FA' }),
  });

  const handleChangePassword = () => {
    const errs: Record<string, string> = {};
    if (!passwordForm.currentPassword) errs.currentPassword = 'Required';
    if (!passwordForm.newPassword) errs.newPassword = 'Required';
    else if (passwordForm.newPassword.length < 8) errs.newPassword = 'Min 8 characters';
    if (passwordForm.newPassword !== passwordForm.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setPasswordErrors(errs);
    if (Object.keys(errs).length) return;
    changePasswordMutation.mutate(passwordForm);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ type: 'success', title: 'Copied to clipboard' });
  };

  const TOGGLE = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} className={cn(
      'relative inline-flex h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors',
      value ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
    )}>
      <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition', value ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {profile?.firstName?.[0]}{profile?.lastName?.[0]}
          </div>
          <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-slate-700 rounded-full shadow flex items-center justify-center border border-slate-200 dark:border-slate-600">
            <Camera className="w-3 h-3 text-slate-500" />
          </button>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {profile?.firstName} {profile?.lastName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="default">{profile?.role?.replace('_', ' ')}</Badge>
            <Badge variant={profile?.twoFactorEnabled ? 'success' : 'warning'}>
              {profile?.twoFactorEnabled ? '2FA On' : '2FA Off'}
            </Badge>
            <span className="text-xs text-slate-400">Member since {formatDate(profile?.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Tab Nav */}
        <div className="w-48 flex-shrink-0 space-y-1">
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
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
          <button
            onClick={() => { logout(); window.location.href = '/login'; }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left mt-4"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {/* Panel */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-5">Personal Information</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={profileForm.firstName}
                    onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))}
                  />
                  <Input
                    label="Last Name"
                    value={profileForm.lastName}
                    onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
                <Input
                  label="Email Address"
                  value={profile?.email ?? ''}
                  disabled
                  hint="Email cannot be changed. Contact your administrator."
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Phone Number"
                    type="tel"
                    placeholder="+254..."
                    value={profileForm.phone}
                    onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                  />
                  <Input
                    label="National ID"
                    value={profileForm.nationalId}
                    onChange={e => setProfileForm(f => ({ ...f, nationalId: e.target.value }))}
                    hint="Required for director approval actions"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Role</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{profile?.role?.replace('_', ' ')}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Last Login</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{profile?.lastLogin ? formatDate(profile.lastLogin) : 'Never'}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                  <Button onClick={() => updateProfileMutation.mutate(profileForm)} loading={updateProfileMutation.isLoading}>
                    <Save className="w-4 h-4" /> Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-5">Change Password</h2>
              <div className="space-y-4 max-w-md">
                <div className="relative">
                  <Input
                    label="Current Password *"
                    type={showCurrentPw ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                    error={passwordErrors.currentPassword}
                  />
                  <button type="button" className="absolute right-3 top-9 text-slate-400" onClick={() => setShowCurrentPw(v => !v)}>
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    label="New Password *"
                    type={showNewPw ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                    error={passwordErrors.newPassword}
                    hint="Min 8 characters. Include uppercase, numbers, and symbols."
                  />
                  <button type="button" className="absolute right-3 top-9 text-slate-400" onClick={() => setShowNewPw(v => !v)}>
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Input
                  label="Confirm New Password *"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  error={passwordErrors.confirmPassword}
                />

                {/* Password strength */}
                {passwordForm.newPassword && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Password strength:</p>
                    <div className="flex gap-1">
                      {['Weak', 'Fair', 'Good', 'Strong'].map((level, i) => {
                        const score = Math.min(4, [
                          passwordForm.newPassword.length >= 8,
                          /[A-Z]/.test(passwordForm.newPassword),
                          /[0-9]/.test(passwordForm.newPassword),
                          /[^A-Za-z0-9]/.test(passwordForm.newPassword),
                        ].filter(Boolean).length);
                        const colors = ['bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];
                        return (
                          <div key={level} className={cn('h-1.5 flex-1 rounded-full', i < score ? colors[score - 1] : 'bg-slate-200')} />
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button onClick={handleChangePassword} loading={changePasswordMutation.isLoading} className="mt-2">
                  <Lock className="w-4 h-4" /> Update Password
                </Button>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Active Sessions</h3>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-indigo-500" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Current Session</p>
                    <p className="text-xs text-slate-400">Web Browser · Last active now</p>
                  </div>
                  <Badge variant="success">Current</Badge>
                </div>
              </div>
            </div>
          )}

          {/* 2FA Tab */}
          {activeTab === 'two-factor' && (
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">Two-Factor Authentication</h2>
              <p className="text-sm text-slate-500 mb-6">Add an extra layer of security with TOTP (Google Authenticator, Authy, etc.)</p>

              {profile?.twoFactorEnabled ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                    <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-700 dark:text-green-400">2FA is Enabled</p>
                      <p className="text-sm text-green-600 dark:text-green-500">Your account is protected by two-factor authentication.</p>
                    </div>
                  </div>
                  <Button variant="destructive" onClick={() => disable2FAMutation.mutate()} loading={disable2FAMutation.isLoading}>
                    Disable Two-Factor Authentication
                  </Button>
                </div>
              ) : !show2FASetup ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-8 h-8 text-amber-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-700 dark:text-amber-400">2FA is Disabled</p>
                      <p className="text-sm text-amber-600 dark:text-amber-500">Enable 2FA to protect your account from unauthorized access.</p>
                    </div>
                  </div>
                  <Button onClick={() => setShow2FASetup(true)}>
                    <Shield className="w-4 h-4" /> Enable Two-Factor Authentication
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400">
                    <p>📱 Install <strong>Google Authenticator</strong> or <strong>Authy</strong>, then scan the QR code below.</p>
                  </div>

                  {setup2FA?.qrCode && (
                    <div className="flex flex-col items-center gap-4 p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                      <img src={setup2FA.qrCode} alt="2FA QR Code" className="w-48 h-48 rounded-lg" />
                      <div className="text-center">
                        <p className="text-xs text-slate-400 mb-1">Or enter this secret manually:</p>
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg">
                          <code className="text-sm font-mono text-slate-700 dark:text-slate-300 tracking-widest">{setup2FA.secret}</code>
                          <button onClick={() => copyToClipboard(setup2FA.secret)}>
                            <Copy className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <Input
                    label="Enter 6-digit verification code from your app"
                    placeholder="000000"
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="text-center text-2xl tracking-widest font-mono"
                    maxLength={6}
                  />

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShow2FASetup(false)}>Cancel</Button>
                    <Button
                      onClick={() => enable2FAMutation.mutate(verifyCode)}
                      loading={enable2FAMutation.isLoading}
                      disabled={verifyCode.length !== 6}
                    >
                      <CheckCircle className="w-4 h-4" /> Verify & Enable 2FA
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-5">Notification Preferences</h2>
              <div className="space-y-0">
                {[
                  { key: 'emailPaymentCreated', label: 'Email when payment created', desc: 'You created a new payment request' },
                  { key: 'emailPaymentApproved', label: 'Email when payment approved', desc: 'Your payment request was approved' },
                  { key: 'emailPaymentFailed', label: 'Email when payment fails', desc: 'A payment you initiated failed' },
                  { key: 'smsPaymentCreated', label: 'SMS when payment created', desc: 'SMS alert on new payment creation' },
                  { key: 'smsPaymentApproved', label: 'SMS when payment approved', desc: 'SMS on approval actions' },
                  { key: 'smsPaymentFailed', label: 'SMS when payment fails', desc: 'SMS alert on payment failure' },
                  { key: 'pushNotifications', label: 'Push notifications (mobile)', desc: 'In-app alerts on the Android app' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
                      <p className="text-xs text-slate-400">{desc}</p>
                    </div>
                    <TOGGLE
                      value={notifPrefs[key as keyof typeof notifPrefs]}
                      onChange={v => setNotifPrefs(p => ({ ...p, [key]: v }))}
                    />
                  </div>
                ))}
              </div>
              <div className="pt-4 flex justify-end">
                <Button onClick={() => toast({ type: 'success', title: 'Preferences saved' })}>
                  <Save className="w-4 h-4" /> Save Preferences
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
