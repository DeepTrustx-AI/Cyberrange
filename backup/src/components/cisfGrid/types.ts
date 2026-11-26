export type CisfGridMode = 'modules' | 'full_op';

export interface CisfGridModuleSpec {
  id: string;
  num: number;
  act: number;
  pts: number;
  passPts: number;
  title: string;
  artifact: string;
  artifactFiles: string[];
  scenario: string;
  roe: string;
  steps: string[];
  objectives: string[];
  rubric: string[];
  isFullOp?: boolean;
}

export interface CisfGridActSpec {
  act: number;
  title: string;
  modules: string[];
}

export interface SessionInfo {
  status: string;
  session: {
    assignment_id: number | null;
    generation: string;
    mode: CisfGridMode;
  };
  urls?: {
    ems: string;
    ems_ws: string;
    terminal: string;
  };
  eval_token?: string;
  eval_token_expires_at?: string;
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

export interface NotesState {
  text: string;
  pins: Array<{ label: string; value: string; ts_utc?: string }>;
  updated_utc: string | null;
}

export interface TourPrefsState {
  cold_open_seen: boolean;
  tour_seen: boolean;
  dismissed_tips: string[];
}

export interface DispatchEntry {
  id: string;
  timestamp_utc?: string;
  utc?: string;
  ist?: string;
  from?: string;
  sender?: string;
  role?: string;
  channel?: string;
  bay_id?: string;
  semaphore?: string;
  message?: string;
  body?: string;
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

export const CISF_GRID_ACTS: CisfGridActSpec[] = [
  { act: 1, title: 'The call', modules: ['m01', 'm02'] },
  { act: 2, title: 'The lie', modules: ['m03', 'm04'] },
  { act: 3, title: 'The trail', modules: ['m05', 'm06', 'm07'] },
  { act: 4, title: 'Shut the doors', modules: ['m08'] },
  { act: 5, title: 'Lights back', modules: ['m09', 'm10'] },
];

export const WORKSPACE_FILES: string[] = [
  'station_inventory.json',
  'ioa_map.json',
  'baseline_report.json',
  'divergence.csv',
  'rogue_commands.json',
  'pivot_dossier.json',
  'implant_decode.json',
  'policy.yaml',
  'm8_evidence.json',
  'restore_plan.yaml',
  'restore_calc.json',
  'grid_defense.zeek',
  'handover_brief.json',
];

export const CISF_GRID_MODULES: CisfGridModuleSpec[] = [
  {
    id: 'm01',
    num: 1,
    act: 1,
    pts: 70,
    passPts: 56,
    title: 'Callout and station walkdown',
    artifact: 'station_inventory.json',
    artifactFiles: ['station_inventory.json'],
    scenario:
      'At 21:40 IST (16:10 UTC), Trauma Hospital and Water Works called in power loss while the control room HMI still reads normal. Map the live SCADA master and RTU endpoints from passive capture without disturbing operations, then run one authorized General Interrogation.',
    roe: 'Safe scope: read-only listening plus one authorized status poll (iec104-observe --gi). Do not issue switching commands or alter firewall rules yet.',
    steps: [
      'Review field callouts in Dispatch and inspect your responder interfaces (ip addr, ss -tn) in the terminal.',
      'Inspect /evidence/m1/live_tap.pcap with tshark to separate the primary SCADA master OA from decoy traffic and identify both RTUs.',
      'Run iec104-observe --gi and confirm your own source port and COT=6/7/20 interrogation frames appear on the live tap.',
      'Save ~/workspace/station_inventory.json, test format with Practice, then click Submit for grading.',
    ],
    objectives: [
      'List active SCADA master and RTU endpoints from /evidence/m1/live_tap.pcap',
      'Run iec104-observe --gi and record your own poll frame metadata',
      'Save ~/workspace/station_inventory.json and submit',
    ],
    rubric: [
      'Active IEC-104 master and RTU session inventory matches this instance',
      'Authorized read-only C_IC_NA_1 interrogation observed on L1 field tap',
      'Station inventory JSON schema valid and complete',
    ],
  },
  {
    id: 'm02',
    num: 2,
    act: 1,
    pts: 90,
    passPts: 72,
    title: 'IOA schedule reconstruction',
    artifact: 'ioa_map.json',
    artifactFiles: ['ioa_map.json'],
    scenario:
      'Paper signal drawings were lost during a station upgrade. Decode full General Interrogation replies from RTU-1 and RTU-2 to reconstruct the authoritative Common Address and IOA schedule for all ten controllable assets while filtering out decoy polling.',
    roe: 'Safe scope: read-only analysis of capture files and point lists plus one targeted bay read. Run ioa-lint before submitting.',
    steps: [
      'Decode /evidence/m2/gi_full.pcap filtered by the primary master OA to extract breaker status (Type 3) and measurement (Type 13) IOAs.',
      'Correlate against /evidence/m2/rtu_point_catalogue.tsv while excluding decoy Common Addresses.',
      'Run one targeted bay read, validate ~/workspace/ioa_map.json with ioa-lint, test with Practice, and submit.',
    ],
    objectives: [
      'Separate authoritative RTU-1 and RTU-2 Common Addresses from decoy traffic',
      'Map status, command, and measurement IOAs for all 10 substation assets',
      'Validate ~/workspace/ioa_map.json with ioa-lint and submit',
    ],
    rubric: [
      'Common ASDU addresses mapped for RTU-1 and RTU-2',
      'Breaker status and command IOA pairs verified across all 10 assets',
      'Measurement float IOAs matched without decoy contamination',
    ],
  },
  {
    id: 'm03',
    num: 3,
    act: 2,
    pts: 80,
    passPts: 64,
    title: 'Electrical baseline from archives',
    artifact: 'baseline_report.json',
    artifactFiles: ['baseline_report.json'],
    scenario:
      'Before proving the control room screen is lying, establish a clean electrical baseline for Suryanagar Substation. Audit the pre-incident historian archive, remove corrupted rows (clock jumps, duplicates, impossible spikes), and query the DMZ historian export.',
    roe: 'Safe scope: read-only archive audit and DMZ historian query. Exclude invalid rows before computing averages.',
    steps: [
      'Inspect /evidence/m3/healthy_archive.csv for non-monotonic or duplicate timestamps and impossible kV or Hz spikes.',
      'Query the DMZ historian export endpoint (http://10.204.20.10:8085/api/v1/export?window=15m) so your audit read is logged.',
      'Write excluded row IDs and clean baseline metrics into ~/workspace/baseline_report.json, test with Practice, and submit.',
    ],
    objectives: [
      'Identify clock jumps, duplicate timestamps, and sensor spikes in healthy_archive.csv',
      'Compute clean bus kV, transformer loading %, island MW, and frequency mean/spread',
      'Save ~/workspace/baseline_report.json and submit',
    ],
    rubric: [
      'Steady bus kV, TR MVA %, and island MW within tolerance',
      'Corrupted archive row indices accurately excluded',
      'Frequency mean and spread calculated from clean rows',
    ],
  },
  {
    id: 'm04',
    num: 4,
    act: 2,
    pts: 100,
    passPts: 80,
    title: 'Prove the screen is lying',
    artifact: 'divergence.csv',
    artifactFiles: ['divergence.csv'],
    scenario:
      'Trauma Hospital is on diesel and water pumps stopped, yet the Control Room HMI insists every feeder is closed. Correlate the Control Room capture, DMZ historian log, and passive field tap, then request a physical bay readout from Devika Nair to prove replay blinding.',
    roe: 'Safe scope: forensic correlation and field bay check only. Record all graded timestamps in UTC within +/-2.0 s.',
    steps: [
      'Compare /evidence/m4/cr_master.pcap, /evidence/m4/dmz_historian.jsonl, and /evidence/m4/field_sensor.pcap.',
      'Isolate APCI sequence gaps, backward CP56Time2a timestamp skew, and suppressed COT=3 breaker trips.',
      'Request a physical bay readout via dispatchctl (or the Controls panel) and save ~/workspace/divergence.csv.',
    ],
    objectives: [
      'Compare Control Room, DMZ historian, and field tap captures',
      'Request a physical switchyard bay readout from Devika Nair',
      'Save ~/workspace/divergence.csv and submit',
    ],
    rubric: [
      'Divergence onset timestamp recorded in UTC within +/-2.0 s',
      'Compromised vs trustworthy vantage layers classified',
      'Field bay readout corroborated with passive tap frames',
    ],
  },
  {
    id: 'm05',
    num: 5,
    act: 3,
    pts: 110,
    passPts: 88,
    title: 'Rogue command forensics',
    artifact: 'rogue_commands.json',
    artifactFiles: ['rogue_commands.json'],
    scenario:
      'Prove the outage was deliberate. Isolate the unauthorized IEC-104 control session on /evidence/m5/field_incident.pcap, pair each Select and Execute command to its target bay, log critical service diesel and water margins, and send one benign contrast probe.',
    roe: 'Safe scope: packet forensics and one read-only contrast probe. Record exact IP, OA, CA, IOA, and UTC Execute timestamps.',
    steps: [
      'Filter /evidence/m5/field_incident.pcap for control activations (COT=6) from the unauthorized source IP.',
      'Pair Select (S/E=1) and Execute (S/E=0) commands per IOA and match against your Module 2 schedule.',
      'Read /evidence/m5/dispatch_summary.json, run one benign contrast probe, save ~/workspace/rogue_commands.json, and submit.',
    ],
    objectives: [
      'Identify the unauthorized control session source IP and Originator Address',
      'Pair every rogue Select and Execute command with its asset and UTC timestamp',
      'Record critical service fuel and water margins and submit JSON',
    ],
    rubric: [
      'Rogue source IP and Originator Address isolated',
      'All unauthorized Select/Execute command pairs documented',
      'Critical service fuel and reservoir margins confirmed',
    ],
  },
  {
    id: 'm06',
    num: 6,
    act: 3,
    pts: 100,
    passPts: 80,
    title: 'Host forensics and pivot chain',
    artifact: 'pivot_dossier.json',
    artifactFiles: ['pivot_dossier.json'],
    scenario:
      'Office workstations should never reach substation control systems. Correlate authentication, kernel audit, firewall flow logs, and the engineering workstation snapshot to reconstruct every lateral pivot hop and locate the persistence unit.',
    roe: 'Safe scope: read-only review under /evidence/m6/ plus audit-query --self-check to verify your own analyst event.',
    steps: [
      'Correlate /evidence/m6/auth.log, /evidence/m6/audit.log, and /evidence/m6/fw_flows.log in UTC order.',
      'Inspect /evidence/m6/ews_fs/ for staged systemd or cron persistence and run audit-query --self-check.',
      'Save ~/workspace/pivot_dossier.json, test with Practice, and submit.',
    ],
    objectives: [
      'Identify the compromised account and all 3 lateral pivot hops',
      'Locate the staged persistence mechanism inside /evidence/m6/ews_fs/',
      'Run audit-query --self-check, save ~/workspace/pivot_dossier.json, and submit',
    ],
    rubric: [
      'Lateral pivot hops, zones, ports, and accounts verified',
      'Persistence unit path and trigger schedule identified',
      'Own analyst audit self-check verified',
    ],
  },
  {
    id: 'm07',
    num: 7,
    act: 3,
    pts: 100,
    passPts: 80,
    title: 'Decode the implant and remove it',
    artifact: 'implant_decode.json',
    artifactFiles: ['implant_decode.json'],
    scenario:
      'A replay shim on the control server is still spoofing normal telemetry. Unpack its 64-byte big-endian binary config (magic, XOR key, masked payload, IEEE CRC-32), then disable both persistence and the active shim from the responder terminal so true alarms return.',
    roe: 'Safe scope: remove only the verified persistence unit and replay shim via scada-ctl disable-shim in the terminal.',
    steps: [
      'Inspect /evidence/m7/ews_fs/var/lib/scada-sync/target.bin with xxd and unpack header, XORed payload, and IEEE CRC-32 in Python.',
      'Run scada-ctl disable-shim --unit <persistence_path> --crc <crc32_hex> in the terminal.',
      'Confirm the stage switches from Blinded to Live True State, save ~/workspace/implant_decode.json, and submit.',
    ],
    objectives: [
      'Verify IEEE CRC-32 and decode all 11 GRID_IMPLANT_V1 binary fields',
      'Remove persistence and live replay shim via scada-ctl disable-shim',
      'Save ~/workspace/implant_decode.json and submit',
    ],
    rubric: [
      'All 11 binary implant config fields decoded accurately',
      'Verified unit/CRC shim removal and true SLD state restored',
      'Live SCADA polling intact',
    ],
  },
  {
    id: 'm08',
    num: 8,
    act: 4,
    pts: 110,
    passPts: 88,
    title: 'Zero-downtime containment',
    artifact: 'policy.yaml',
    artifactFiles: ['policy.yaml', 'm8_evidence.json'],
    scenario:
      'True telemetry is back, but inter-zone corridors remain open. Author a default-deny Purdue firewall policy in ~/workspace/policy.yaml that blocks all unauthorized corridors while preserving live SCADA polling (>= 99%) and historian reads, verify a denied path with shell fwctl probe, and record a 60 s live tap I-frame count.',
    roe: 'Safe scope: keep L3_CTRL to L1_FIELD polling >= 99% with zero disconnects. Use fwctl probe in the terminal for graded proof.',
    steps: [
      'Write default_policy: deny and only required operational flows into ~/workspace/policy.yaml.',
      'Validate with fwctl test ~/workspace/policy.yaml and enforce live with fwctl apply ~/workspace/policy.yaml.',
      'Run a shell fwctl probe against a blocked path, read /evidence/m8/firewall_events.tsv, count 60 s post-apply I-frames in /evidence/m8/live_tap.pcap, save ~/workspace/m8_evidence.json, and submit.',
    ],
    objectives: [
      'Author and apply a default-deny Purdue policy without dropping SCADA polling',
      'Run shell fwctl probe and record the matching firewall_events.tsv rule ID and UTC time',
      'Record a 60 s post-apply live tap I-frame count in ~/workspace/m8_evidence.json and submit',
    ],
    rubric: [
      '12 of 12 unauthorized inter-zone corridors blocked',
      'IEC-104 polling continuity >= 99% with zero disconnects and historian healthy',
      'Own shell probe and 60 s live tap window verified',
    ],
  },
  {
    id: 'm09',
    num: 9,
    act: 5,
    pts: 140,
    passPts: 112,
    title: 'Plan and run the restoration',
    artifact: 'restore_plan.yaml',
    artifactFiles: ['restore_plan.yaml', 'restore_calc.json'],
    scenario:
      'All six 33 kV feeders start open on GEN-132-GT1 (42 MW continuous / 46 MW 10 s ceiling). Inspect this instance seeded feeder steady loads and cold-load pickup (CLPU) decay curves, record your switching sequence and predicted peak MW per step, and restore Suryanagar safely without tripping protection.',
    roe: 'Safe scope: restore Tier 1 feeders (Trauma Hospital and Water Works) strictly first with wait_s >= 2. Each protection trip costs 10% (max 30%).',
    steps: [
      'Run grid-calc budget and grid-calc clpu <bay> --t 0,10,20,30,45 in the terminal to inspect seeded feeder loads and CLPU curves.',
      'Save ~/workspace/restore_plan.yaml and ~/workspace/restore_calc.json (predicted peak MW per step within +/-3%).',
      'Execute two-step Select-Before-Operate switching via sbo CLI (including sbo governor <freq_hz> in 49.00 to 51.00 Hz to adjust generator frequency into the ANSI 25 window before closing CB-220-TIE1) or Station Controls matching your plan, hold steady in 49.90 to 50.05 Hz, and submit.',
    ],
    objectives: [
      'Inspect seeded feeder MW and CLPU decay curves via grid-calc',
      'Save ~/workspace/restore_plan.yaml and ~/workspace/restore_calc.json',
      'Restore Tier 1 feeders first without protection trips and hold steady',
    ],
    rubric: [
      'Predicted step-by-step peak MW matches grid physics within +/-3%',
      'Live switching order matches restore_plan.yaml with Tier 1 first and zero trips during hold',
      'Bus voltage 0.95 to 1.05 p.u., TR loading <= 95%, frequency 49.90 to 50.05 Hz',
    ],
  },
  {
    id: 'm10',
    num: 10,
    act: 5,
    pts: 100,
    passPts: 80,
    title: 'Detection engineering and handover',
    artifact: 'grid_defense.zeek',
    artifactFiles: ['grid_defense.zeek', 'handover_brief.json'],
    scenario:
      'Power is restored. Ship a protocol-invariant Zeek IEC-104 detector in ~/workspace/grid_defense.zeek that catches unauthorized masters, disallowed control TypeIDs, SBO violations, and C_RP_NA_1 resets with zero false positives, then compile your commander handover brief in ~/workspace/handover_brief.json.',
    roe: 'Safe scope: your Zeek script executes in an isolated sandbox against unseen captures. Use GridDefense::authorized_masters and GridDefense::authorized_oa rather than hardcoded IPs.',
    steps: [
      'Author ~/workspace/grid_defense.zeek declaring module iec104; and validate locally with zeek-test ~/workspace/grid_defense.zeek.',
      'Confirm zero false alerts on clean polling captures.',
      'Compile ~/workspace/handover_brief.json from your verified Case Board evidence, run Practice, and submit to unlock your Shift Report.',
    ],
    objectives: [
      'Write protocol-invariant IEC-104 Zeek detections in ~/workspace/grid_defense.zeek',
      'Pass zeek-test with zero false positives on benign polling',
      'Compile ~/workspace/handover_brief.json and submit to unlock Shift Report',
    ],
    rubric: [
      'True positive detection across unseen IEC-104 control attack shapes',
      'Zero false positives across benign practice and live traffic',
      'Handover brief consistent with verified incident evidence',
    ],
  },
];

export const FULL_OP_MODULE: CisfGridModuleSpec = {
  id: 'full_op',
  num: 11,
  act: 5,
  pts: 100,
  passPts: 100,
  title: 'Full operation mode',
  artifact: 'handover_brief.json',
  artifactFiles: [
    'divergence.csv',
    'implant_decode.json',
    'policy.yaml',
    'm8_evidence.json',
    'restore_plan.yaml',
    'restore_calc.json',
    'grid_defense.zeek',
    'handover_brief.json',
  ],
  scenario:
    'Run the complete Operation Blackout response from a fresh independent seed with all six operational gates graded together: prove telemetry divergence, eradicate the replay shim, seal Purdue zones with zero polling loss, restore Suryanagar Tier 1 first, deploy Zeek detection, and deliver your handover brief.',
  roe: 'Safe scope: per-module Clean Start is disabled in Full Operation Mode; electrical recoveries are capped at 3.',
  steps: [
    'Prove telemetry divergence and disable the replay shim via terminal CLI.',
    'Enforce default-deny Purdue containment and record shell probe plus 60 s live tap evidence.',
    'Restore all districts safely (Tier 1 first) matching your restoration plan and calculations.',
    'Deploy ~/workspace/grid_defense.zeek, complete ~/workspace/handover_brief.json, and submit.',
  ],
  objectives: [
    'Gates 1 to 3: Divergence proof and verified replay shim removal',
    'Gate 4: Zero-downtime Purdue containment active',
    'Gates 5 to 6: Tier 1 first restoration and Zeek detection verified',
  ],
  rubric: [
    'All six operational gates verified against fresh independent seed',
    'Zero false positives and zero unrecovered protection lockouts',
    'Complete commander handover brief',
  ],
  isFullOp: true,
};
