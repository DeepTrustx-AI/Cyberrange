import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Eye, EyeOff, AlertTriangle, Key } from 'lucide-react';
import { AuthShell } from '../../components/auth/AuthShell';
import {
  fieldHint,
  fieldInputWithIcon,
  fieldLabel,
  primaryButton,
  secondaryButton,
  textLink,
} from '../../components/auth/formStyles';
import { useAuth } from '../../context';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { homePathFor } from '../../utils/roleMapping';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  // Sent here from the student page with an institution account: keep the email typed there.
  const arrival = useLocation().state as { email?: string; fromStudentPage?: boolean } | null;

  const [email, setEmail] = useState(arrival?.email ?? '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLockedOut, setIsLockedOut] = useState(false);

  // OTP view control state
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLockedOut(false);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please complete all admin credential fields.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(email.trim(), password, rememberMe, 'admin', otpRequired ? otpCode : undefined);
      setIsLoading(false);

      if (res && res.status === 'otp_required') {
        setOtpRequired(true);
      } else {
        if (res?.is_first_login) sessionStorage.setItem('cr_show_tour', '1');
        navigate(homePathFor(res?.role));
      }
    } catch (err: any) {
      setIsLoading(false);
      if (err.message && err.message.includes('locked')) {
        setIsLockedOut(true);
      }
      setErrorMsg(err.message || 'Invalid Official Administrator Credentials.');
    }
  };

  const isStudentRedirect = errorMsg.includes('verified academic institutions') || errorMsg.includes('institutional administrator');

  const iconClass = 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400';

  return (
    <AuthShell
      audience="enterprise"
      title={otpRequired ? 'Enter your verification code' : 'Institution sign-in'}
      subtitle={
        otpRequired
          ? <>We sent a 6-digit code to <span className="font-medium text-slate-800">{email}</span>.</>
          : arrival?.fromStudentPage
            ? 'This is an institution account, so it signs in here.'
            : 'Manage students, labs, assignments and reports for your institution.'
      }
      footer={
        <div className="space-y-1.5">
          <p>Registering a new institution? <Link to="/admin/register" className={textLink}>Create an admin account</Link></p>
          <p>Studying on CyberRange? <Link to="/login" className={textLink}>Student sign-in</Link></p>
        </div>
      }
    >
      {errorMsg && (
        <div
          role="alert"
          className={`mb-6 rounded-lg border px-3.5 py-3 text-sm ${
            isLockedOut ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </p>
          {isStudentRedirect && (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="mt-2 inline-flex items-center gap-1.5 pl-6 font-semibold hover:underline"
            >
              Go to student sign-in <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {!otpRequired ? (
        <form onSubmit={handleAdminSubmit} className="space-y-5">
          <div>
            <label htmlFor="admin-email" className={fieldLabel}>Work email</label>
            <div className="relative">
              <Mail className={iconClass} />
              <input
                id="admin-email"
                type={import.meta.env.DEV ? 'text' : 'email'}
                autoComplete="email"
                required
                placeholder="you@institution.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldInputWithIcon}
              />
            </div>
            <p className={fieldHint}>Use your institutional administrator account.</p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="admin-password" className="text-sm font-medium text-slate-800">Password</label>
              <Link to="/admin/forgot-password" className={`text-sm ${textLink}`}>Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock className={iconClass} />
              <input
                id="admin-password"
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

          <button type="submit" disabled={isLoading || isLockedOut} className={primaryButton}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="flex items-center gap-3 py-1 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <GoogleSignInButton
            portal="admin"
            buttonText="Continue with institutional Google"
            className={secondaryButton}
            onSuccess={(data) => navigate(homePathFor(data.role))}
            onError={(err) => setErrorMsg(err)}
          />
        </form>
      ) : (
        <form onSubmit={handleAdminSubmit} className="space-y-5">
          <div>
            <label htmlFor="admin-otp" className={fieldLabel}>Verification code</label>
            <div className="relative">
              <Key className={iconClass} />
              <input
                id="admin-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                placeholder="6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className={`${fieldInputWithIcon} tabular tracking-[0.3em]`}
              />
            </div>
          </div>

          <button type="submit" disabled={isLoading || otpCode.length !== 6} className={primaryButton}>
            {isLoading ? 'Verifying…' : 'Verify and sign in'}
          </button>

          <button
            type="button"
            onClick={() => {
              setOtpRequired(false);
              setOtpCode('');
              setErrorMsg('');
            }}
            className="w-full py-1 text-center text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            Back to email and password
          </button>
        </form>
      )}
    </AuthShell>
  );
};
