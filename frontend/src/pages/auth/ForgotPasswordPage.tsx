import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/services/api';
import { useState } from 'react';
import { extractApiError } from '@/lib/utils';
import { CheckCircle, Loader2 } from 'lucide-react';

const schema = z.object({
  email: z.string().email(),
});

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: { email: string }) => authApi.forgotPassword(data.email),
    onSuccess: () => setSent(true),
    onError: (err: unknown) => setError(extractApiError(err)),
  });

  if (sent) return (
    <div className="text-center">
      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-7 h-7 text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
      <p className="text-gray-500 text-sm mb-6">If that email is registered, we've sent a password reset link. Check your inbox.</p>
      <Link to="/login" className="text-blue-600 text-sm hover:underline">← Back to Sign In</Link>
    </div>
  );

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
        <p className="text-gray-500 text-sm mt-1">Enter your email to receive a reset link</p>
      </div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
      <form onSubmit={handleSubmit((d) => mutation.mutate(d as { email: string }))} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
          <input {...register('email')} type="email" placeholder="you@company.co.ke" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message as string}</p>}
        </div>
        <button type="submit" disabled={mutation.isPending} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2">
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Send Reset Link
        </button>
      </form>
      <div className="text-center mt-4"><Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">← Back to Sign In</Link></div>
    </div>
  );
}
