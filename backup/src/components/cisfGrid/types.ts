export type CisfGridMode = 'modules';

export interface SessionInfo {
  status: string;
  session: {
    assignment_id: number | null;
    generation: string;
    mode: CisfGridMode | string;
  };
  urls?: {
    ems: string;
    ems_ws: string;
    terminal: string;
  };
  eval_token?: string;
  eval_token_expires_at?: string;
  stopped_unexpectedly?: boolean;
  error_message?: string;
}

export interface AreaFeedback {
  area: string;
  passed: number;
  total: number;
  message: string;
}

export interface CaseSummary {
  module_id: string;
  title: string;
  fields: Array<{ label: string; value: string }>;
}

export interface ModuleHintUnlockState {
  l1?: boolean;
  l2?: boolean;
  l3?: boolean;
  l3_text?: string;
}

export type HintsUnlockedMap = Record<string, ModuleHintUnlockState>;

export interface CheckStatusResponse {
  check_id?: string;
  module_id?: string;
  status: 'running' | 'passed' | 'failed' | 'timed_out' | string;
  started_at?: string;
  deadline_at?: string;
  completed_at?: string | null;
  score?: number;
  max_score?: number;
  hint_deduction?: number;
  awarded_points?: number;
  total_score?: number;
  already_completed?: boolean;
  area_feedback?: AreaFeedback[];
  case_summary?: CaseSummary;
  tier?: string;
  trip_events?: number;
  trip_penalty_pct?: number;
  practice?: boolean;
  passed?: boolean;
  error?: string;
  detail?: string;
}

export interface HintResponse {
  module_id: string;
  level: 1 | 2 | 3;
  hint: string;
  point_deduction: number;
  unlocked_levels: number[];
}

export interface NotesPinItem {
  id: string;
  source: string;
  vantage: string;
  utc: string;
  ist?: string;
  utcSec?: number;
  summary: string;
  label?: string;
  value?: string;
  ts_utc?: string;
}

export interface NotesState {
  text: string;
  pins: NotesPinItem[];
  updated_utc: string | null;
}

export interface TourPrefsState {
  cold_open_seen: boolean;
  tour_seen: boolean;
  dismissed_tips: string[];
}

export interface ShiftReportResponse {
  ok: boolean;
  completed_utc: string;
  total_elapsed_s: number;
  total_score: number;
  max_score: number;
  hints_used: {
    l1: number;
    l2: number;
    l3: number;
    total_deduction: number;
  };
  acts: Array<{
    act: number;
    title: string;
    modules: string[];
    elapsed_s: number;
    score: number;
    max_score: number;
  }>;
  cases: Record<string, CaseSummary>;
}

export interface EmsBayTelemetry {
  bay_id?: string;
  rtu?: string;
  status?: string;
  closed?: boolean;
  mw?: number;
  kv?: number;
  role?: string;
  label?: string;
  short_label?: string;
  tier?: number;
}

export type DistrictStatus = 'lit' | 'diesel' | 'dark';

export interface EmsTelemetryState {
  ts_utc?: string;
  module_id?: string;
  shim_active?: boolean;
  truth_visible?: boolean;
  persistence_removed?: boolean;
  bus_v_pu?: number;
  bus_33kv_c1_kv?: number;
  bus_33kv_c2_kv?: number;
  freq_hz?: number;
  gen_mw?: number;
  total_load_p_mw?: number;
  grid_tie_mw?: number;
  island_mw?: number;
  tr1_mva_pct?: number;
  tr2_mva_pct?: number;
  tr2_closed?: boolean;
  tie_closed?: boolean;
  lockouts?: string[];
  trip_events?: number;
  trip_penalty_pct?: number;
  passed_modules?: string[];
  poller?: {
    rtu1_connected?: boolean;
    rtu2_connected?: boolean;
    poll_continuity_pct?: number;
    last_poll_rtt_ms?: number;
    total_disconnects?: number;
  };
  bays?: Record<string, EmsBayTelemetry>;
  breakers?: Record<string, { closed?: boolean; mw?: number; kv?: number }>;
  districts?: Record<string, DistrictStatus>;
  zones?: Record<string, { status?: string }>;
}
