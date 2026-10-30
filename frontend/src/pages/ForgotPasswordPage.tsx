import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const ForgotPasswordPage: React.FC = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-brand-600/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <MapPin size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-100 tracking-tight">Wandr</span>
          </div>
        </div>

        {sent ? (
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800/60 rounded-2xl p-7 shadow-2xl shadow-black/40 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">Email sent!</h2>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              If <span className="text-slate-200 font-medium">{email}</span> has an account, you'll receive a password reset link shortly.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 mt-6 text-sm text-brand-400 hover:text-brand-300 font-medium transition-colors"
            >
              <ArrowLeft size={14} />
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-slate-100">Forgot password?</h1>
              <p className="mt-1.5 text-sm text-slate-400">
                Enter your email and we'll send a reset link
              </p>
            </div>

            <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800/60 rounded-2xl p-6 shadow-2xl shadow-black/40">
              {error && (
                <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm px-4 py-3">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  id="forgot-email"
                  type="email"
                  label="Email address"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail size={15} />}
                  autoComplete="email"
                  required
                />
                <Button type="submit" fullWidth loading={loading} className="mt-1">
                  Send reset link
                </Button>
              </form>
            </div>

            <p className="mt-5 text-center text-sm text-slate-400">
              Remember your password?{' '}
              <Link
                to="/login"
                className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};
