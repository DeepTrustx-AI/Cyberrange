import { apiWebSocketUrl, parseApiErrorMessage } from '../../lib/api';
import type {
  CaseSummary,
  CheckStatusResponse,
  CisfGridMode,
  HintResponse,
  HintsUnlockedMap,
  NotesState,
  SessionInfo,
  ShiftReportResponse,
  TourPrefsState,
} from './types';

export type ApiFetchFn = (path: string, options?: RequestInit) => Promise<Response>;

export class CisfGridApiError extends Error {
  status: number;
  retryAfterSeconds?: number;
  errorCode?: string;
  data?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    retryAfterSeconds?: number,
    errorCode?: string,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CisfGridApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.errorCode = errorCode;
    this.data = data;
  }
}

async function readJsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const retryHeader = response.headers.get('Retry-After');
    const gridErrHeader = response.headers.get('X-Grid-Error-Code')?.trim() || undefined;
    let retryAfter = retryHeader && /^\d+$/.test(retryHeader) ? Number(retryHeader) : undefined;
    let message = parseApiErrorMessage(data, fallback);
    let errorCode = gridErrHeader;
    let rec: Record<string, unknown> | undefined;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      rec = data as Record<string, unknown>;
      if (typeof rec.error === 'string' && rec.error.trim()) {
        message = rec.error.trim();
        if (!errorCode) errorCode = rec.error.trim();
      }
      if (!errorCode && typeof rec.code === 'string' && rec.code.trim()) {
        errorCode = rec.code.trim();
      }
      if (
        retryAfter === undefined &&
        typeof rec.retry_after_s === 'number' &&
        Number.isFinite(rec.retry_after_s) &&
        rec.retry_after_s > 0
      ) {
        retryAfter = Math.ceil(rec.retry_after_s);
      }
    }
    if (retryAfter !== undefined && !message.includes(`${retryAfter}s`) && !message.includes(`${retryAfter} s`)) {
      message = `${message} (retry in ${retryAfter}s)`;
    }
    throw new CisfGridApiError(message, response.status, retryAfter, errorCode, rec);
  }
  return data as T;
}

