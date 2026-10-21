import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { usersApi } from '@/services/api';
import { extractApiError } from '@/lib/utils';
import { CheckCircle, Eye, EyeOff, Loader2, AlertCircle, Building2, ShieldCheck, Mail } from 'lucide-react';

const schema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9])/, 'Must contain uppercase, lowercase, number & a special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const token = (params.get('token') || '').trim();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Verify invitation token on load
  const {
    data: inviteData,
    isLoading: isVerifying,
    error: verifyError,
  } = useQuery({
    queryKey: ['invitation', token],
    queryFn: async () => {
      const res = await usersApi.getInvitation(token);
      return res.data?.data;
    },
    enabled: Boolean(token),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => usersApi.acceptInvitation({ token, ...data }),
    onSuccess: () => {
      setDone(true);
      setSubmitError('');
    },
    onError: (err: unknown) => {
      setSubmitError(extractApiError(err));
    },
  });

  if (!token) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Missing Invitation Token</h2>
        <p className="text-gray-500 text-sm mb-4">The invitation link is invalid or incomplete. Please check the link from your email.</p>
        <Link to="/login" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">
          Return to Sign In
        </Link>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-xl shadow-sm border border-gray-200 text-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <h2 className="text-base font-semibold text-gray-800">Verifying your invitation...</h2>
        <p className="text-xs text-gray-500 mt-1">Please wait a moment</p>
      </div>
    );
  }

  if (verifyError) {
    const errorMsg = extractApiError(verifyError);
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200 text-center">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Unable to Accept Invitation</h2>
        <p className="text-gray-600 text-sm mb-5">{errorMsg}</p>
        <Link to="/login" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
          Go to Sign In
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200 text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Account Created Successfully!</h2>
        <p className="text-gray-600 text-sm mb-6">
          Your account is active. You can now sign in with your email and password to access the portal.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors shadow-sm"
        >
          Sign In Now
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Accept Invitation</h1>
        <p className="text-gray-500 text-sm mt-1">Set up your account to join your organization</p>
      </div>

      {inviteData && (
        <div className="mb-5 p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1.5 text-blue-900">
          <div className="flex items-center gap-2 font-medium">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Organization: {inviteData.organizationName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span>Email: <strong>{inviteData.email}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Role: <strong className="uppercase">{inviteData.role?.replace(/_/g, ' ')}</strong></span>
          </div>
        </div>
      )}

      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">First Name *</label>
            <input
              {...register('firstName')}
              placeholder="e.g. John"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name *</label>
            <input
              {...register('lastName')}
              placeholder="e.g. Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number (optional)</label>
          <input
            {...register('phone')}
            type="tel"
            placeholder="+254700000000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Password *</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPw ? 'text' : 'password'}
              placeholder="At least 8 chars, 1 uppercase, 1 number, 1 special"
              className="w-full px-3 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm Password *</label>
          <div className="relative">
            <input
              {...register('confirmPassword')}
              type={showConfirmPw ? 'text' : 'password'}
              placeholder="Repeat your password"
              className="w-full px-3 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPw(!showConfirmPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors shadow-sm"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating Account...</span>
            </>
          ) : (
            'Create Account & Join'
          )}
        </button>
      </form>
    </div>
  );
}
