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
    keyTerms: ['iec-104', 'rtu', 'gi', 'startdt-testfr', 'passive-tap-pcap'],
    scenario: 'At 21:40 IST (16:10 UTC), Trauma Hospital and Water Works called in power loss, yet the control room screen still shows everything normal. Your first job is to see who is actually talking on the substation network without disturbing it: list the live SCADA master and RTU endpoints from the passive network capture, then send one read-only status poll (General Interrogation) and confirm it appears on the wire.',
    roe: 'Safe scope: Read-only listening plus one authorized status poll (iec104-observe --gi). Do not send any breaker switching commands or touch firewall rules yet.',
    steps: [
      'Open Evidence -> Dispatch to read Raghav Menon and city callouts, then check your own network connections in the Terminal using ip addr and ss -tn.',
      'Inspect /evidence/m1/live_tap.pcap in the Terminal with tshark (or open Evidence -> IEC-104 Frames) to list the SCADA master, RTU devices, STARTDT/TESTFR link frames, and how often polling repeats.',
      'Run iec104-observe --gi in the Terminal to send one safe read-only roll call, then confirm your own request appears on the live field tap.',
      'Write your verified inventory into ~/workspace/station_inventory.json (using your Terminal or Edit file above the terminal), test format with Practice, then click Submit module.',
    ],
    objectives: [
      'Read field callouts in Evidence -> Dispatch and check your terminal network interfaces',
      'List active SCADA master and RTU endpoints from /evidence/m1/live_tap.pcap',
      'Run iec104-observe --gi and verify your own poll on the tap',
      'Save ~/workspace/station_inventory.json and submit',
    ],
    hints: [
      'IEC 60870-5-104 uses TCP port 2404. Match endpoints across the L3 Control Room and L1 Field Switchyard subnets.',
      'Send one read-only C_IC_NA_1 interrogation from the observer CLI and filter tshark on iec60870_asdu.typeid == 100.',
      'tshark -r /evidence/m1/live_tap.pcap -Y "iec60870_asdu.typeid == 100" && iec104-observe --gi',
    ],
    rubric: [
      'Active IEC-104 master and RTU session inventory matches this instance',
      'Authorized read-only C_IC_NA_1 interrogation observed on L1 field tap',
      'Station inventory JSON schema valid and complete',
    ],
  },
  {
    id: 'm2', contractId: 'm02', num: 2, pts: 90, pass: 72, time: '50 to 70 min',
    title: 'IOA schedule reconstruction',
    artifact: '~/workspace/ioa_map.json',
    keyTerms: ['ioa', 'asdu-ca', 'gi', 'rtu', 'feeder-bay'],
    scenario: 'Paper signal drawings were lost during a substation upgrade, so the team cannot tell which IEC-104 address number controls which breaker or meter. Decode the full station poll replies from RTU-1 and RTU-2 to rebuild the clean address table (Common Address and IOA) for all ten controllable assets while ignoring benign decoy traffic.',
    roe: 'Safe scope: Read-only analysis of capture files and point lists. Run ioa-lint in the Terminal to check your JSON layout before submitting.',
    steps: [
      'Read /evidence/m2/gi_full.pcap in the Terminal with tshark (or inspect frames in Evidence -> IEC-104 Frames) to extract breaker status (Type 3) and meter float (Type 13) replies.',
      'Cross-check those addresses against /evidence/m2/rtu_point_catalogue.tsv and filter out any secondary decoy monitor sessions.',
      'Fill in ~/workspace/ioa_map.json (via Terminal or Edit file above the terminal), run ioa-lint to verify formatting, test with Practice, and click Submit module.',
    ],
    objectives: [
      'Separate authoritative RTU-1 and RTU-2 Common Addresses from decoy traffic',
      'Map status, command, and meter IOAs for all 10 substation assets',
      'Validate ~/workspace/ioa_map.json with ioa-lint and submit',
    ],
    hints: [
      'Filter out decoy polling traffic by matching the verified station Common Addresses and source IPs.',
      'Group GI response objects (COT=20) by Common Address and correlate status double-points with float measurements.',
      'tshark -r /evidence/m2/gi_full.pcap -Y "iec60870_asdu.causetx == 20" -T fields -e iec60870_asdu.addr -e iec60870_asdu.ioa',
    ],
    rubric: [
      'Common ASDU addresses mapped for RTU-1 and RTU-2',
      'Breaker status and command IOA pairs verified across all 10 assets',
      'Measurement float IOAs matched without decoy contamination',
    ],
  },
  {
    id: 'm3', contractId: 'm03', num: 3, pts: 80, pass: 64, time: '45 to 60 min',
    title: 'Electrical baseline from archives',
    artifact: '~/workspace/baseline_report.json',
    keyTerms: ['historian', 'iegc-band', 'busbar', 'hmi'],
    scenario: 'Before proving the control room screen is lying, you need hard numbers showing what a healthy night at Suryanagar Substation looks like. Audit the pre-incident historian CSV export, throw out broken rows (clock jumps, duplicate timestamps, or impossible sensor spikes), and calculate clean baseline bus voltage, transformer loading, island MW, and grid frequency.',
    roe: 'Safe scope: Read-only archive audit and historian query. Exclude corrupted rows before calculating averages and spreads.',
    steps: [
      'Open /evidence/m3/healthy_archive.csv in the Terminal using awk or Python and scan for timestamps that go backward, repeat, or carry physically impossible kV or Hz spikes.',
      'Check live station meters in Station -> Trends for context, and query the DMZ historian read endpoint as instructed so your read appears in its log.',
      'Write the excluded row numbers and clean electrical averages into ~/workspace/baseline_report.json (via Terminal or Edit file), run Practice, and click Submit module.',
    ],
    objectives: [
      'Find clock jumps, duplicate timestamps, and sensor spikes in healthy_archive.csv',
      'Compute clean steady-state bus kV, transformer %, MW, and frequency stats',
      'Save ~/workspace/baseline_report.json and submit',
    ],
    hints: [
      'Check monotonic UTC timestamps first to detect clock regressions and duplicate archive records.',
      'Compute mean and spread of frequency within the 49.90 to 50.05 Hz IEGC operating band after removing invalid rows.',
      'awk -F, \'NR>1 && ($3<30 || $3>36) {print NR, $0}\' /evidence/m3/healthy_archive.csv',
    ],
    rubric: [
      'Steady bus kV, TR MVA %, and island MW within tolerance',
      'Corrupted archive row indices accurately excluded',
      'Frequency mean and spread calculated from clean rows',
    ],
  },
  {
    id: 'm4', contractId: 'm04', num: 4, pts: 100, pass: 80, time: '55 to 75 min',
    title: 'Prove the screen is lying',
    artifact: '~/workspace/divergence.csv',
    keyTerms: ['hmi', 'historian', 'apci', 'cot', 'dispatch-soe'],
    scenario: 'The hospital is running on diesel and water pumps have stopped, yet the Control Room HMI still insists every feeder is closed with zero alarms. Compare three independent views of the incident (Control Room capture, DMZ historian log, and passive field tap) and ask Devika Nair in the switchyard to read physical bay meters so you can prove exactly when and where the screen stopped telling the truth.',
    roe: 'Safe scope: Forensic comparison only. Record every graded timestamp in UTC (within +/-2.0 s). Use the Split lens button above the stage and physical bay checks to confirm what you see in the captures.',
    steps: [
      'Compare /evidence/m4/cr_master.pcap, /evidence/m4/dmz_historian.jsonl, and /evidence/m4/field_sensor.pcap in the Terminal.',
      'Look for APCI sequence breaks, stale CP56Time2a timestamps, and spontaneous trip messages (COT=3) using tshark or Evidence -> IEC-104 Frames.',
      'Open Station -> Controls (or Evidence -> Dispatch) to ask Devika Nair for a physical switchyard bay readout, and pin key findings to Evidence -> Timeline.',
      'Record your verified UTC divergence rows in ~/workspace/divergence.csv (via Terminal or Edit file), test with Practice, and click Submit module.',
    ],
    objectives: [
      'Compare Control Room, DMZ historian, and field tap captures in the Terminal',
      'Request a physical bay check in Station -> Controls or Evidence -> Dispatch',
      'Pin corroborating evidence to Evidence -> Timeline',
      'Save ~/workspace/divergence.csv and submit',
    ],
    hints: [
      'Replay blinding injects slight load jitter so readings still move. Inspect APCI N(S)/N(R) continuity and CP56Time2a timestamps.',
      'Compare spontaneous COT=3 state transitions on the L1 field tap against what reached L3 Control Room.',
      'tshark -r /evidence/m4/field_sensor.pcap -Y "iec60870_asdu.causetx == 3"',
    ],
    rubric: [
      'Divergence onset timestamp recorded in UTC within +/-2.0 s',
      'Compromised vs trustworthy vantage layers classified',
      'Field bay readout corroborated with passive tap frames',
    ],
  },
  {
    id: 'm5', contractId: 'm05', num: 5, pts: 110, pass: 88, time: '60 to 75 min',
    title: 'Rogue command forensics',
    artifact: '~/workspace/rogue_commands.json',
    keyTerms: ['iec-104', 'sbo', 'asdu-ca', 'ioa', 'dispatch-soe'],
    scenario: 'Now that you have proven the screen was blinded, prove the outage was deliberate. Isolate the unauthorized IEC-104 control session on the field tap, pair every Select and Execute breaker command it sent, match each IOA to the district it dropped, and log the hospital diesel and water reservoir countdowns from Dispatch.',
    roe: 'Safe scope: Packet forensics only. Record exact protocol fields (source IP, Originator Address, Common Address, IOA, and UTC Execute timestamp) from the wire capture.',
    steps: [
      'Inspect /evidence/m5/field_incident.pcap in the Terminal with tshark (or open Evidence -> IEC-104 Frames) and filter for IEC-104 control commands (Type 45, 46, 58, 59).',
      'Separate unauthorized control frames from legitimate polling, and pair each Select (S/E=1) with its matching Execute (S/E=0) command and UTC timestamp.',
      'Check Evidence -> Dispatch to verify Trauma Hospital diesel hours and Water Works reservoir margin, write ~/workspace/rogue_commands.json (via Terminal or Edit file), run Practice, and submit.',
    ],
    objectives: [
      'Identify the unauthorized control session source IP and Originator Address',
      'Pair every rogue Select and Execute command with its asset and UTC time',
      'Confirm hospital diesel and water margins in Evidence -> Dispatch and submit JSON',
    ],
    hints: [
      'Compare Originator Address (OA) and source IP on control commands against the legitimate SCADA master.',
      'Group control ASDUs by IOA and sort by UTC timestamp to distinguish Select from Execute.',
      'tshark -r /evidence/m5/field_incident.pcap -Y "iec60870_asdu.typeid == 46 || iec60870_asdu.typeid == 45"',
    ],
    rubric: [
      'Rogue source IP and Originator Address isolated',
      'All unauthorized Select/Execute command pairs documented',
      'Critical service fuel and reservoir margins confirmed',
    ],
  },
  {
    id: 'm6', contractId: 'm06', num: 6, pts: 100, pass: 80, time: '50 to 70 min',
    title: 'Host forensics and pivot chain',
    artifact: '~/workspace/pivot_dossier.json',
    keyTerms: ['purdue-model', 'historian', 'scada', 'dispatch-soe'],
    scenario: 'Office computers should never be able to reach the substation control room. Trace how the intruder crossed the network zones by piecing together login records, host audit trails, and firewall logs, and find the scheduled persistence task left behind on the engineering workstation snapshot.',
    roe: 'Safe scope: Read-only forensic review of snapshot logs under /evidence/m6/. Record exact accounts, UTC hop timestamps, zones, ports, and the persistence file path.',
    steps: [
      'Inspect /evidence/m6/auth.log, /evidence/m6/audit.log, and /evidence/m6/fw_flows.log in the Terminal.',
      'Put each cross-zone login hop in UTC order (pin key lines to Evidence -> Timeline to visualize the chain), then search /evidence/m6/ews_fs/ for scheduled persistence units or timers.',
      'Write the verified pivot hops and persistence details into ~/workspace/pivot_dossier.json (via Terminal or Edit file), check with Practice, and click Submit module.',
    ],
    objectives: [
      'Trace each cross-zone login hop across auth.log and fw_flows.log',
      'Find the staged persistence unit inside /evidence/m6/ews_fs/',
      'Save ~/workspace/pivot_dossier.json and submit',
    ],
    hints: [
      'Filter /evidence/m6/fw_flows.log for allowed inter-zone flows just prior to the 16:10 UTC outage window.',
      'Correlate accepted SSH logins in auth.log with scheduled units or timers inside /evidence/m6/ews_fs/.',
      'awk \'$8 == "ALLOW" {print}\' /evidence/m6/fw_flows.log && grep -E "Accepted|session opened" /evidence/m6/auth.log',
    ],
    rubric: [
      'Lateral pivot hops, zones, ports, and accounts verified',
      'Persistence unit path and trigger schedule identified',
      'UTC hop timeline consistent with control room compromise',
    ],
  },
  {
    id: 'm7', contractId: 'm07', num: 7, pts: 100, pass: 80, time: '50 to 70 min',
    title: 'Decode the implant and remove it',
    artifact: '~/workspace/implant_decode.json',
    keyTerms: ['replay-shim', 'hmi', 'scada', 'ioa'],
    scenario: 'A hidden replay shim on the control server is still feeding fake normal numbers to the operator screens. Decode its 64-byte binary config file (4-byte ASCII header, XOR key at byte 5, masked payload bytes 8 to 59, IEEE CRC-32 checksum bytes 60 to 63), then remove both the Module 6 persistence task and the live replay shim from the Terminal so true open breakers and real alarms finally appear.',
    roe: 'Safe scope: Remove only the rogue shim and persistence unit using the terminal CLI (Station -> Controls shows read-only shim status). Keep normal SCADA polling running.',
    steps: [
      'Inspect /evidence/m7/ews_fs/var/lib/scada-sync/target.bin in the Terminal using xxd and unpack the big-endian config fields and IEEE CRC-32 checksum in Python.',
      'Run the terminal cleanup command using your Module 6 persistence path and verified CRC-32 hex to disable the replay shim cleanly.',
      'Confirm true breaker states and real alerts show up in the stage and Station -> Alarms & SOE, save ~/workspace/implant_decode.json (via Terminal or Edit file), run Practice, and submit.',
    ],
    objectives: [
      'Verify the IEEE CRC-32 and decode target.bin in the Terminal',
      'Disable persistence and remove the live replay shim via terminal CLI',
      'Confirm true alarms appear in Station -> Alarms & SOE',
      'Save ~/workspace/implant_decode.json and submit',
    ],
    hints: [
      'Bytes 0..3 hold the 4-byte ASCII magic header; byte 5 holds the XOR key masking bytes 8..59.',
      'Verify IEEE CRC-32 over raw bytes 0..59 before unpacking primary/secondary CA, rogue OA, and target IOAs; keep the verified CRC-32 hex and your M6 persistence unit path ready for clean-up.',
      'xxd /evidence/m7/ews_fs/var/lib/scada-sync/target.bin && scada-ctl disable-shim --unit <m6_persistence_path> --crc <decoded_crc32_hex>',
    ],
    rubric: [
      'Decoded target RTU IPs, CAs, rogue OA, IOA list, and delay verified',
      'Persistence unit and replay shim removed cleanly',
      'Live SCADA polling intact and true station state visible',
    ],
  },
  {
    id: 'm8', contractId: 'm08', num: 8, pts: 110, pass: 88, time: '55 to 70 min',
    title: 'Zero-downtime Purdue containment',
    artifact: '~/workspace/policy.yaml',
    artifactNote: '~/workspace/policy.yaml + ~/workspace/m8_evidence.json',
    keyTerms: ['purdue-model', 'iec-104', 'historian', 'passive-tap-pcap'],
    scenario: 'The screens tell the truth again, but the open doors between office, DMZ, and substation zones are still unguarded. Build a default-deny Purdue firewall policy in ~/workspace/policy.yaml that blocks every unauthorized path while keeping live SCADA polling and historian reads flowing uninterrupted, prove a blocked path with a shell probe, and record 60 seconds of healthy post-apply IEC-104 traffic.',
    roe: 'Safe scope: Keep L3 Master to L1 RTU polling at or above 99% with zero disconnects during apply and hold. Use fwctl probe in the Terminal (not only the dashboard preview) for graded proof.',
    steps: [
      'Design your allowed zone rules in ~/workspace/policy.yaml (either in the Terminal, Edit file, or the empty matrix in Station -> Controls). Watch the Network view above to visualize zones.',
      'Test syntax safely with fwctl test ~/workspace/policy.yaml, then enforce live with fwctl apply ~/workspace/policy.yaml.',
      'Run fwctl probe --from <SRC> --to <DST> --port <PORT> in the Terminal against a blocked cross-zone path and capture the matching line from /evidence/m8/firewall_events.tsv.',
      'Count live IEC-104 I-frames across a 60 s post-apply window in /evidence/m8/live_tap.pcap with tshark, save ~/workspace/m8_evidence.json, test with Practice, and submit.',
    ],
    objectives: [
      'Write a default-deny Purdue policy in ~/workspace/policy.yaml',
      'Test and apply the policy without dropping SCADA polling',
      'Run shell fwctl probe on a blocked path and save the firewall_events.tsv line',
      'Record 60 s post-apply tap I-frame count in ~/workspace/m8_evidence.json and submit',
    ],
    hints: [
      'Audit which ordered zone pairs require explicit allow rules for SCADA polling, historian ingestion, and responder access; deny unauthorized lateral paths.',
      'After fwctl apply, run fwctl probe from the shell against a denied path to generate a firewall_events.tsv record, then filter /evidence/m8/live_tap.pcap for iec60870_104.type == 0 across a 60 s window.',
      'fwctl test ~/workspace/policy.yaml && fwctl apply ~/workspace/policy.yaml && fwctl probe --from L4_CORP --to L1_FIELD --port 2404',
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
    artifactNote: '~/workspace/restore_plan.yaml + ~/workspace/restore_calc.json',
    keyTerms: ['sbo', 'clpu', 'ansi-25', 'lockout-86', 'gen-132-gt1'],
    scenario: 'The substation starts at Clean Start: all six 33 kV feeders are open, TR-2 is on standby, and the station is running islanded on GEN-132-GT1 (42 MW continuous / 46 MW 10 s ceiling). Check this instance seeded feeder loads and cold-load surge (CLPU) curves, write your switching sequence in ~/workspace/restore_plan.yaml and predicted peak MW per step in ~/workspace/restore_calc.json, then energize Suryanagar safely in the exact order you planned (either paced islanded restoration or synchronised via CB-220-TIE1).',
    roe: 'Safe scope: Always restore Tier 1 life-safety feeders (Trauma Hospital and Water Works) strictly before Tier 2 and Tier 3, with wait_s >= 2 on every feeder close. Each protection trip costs 10% (max 30%).',
    steps: [
      'Run grid-calc budget and grid-calc clpu <bay> --t <seconds> in the Terminal to read this instance seeded feeder loads and cold-load surge decay.',
      'Write ~/workspace/restore_plan.yaml (matching your chosen strategy and step order, with wait_s >= 2 per feeder close) and ~/workspace/restore_calc.json (predicted total MW per step within +/-3%).',
      'Open Station -> Controls (or run sbo commands in the Terminal, including sbo governor <freq_hz> from 49.00 to 51.00 Hz to bring synchroscope slip into the ANSI 25 window for tied mode) to Select and Permit-Execute each breaker in your planned order while monitoring Station -> Trends and the Substation view above.',
      'If an overload latches Lockout 86, review the 15 s trip replay in Station -> Alarms & SOE, clear Lockout 86 or reset, adjust pacing, then run Practice and Submit module.',
    ],
    objectives: [
      'Read seeded feeder MW and CLPU decay curves using grid-calc in the Terminal',
      'Save ~/workspace/restore_plan.yaml and ~/workspace/restore_calc.json',
      'Energize Tier 1 feeders first in Station -> Controls matching your planned order',
      'Hold steady inside 49.90 to 50.05 Hz and submit',
    ],
    hints: [
      'Inspect each feeder steady MW, CLPU multiplier, and decay curve via grid-calc budget and grid-calc clpu <bay> --t <seconds>. Islanded restoration tests surge planning; synchronised restoration tests ANSI 25 tie closing (|Phase| <= 12 deg, 49.95 to 50.05 Hz, |dV| <= 0.03 p.u.).',
      'Compare each candidate feeder initial surge plus already-decaying earlier surges against the remaining headroom under the 46 MW 10 s ceiling and 115% transformer trip threshold before writing restore_calc.json.',
      'Compare cold-load excess P_steady * (clpu_mult - 1) descending per tier; run: grid-calc budget && grid-calc clpu BAY-01 --t 15 && sbo tr2 close',
    ],
    rubric: [
      'Step-by-step predicted peak MW in restore_calc.json matches physics within +/-3% (30%)',
      'Live switching order matches restore_plan.yaml with Tier 1 first and zero trips during 30 s hold (70%)',
      'Bus voltage 0.95 to 1.05 p.u., TR loading <= 95%, frequency 49.90 to 50.05 Hz (10% per protection trip, max 30%)',
    ],
  },
  {
    id: 'm10', contractId: 'm10', num: 10, pts: 100, pass: 80, time: '55 to 75 min',
    title: 'Detection engineering and handover',
    artifact: '~/workspace/grid_defense.zeek',
    keyTerms: ['iec-104', 'sbo', 'asdu-ca', 'passive-tap-pcap', 'dispatch-soe'],
    scenario: 'Suryanagar has power again. Make sure an attack like this is caught immediately next time: write a Zeek IEC-104 detection script in ~/workspace/grid_defense.zeek that alerts on unauthorized control commands (wrong source IP, wrong Originator Address, disallowed control TypeIDs, or Execute without a prior Select) with zero false alerts on normal polling, then compile your commander handover brief in ~/workspace/handover_brief.json.',
    roe: 'Safe scope: Your Zeek script runs in an isolated sandbox against unseen test captures. Save files with standard Unix (LF) line endings.',
    steps: [
      'Write your protocol-invariant detection logic in ~/workspace/grid_defense.zeek (via Terminal or Edit file) and test it against practice captures using zeek-test in the Terminal.',
      'Confirm zero false alerts fire on clean live station polling traffic.',
      'Review your verified findings in Case & Checks -> Case Board and Evidence -> Timeline, compile ~/workspace/handover_brief.json, run Practice, and click Submit module to unlock your Shift Report.',
    ],
    objectives: [
      'Write ~/workspace/grid_defense.zeek and test with zeek-test in the Terminal',
      'Verify zero false alerts on clean polling traffic',
      'Compile ~/workspace/handover_brief.json from your Case Board & Timeline and submit',
    ],
    hints: [
      'Track pending Select (S/E=1) per (source, CA, IOA) so Execute-without-Select raises a notice immediately.',
      'Inspect Type 45, 46, 58, 59, and 105 control ASDUs against the legitimate master address and Originator Address.',
      'zeek-test ~/workspace/grid_defense.zeek',
    ],
    rubric: [
      'True positive detection across unseen control attack shapes',
      'Zero false positives across benign practice and live polling windows',
      'Handover brief consistent with verified incident evidence',
    ],
  },
  {
    id: 'full_op', contractId: 'full_op', num: 11, pts: 1000, pass: 800, time: 'Unscripted 6-gate', isFullOp: true,
    title: 'Full operation mode',
    artifact: '~/workspace/handover_brief.json',
    keyTerms: ['iec-104', 'replay-shim', 'purdue-model', 'sbo', 'clpu'],
    scenario: 'Run the complete Operation Blackout response from start to finish with a fresh independent seed and no guided step rails: prove telemetry divergence, remove the replay shim, seal the Purdue zones without dropping polling, restore the city safely (Tier 1 first), deploy Zeek detection, and deliver your commander handover brief.',
    roe: 'Safe scope: All six operational gates are graded together. Electrical state resets are capped at three in Full Operation Mode.',
    steps: [
      'Corroborate telemetry divergence across Evidence -> Dispatch, Evidence -> IEC-104 Frames, and the Terminal, then decode and remove the replay shim.',
      'Author and enforce zero-downtime Purdue segmentation in ~/workspace/policy.yaml and verify your shell fwctl probe.',
      'Plan and run paced two-step SBO restoration (Trauma Hospital and Water Works first) in Station -> Controls while watching Station -> Trends.',
      'Deploy ~/workspace/grid_defense.zeek, compile ~/workspace/handover_brief.json, and submit.',
    ],
    objectives: [
      'Prove divergence and remove the replay shim via Terminal',
      'Enforce Purdue containment and verify shell probe proof',
      'Restore all districts safely (Tier 1 first) with stable frequency',
      'Deploy Zeek detection and submit ~/workspace/handover_brief.json',
    ],
    hints: [
      'Full operation mode evaluates end-to-end response across Modules 1 through 10.',
      'Correlate Evidence -> Timeline, Station -> Alarms & SOE, and Station -> Trends before switching or applying firewall changes.',
      'Check ~/workspace artifacts against each module contract before submitting.',
    ],
    rubric: [
      'Gates 1 to 3: Inventory, divergence proof, and implant eradication verified',
      'Gate 4: Zero-downtime Purdue containment active across unauthorized corridors',
      'Gates 5 to 6: Tier 1 first paced restoration stable and Zeek detection verified',
    ],
  },
];

export const SCORED_MODULES = MODULES.filter((m) => !m.isFullOp);
