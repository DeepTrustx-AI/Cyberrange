import { apiFetch as routedApiFetch } from '../../lib/api';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { AuthShell } from '../../components/auth/AuthShell';
import { errorBox, fieldInputWithIcon, fieldLabel, primaryButton } from '../../components/auth/formStyles';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid work email address.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await routedApiFetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to dispatch recovery email.');
      }
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title={isSuccess ? 'Check your inbox' : 'Reset your password'}
      subtitle={
        isSuccess
          ? <>If an account uses <span className="font-medium text-slate-800">{email}</span>, reset instructions will arrive shortly. Look in spam too.</>
          : "Enter the email linked to your account and we'll send you a reset link."
      }
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      }
    >
      {!isSuccess ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMsg && <div className={errorBox} role="alert">{errorMsg}</div>}
          <div>
            <label htmlFor="forgot-email" className={fieldLabel}>Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                className={fieldInputWithIcon}
              />
            </div>
          </div>
          <button type="submit" disabled={isLoading} className={primaryButton}>
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                Sending link…
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </form>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p>The reset link expires in 15 minutes.</p>
        </div>
      )}
    </AuthShell>
  );
};
