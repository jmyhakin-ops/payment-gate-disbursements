import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/services/api';
import { extractApiError } from '@/lib/utils';
import { CheckCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

const schema = z.object({
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Must contain uppercase, lowercase, number and special char'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const token = params.get('token') || '';

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: { password: string }) => authApi.resetPassword(token, data.password),
    onSuccess: () => setDone(true),
    onError: (err: unknown) => setError(extractApiError(err)),
  });

  if (!token) return (
    <div className="text-center"><p className="text-red-600">Invalid reset link. Please request a new one.</p><Link to="/forgot-password" className="text-blue-600 text-sm mt-2 block">Request new link</Link></div>
  );

  if (done) return (
    <div className="text-center">
      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-7 h-7 text-green-600" /></div>
      <h2 className="text-xl font-bold mb-2">Password Reset!</h2>
      <p className="text-gray-500 text-sm mb-4">Your password has been changed. You can now sign in.</p>
      <button onClick={() => navigate('/login')} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Sign In</button>
    </div>
  );

  return (
    <div>
      <div className="text-center mb-8"><h1 className="text-2xl font-bold text-gray-900">Reset Password</h1><p className="text-gray-500 text-sm mt-1">Enter your new password below</p></div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
      <form onSubmit={handleSubmit((d) => mutation.mutate(d as { password: string }))} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
          <div className="relative">
            <input {...register('password')} type={showPw ? 'text' : 'password'} className="w-full px-4 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message as string}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
          <input {...register('confirmPassword')} type="password" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message as string}</p>}
        </div>
        <button type="submit" disabled={mutation.isPending} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2">
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Reset Password
        </button>
      </form>
    </div>
  );
}
