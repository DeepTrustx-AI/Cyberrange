import React, {
  createContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { apiFetch as baseApiFetch, authFetch } from '../lib/api';

const TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const REFRESH_LEAD_MS = 5 * 60_000;

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked or quota exceeded; fall back to in-memory/cookie auth.
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage blocked.
  }
}

function clearLabLocalStorage(userId?: number | null): void {
  try {
    const keysToDelete: string[] = [];
    const userPrefix = userId != null ? `cg_u${userId}_` : null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith('cisf_grid_') ||
        k.startsWith('cg_anon_') ||
        k.startsWith('cr-editor-draft:') ||
        k.startsWith('cg-layout-') ||
        k.startsWith('cg-tour-') ||
        k.startsWith('cg-story-') ||
        (userPrefix ? k.startsWith(userPrefix) : k.startsWith('cg_u'))
      ) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      localStorage.removeItem(k);
    }
  } catch {
    // Storage blocked.
  }
  try {
    const sessionKeys: string[] = [];
    const userPrefix = userId != null ? `cg_u${userId}_` : null;
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith('cisf_grid_') ||
        k.startsWith('cg_anon_') ||
        k.startsWith('cr-editor-draft:') ||
        (userPrefix ? k.startsWith(userPrefix) : k.startsWith('cg_u'))
      ) {
        sessionKeys.push(k);
      }
    }
    for (const k of sessionKeys) {
      sessionStorage.removeItem(k);
    }
  } catch {
    // Storage blocked.
  }
}

function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function decodeJwtExpMs(token: string | null): number | null {
  const payload = decodeJwtPayload(token);
  return payload && typeof payload.exp === 'number' && Number.isFinite(payload.exp)
    ? payload.exp * 1000
    : null;
}

function decodeJwtSub(token: string | null): string | null {
  const payload = decodeJwtPayload(token);
  return payload && typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  account_type?: string;
  profile_completed?: boolean;
  profile_photo?: string;
  total_score?: number;
  phone?: string;
  auth_type?: 'INDIVIDUAL' | 'SSO';
}

