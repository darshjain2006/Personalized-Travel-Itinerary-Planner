import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, MapPin, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export const SignupPage: React.FC = () => {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: { pathname: string } | string })?.from;
  const from = typeof fromState === 'string' ? fromState : fromState?.pathname || '/dashboard';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordStrength = (() => {
    if (password.length === 0) return null;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthLabel = passwordStrength === null ? '' :
    passwordStrength <= 1 ? 'Weak' : passwordStrength <= 2 ? 'Fair' : passwordStrength <= 3 ? 'Good' : 'Strong';
  const strengthColor = passwordStrength === null ? '' :
    passwordStrength <= 1 ? 'bg-rose-500' : passwordStrength <= 2 ? 'bg-amber-500' : passwordStrength <= 3 ? 'bg-sky-500' : 'bg-emerald-500';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUpWithEmail(email, password, name);
      if (error) throw error;
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      setGoogleLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-5">
            <Mail size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Check your inbox</h2>
          <p className="mt-2 text-sm text-slate-400">
            We sent a confirmation email to <span className="text-slate-200 font-medium">{email}</span>. Click the link to activate your account.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => navigate('/login', { state: { from: location.state?.from } })}>
            Back to login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <MapPin size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-100 tracking-tight">Wandr</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Create your account</h1>
          <p className="mt-1.5 text-sm text-slate-400">Start planning smarter trips today</p>
        </div>

        <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800/60 rounded-2xl p-6 shadow-2xl shadow-black/40">
          {error && (
            <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="signup-name"
              type="text"
              label="Full name"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<User size={15} />}
              autoComplete="name"
              required
            />
            <Input
              id="signup-email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={15} />}
              autoComplete="email"
              required
            />
            <div>
              <Input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                label="Password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock size={15} />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
                autoComplete="new-password"
                required
              />
              {passwordStrength !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
                      style={{ width: `${(passwordStrength / 4) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-10">{strengthLabel}</span>
                </div>
              )}
            </div>
            <Input
              id="signup-confirm-password"
              type={showPassword ? 'text' : 'password'}
              label="Confirm password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<Lock size={15} />}
              error={confirmPassword && password !== confirmPassword ? "Passwords don't match" : undefined}
              autoComplete="new-password"
              required
            />

            <Button
              type="submit"
              fullWidth
              loading={loading}
              rightIcon={!loading && <ArrowRight size={15} />}
              className="mt-1"
            >
              Create account
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-500 font-medium">or</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <Button
            variant="outline"
            fullWidth
            onClick={handleGoogle}
            loading={googleLoading}
            leftIcon={<GoogleIcon />}
          >
            Continue with Google
          </Button>
        </div>

        <p className="mt-5 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" state={{ from: location.state?.from }} className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
