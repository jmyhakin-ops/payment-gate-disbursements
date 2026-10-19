import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { usersApi } from '@/services/api';
import { extractApiError } from '@/lib/utils';
import { CheckCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().optional(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Must contain uppercase, lowercase, number & special char'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export default function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const token = params.get('token') || '';

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: object) => usersApi.acceptInvitation({ token, ...data }),
    onSuccess: () => setDone(true),
    onError: (err: unknown) => setError(extractApiError(err)),
  });

  if (!token) return <div className="text-center text-red-600">Invalid invitation link</div>;

  if (done) return (
    <div className="text-center">
      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-7 h-7 text-green-600" /></div>
      <h2 className="text-xl font-bold mb-2">Account Created!</h2>
      <p className="text-gray-500 text-sm mb-4">Your account is ready. Sign in to get started.</p>
      <button onClick={() => navigate('/login')} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Sign In</button>
    </div>
  );

  return (
    <div>
      <div className="text-center mb-6"><h1 className="text-2xl font-bold">Accept Invitation</h1><p className="text-gray-500 text-sm mt-1">Set up your account to join your team</p></div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
            <input {...register('firstName')} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message as string}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
            <input {...register('lastName')} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message as string}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone (optional)</label>
          <input {...register('phone')} type="tel" placeholder="+254700000000" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
          <div className="relative">
            <input {...register('password')} type={showPw ? 'text' : 'password'} className="w-full px-3 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message as string}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
          <input {...register('confirmPassword')} type="password" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message as string}</p>}
        </div>
        <button type="submit" disabled={mutation.isPending} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2">
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Create Account
        </button>
      </form>
    </div>
  );
}
