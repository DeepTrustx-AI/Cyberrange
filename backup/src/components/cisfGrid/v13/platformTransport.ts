import { apiWebSocketUrl } from '../../../lib/api';
import { CisfGridApiError, type ApiFetchFn, createCisfGridApi } from '../api';
import type { NotesState } from '../types';
import type {
  V13ApiResponse,
  V13ReadFileResult,
  V13Transport,
  V13WriteFileResult,
} from './ems';

export interface PlatformTransportConfig {
  apiFetch: ApiFetchFn;
  token?: string | null;
  getToken?: () => string | null;
  isSessionActive?: () => boolean;
  assignmentId: number | null;
  ensureEvalToken: (forceRefresh?: boolean) => Promise<string>;
  onProgressUpdated?: (passedModules: string[]) => void;
  onUpstreamLost?: (status: number) => void;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function isEvalTokenExpiredError(err: CisfGridApiError): boolean {
  if (err.status !== 403) return false;
  if (err.errorCode === 'eval_token_expired') return true;
  return /evaluation token|eval_token/i.test(err.message);
}

function isUpstreamLossResponse(status: number, message: string): boolean {
  if (status === 502 || status === 503 || status === 504) return true;
  if (status === 409) {
    return /routing is unavailable|no active.*session|session.*stopped|session.*not running/i.test(message);
  }
  return false;
}

function errorResponse(err: unknown): V13ApiResponse {
  if (err instanceof CisfGridApiError) {
    const data: Record<string, unknown> = {
      ...(err.data || {}),
      error: err.message,
      detail: err.message,
    };
    if (typeof err.retryAfterSeconds === 'number') {
      data.retry_after_s = err.retryAfterSeconds;
    }
    if (err.errorCode) {
      data.error_code = err.errorCode;
    }
    return { status: err.status, ok: false, data };
  }
  const isNetworkErr =
    err instanceof TypeError ||
    (err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message));
  const message = err instanceof Error ? err.message : 'Request failed';
  return {
    status: isNetworkErr ? 0 : 500,
    ok: false,
    data: { error: message, detail: message },
  };
}

