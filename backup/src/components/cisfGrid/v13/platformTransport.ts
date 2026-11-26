import { apiWebSocketUrl } from '../../../lib/api';
import { CisfGridApiError, type ApiFetchFn, createCisfGridApi } from '../api';
import type { NotesState } from '../types';
import type { V13ApiResponse, V13Transport } from './ems';

export interface PlatformTransportConfig {
  apiFetch: ApiFetchFn;
  token: string | null;
  assignmentId: number | null;
  ensureEvalToken: (forceRefresh?: boolean) => Promise<string>;
  onProgressUpdated?: (passedModules: string[]) => void;
  onUpstreamLost?: (status: number) => void;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function errorResponse(err: unknown): V13ApiResponse {
  if (err instanceof CisfGridApiError) {
    const data: Record<string, unknown> = {
      error: err.message,
      detail: err.message,
    };
    if (typeof err.retryAfterSeconds === 'number') {
      data.retry_after_s = err.retryAfterSeconds;
    }
    return { status: err.status, ok: false, data };
  }
  const message = err instanceof Error ? err.message : 'Request failed';
  return { status: 500, ok: false, data: { error: message, detail: message } };
}

export function createV13PlatformTransport(config: PlatformTransportConfig): V13Transport {
  const { apiFetch, token, assignmentId, ensureEvalToken, onProgressUpdated, onUpstreamLost } = config;
  const api = createCisfGridApi(apiFetch);

  const notifyIfUpstreamLost = (status: number) => {
    if ((status === 409 || status === 502) && onUpstreamLost) {
      onUpstreamLost(status);
    }
  };

  async function runWithEvalTokenRetry<T>(fn: (evalToken: string) => Promise<T>): Promise<T> {
    let evalToken = await ensureEvalToken(false);
    try {
      return await fn(evalToken);
    } catch (firstErr) {
      if (firstErr instanceof CisfGridApiError && firstErr.status === 403) {
        evalToken = await ensureEvalToken(true);
        return await fn(evalToken);
      }
      throw firstErr;
    }
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

        // Merged Postgres + live Case Board
        if (upper === 'GET' && path === '/api/ems/case') {
          const data = await api.getCaseBoard(assignmentId);
          if (Array.isArray(data.passed_modules) && onProgressUpdated) {
            onProgressUpdated(data.passed_modules);
          }
          return { status: 200, ok: true, data: asRecord(data) };
        }

        // Shift Report (unlocked after M10)
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
            const text = typeof bodyRec.text === 'string' ? bodyRec.text : '';
            const pins = Array.isArray(bodyRec.pins) ? (bodyRec.pins as NotesState['pins']) : [];
            const data = await api.saveNotes({ text, pins }, assignmentId);
            return { status: 200, ok: true, data: asRecord(data) };
          }
        }

        // All live SCADA/EMS operational endpoints go through the authenticated private-ENI proxy
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        const proxyPath = `/api/v1/ot-grid/proxy/ems${normalizedPath}`;
        const opts: RequestInit = { method: upper };
        if (payload !== null && upper !== 'GET' && upper !== 'HEAD') {
          opts.headers = { 'Content-Type': 'application/json' };
          opts.body = JSON.stringify(payload);
        }
        const res = await apiFetch(proxyPath, opts);
        const data = asRecord(await res.json().catch(() => ({})));
        notifyIfUpstreamLost(res.status);
        return { status: res.status, ok: res.ok, data };
      } catch (err) {
        const res = errorResponse(err);
        notifyIfUpstreamLost(res.status);
        return res;
      }
    },

    async readFile(filename: string): Promise<{ ok: boolean; status: number; text: string }> {
      try {
        const data = await api.readWorkspaceFile(filename, assignmentId);
        return { ok: true, status: 200, text: data.content };
      } catch (err) {
        const status = err instanceof CisfGridApiError ? err.status : 500;
        notifyIfUpstreamLost(status);
        return { ok: false, status, text: '' };
      }
    },

    async writeFile(filename: string, content: string): Promise<{ ok: boolean; status: number }> {
      try {
        await api.writeWorkspaceFile(filename, content, assignmentId);
        return { ok: true, status: 200 };
      } catch (err) {
        const status = err instanceof CisfGridApiError ? err.status : 500;
        notifyIfUpstreamLost(status);
        return { ok: false, status };
      }
    },

    getEmsWsUrl(): string {
      return api.emsWebSocketUrl(token);
    },

    openEmsSocket(): WebSocket {
      return new WebSocket(api.emsWebSocketUrl(token));
    },

    async getTerminalWsUrl(): Promise<string> {
      const base = '/api/v1/terminal/ws/cisf-ot-grid';
      const query = token ? `?token=${encodeURIComponent(token)}` : '';
      return apiWebSocketUrl(`${base}${query}`);
    },
  };
}
