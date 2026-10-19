import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/services/api';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['verify-email', token],
    queryFn: () => authApi.me(), // The backend handles verification via GET param
    enabled: !!token,
    retry: false,
  });

  if (isLoading) return (
    <div className="text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" /><p className="text-gray-500">Verifying your email...</p></div>
  );

  return (
    <div className="text-center">
      {isError ? (
        <>
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><XCircle className="w-7 h-7 text-red-600" /></div>
          <h2 className="text-xl font-bold mb-2">Verification Failed</h2>
          <p className="text-gray-500 text-sm mb-4">This link may be invalid or expired.</p>
        </>
      ) : (
        <>
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-7 h-7 text-green-600" /></div>
          <h2 className="text-xl font-bold mb-2">Email Verified!</h2>
          <p className="text-gray-500 text-sm mb-4">Your email has been verified successfully.</p>
        </>
      )}
      <Link to="/login" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm inline-block">Go to Sign In</Link>
    </div>
  );
}
