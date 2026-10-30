import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { AuthShell } from '../../components/auth/AuthShell';
import {
  errorBox,
  fieldInputWithIcon,
  fieldLabel,
  noticeBox,
  primaryButton,
  secondaryButton,
  textLink,
} from '../../components/auth/formStyles';
import { useAuth } from '../../context';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { homePathFor } from '../../utils/roleMapping';

// How long after a session ends the sign-in page still explains why.
const SESSION_NOTICE_MS = 15_000;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Set by the auth context just before it sends a signed-out student here.
  const [sessionEnded] = useState(() => {
    try {
      return Date.now() - Number(sessionStorage.getItem('sessionEndedAt') || 0) < SESSION_NOTICE_MS;
    } catch {
      return false;
    }
  });

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please complete all credential fields.');
      return;
    }

    setIsLoading(true);
    try {
      const { role, status, is_first_login } = await login(email, password, rememberMe, 'student');
      setIsLoading(false);
      // Institution accounts confirm an emailed code, which only their own sign-in page asks for.
      if (status === 'otp_required') {
        navigate('/admin/login', { state: { email: email.trim(), fromStudentPage: true } });
        return;
      }
      if (is_first_login) sessionStorage.setItem('cr_show_tour', '1');
      navigate(homePathFor(role));
    } catch (err: any) {
      console.error('[LoginPage] Login error:', err);
      setIsLoading(false);
      setErrorMsg(err.message || 'Invalid Email or Password.');
    }
  };



  const isEnterpriseRedirect = errorMsg.includes('Enterprise Portal') || errorMsg.includes('only for students');

  return (
    <AuthShell
      title="Sign in to CyberRange"
      subtitle="Pick up your labs, challenges and progress."
      footer={
        <>
          New to CyberRange?{' '}
          <Link to="/register" className={textLink}>Create a student account</Link>
          <span className="mx-2 text-slate-300">·</span>
          <Link to="/admin/login" className="text-slate-500 hover:text-slate-800 hover:underline">Institution sign-in</Link>
        </>
      }
    >
      {sessionEnded && !errorMsg && (
        <p className={`${noticeBox} mb-6`} role="status">Your session ended. Sign in again to continue.</p>
      )}
      {errorMsg && (
        <div className={`${errorBox} mb-6`} role="alert">
          <p>{errorMsg}</p>
          {isEnterpriseRedirect && (
            <button
              type="button"
              onClick={() => navigate('/admin/login')}
              className="mt-2 inline-flex items-center gap-1.5 font-semibold text-rose-800 hover:underline"
            >
              Go to the enterprise console <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleStandardSubmit} className="space-y-5">
        <div>
          <label htmlFor="login-email" className={fieldLabel}>Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="login-email"
              type={import.meta.env.DEV ? 'text' : 'email'}
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@college.edu"
              className={fieldInputWithIcon}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-medium text-slate-800">Password</label>
            <Link to="/forgot-password" className={`text-sm ${textLink}`}>Forgot password?</Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${fieldInputWithIcon} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-brand-600"
          />
          Keep me signed in
        </label>

        <button type="submit" disabled={isLoading} className={primaryButton}>
          {isLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>

        <div className="flex items-center gap-3 py-1 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          or
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <GoogleSignInButton
          portal="student"
          buttonText="Continue with Google"
          className={secondaryButton}
          onSuccess={(data) => navigate(homePathFor(data.role))}
          onError={(err) => setErrorMsg(err)}
        />
      </form>
    </AuthShell>
  );
};