export interface AuthorizationInfo {
  user_id: number;
  legacy_role: string;
  roles: string[];
  capabilities: string[];
  scopes: Array<{
    binding_id: number;
    role: string;
    scope_type: 'GLOBAL' | 'ORGANIZATION' | 'COLLEGE' | 'UNSCOPED';
    organization_id?: number | null;
    college_id?: number | null;
  }>;
  professor_profile?: {
    id: number;
    department?: string | null;
    academic_title?: string | null;
    employee_id?: string | null;
    office?: string | null;
  } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  authorization: AuthorizationInfo | null;
  hasCapability: (capability: string) => boolean;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
    portal?: 'student' | 'admin',
    otpCode?: string
  ) => Promise<{ role: string; user?: any; status?: string; message?: string; is_first_login?: boolean }>;
  setSessionToken: (token: string, userData?: User) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => safeGetItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);
  const [authorization, setAuthorization] = useState<AuthorizationInfo | null>(null);
  const tokenRef = useRef<string | null>(token);
  const userIdRef = useRef<number | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }
    const task = (async () => {
      try {
        const storedRefresh = safeGetItem(REFRESH_TOKEN_KEY);
        const body = storedRefresh ? JSON.stringify({ refresh_token: storedRefresh }) : '{}';
        const response = await baseApiFetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          credentials: 'include',
        });
        if (!response.ok) return null;
        const data = (await response.json().catch(() => null)) as {
          token?: unknown;
          refresh_token?: unknown;
        } | null;
        if (!data || typeof data.token !== 'string' || !data.token) {
          return null;
        }
        safeSetItem(TOKEN_KEY, data.token);
        if (typeof data.refresh_token === 'string' && data.refresh_token) {
          safeSetItem(REFRESH_TOKEN_KEY, data.refresh_token);
        }
        tokenRef.current = data.token;
        setToken(data.token);
        return data.token;
      } catch {
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();
    refreshPromiseRef.current = task;
    return task;
  }, []);

  // Proactive JWT refresh 5 minutes before expiry + on tab wake from sleep.
  useEffect(() => {
    if (!token) return;
    const expMs = decodeJwtExpMs(token);
    if (!expMs) return;

    const triggerIfDue = () => {
      const latestExp = decodeJwtExpMs(tokenRef.current);
      if (!latestExp) return;
      if (latestExp - Date.now() <= REFRESH_LEAD_MS) {
        void refreshAccessToken();
      }
    };

    const delayMs = Math.max(1_000, expMs - Date.now() - REFRESH_LEAD_MS);
    const timer = window.setTimeout(triggerIfDue, delayMs);
    const onVisibility = () => {
      if (!document.hidden) triggerIfDue();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [token, refreshAccessToken]);

  // Sync cross-tab re-login or sign-out via localStorage events without split-brain user/token state.
  useEffect(() => {
    let seq = 0;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== TOKEN_KEY) return;
      const prevToken = tokenRef.current;
      const nextToken = event.newValue;
      if (nextToken === prevToken) return;
      seq += 1;
      const curSeq = seq;
      tokenRef.current = nextToken;
      setToken(nextToken);
      if (!nextToken) {
        setUser(null);
        setAuthorization(null);
        return;
      }
      const prevSub = decodeJwtSub(prevToken);
      const nextSub = decodeJwtSub(nextToken);
      if (prevSub !== nextSub || userIdRef.current === null) {
        setUser(null);
        setAuthorization(null);
        setIsLoading(true);
        void (async () => {
          try {
            const meRes = await baseApiFetch('/api/v1/auth/me', {
              headers: { Authorization: `Bearer ${nextToken}` },
              credentials: 'include',
            });
            if (curSeq !== seq || tokenRef.current !== nextToken) return;
            if (!meRes.ok) {
              setUser(null);
              setAuthorization(null);
              return;
            }
            const nextUser = (await meRes.json()) as User;
            if (curSeq !== seq || tokenRef.current !== nextToken) return;
            setUser(nextUser);
            const rbacRes = await baseApiFetch('/api/v1/rbac/me', {
              headers: { Authorization: `Bearer ${nextToken}` },
              credentials: 'include',
            });
            if (curSeq !== seq || tokenRef.current !== nextToken) return;
            setAuthorization(rbacRes.ok ? ((await rbacRes.json()) as AuthorizationInfo) : null);
          } catch {
            if (curSeq === seq) {
              setUser(null);
              setAuthorization(null);
            }
          } finally {
            if (curSeq === seq) setIsLoading(false);
          }
        })();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      seq += 1;
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Back after signing out can bring the old page back from the browser's memory, still showing
  // the last screen. If the sign-in changed since the page was kept, load it again from scratch.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && tokenRef.current !== safeGetItem(TOKEN_KEY)) {
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const loadAuthorization = useCallback(async (explicitToken?: string | null) => {
    const currentToken = explicitToken ?? tokenRef.current;
    if (!currentToken) {
      setAuthorization(null);
      return null;
    }
    try {
      const response = await baseApiFetch('/api/v1/rbac/me', {
        headers: { Authorization: `Bearer ${currentToken}` },
        credentials: 'include',
      });
      if (!response.ok) {
        setAuthorization(null);
        return null;
      }
      const data = (await response.json()) as AuthorizationInfo;
      setAuthorization(data);
      return data;
    } catch {
      setAuthorization(null);
      return null;
    }
  }, []);

  const setSessionToken = useCallback(async (newToken: string, userData?: User) => {
    safeSetItem(TOKEN_KEY, newToken);
    tokenRef.current = newToken;
    setToken(newToken);
    if (userData) setUser(userData);
    await loadAuthorization(newToken);
  }, [loadAuthorization]);

  const logout = useCallback(async () => {
    const currentToken = tokenRef.current || safeGetItem(TOKEN_KEY);
    try {
      // The server can only end the session it is told about.
      await baseApiFetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
        credentials: 'include',
      });
    } catch {
      // Logout errors are non-fatal.
    }
    safeRemoveItem(TOKEN_KEY);
    safeRemoveItem(REFRESH_TOKEN_KEY);
    clearLabLocalStorage(userIdRef.current);
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;';
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setAuthorization(null);
    window.location.href = '/login';
  }, []);

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const makeRequest = (authToken: string | null, forceReplaceAuth = false) => {
      const headers = new Headers(options.headers || {});
      if (authToken && (forceReplaceAuth || !headers.has('Authorization'))) {
        headers.set('Authorization', `Bearer ${authToken}`);
      }
      if (
        options.body &&
        !headers.has('Content-Type') &&
        !(options.body instanceof FormData)
      ) {
        headers.set('Content-Type', 'application/json');
      }
      return baseApiFetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    };

    const initialToken = tokenRef.current;
    let response = await makeRequest(initialToken, false);

    const canAttemptRefresh =
      response.status === 401 &&
      !url.includes('/auth/refresh') &&
      !url.includes('/auth/logout') &&
      !url.includes('/auth/student-login') &&
      !url.includes('/auth/admin-login');

    if (canAttemptRefresh) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        response = await makeRequest(refreshedToken, true);
      }
    }

    if (response.status === 401 && url.includes('/auth/me')) {
      const hadSession = tokenRef.current !== null;
      safeRemoveItem(TOKEN_KEY);
      safeRemoveItem(REFRESH_TOKEN_KEY);
      clearLabLocalStorage(userIdRef.current);
      document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;';
      tokenRef.current = null;
      setToken(null);
      setUser(null);
      setAuthorization(null);

      // Pages anyone may open without signing in; they match the open routes in App.tsx.
      const publicPaths = [
        '/login', '/register', '/forgot-password', '/reset-password',
        '/admin/login', '/admin/register', '/admin/forgot-password', '/admin/reset-password',
        '/adminform', '/admin-login', '/system',
        '/certificate/verify', '/verify/', '/help', '/error', '/maintenance', '/unauthorized',
      ];
      const isPublicPath = publicPaths.some((path) =>
        window.location.pathname.toLowerCase().startsWith(path)
      );
      if (!isPublicPath && window.location.pathname !== '/') {
        // Only a session that really ended gets the sign-in page's explanation.
        if (hadSession) {
          try { sessionStorage.setItem('sessionEndedAt', String(Date.now())); } catch { /* storage blocked */ }
        }
        window.location.href = '/login';
      }
    }
    return response;
  }, [refreshAccessToken]);

  const login = useCallback(async (
    email: string,
    password: string,
    rememberMe: boolean = false,
    portal: 'student' | 'admin' = 'student',
    otpCode?: string
  ): Promise<{ role: string; user: any; status?: string; message?: string; is_first_login?: boolean }> => {
    const endpoint = portal === 'admin' ? '/api/v1/auth/admin-login' : '/api/v1/auth/student-login';
    const data = await authFetch(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        remember_me: rememberMe,
        portal,
        otp_code: otpCode,
      }),
    });

    if (data.status === 'otp_required') {
      return { role: '', user: null, status: 'otp_required', message: data.message };
    }
    if (data.token) {
      safeSetItem(TOKEN_KEY, data.token);
      tokenRef.current = data.token;
      setToken(data.token);
    }
    if (typeof data.refresh_token === 'string' && data.refresh_token) {
      safeSetItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }
    setUser(data.user);
    await loadAuthorization(data.token || tokenRef.current);
    return { role: data.role, user: data.user, status: 'success', is_first_login: !!data.is_first_login };
  }, [loadAuthorization]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiFetch('/api/v1/auth/me');
      if (response.ok) {
        setUser(await response.json());
        await loadAuthorization();
      }
    } catch {
      // Non-fatal.
    }
  }, [apiFetch, loadAuthorization]);

  const hasCapability = useCallback((capability: string) =>
    Boolean(authorization?.capabilities?.includes(capability.toUpperCase())),
  [authorization]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await apiFetch('/api/v1/auth/me');
        if (response.ok) {
          setUser(await response.json());
          await loadAuthorization();
        } else {
          setUser(null);
          setAuthorization(null);
        }
      } catch {
        setUser(null);
        setAuthorization(null);
      } finally {
        setIsLoading(false);
      }
    };
    void checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      authorization,
      hasCapability,
      login,
      setSessionToken,
      logout,
      refreshUser,
      apiFetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
