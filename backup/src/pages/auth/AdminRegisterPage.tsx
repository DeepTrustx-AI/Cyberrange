import { apiFetch as routedApiFetch, makeUnconfiguredOrgName, parseApiErrorMessage } from '../../lib/api';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { AuthShell } from '../../components/auth/AuthShell';
import { errorBox, fieldHint, fieldInput, fieldLabel, primaryButton, textLink } from '../../components/auth/formStyles';

import { useAuth } from '../../context';
import { PasswordStrengthMeter, evaluatePasswordPolicy } from '../../components/PasswordStrengthMeter';

export const AdminRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSessionToken } = useAuth();

  const [step, setStep] = useState<'form' | 'verification'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form inputs — kept intentionally minimal. Organization, address, GST and
  // designation are filled in later from the admin dashboard's "Update
  // Profile" prompt, once the account exists.
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const policy = evaluatePasswordPolicy(password, email, adminName);
    if (!policy.isValid) {
      setError('Password does not meet platform security requirements.');
      return;
    }

    setLoading(true);
    try {
      const res = await routedApiFetch('/api/v1/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_name: adminName,
          email,
          phone,
          password,
          // The backend's org/address fields are still required server-side —
          // this form just doesn't ask for them up front. primary_affiliation_type
          // "organization" (rather than the default "college") skips the
          // college_id requirement; a clearly-not-real name plus blank address
          // fields let the admin fill in the real institution later from
          // "Update Profile" without any backend change.
          primary_affiliation_type: 'organization',
          organization_name: makeUnconfiguredOrgName(email),
          institution_type: 'Company',
          address: '',
          country: '',
          state: '',
          city: '',
          pincode: ''
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(parseApiErrorMessage(data, 'Registration failed.'));
      }

      if (data.access_token) {
        await setSessionToken(data.access_token, data.user);
        localStorage.setItem('role', 'admin');
      }

      setStep('verification');
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      audience="enterprise"
      title={step === 'form' ? 'Register your institution' : 'Account created'}
      subtitle={
        step === 'form'
          ? 'Create the primary admin account. You can add institution details later.'
          : <>We sent a verification code to <span className="font-medium text-slate-800">{email}</span>. Verify it to unlock every admin feature.</>
      }
      footer={step === 'form' ? <>Already registered? <Link to="/admin/login" className={textLink}>Sign in</Link></> : undefined}
    >
      {step === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className={errorBox} role="alert">{error}</div>}

          <div>
            <label htmlFor="ar-name" className={fieldLabel}>Full name</label>
            <input
              id="ar-name"
              type="text"
              autoComplete="name"
              required
              placeholder="Dr. Meera Iyer"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className={fieldInput}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="ar-email" className={fieldLabel}>Official email</label>
              <input
                id="ar-email"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@institution.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldInput}
              />
            </div>
            <div>
              <label htmlFor="ar-phone" className={fieldLabel}>Phone number</label>
              <input
                id="ar-phone"
                type="tel"
                autoComplete="tel"
                required
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={fieldInput}
              />
            </div>
          </div>

          <div>
            <label htmlFor="ar-password" className={fieldLabel}>Password</label>
            <input
              id="ar-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldInput}
            />
            <PasswordStrengthMeter password={password} email={email} username={adminName} />
          </div>

          <div>
            <label htmlFor="ar-confirm" className={fieldLabel}>Confirm password</label>
            <input
              id="ar-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={fieldInput}
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">Passwords do not match</p>
            )}
          </div>

          <p className={fieldHint}>Institution name, address and other organisation details can be added from your admin dashboard.</p>

          <button type="submit" disabled={loading} className={primaryButton}>
            {loading ? 'Creating account…' : 'Create admin account'}
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>Registration complete.</p>
          </div>
          <button onClick={() => navigate('/admin/dashboard')} className={primaryButton}>
            Go to admin dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </AuthShell>
  );
};
