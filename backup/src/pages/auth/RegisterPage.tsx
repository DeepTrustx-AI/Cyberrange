import { apiFetch as routedApiFetch, parseApiErrorMessage } from '../../lib/api';
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Lock, ArrowLeft, Phone } from 'lucide-react';
import { AuthShell } from '../../components/auth/AuthShell';
import {
  errorBox,
  fieldHint,
  fieldInput,
  fieldInputWithIcon,
  fieldLabel,
  primaryButton,
  textLink,
} from '../../components/auth/formStyles';
import { PasswordStrengthMeter, evaluatePasswordPolicy } from '../../components/PasswordStrengthMeter';

export const RegisterPage: React.FC = () => {

  const [step, setStep] = useState<'details' | 'otp'>('details');

  // Form inputs — kept intentionally minimal. Everything else (college,
  // department, year, roll number, etc.) is filled in later from the
  // dashboard's "Update Profile" prompt, once the account exists.
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 6-Digit OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // 45s Cooldown Timer
  const [resendTimer, setResendTimer] = useState(45);
  const [isResendDisabled, setIsResendDisabled] = useState(true);

  useEffect(() => {
    let interval: any = null;
    if (step === 'otp' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setIsResendDisabled(false);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password.trim()) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await routedApiFetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fullName,
          email: email,
          password: password,
          phone: phone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(parseApiErrorMessage(errorData, 'Registration failed'));
      }

      setIsLoading(false);
      setStep('otp');
      setResendTimer(45);
      setIsResendDisabled(true);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'An error occurred during registration.');
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-advance focus to next digit
    if (value && index < 5) {
      otpInputRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otp.join('');
    if (fullCode.length !== 6) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await routedApiFetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          otp_code: fullCode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(parseApiErrorMessage(errorData, 'OTP verification failed'));
      }

      const data = await response.json();
      setIsLoading(false);

      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      window.location.href = '/dashboard';
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'OTP verification failed. Please try again.');
    }
  };

  const handleResendCode = () => {
    if (isResendDisabled) return;
    setOtp(['', '', '', '', '', '']);
    setResendTimer(45);
    setIsResendDisabled(true);
    otpInputRefs[0].current?.focus();
  };

  const iconClass = 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400';

  return (
    <AuthShell
      title={step === 'details' ? 'Create your account' : 'Check your email'}
      subtitle={
        step === 'details'
          ? 'Start practising on real, graded labs.'
          : <>We sent a 6-digit code to <span className="font-medium text-slate-800">{email}</span>.</>
      }
      footer={
        step === 'otp' ? (
          <button
            type="button"
            onClick={() => setStep('details')}
            className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to details
          </button>
        ) : (
          <>Already have an account? <Link to="/login" className={textLink}>Sign in</Link></>
        )
      }
    >
      {errorMsg && <div className={`${errorBox} mb-6`} role="alert">{errorMsg}</div>}

      {step === 'details' ? (
        <form onSubmit={handleDetailsSubmit} className="space-y-5">
          <div>
            <label htmlFor="reg-name" className={fieldLabel}>Full name</label>
            <div className="relative">
              <User className={iconClass} />
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Priya Sharma"
                className={fieldInputWithIcon}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-email" className={fieldLabel}>Email</label>
            <div className="relative">
              <Mail className={iconClass} />
              <input
                id="reg-email"
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

          <div>
            <label htmlFor="reg-phone" className={fieldLabel}>Phone number</label>
            <div className="relative">
              <Phone className={iconClass} />
              <input
                id="reg-phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={fieldInputWithIcon}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" className={fieldLabel}>Password</label>
            <div className="relative">
              <Lock className={iconClass} />
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldInputWithIcon}
              />
            </div>
            <PasswordStrengthMeter password={password} email={email} username={fullName} />
          </div>

          <p className={fieldHint}>You can add your college, department and other details later from your dashboard.</p>

          <button
            type="submit"
            disabled={isLoading || !evaluatePasswordPolicy(password, email, fullName).isValid}
            className={primaryButton}
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                Sending your code…
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="space-y-6">
          <fieldset>
            <legend className="sr-only">Verification code</legend>
            <div className="flex justify-between gap-2">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={otpInputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={digit}
                  aria-label={`Digit ${idx + 1}`}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className={`${fieldInput} h-14 w-12 px-0 text-center font-display text-xl font-semibold tabular`}
                />
              ))}
            </div>
          </fieldset>

          <button type="submit" disabled={isLoading || otp.join('').length !== 6} className={primaryButton}>
            {isLoading ? 'Verifying…' : 'Verify and continue'}
          </button>

          <p className="text-center text-sm text-slate-500">
            Didn't get it?{' '}
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isResendDisabled}
              className="font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            >
              {isResendDisabled ? <span className="tabular">Resend in {resendTimer}s</span> : 'Resend code'}
            </button>
          </p>
        </form>
      )}
    </AuthShell>
  );
};
