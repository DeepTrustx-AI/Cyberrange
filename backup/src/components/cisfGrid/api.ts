import { apiWebSocketUrl, parseApiErrorMessage } from '../../lib/api';
import type {
  CaseSummary,
  CheckStatusResponse,
  CisfGridMode,
  DispatchEntry,
  HintResponse,
  NotesState,
  SessionInfo,
  ShiftReportResponse,
  TourPrefsState,
} from './types';

export type ApiFetchFn = (path: string, options?: RequestInit) => Promise<Response>;

export class CisfGridApiError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'CisfGridApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function readJsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const retryHeader = response.headers.get('Retry-After');
    let retryAfter = retryHeader && /^\d+$/.test(retryHeader) ? Number(retryHeader) : undefined;
    let message = parseApiErrorMessage(data, fallback);
    if (data && typeof data === 'object') {
      const rec = data as Record<string, unknown>;
      if (typeof rec.error === 'string' && rec.error.trim()) {
        message = rec.error.trim();
      }
      if (retryAfter === undefined && typeof rec.retry_after_s === 'number' && Number.isFinite(rec.retry_after_s) && rec.retry_after_s > 0) {
        retryAfter = Math.ceil(rec.retry_after_s);
      }
    }
    if (retryAfter !== undefined && !message.includes(`${retryAfter}s`) && !message.includes(`${retryAfter} s`)) {
      message = `${message} (retry in ${retryAfter}s)`;
    }
    throw new CisfGridApiError(message, response.status, retryAfter);
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

    async listWorkspaceFiles(assignmentId: number | null): Promise<Array<{ name: string; size: number; mtime: number }>> {
      const res = await apiFetch(withAssignment('/api/v1/ot-grid/workspace/files', assignmentId));
      const data = await readJsonOrThrow<{ files?: Array<{ name: string; size: number; mtime: number }> }>(
        res,
        'Could not list workspace files.',
      );
      return Array.isArray(data.files) ? data.files : [];
    },

    async readWorkspaceFile(filename: string, assignmentId: number | null): Promise<{ name: string; content: string; mtime?: number }> {
      const res = await apiFetch(withAssignment(`/api/v1/ot-grid/workspace/files/${encodeURIComponent(filename)}`, assignmentId));
      return readJsonOrThrow<{ name: string; content: string; mtime?: number }>(res, `Could not read ${filename}.`);
    },

    async writeWorkspaceFile(filename: string, content: string, assignmentId: number | null): Promise<{ ok: boolean; name: string; size?: number; mtime?: number }> {
      const res = await apiFetch(`/api/v1/ot-grid/workspace/files/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, assignment_id: assignmentId }),
      });
      return readJsonOrThrow<{ ok: boolean; name: string; size?: number; mtime?: number }>(res, `Could not save ${filename}.`);
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

    async getCaseBoard(assignmentId: number | null): Promise<{ cases: Record<string, CaseSummary>; passed_modules: string[] }> {
      const res = await apiFetch(withAssignment('/api/v1/ot-grid/case', assignmentId));
      return readJsonOrThrow<{ cases: Record<string, CaseSummary>; passed_modules: string[] }>(res, 'Could not load Case Board.');
    },

    async getShiftReport(assignmentId: number | null): Promise<ShiftReportResponse | null> {
      const res = await apiFetch(withAssignment('/api/v1/ot-grid/shift-report', assignmentId));
      if (res.status === 403 || res.status === 404) return null;
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

    async getDispatch(): Promise<DispatchEntry[]> {
      const res = await apiFetch('/api/v1/ot-grid/proxy/ems/api/ems/dispatch');
      const data = await readJsonOrThrow<{ entries?: DispatchEntry[] }>(res, 'Could not load dispatch feed.');
      return Array.isArray(data.entries) ? data.entries : [];
    },

    async requestBayReadout(bayId: string): Promise<DispatchEntry> {
      const res = await apiFetch('/api/v1/ot-grid/proxy/ems/api/ems/dispatch/bay-readout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bay_id: bayId }),
      });
      return readJsonOrThrow<DispatchEntry>(res, `Could not request field readout for ${bayId}.`);
    },

    emsWebSocketUrl(token?: string | null): string {
      const base = '/api/v1/ot-grid/proxy/ems/ws';
      const query = token ? `?token=${encodeURIComponent(token)}` : '';
      return apiWebSocketUrl(`${base}${query}`);
    },
  };
}
