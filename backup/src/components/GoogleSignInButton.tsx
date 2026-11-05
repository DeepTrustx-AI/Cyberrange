import { authFetch } from '../lib/api';
import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useAuth } from '../context';
import { secondaryButton } from './auth/formStyles';

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_SCRIPT_TIMEOUT_MS = 15_000;
const GOOGLE_BUTTON_MAX_WIDTH = 400; // Maximum supported by Google's rendering API.
let googleScript: Promise<void> | null = null;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  googleScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      googleScript = null;
      reject(new Error('Google sign-in did not load.'));
    };
    const timeout = window.setTimeout(fail, GOOGLE_SCRIPT_TIMEOUT_MS);
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (!window.google?.accounts?.id) {
        fail();
        return;
      }
      window.clearTimeout(timeout);
      resolve();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return googleScript;
}

interface GoogleSignInButtonProps {
  portal: 'student' | 'admin';
  onSuccess: (data: any) => void;
  onError: (errorMsg: string) => void;
  buttonText?: string;
  className?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  portal,
  onSuccess,
  onError,
  buttonText = 'Continue with Google',
  className = '',
}) => {
  const { setSessionToken } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const buttonRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const authenticatingRef = useRef(false);

  const clientId: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const configured = clientId.trim() !== '' && !clientId.startsWith('your-');

  // The SDK subscription keeps the current portal and callbacks without reinitializing
  // whenever a parent renders. Google invokes it only after a real button interaction.
  const handleCredentialResponse = useEffectEvent(async (response: any, isCurrent: () => boolean) => {
    if (authenticatingRef.current || !isCurrent()) return;
    if (!response?.credential) {
      onError('Google did not return a sign-in token. Please try again.');
      return;
    }
    authenticatingRef.current = true;
    setIsAuthenticating(true);
    try {
      const data = await authFetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential, portal }),
      });
      if (!isCurrent()) return;
      if (!data.success || !data.token) {
        throw new Error(data.message || 'Unable to complete Google sign-in. Please try again.');
      }
      await setSessionToken(data.token, data.user);
      if (!isCurrent()) return;
      if (data.role) localStorage.setItem('role', data.role);
      onSuccess(data);
    } catch (err: any) {
      if (isCurrent()) onError(err.message || 'Unable to complete Google sign-in. Please try again.');
    } finally {
      authenticatingRef.current = false;
      if (isCurrent()) setIsAuthenticating(false);
    }
  });

  const reportLoadFailure = useEffectEvent(() => {
    onError('Google sign-in could not load. Check your connection and retry, or sign in with your email.');
  });

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const target = buttonRef.current;
    setIsReady(false);
    setLoadFailed(false);

    loadGoogleScript().then(() => {
      if (cancelled || !target) return;
      const gis = window.google.accounts.id;
      gis.initialize({
        client_id: clientId,
        callback: (response: any) => handleCredentialResponse(response, () => !cancelled),
        auto_select: false,
        ux_mode: 'popup',
      });
      let renderedWidth = 0;
      const renderButton = () => {
        const width = Math.min(
          GOOGLE_BUTTON_MAX_WIDTH,
          Math.floor(containerRef.current?.getBoundingClientRect().width || GOOGLE_BUTTON_MAX_WIDTH),
        );
        if (width === renderedWidth) return;
        renderedWidth = width;
        target.replaceChildren();
        gis.renderButton(target, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          type: 'standard',
          width,
        });
      };
      renderButton();
      observer = new ResizeObserver(renderButton);
      if (containerRef.current) observer.observe(containerRef.current);
      setIsReady(true);
    }).catch(() => {
      if (cancelled) return;
      setLoadFailed(true);
      reportLoadFailure();
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      target?.replaceChildren();
    };
  }, [clientId, configured, portal, loadAttempt]);

  return (
    <div ref={containerRef} className="relative flex h-12 w-full items-center justify-center" role="group" aria-label={buttonText}>
      {/* Keep Google's real, keyboard-accessible button visible and directly clickable.
          Synthetic clicks on a hidden button cannot reliably launch Google's flow. */}
      <div ref={buttonRef} hidden={!isReady || isAuthenticating} />
      {(!isReady || isAuthenticating) && (
        <button
          type="button"
          disabled={!configured || !loadFailed || isAuthenticating}
          onClick={() => setLoadAttempt((attempt) => attempt + 1)}
          className={className || secondaryButton}
          aria-busy={(configured && !loadFailed) || isAuthenticating}
        >
          <span role="status">
            {!configured ? 'Google sign-in is not configured.'
              : isAuthenticating ? 'Verifying Google identity…'
                : loadFailed ? 'Retry Google sign-in'
                  : 'Loading Google sign-in…'}
          </span>
        </button>
      )}
    </div>
  );
};
