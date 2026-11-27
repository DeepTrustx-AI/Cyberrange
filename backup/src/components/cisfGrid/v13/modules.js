export const ZONES = ['L4_CORP', 'L35_DMZ', 'L3_CTRL', 'L1_FIELD', 'RESPONDER'];

export const ZONE_PAIRS = (() => {
  const out = [];
  for (const src of ZONES) {
    for (const dst of ZONES) {
      if (src !== dst) out.push({ src, dst, key: `${src}->${dst}` });
    }
  }
  return out;
})();

export const IEC_TYPE_NAMES = {
  1: 'M_SP_NA_1 (Single-point info)',
  3: 'M_DP_NA_1 (Double-point info)',
  13: 'M_ME_NC_1 (Measured short float)',
  30: 'M_SP_TB_1 (Single-point w/ CP56Time2a)',
  31: 'M_DP_TB_1 (Double-point w/ CP56Time2a)',
  36: 'M_ME_TF_1 (Short float w/ CP56Time2a)',
  45: 'C_SC_NA_1 (Single command)',
  46: 'C_DC_NA_1 (Double command)',
  58: 'C_SC_TA_1 (Single command w/ CP56Time2a)',
  59: 'C_DC_TA_1 (Double command w/ CP56Time2a)',
  100: 'C_IC_NA_1 (Interrogation command)',
  103: 'C_CS_NA_1 (Clock sync command)',
  105: 'C_RP_NA_1 (Reset process command)',
};

export const IEC_COT_NAMES = {
  1: 'Periodic / cyclic',
  3: 'Spontaneous',
  5: 'Requested / interrogated',
  6: 'Activation',
  7: 'Activation confirmation',
  10: 'Activation termination',
  20: 'Interrogated by station GI',
  44: 'Unknown type ID',
  45: 'Unknown COT',
  47: 'Unknown IOA',
};

export const ROLE_META = {
  hospital: { name: 'Trauma Hospital', shortName: 'Hospital', tier: 'Tier 1' },
  water: { name: 'Water Works', shortName: 'Water Works', tier: 'Tier 1' },
  metro: { name: 'Metro Rail', shortName: 'Metro', tier: 'Tier 2' },
  airport: { name: 'Airport ATC', shortName: 'Airport', tier: 'Tier 2' },
  industrial: { name: 'Industrial Corridor', shortName: 'Industrial Corridor', tier: 'Tier 3' },
  municipal: { name: 'Municipal Blocks', shortName: 'Municipal', tier: 'Tier 3' },
};