export function createV13PlatformTransport(config: PlatformTransportConfig): V13Transport {
  const { apiFetch, assignmentId, ensureEvalToken, onProgressUpdated, onUpstreamLost, isSessionActive } = config;
  const api = createCisfGridApi(apiFetch);

  const notifyIfUpstreamLost = (status: number, message = '') => {
    if (onUpstreamLost && isUpstreamLossResponse(status, message)) {
      onUpstreamLost(status);
    }
  };

  async function runWithEvalTokenRetry<T>(fn: (evalToken: string) => Promise<T>): Promise<T> {
    let evalToken = await ensureEvalToken(false);
    try {
      return await fn(evalToken);
    } catch (firstErr) {
      if (firstErr instanceof CisfGridApiError && isEvalTokenExpiredError(firstErr)) {
        evalToken = await ensureEvalToken(true);
        return await fn(evalToken);
      }
      throw firstErr;
    }
  }

  async function resolveWsAuth(scope: 'ems' | 'terminal'): Promise<{ ticket?: string }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await api.getWsTicket(assignmentId, scope);
        if (res && typeof res.ticket === 'string' && res.ticket) {
          return { ticket: res.ticket };
        }
        break;
      } catch (err) {
        if (err instanceof CisfGridApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
          break;
        }
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    }
    return {};
  }

  return {
    async apiJson(method: string, path: string, payload: unknown = null): Promise<V13ApiResponse> {
      const upper = method.toUpperCase();
      const bodyRec = asRecord(payload);

      try {
        // Graded verification (requires X-Grid-Eval-Token)
        if (upper === 'POST' && path === '/api/ems/verify') {
          const modId = String(bodyRec.module_id || 'm01');
          const data = await runWithEvalTokenRetry((evalTok) =>
            api.verifyModule(modId, assignmentId, evalTok),
          );
          return { status: 202, ok: true, data: asRecord(data) };
        }

        // Practice check (0 pts, supports X-Grid-Eval-Token)
        if (upper === 'POST' && path === '/api/ems/practice') {
          const modId = String(bodyRec.module_id || 'm01');
          const data = await runWithEvalTokenRetry((evalTok) =>
            api.practiceModule(modId, assignmentId, evalTok),
          );
          return { status: 200, ok: true, data: asRecord(data) };
        }

        // Poll async verification status (backend verifies HMAC and writes Postgres score)
        const checkMatch = upper === 'GET' ? path.match(/^\/api\/ems\/checks\/([^/?#]+)$/) : null;
        if (checkMatch) {
          const checkId = decodeURIComponent(checkMatch[1]);
          const data = await api.getCheckStatus(checkId, assignmentId);
          return { status: 200, ok: true, data: asRecord(data) };
        }

        // Merged Postgres + live Case Board (includes persisted hints_unlocked)
        if (upper === 'GET' && path === '/api/ems/case') {
          const data = await api.getCaseBoard(assignmentId);
          if (Array.isArray(data.passed_modules) && onProgressUpdated) {
            onProgressUpdated(data.passed_modules);
          }
          return { status: 200, ok: true, data: asRecord(data) };
        }

        // Shift Report (preserves 403 locked vs 404 missing)
        if (upper === 'GET' && path === '/api/ems/shift-report') {
          const data = await api.getShiftReport(assignmentId);
          if (!data) {
            return { status: 404, ok: false, data: { ok: false } };
          }
          return { status: 200, ok: true, data: asRecord(data) };
        }

        // Module Clean Start or electrical-only reset
        if (upper === 'POST' && (path === '/api/ems/reset-module' || path === '/api/ems/reset-electrical')) {
          const modId = String(bodyRec.module_id || 'm01');
          const electricalOnly = path === '/api/ems/reset-electrical';
          const data = await api.resetModule(modId, assignmentId, electricalOnly);
          return { status: 200, ok: true, data: asRecord(data) };
        }

        // Tiered hint unlock (POST /api/ems/hints/:moduleId/:level)
        const hintMatch = upper === 'POST' ? path.match(/^\/api\/ems\/hints\/([^/]+)\/([123])$/) : null;
        if (hintMatch) {
          const modId = decodeURIComponent(hintMatch[1]);
          const level = Number(hintMatch[2]) as 1 | 2 | 3;
          const confirmed = Boolean(bodyRec.confirmed);
          const data = await api.unlockHint(modId, level, assignmentId, confirmed);
          return { status: 200, ok: true, data: asRecord(data) };
        }

        // Persisted Postgres responder notes and evidence pins
        if (path === '/api/ems/notes') {
          if (upper === 'GET') {
            const data = await api.getNotes(assignmentId);
            return { status: 200, ok: true, data: asRecord(data) };
          }
          if (upper === 'PUT') {
            if (isSessionActive && !isSessionActive()) {
              return { status: 401, ok: false, data: { error: 'Session no longer active for mounted user' } };
            }
            const text = typeof bodyRec.text === 'string' ? bodyRec.text : '';
            const pins = Array.isArray(bodyRec.pins) ? (bodyRec.pins as NotesState['pins']) : [];
            const data = await api.saveNotes({ text, pins }, assignmentId);
            return { status: 200, ok: true, data: asRecord(data) };
          }
        }

        // All live SCADA/EMS operational endpoints go through the authenticated private-ENI proxy
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        const rawProxyPath = `/api/v1/ot-grid/proxy/ems${normalizedPath}`;
        const proxyPath =
          assignmentId !== null && assignmentId !== undefined
            ? `${rawProxyPath}${rawProxyPath.includes('?') ? '&' : '?'}assignment_id=${encodeURIComponent(String(assignmentId))}`
            : rawProxyPath;
        const opts: RequestInit = { method: upper };
        if (payload !== null && upper !== 'GET' && upper !== 'HEAD') {
          opts.headers = { 'Content-Type': 'application/json' };
          opts.body = JSON.stringify(payload);
        }
        const res = await apiFetch(proxyPath, opts);
        const data = asRecord(await res.json().catch(() => ({})));
        const msg = String(data.detail || data.error || '');
        notifyIfUpstreamLost(res.status, msg);
        return { status: res.status, ok: res.ok, data };
      } catch (err) {
        const res = errorResponse(err);
        const msg = String(res.data?.detail || res.data?.error || '');
        notifyIfUpstreamLost(res.status, msg);
        return res;
      }
    },

    async readFile(filename: string): Promise<V13ReadFileResult> {
      try {
        const data = await api.readWorkspaceFile(filename, assignmentId);
        return {
          ok: true,
          status: 200,
          text: data.content,
          mtime: typeof data.mtime === 'number' ? data.mtime : null,
        };
      } catch (err) {
        const isApiErr = err instanceof CisfGridApiError;
        const status = isApiErr ? err.status : err instanceof TypeError ? 0 : 500;
        const msg = err instanceof Error ? err.message : 'Could not read file';
        notifyIfUpstreamLost(status, msg);
        return { ok: false, status, text: '', error: msg };
      }
    },

    async writeFile(
      filename: string,
      content: string,
      expectedMtime?: number | null,
    ): Promise<V13WriteFileResult> {
      try {
        const data = await api.writeWorkspaceFile(filename, content, assignmentId, expectedMtime);
        return {
          ok: true,
          status: 200,
          mtime: typeof data.mtime === 'number' ? data.mtime : null,
        };
      } catch (err) {
        const isApiErr = err instanceof CisfGridApiError;
        const status = isApiErr ? err.status : err instanceof TypeError ? 0 : 500;
        const msg = err instanceof Error ? err.message : 'Could not save file';
        const errCode = isApiErr ? err.errorCode : undefined;
        const rawCurMtime = isApiErr ? err.data?.current_mtime : undefined;
        const currentMtime = typeof rawCurMtime === 'number' ? rawCurMtime : null;
        notifyIfUpstreamLost(status, msg);
        return {
          ok: false,
          status,
          error: errCode || msg,
          current_mtime: currentMtime,
        };
      }
    },

    async getEmsWsUrl(): Promise<string> {
      const auth = await resolveWsAuth('ems');
      return api.emsWebSocketUrl(auth, assignmentId);
    },

    async openEmsSocket(): Promise<WebSocket | null> {
      const url = await this.getEmsWsUrl();
      if (!url) return null;
      return new WebSocket(url);
    },

    async getTerminalWsUrl(): Promise<string> {
      const base = '/api/v1/terminal/ws/cisf-ot-grid';
      const auth = await resolveWsAuth('terminal');
      const params = new URLSearchParams();
      if (assignmentId !== null && assignmentId !== undefined) {
        params.set('assignment_id', String(assignmentId));
      }
      if (auth.ticket) {
        params.set('ticket', auth.ticket);
      }
      const qs = params.toString();
      return apiWebSocketUrl(qs ? `${base}?${qs}` : base);
    },
  };
}