function withAssignment(path: string, assignmentId: number | null): string {
  if (!assignmentId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}assignment_id=${assignmentId}`;
}

export function createCisfGridApi(apiFetch: ApiFetchFn) {
  return {
    async getCurrentSession(assignmentId: number | null): Promise<SessionInfo | null> {
      const res = await apiFetch(withAssignment('/api/v1/ot-grid/sessions/current', assignmentId));
      if (res.status === 404) return null;
      return readJsonOrThrow<SessionInfo>(res, 'Could not read current CISF OT Grid session.');
    },

    async startSession(assignmentId: number | null, mode: CisfGridMode): Promise<SessionInfo> {
      const res = await apiFetch('/api/v1/ot-grid/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, mode }),
      });
      return readJsonOrThrow<SessionInfo>(res, 'Could not start CISF OT Grid session.');
    },

    async stopSession(assignmentId: number | null): Promise<{ status: string }> {
      const res = await apiFetch(withAssignment('/api/v1/ot-grid/sessions/current', assignmentId), {
        method: 'DELETE',
      });
      return readJsonOrThrow<{ status: string }>(res, 'Could not stop CISF OT Grid session.');
    },

    async getWsTicket(assignmentId: number | null): Promise<{ ticket: string; expires_in: number }> {
      const res = await apiFetch(withAssignment('/api/v1/ot-grid/ws-ticket', assignmentId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });
      return readJsonOrThrow<{ ticket: string; expires_in: number }>(
        res,
        'Could not mint WebSocket ticket.',
      );
    },

    async readWorkspaceFile(
      filename: string,
      assignmentId: number | null,
    ): Promise<{ name: string; content: string; bytes?: number; mtime?: number }> {
      const res = await apiFetch(withAssignment(`/api/v1/ot-grid/workspace/files/${encodeURIComponent(filename)}`, assignmentId));
      return readJsonOrThrow<{ name: string; content: string; bytes?: number; mtime?: number }>(
        res,
        `Could not read ${filename}.`,
      );
    },

    async writeWorkspaceFile(
      filename: string,
      content: string,
      assignmentId: number | null,
      expectedMtime?: number | null,
    ): Promise<{ ok: boolean; name: string; size?: number; bytes?: number; mtime?: number }> {
      const payload: Record<string, unknown> = { content, assignment_id: assignmentId };
      if (typeof expectedMtime === 'number' && Number.isFinite(expectedMtime)) {
        payload.expected_mtime = expectedMtime;
      }
      const res = await apiFetch(`/api/v1/ot-grid/workspace/files/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return readJsonOrThrow<{ ok: boolean; name: string; size?: number; bytes?: number; mtime?: number }>(
        res,
        `Could not save ${filename}.`,
      );
    },

    async practiceModule(moduleId: string, assignmentId: number | null, evalToken?: string): Promise<CheckStatusResponse> {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (evalToken) headers['X-Grid-Eval-Token'] = evalToken;
      const res = await apiFetch(`/api/v1/ot-grid/modules/${encodeURIComponent(moduleId)}/practice`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ assignment_id: assignmentId }),
      });
      return readJsonOrThrow<CheckStatusResponse>(res, `Practice check failed for ${moduleId}.`);
    },

    async verifyModule(moduleId: string, assignmentId: number | null, evalToken: string): Promise<{ check_id: string; module_id: string; started_at?: string; deadline_at?: string }> {
      const res = await apiFetch(`/api/v1/ot-grid/modules/${encodeURIComponent(moduleId)}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Grid-Eval-Token': evalToken,
        },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });
      return readJsonOrThrow<{ check_id: string; module_id: string; started_at?: string; deadline_at?: string }>(
        res,
        `Could not start verification for ${moduleId}.`,
      );
    },

    async getCheckStatus(checkId: string, assignmentId: number | null): Promise<CheckStatusResponse> {
      const res = await apiFetch(withAssignment(`/api/v1/ot-grid/checks/${encodeURIComponent(checkId)}`, assignmentId));
      return readJsonOrThrow<CheckStatusResponse>(res, 'Could not read verification status.');
    },

    async resetModule(moduleId: string, assignmentId: number | null, electricalOnly = false): Promise<Record<string, unknown>> {
      const res = await apiFetch(`/api/v1/ot-grid/modules/${encodeURIComponent(moduleId)}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, electrical_only: electricalOnly }),
      });
      return readJsonOrThrow<Record<string, unknown>>(res, `Could not reset ${moduleId}.`);
    },

    async unlockHint(moduleId: string, level: 1 | 2 | 3, assignmentId: number | null, confirmed = false): Promise<HintResponse> {
      const res = await apiFetch(`/api/v1/ot-grid/modules/${encodeURIComponent(moduleId)}/hints/${level}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, confirmed }),
      });
      return readJsonOrThrow<HintResponse>(res, `Could not unlock level ${level} hint.`);
    },

    async getCaseBoard(
      assignmentId: number | null,
    ): Promise<{ cases: Record<string, CaseSummary>; passed_modules: string[]; hints_unlocked?: HintsUnlockedMap }> {
      const res = await apiFetch(withAssignment('/api/v1/ot-grid/case', assignmentId));
      return readJsonOrThrow<{
        cases: Record<string, CaseSummary>;
        passed_modules: string[];
        hints_unlocked?: HintsUnlockedMap;
      }>(res, 'Could not load Case Board.');
    },

    async getShiftReport(assignmentId: number | null): Promise<ShiftReportResponse | null> {
      const res = await apiFetch(withAssignment('/api/v1/ot-grid/shift-report', assignmentId));
      if (res.status === 404) return null;
      return readJsonOrThrow<ShiftReportResponse>(res, 'Could not load Shift Report.');
    },

    async getNotes(assignmentId: number | null): Promise<NotesState> {
      const res = await apiFetch(withAssignment('/api/v1/ot-grid/notes', assignmentId));
      return readJsonOrThrow<NotesState>(res, 'Could not load responder notes.');
    },

    async saveNotes(notes: { text: string; pins: NotesState['pins'] }, assignmentId: number | null): Promise<NotesState> {
      const res = await apiFetch('/api/v1/ot-grid/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...notes, assignment_id: assignmentId }),
      });
      return readJsonOrThrow<NotesState>(res, 'Could not save responder notes.');
    },

    async getTourPrefs(): Promise<TourPrefsState> {
      const res = await apiFetch('/api/v1/ot-grid/preferences/tour-seen');
      return readJsonOrThrow<TourPrefsState>(res, 'Could not load tour preferences.');
    },

    async saveTourPrefs(prefs: TourPrefsState): Promise<TourPrefsState> {
      const res = await apiFetch('/api/v1/ot-grid/preferences/tour-seen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      return readJsonOrThrow<TourPrefsState>(res, 'Could not save tour preferences.');
    },

    emsWebSocketUrl(auth?: { ticket?: string | null; token?: string | null } | string | null): string {
      const base = '/api/v1/ot-grid/proxy/ems/ws';
      if (typeof auth === 'string' && auth) {
        return apiWebSocketUrl(`${base}?token=${encodeURIComponent(auth)}`);
      }
      if (auth && typeof auth === 'object') {
        if (auth.ticket) return apiWebSocketUrl(`${base}?ticket=${encodeURIComponent(auth.ticket)}`);
        if (auth.token) return apiWebSocketUrl(`${base}?token=${encodeURIComponent(auth.token)}`);
      }
      return apiWebSocketUrl(base);
    },
  };
}