export const MODULES = [
  {
    id: 'm1', contractId: 'm01', num: 1, pts: 70, pass: 56, time: '45 to 60 min',
    title: 'Callout and station walkdown',
    artifact: '~/workspace/station_inventory.json',
    artifacts: ['station_inventory.json'],
    keyTerms: ['iec-104', 'rtu', 'gi', 'startdt-testfr', 'passive-tap-pcap'],
    scenario: 'At 21:40 IST (16:10 UTC), Trauma Hospital and Water Works called in power loss, yet the control room screen still shows everything normal. Map the live SCADA master and RTU endpoints from passive capture without disturbing operations, ignore benign decoy monitor sessions, then run one authorized General Interrogation (iec104-observe --gi) and record its frame metadata.',
    roe: 'Safe scope: Read-only listening plus one authorized status poll (iec104-observe --gi). Do not send any breaker switching commands or touch firewall rules yet.',
    steps: [
      'Open Evidence -> Dispatch to read Raghav Menon and city callouts, then check your own network interfaces in the Terminal with ip addr and ss -tn.',
      'Inspect /evidence/m1/live_tap.pcap with tshark (or Evidence -> IEC-104 Frames) to separate the primary SCADA master OA from decoy monitor traffic and identify both RTUs and poll_interval_s.',
      'Run iec104-observe --gi in the Terminal to send one safe read-only roll call and capture your JSON output (src_port, timestamp_utc, cot_seen including 6, 7, 20).',
      'Save ~/workspace/station_inventory.json with responder_ip, master_ip, rtus (array of {ip, port, common_address} excluding decoys), poll_interval_s, and own_gi_frame ({src_port, timestamp_utc, cot_seen}), test with Practice, then click Submit module.',
    ],
    objectives: [
      'Read field callouts in Evidence -> Dispatch and check your terminal network interfaces',
      'List active SCADA master and RTU endpoints from /evidence/m1/live_tap.pcap (excluding decoy traffic)',
      'Run iec104-observe --gi and record src_port, timestamp_utc, and cot_seen',
      'Save ~/workspace/station_inventory.json and submit',
    ],
    hints: [
      'IEC 60870-5-104 uses TCP port 2404. Match endpoints across the L3 Control Room and L1 Field Switchyard subnets and separate the primary master OA from decoy polling.',
      'Run iec104-observe --gi from the Terminal and filter tshark on iec60870_asdu.typeid == 100; record each RTU as {"ip", "port": 2404, "common_address"}.',
    ],
    rubric: [
      'Active IEC-104 master and RTU session inventory matches this instance',
      'Authorized read-only C_IC_NA_1 interrogation observed on L1 field tap',
      'Station inventory JSON schema valid and complete',
    ],
  },
  {
    id: 'm2', contractId: 'm02', num: 2, pts: 90, pass: 72, time: '50 to 65 min',
    title: 'IOA schedule reconstruction',
    artifact: '~/workspace/ioa_map.json',
    artifacts: ['ioa_map.json'],
    keyTerms: ['ioa', 'asdu-ca', 'gi', 'rtu', 'feeder-bay'],
    scenario: 'Paper signal drawings were lost during a substation upgrade, so the team cannot tell which IEC-104 address number controls which breaker or meter. Decode the full station poll replies from RTU-1 and RTU-2 to rebuild the clean Common Address and IOA schedule (status Type 3, measurement Type 13, and Type 46 C_DC_NA_1 command IOAs) for all ten controllable assets while filtering out decoy polling.',
    roe: 'Safe scope: Read-only analysis of capture files and point lists plus one targeted bay read (iec104-observe --bay <BAY>). Run ioa-lint before submitting.',
    steps: [
      'Read /evidence/m2/gi_full.pcap with tshark filtered by the primary master OA (or Evidence -> IEC-104 Frames) to extract breaker status (Type 3) and meter float (Type 13) IOAs.',
      'Cross-check against /evidence/m2/rtu_point_catalogue.tsv to map Type 46 command_ioa for all 10 assets while excluding decoy Common Addresses.',
      'Run one targeted bay read in the Terminal using iec104-observe --bay <BAY> (for example, iec104-observe --bay BAY-01) and record own_bay_read ({asset_id, timestamp_utc, status_ioa}).',
      'Save ~/workspace/ioa_map.json (assets keyed by asset_id with {common_address, status_ioa, command_ioa, meas_ioa} plus own_bay_read), run ioa-lint, test with Practice, and click Submit module.',
    ],
    objectives: [
      'Separate authoritative RTU-1 and RTU-2 Common Addresses from decoy traffic',
      'Map common_address, status_ioa, command_ioa (Type 46), and meas_ioa for all 10 assets',
      'Run iec104-observe --bay <BAY> and record own_bay_read',
      'Validate ~/workspace/ioa_map.json with ioa-lint and submit',
    ],
    hints: [
      'Filter out decoy polling traffic by matching the verified station Common Addresses and primary master OA.',
      'Group GI response objects (COT=20) by Common Address, correlate status double-points with float measurements and Type 46 command IOAs from rtu_point_catalogue.tsv, then run iec104-observe --bay BAY-01.',
    ],
    rubric: [
      'Common ASDU addresses mapped for RTU-1 and RTU-2',
      'Breaker status, Type 46 command, and measurement IOAs verified across all 10 assets',
      'Targeted bay read (iec104-observe --bay) corroborated',
    ],
  },
  {
    id: 'm3', contractId: 'm03', num: 3, pts: 80, pass: 64, time: '45 to 60 min',
    title: 'Electrical baseline from archives',
    artifact: '~/workspace/baseline_report.json',
    artifacts: ['baseline_report.json'],
    keyTerms: ['historian', 'iegc-band', 'busbar', 'hmi'],
    scenario: 'Before proving the control room screen is lying, establish hard baseline numbers for a healthy night at Suryanagar Substation. Audit the pre-incident historian CSV export, exclude corrupted rows (clock jumps, duplicate timestamps, or impossible sensor spikes), and pull a live read from the DMZ historian export endpoint.',
    roe: 'Safe scope: Read-only archive audit and DMZ historian query. Exclude invalid rows before computing averages and spreads.',
    steps: [
      'Inspect /evidence/m3/healthy_archive.csv with awk or Python to find row_ids with non-monotonic or duplicate timestamps or impossible kV or Hz spikes.',
      'Query the DMZ historian export endpoint in the Terminal: curl -s "http://10.204.20.10:8085/api/v1/export?window=15m" and inspect /evidence/m3/dmz_access.tsv to verify your own read UTC timestamp.',
      'Write bus_33kv_c1_kv, bus_33kv_c2_kv, tr1_mva_pct, tr2_mva_pct, island_mw, freq_mean_hz, freq_spread_hz, excluded_bad_rows, and own_historian_query_utc into ~/workspace/baseline_report.json, test with Practice, and click Submit module.',
    ],
    objectives: [
      'Identify clock jumps, duplicate timestamps, and sensor spikes in healthy_archive.csv',
      'Query http://10.204.20.10:8085/api/v1/export?window=15m and verify /evidence/m3/dmz_access.tsv',
      'Compute clean steady-state bus kV, transformer %, MW, and frequency stats',
      'Save ~/workspace/baseline_report.json and submit',
    ],
    hints: [
      'Check monotonic UTC timestamps first to detect clock regressions and duplicate archive records, and scan for physically impossible 33 kV bus voltages or frequency outliers.',
      'Compute mean and spread of frequency within the 49.90 to 50.05 Hz IEGC operating band after excluding invalid row_ids, then curl http://10.204.20.10:8085/api/v1/export?window=15m.',
    ],
    rubric: [
      'Steady bus kV, TR MVA %, and island MW within tolerance',
      'Corrupted archive row indices accurately excluded',
      'Frequency mean/spread and DMZ historian query verified',
    ],
  },
  {
    id: 'm4', contractId: 'm04', num: 4, pts: 100, pass: 80, time: '55 to 70 min',
    title: 'Prove the screen is lying',
    artifact: '~/workspace/divergence.csv',
    artifacts: ['divergence.csv'],
    keyTerms: ['hmi', 'historian', 'apci', 'cot', 'dispatch-soe'],
    scenario: 'The hospital is running on diesel and water pumps have stopped, yet the Control Room HMI still insists every feeder is closed with zero alarms. Compare three independent views of the incident (Control Room capture, DMZ historian log, and passive field tap) and request a physical switchyard bay readout from Devika Nair to prove exactly when and where the screen stopped telling the truth.',
    roe: 'Safe scope: Forensic comparison only. Record all graded timestamps in UTC (within +/-2.0 s). Use exact vantage values hmi or historian in divergence.csv.',
    steps: [
      'Compare /evidence/m4/cr_master.pcap, /evidence/m4/dmz_historian.jsonl, and /evidence/m4/field_sensor.pcap in the Terminal.',
      'Isolate APCI sequence breaks, backward CP56Time2a timestamp skew, and spontaneous trip messages (COT=3) using tshark or Evidence -> IEC-104 Frames.',
      'Open Station -> Controls (or Evidence -> Dispatch, or run dispatchctl in the Terminal) to request a physical switchyard bay readout from Devika Nair, and pin key findings to Evidence -> Timeline.',
      'Save ~/workspace/divergence.csv with columns timestamp_utc,vantage,bay_id,reported_state,true_state,cp56_skew_s,suppressed_cot3,dispatch_bay_checked (using exact vantage value hmi or historian), test with Practice, and click Submit module.',
    ],
    objectives: [
      'Compare Control Room, DMZ historian, and field tap captures in the Terminal',
      'Request a physical bay check in Station -> Controls, Evidence -> Dispatch, or dispatchctl',
      'Pin corroborating evidence to Evidence -> Timeline',
      'Save ~/workspace/divergence.csv (vantage hmi or historian) and submit',
    ],
    hints: [
      'Replay blinding injects slight load jitter so readings still move. Inspect APCI N(S)/N(R) continuity and CP56Time2a timestamps across cr_master.pcap and dmz_historian.jsonl.',
      'Compare spontaneous COT=3 state transitions on /evidence/m4/field_sensor.pcap against what reached L3 Control Room, and set vantage strictly to hmi or historian.',
    ],
    rubric: [
      'Divergence onset timestamp recorded in UTC within +/-2.0 s',
      'Compromised vantage layer (hmi or historian) and skew classified',
      'Field bay readout corroborated with passive tap frames',
    ],
  },
  {
    id: 'm5', contractId: 'm05', num: 5, pts: 110, pass: 88, time: '55 to 75 min',
    title: 'Rogue command forensics',
    artifact: '~/workspace/rogue_commands.json',
    artifacts: ['rogue_commands.json'],
    keyTerms: ['iec-104', 'sbo', 'asdu-ca', 'ioa', 'dispatch-soe'],
    scenario: 'Now that you have proven the screen was blinded, prove the outage was deliberate. Isolate the unauthorized IEC-104 control session on the field tap, pair every Select and Execute breaker command it sent, match each IOA to the district it dropped, log the critical service countdowns, and send one benign contrast probe.',
    roe: 'Safe scope: Packet forensics plus one read-only contrast probe (iec104-observe --probe). Record exact IP, OA, CA, IOA, select_qoc, execute_qoc, and UTC execute_utc.',
    steps: [
      'Inspect /evidence/m5/field_incident.pcap with tshark (or Evidence -> IEC-104 Frames) and filter for Type 46 control activations (COT=6) from the unauthorized source IP.',
      'Pair each Select (select_qoc "0x81") with its matching Execute (execute_qoc "0x01") per IOA and map each command_ioa using your Module 2 schedule.',
      'Read /evidence/m5/dispatch_summary.json (or Evidence -> Dispatch) for hospital_diesel_hours and water_reservoir_margin_hours, then run iec104-observe --probe in the Terminal and record own_probe_utc.',
      'Save ~/workspace/rogue_commands.json with rogue_src_ip, rogue_oa, commands ([{bay_id, common_address, type_id, command_ioa, select_qoc, execute_qoc, execute_utc}]), hospital_diesel_hours, water_reservoir_margin_hours, and own_probe_utc; run Practice and submit.',
    ],
    objectives: [
      'Identify rogue_src_ip and rogue_oa on /evidence/m5/field_incident.pcap',
      'Pair all 3 rogue Select/Execute commands (select_qoc "0x81", execute_qoc "0x01", execute_utc)',
      'Run iec104-observe --probe and record own_probe_utc plus critical service margins',
      'Save ~/workspace/rogue_commands.json and submit',
    ],
    hints: [
      'Compare Originator Address (OA) and source IP on control commands against the legitimate SCADA master.',
      'Group Type 46 COT=6 ASDUs by IOA to pair Select (0x81) and Execute (0x01), read /evidence/m5/dispatch_summary.json, and run iec104-observe --probe for own_probe_utc.',
    ],
    rubric: [
      'Rogue source IP and Originator Address isolated',
      'All unauthorized Select/Execute command pairs documented',
      'Critical service fuel/reservoir margins and contrast probe confirmed',
    ],
  },
  {
    id: 'm6', contractId: 'm06', num: 6, pts: 100, pass: 80, time: '55 to 70 min',
    title: 'Host forensics and pivot chain',
    artifact: '~/workspace/pivot_dossier.json',
    artifacts: ['pivot_dossier.json'],
    keyTerms: ['purdue-model', 'historian', 'scada', 'dispatch-soe'],
    scenario: 'Office computers should never be able to reach the substation control room. Trace how the intruder crossed the network zones across authentication, kernel audit, and firewall logs, locate the staged persistence task on the engineering workstation snapshot, and run audit-query --self-check to verify your own analyst event.',
    roe: 'Safe scope: Read-only forensic review under /evidence/m6/ plus audit-query --self-check. Record exact compromised_account, 3 hops, persistence_kind, persistence_path, and own_audit_check_utc.',
    steps: [
      'Correlate /evidence/m6/auth.log, /evidence/m6/audit.log, and /evidence/m6/fw_flows.log in UTC order across all 3 lateral pivot hops.',
      'Inspect /evidence/m6/ews_fs/ for staged persistence and set persistence_kind strictly to systemd_timer or cron along with its exact persistence_path.',
      'Run audit-query --self-check in the Terminal and record its returned UTC timestamp in own_audit_check_utc.',
      'Save ~/workspace/pivot_dossier.json with compromised_account, hops ([{hop, src_zone, dst_zone, src_ip, dst_ip, dst_port, timestamp_utc}]), persistence_kind, persistence_path, and own_audit_check_utc; check with Practice and submit.',
    ],
    objectives: [
      'Trace compromised_account and all 3 lateral pivot hops across auth.log and fw_flows.log',
      'Identify persistence_kind (systemd_timer or cron) and persistence_path under /evidence/m6/ews_fs/',
      'Run audit-query --self-check and record own_audit_check_utc',
      'Save ~/workspace/pivot_dossier.json and submit',
    ],
    hints: [
      'Filter /evidence/m6/fw_flows.log for allowed inter-zone flows just prior to the 16:10 UTC outage window.',
      'Correlate accepted SSH logins in auth.log with scheduled units or cron entries inside /evidence/m6/ews_fs/, and run audit-query --self-check for your analyst event timestamp.',
    ],
    rubric: [
      'Compromised account and all 3 lateral pivot hops verified',
      'Persistence kind and file path identified accurately',
      'Own analyst audit-query --self-check event verified',
    ],
  },
  {
    id: 'm7', contractId: 'm07', num: 7, pts: 100, pass: 80, time: '50 to 65 min',
    title: 'Decode the implant and remove it',
    artifact: '~/workspace/implant_decode.json',
    artifacts: ['implant_decode.json'],
    keyTerms: ['replay-shim', 'hmi', 'scada', 'ioa'],
    scenario: 'A hidden replay shim on the control server is still feeding fake normal numbers to the operator screens. Unpack its 64-byte big-endian binary config (8-byte header >4sBBH, 52-byte XOR-masked payload >4s4sHHBBH3I3BB20s covering 15 packed fields, and 4-byte IEEE CRC-32 trailer >I), then disable both persistence and the active shim via scada-ctl so true alarms return.',
    roe: 'Safe scope: Remove only the rogue shim and persistence unit using scada-ctl disable-shim in the Terminal (Station -> Controls shows read-only shim status). Keep normal SCADA polling running.',
    steps: [
      'Inspect /evidence/m7/ews_fs/var/lib/scada-sync/target.bin with xxd and verify IEEE CRC-32 over raw bytes 0..59 against bytes 60..63.',
      'Unpack header bytes 0..7 (>4sBBH: magic, version, xor_key, flags) and XOR bytes 8..59 with xor_key to unpack the 15-field payload >4s4sHHBBH3I3BB20s (rtu1_ip, rtu2_ip, primary_ca, secondary_ca, rogue_oa, ioa_count, delay_ms, 3 target_ioas, 3 target_rtu_indices, pad, 20-byte NUL-padded campaign_tag).',
      'Run scada-ctl disable-shim --unit <persistence_path> --crc <crc32_hex> in the Terminal and note the returned shim_removed_utc.',
      'Save ~/workspace/implant_decode.json with magic, version, xor_key, primary_ca, secondary_ca, rogue_oa, delay_ms, sbo_required, target_ioas, campaign_tag, crc32_hex, and shim_removed_utc; run Practice and submit.',
    ],
    objectives: [
      'Verify IEEE CRC-32 and unpack >4sBBH + XORed >4s4sHHBBH3I3BB20s from target.bin',
      'Disable persistence and live replay shim via scada-ctl disable-shim',
      'Confirm true alarms appear in Station -> Alarms & SOE',
      'Save ~/workspace/implant_decode.json and submit',
    ],
    hints: [
      'Bytes 0..7 pack >4sBBH (magic, version, xor_key, flags); XOR bytes 8..59 with xor_key before unpacking the 52-byte >4s4sHHBBH3I3BB20s payload.',
      'Verify IEEE CRC-32 over raw bytes 0..59 before running scada-ctl disable-shim --unit <m6_persistence_path> --crc <crc32_hex>, and strip NUL padding from campaign_tag.',
    ],
    rubric: [
      'All 11 decoded binary implant fields (magic, version, xor_key, CAs, rogue_oa, delay_ms, sbo_required, target_ioas, campaign_tag, crc32_hex) verified',
      'Persistence unit and live replay shim removed cleanly',
      'Live SCADA polling intact and true station state visible',
    ],
  },
  {
    id: 'm8', contractId: 'm08', num: 8, pts: 110, pass: 88, time: '55 to 75 min',
    title: 'Zero-downtime Purdue containment',
    artifact: '~/workspace/policy.yaml',
    artifacts: ['policy.yaml', 'm8_evidence.json'],
    artifactNote: '~/workspace/policy.yaml + ~/workspace/m8_evidence.json',
    keyTerms: ['purdue-model', 'iec-104', 'historian', 'passive-tap-pcap'],
    scenario: 'The screens tell the truth again, but the open doors between office, DMZ, and substation zones are still unguarded. Build a default-deny Purdue firewall policy in ~/workspace/policy.yaml that blocks every unauthorized path while keeping live SCADA polling and historian reads flowing uninterrupted, prove a blocked path with a shell probe, and record 60 seconds of healthy post-apply IEC-104 traffic.',
    roe: 'Safe scope: Keep L3 Master to L1 RTU polling at or above 99% with zero disconnects during apply and hold. Use fwctl probe in the Terminal (not only the dashboard preview) for graded proof.',
    steps: [
      'Author ~/workspace/policy.yaml with default_policy: deny and explicit TCP allow rules ({id, src_zone, dst_zone, protocol: tcp, dst_port, action}) for required operational flows only (use Terminal, Edit file, or Station -> Controls).',
      'Validate syntax with fwctl test ~/workspace/policy.yaml, then enforce live with fwctl apply ~/workspace/policy.yaml.',
      'Run fwctl probe --from <SRC> --to <DST> --port <PORT> in the Terminal against a blocked cross-zone path and read the matching rule_id and timestamp_utc from /evidence/m8/firewall_events.tsv.',
      'Count live IEC-104 I-frames across a 60 s post-apply window in /evidence/m8/live_tap.pcap with tshark, save ~/workspace/m8_evidence.json ({probe_event: {timestamp_utc, rule_id}, tap_window: {start_utc, end_utc, i_frame_count}}), test with Practice, and submit.',
    ],
    objectives: [
      'Write a default-deny Purdue policy in ~/workspace/policy.yaml',
      'Test and apply the policy without dropping SCADA polling (>= 99%)',
      'Run shell fwctl probe on a blocked path and save probe_event from firewall_events.tsv',
      'Record 60 s post-apply tap I-frame count in ~/workspace/m8_evidence.json and submit',
    ],
    hints: [
      'Audit which ordered zone pairs require explicit allow rules for SCADA polling, historian ingestion, and responder access; deny all unauthorized lateral paths.',
      'After fwctl apply, run fwctl probe from the shell against a denied path to generate a firewall_events.tsv record, then filter /evidence/m8/live_tap.pcap for iec60870_104.type == 0 across a 60 s window.',
    ],
    rubric: [
      'Unauthorized inter-zone corridors blocked by applied policy',
      'L3 Master to L1 RTU polling continuity >= 99% with zero disconnects',
      'Own shell probe and 60 s live tap I-frame count verified in m8_evidence.json',
    ],
  },
  {
    id: 'm9', contractId: 'm09', num: 9, pts: 140, pass: 112, time: '60 to 75 min',
    title: 'Plan and run the restoration',
    artifact: '~/workspace/restore_plan.yaml',
    artifacts: ['restore_plan.yaml', 'restore_calc.json'],
    artifactNote: '~/workspace/restore_plan.yaml + ~/workspace/restore_calc.json',
    keyTerms: ['sbo', 'clpu', 'ansi-25', 'lockout-86', 'gen-132-gt1'],
    scenario: 'The substation starts at Clean Start: all six 33 kV feeders are open, TR-2 is on standby, and the station is running islanded on GEN-132-GT1 (42 MW continuous / 46 MW 10 s ceiling). Inspect this instance seeded feeder loads and cold-load pickup (CLPU) decay curves, write ~/workspace/restore_plan.yaml and ~/workspace/restore_calc.json, then energize Suryanagar safely in your planned order (islanded_paced or tie_synced via CB-220-TIE1). Full pass awards up to 140 pts (pass >= 112); Safe Partial (Tier 1 + >= 4 feeders with < 3 trips) awards 85 pts.',
    roe: 'Safe scope: Restore Tier 1 feeders (Trauma Hospital and Water Works) strictly first with wait_s >= 2 on every feeder close. Warning: each protection trip logs a permanent -10% penalty across electrical resets (avoid a 3rd trip, which disqualifies both Full Pass and Safe Partial).',
    steps: [
      'Run grid-calc budget and grid-calc clpu <bay> --t 0,10,20,30,45 in the Terminal to read this instance seeded feeder steady MW and CLPU decay curves.',
      'Save ~/workspace/restore_plan.yaml ({strategy: islanded_paced | tie_synced, steps: [{action, target, wait_s}]}) and ~/workspace/restore_calc.json ({steps: [{target, predicted_total_mw}]} matching restore_plan.yaml steps within +/-3%).',
      'Execute two-step SBO switching in Station -> Controls (or sbo CLI, using Gov ref in Station -> Controls or sbo governor <freq_hz> in 48.50 to 51.50 Hz to enter the ANSI 25 window for tie_synced) matching your plan while watching Station -> Trends.',
      'If an overload latches Lockout 86, inspect the 15 s trip replay in Station -> Controls, clear Lockout 86 or reset electrical state before risking a 3rd trip, wait for CLPU decay to settle in 49.90 to 50.05 Hz, then run Practice and Submit module.',
    ],
    objectives: [
      'Read seeded feeder MW and CLPU decay curves using grid-calc budget and grid-calc clpu',
      'Save ~/workspace/restore_plan.yaml and ~/workspace/restore_calc.json',
      'Energize Tier 1 feeders first in Station -> Controls without hitting 3 protection trips',
      'Hold steady inside 49.90 to 50.05 Hz and submit (Full >= 112 pts or Safe Partial 85 pts)',
    ],
    hints: [
      'Inspect each feeder steady MW, CLPU multiplier, and decay curve via grid-calc budget and grid-calc clpu <bay> --t 0,10,20,30,45. Islanded restoration tests surge planning; tie_synced tests ANSI 25 tie closing (|Phase| <= 12 deg, 49.95 to 50.05 Hz, |dV| <= 0.03 p.u.).',
      'Compare each candidate feeder initial surge plus decaying earlier surges against the remaining headroom under the 46 MW 10 s ceiling and 115% transformer limit before writing restore_calc.json.',
    ],
    rubric: [
      'Step-by-step predicted peak MW in restore_calc.json matches physics within +/-3% (30%)',
      'Live switching order matches restore_plan.yaml with Tier 1 first and zero trips during hold (70%)',
      'Bus voltage 0.95 to 1.05 p.u., TR <= 95%, freq 49.90 to 50.05 Hz (-10% per trip; Safe Partial 85 pts if < 3 trips)',
    ],
  },
  {
    id: 'm10', contractId: 'm10', num: 10, pts: 100, pass: 80, time: '55 to 70 min',
    title: 'Detection engineering and handover',
    artifact: '~/workspace/grid_defense.zeek',
    artifacts: ['grid_defense.zeek', 'handover_brief.json'],
    artifactNote: '~/workspace/grid_defense.zeek + ~/workspace/handover_brief.json',
    keyTerms: ['iec-104', 'sbo', 'asdu-ca', 'passive-tap-pcap', 'dispatch-soe'],
    scenario: 'Suryanagar has power again. Ship a protocol-invariant Zeek IEC-104 detector in ~/workspace/grid_defense.zeek (declaring module iec104; and using ctx(c, is_orig) plus GridDefense::authorized_masters, GridDefense::authorized_oa, and GridDefense::authorized_cas) that catches unauthorized masters, disallowed control TypeIDs, SBO violations, rapid command sweeps, and C_RP_NA_1 resets with zero false alerts, then compile ~/workspace/handover_brief.json.',
    roe: 'Safe scope: Your Zeek script runs in an isolated sandbox against unseen captures. Use GridDefense Notice enums (Unauthorized_Control, Rogue_Master, Originator_Mismatch, SBO_Violation, Rapid_Command_Sweep, Unauthorized_Process_Reset) and Unix (LF) line endings.',
    steps: [
      'Author ~/workspace/grid_defense.zeek declaring module iec104;, using ctx(c, is_orig) and checking GridDefense::authorized_masters, GridDefense::authorized_oa, and GridDefense::authorized_cas (never hardcoded IPs) to emit GridDefense Notice enums.',
      'Validate locally against practice and benign polling captures using zeek-test ~/workspace/grid_defense.zeek and confirm zero false alerts.',
      'Review your verified Case Board and Timeline, then write ~/workspace/handover_brief.json (root_cause, compromised_account, tripped_bays, target_ioas, containment_summary, restoration_margin_mw = 42.0 - sum(steady_mw), detection_summary, residual_risks).',
      'Run Practice and click Submit module to unlock your Shift Report.',
    ],
    objectives: [
      'Write protocol-invariant module iec104; detections in ~/workspace/grid_defense.zeek',
      'Pass zeek-test with zero false alerts on benign polling',
      'Compile ~/workspace/handover_brief.json (including restoration_margin_mw) and submit',
    ],
    hints: [
      'Declare module iec104; and call ctx(c, is_orig) to track pending Select (S/E=1) per (source, CA, IOA) so Execute-without-Select raises GridDefense::SBO_Violation immediately.',
      'Inspect control ASDUs (Types 45, 46, 47, 58, 59, 60, and 105) against GridDefense::authorized_masters, GridDefense::authorized_oa, and GridDefense::authorized_cas rather than hardcoded IPs.',
    ],
    rubric: [
      'True positive detection across unseen IEC-104 control attack shapes',
      'Zero false positives across benign practice and live polling windows',
      'Handover brief (including restoration_margin_mw = 42.0 - sum(steady_mw)) consistent with verified evidence',
    ],
  },
];

export const SCORED_MODULES = MODULES;
