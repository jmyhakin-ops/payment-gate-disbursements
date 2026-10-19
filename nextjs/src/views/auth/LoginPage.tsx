import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { extractApiError } from '@/lib/utils';
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  twoFactorToken: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [pending2FAUserId, setPending2FAUserId] = useState('');
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({ resolver: zodResolver(schema) });

  const loginMutation = useMutation({
    mutationFn: (data: FormData) => authApi.login(data.email, data.password),
    onSuccess: async (res) => {
      const { data } = res.data;
      if (res.data.requiresTwoFactor) {
        setRequires2FA(true);
        setPending2FAUserId(res.data.userId);
        return;
      }
      // Use the user object returned from login directly — no need to call me()
      setAuth(data.accessToken, data.refreshToken, data.user);
      navigate(from, { replace: true });
    },
    onError: (err: unknown) => setError(extractApiError(err)),
  });

  const twoFaMutation = useMutation({
    mutationFn: (token: string) => authApi.verify2fa(pending2FAUserId, token),
    onSuccess: async (res) => {
      const { data } = res.data;
      // Use the user object returned from 2FA verify directly
      setAuth(data.accessToken, data.refreshToken, data.user);
      navigate(from, { replace: true });
    },
    onError: (err: unknown) => setError(extractApiError(err)),
  });


  const onSubmit = (data: FormData) => {
    setError('');
    if (requires2FA) {
      twoFaMutation.mutate(data.twoFactorToken || '');
    } else {
      loginMutation.mutate(data);
    }
  };

  const isLoading = loginMutation.isPending || twoFaMutation.isPending;

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {requires2FA ? 'Two-Factor Authentication' : 'Welcome back'}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {requires2FA
            ? 'Enter the 6-digit code from your authenticator app'
            : 'Sign in to your KenyaPay account'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <span className="text-red-500 text-sm flex-1">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {!requires2FA ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.co.ke"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">6-Digit Code</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                {...register('twoFactorToken')}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-center text-xl tracking-widest font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">Open your authenticator app (Google Authenticator, Authy) to get the code</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLoading ? 'Please wait...' : requires2FA ? 'Verify & Sign In' : 'Sign In'}
        </button>

        {requires2FA && (
          <button
            type="button"
            onClick={() => { setRequires2FA(false); setError(''); }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
          >
            ← Back to login
          </button>
        )}
      </form>

      {!requires2FA && (
        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> 256-bit SSL</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full" /> CBK Compliant</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-500 rounded-full" /> 2FA Support</div>
          </div>
        </div>
      )}
    </div>
  );
}
