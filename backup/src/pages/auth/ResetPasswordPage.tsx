import { apiFetch as routedApiFetch, parseApiErrorMessage } from '../../lib/api';
import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { AuthShell } from '../../components/auth/AuthShell';
import { errorBox, fieldInputWithIcon, fieldLabel, primaryButton } from '../../components/auth/formStyles';
import { PasswordStrengthMeter, evaluatePasswordPolicy } from '../../components/PasswordStrengthMeter';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [isTokenExpired, setIsTokenExpired] = useState(searchParams.get('token') === 'expired');
  const [errorMsg, setErrorMsg] = useState('');
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordValid = evaluatePasswordPolicy(newPassword).isValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const policy = evaluatePasswordPolicy(newPassword);
    if (!policy.isValid || newPassword !== confirmPassword) {
      setErrorMsg('Password does not meet platform security policy or passwords do not match.');
      return;
    }
    if (!token) {
      setIsTokenExpired(true);
      return;
    }
    setIsLoading(true);
    try {
      const response = await routedApiFetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.message && (data.message.toLowerCase().includes('expired') || data.message.toLowerCase().includes('token'))) {
          setIsTokenExpired(true);
          return;
        }
        // Token errors use AppError, which serializes to a top-level
        // `message` (handled above); password-validation failures raise a
        // raw HTTPException with detail={message, errors} instead — this
        // covers that second shape too, rather than falling through to a
        // generic "Failed to reset password."
        throw new Error(parseApiErrorMessage(data, 'Failed to reset password.'));
      }
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const iconClass = 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400';

  return (
    <AuthShell
      title={isTokenExpired ? 'This link has expired' : isSuccess ? 'Password updated' : 'Choose a new password'}
      subtitle={
        isTokenExpired
          ? 'Reset links work once and expire after 15 minutes. Request a new one to continue.'
          : isSuccess
            ? 'You can now sign in with your new password.'
            : 'Use something you have not used here before.'
      }
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      }
    >
      {isTokenExpired ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>This reset link has expired or was already used.</p>
          </div>
          <Link to="/forgot-password" className={primaryButton}>Request a new link</Link>
        </div>
      ) : isSuccess ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>Your password has been reset.</p>
          </div>
          <Link to="/login" className={primaryButton}>Continue to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMsg && <div className={errorBox} role="alert">{errorMsg}</div>}

          <div>
            <label htmlFor="reset-password" className={fieldLabel}>New password</label>
            <div className="relative">
              <Lock className={iconClass} />
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${fieldInputWithIcon} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrengthMeter password={newPassword} />
          </div>

          <div>
            <label htmlFor="reset-confirm" className={fieldLabel}>Confirm new password</label>
            <div className="relative">
              <Lock className={iconClass} />
              <input
                id="reset-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={fieldInputWithIcon}
              />
            </div>
            {confirmPassword && (
              <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${isMatching ? 'text-emerald-700' : 'text-rose-600'}`}>
                {isMatching ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {isMatching ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !isPasswordValid || !isMatching}
            className={primaryButton}
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Save new password'
            )}
          </button>
        </form>
      )}
    </AuthShell>
  );
};
