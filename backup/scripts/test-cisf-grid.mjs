import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function loadTsModule(relPath, replacer = (s) => s) {
  const raw = await readFile(new URL(`../${relPath}`, import.meta.url), 'utf8');
  const source = replacer(raw);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

async function loadBundledPlatformTransport() {
  const libApiSrc = (await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8'))
    .replaceAll('import.meta.env.VITE_API_URL', "''");
  const apiSrc = await readFile(new URL('../src/components/cisfGrid/api.ts', import.meta.url), 'utf8');
  const transportSrc = await readFile(new URL('../src/components/cisfGrid/v13/platformTransport.ts', import.meta.url), 'utf8');

  const libApiJs = ts.transpileModule(libApiSrc, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const libApiUrl = `data:text/javascript;base64,${Buffer.from(libApiJs).toString('base64')}`;

  const apiJs = ts.transpileModule(
    apiSrc.replaceAll("'../../lib/api'", `'${libApiUrl}'`),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
  ).outputText;
  const apiUrl = `data:text/javascript;base64,${Buffer.from(apiJs).toString('base64')}`;

  const transportJs = ts.transpileModule(
    transportSrc
      .replaceAll("'../../../lib/api'", `'${libApiUrl}'`)
      .replaceAll("'../api'", `'${apiUrl}'`),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
  ).outputText;
  const transportUrl = `data:text/javascript;base64,${Buffer.from(transportJs).toString('base64')}`;

  const [apiMod, transportMod] = await Promise.all([import(apiUrl), import(transportUrl)]);
  return { ...apiMod, ...transportMod };
}

test('labRoutes maps cisf-ot-grid and preserves assignment_id query param', async () => {
  const { labPath, assignmentLabPath } = await loadTsModule('src/utils/labRoutes.ts');
  assert.equal(labPath('cisf-ot-grid'), '/labs/cisf-ot-grid');
  assert.equal(assignmentLabPath('cisf-ot-grid', 42), '/labs/cisf-ot-grid?assignment_id=42');
  assert.equal(labPath('cisf-honeypot'), '/labs/cisf-honeypot');

  const availableSrc = await readFile(new URL('../src/pages/user/AvailableLabs.tsx', import.meta.url), 'utf8');
  assert.ok(
    availableSrc.includes("id === 'cisf-ot-grid') navigate('/labs/cisf-ot-grid')"),
    'AvailableLabs.tsx must route cisf-ot-grid launches directly to /labs/cisf-ot-grid',
  );
});

test('labCopy and skills register cisf-ot-grid metadata cleanly', async () => {
  const { labSummary, labDifficulty, moduleMinutes } = await loadTsModule('src/utils/labCopy.ts');
  const { LAB_SKILLS } = await loadTsModule('src/data/skills.ts');
  assert.match(labSummary('cisf-ot-grid', ''), /IEC 60870-5-104/i);
  assert.equal(labDifficulty('cisf-ot-grid', 'intermediate'), 'advanced');
  assert.equal(moduleMinutes('cisf-ot-grid', 'cisf-ot-grid_m01', 45), 50);
  assert.ok(LAB_SKILLS['cisf-ot-grid'].skills.includes('IEC 60870-5-104'));
});

test('Mascot Phase 3 additions have zero raw hex literals and cover all four poses', async () => {
  const mascotTsx = await readFile(new URL('../src/components/mascot/Mascot.tsx', import.meta.url), 'utf8');
  const mascotCss = await readFile(new URL('../src/components/mascot/mascot.css', import.meta.url), 'utf8');
  const hopTs = await readFile(new URL('../src/components/mascot/mascotHop.ts', import.meta.url), 'utf8');

  for (const pose of ["'point'", "'hop'", "'nod'", "'phone'"]) {
    assert.ok(mascotTsx.includes(pose), `Mascot.tsx missing pose ${pose}`);
  }
  assert.ok(mascotTsx.includes('data-dir={shown === \'point\''), 'Mascot.tsx missing data-dir binding');
  assert.ok(mascotTsx.includes('className="m-phone"'), 'Mascot.tsx missing clay peach handset group');

  const phase3Marker = '/* Phase 3 lab-tour poses:';
  const idx = mascotCss.indexOf(phase3Marker);
  assert.ok(idx !== -1, 'mascot.css missing Phase 3 section');
  const addedCss = mascotCss.slice(idx);
  assert.doesNotMatch(addedCss, /#[0-9a-fA-F]{3,8}\b/, 'Phase 3 mascot.css additions must contain zero raw hex');
  for (const dir of ['left', 'right', 'up', 'down']) {
    assert.ok(addedCss.includes(`.mascot--point[data-dir="${dir}"]`), `mascot.css missing point dir ${dir}`);
  }
  assert.ok(addedCss.includes('.mascot--hop'), 'mascot.css missing .mascot--hop');
  assert.ok(addedCss.includes('.mascot--nod'), 'mascot.css missing .mascot--nod');
  assert.ok(addedCss.includes('.mascot--phone'), 'mascot.css missing .mascot--phone');
  assert.ok(hopTs.includes('prefers-reduced-motion: reduce'), 'mascotHop.ts must honor prefers-reduced-motion');
});

test('CisfGridLabPage and V13 Living Stage port adhere to aesthetic, routing, security, and L1-L4 invariants', async () => {
  const files = [
    'src/pages/user/CisfGridLabPage.tsx',
    'src/components/cisfGrid/types.ts',
    'src/components/cisfGrid/api.ts',
    'src/components/cisfGrid/CisfGridV13Workspace.tsx',
    'src/components/cisfGrid/v13/platformTransport.ts',
    'src/components/cisfGrid/v13/ems.d.ts',
    'src/components/cisfGrid/v13/ems.js',
    'src/components/cisfGrid/v13/modules.js',
    'src/components/cisfGrid/v13/scene.js',
    'src/components/cisfGrid/v13/panels.js',
    'src/components/cisfGrid/v13/glossary.js',
    'src/components/cisfGrid/v13/mascot.js',
    'src/components/cisfGrid/v13/terminal.js',
    'src/components/cisfGrid/v13/story.js',
    'src/components/cisfGrid/v13/tour.js',
    'src/components/cisfGrid/v13/v13Styles.css',
    'src/components/cisfGrid/v13/v13Tour.css',
  ];
  for (const rel of files) {
    const src = await readFile(new URL(`../${rel}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /[\u2013\u2014]/, `${rel} must not contain em/en dashes`);
    assert.doesNotMatch(src, /transition-all|transition:\s*all\b/, `${rel} must not use transition-all`);
    assert.doesNotMatch(src, /\b(?:purple|violet|indigo)-\d{2,3}\b/, `${rel} must not use purple/violet/indigo`);
    if (/\.(js|ts|tsx)$/.test(rel)) {
      assert.doesNotMatch(src, /\bfetch\s*\(/, `${rel} must not call raw fetch()`);
    }
  }

  // E-21: Dead legacy components removed
  for (const dead of [
    '../src/components/cisfGrid/CisfGridCodeEditor.tsx',
    '../src/components/cisfGrid/CisfGridStage.tsx',
    '../src/components/cisfGrid/CisfGridTour.tsx',
  ]) {
    await assert.rejects(access(new URL(dead, import.meta.url)), `${dead} should be removed as dead code`);
  }

  const pageSrc = await readFile(new URL('../src/pages/user/CisfGridLabPage.tsx', import.meta.url), 'utf8');
  const wsBridgeSrc = await readFile(new URL('../src/components/cisfGrid/CisfGridV13Workspace.tsx', import.meta.url), 'utf8');
  const transportSrc = await readFile(new URL('../src/components/cisfGrid/v13/platformTransport.ts', import.meta.url), 'utf8');
  const v13EmsSrc = await readFile(new URL('../src/components/cisfGrid/v13/ems.js', import.meta.url), 'utf8');
  const v13TermSrc = await readFile(new URL('../src/components/cisfGrid/v13/terminal.js', import.meta.url), 'utf8');
  const v13CssSrc = await readFile(new URL('../src/components/cisfGrid/v13/v13Styles.css', import.meta.url), 'utf8');
  const apiSrc = await readFile(new URL('../src/components/cisfGrid/api.ts', import.meta.url), 'utf8');

  assert.ok(pageSrc.includes('<CisfGridV13Workspace'), 'CisfGridLabPage must mount CisfGridV13Workspace when running');
  assert.doesNotMatch(pageSrc, /Full Operation Mode|setLaunchMode\('full_op'\)/, 'CisfGridLabPage must use guided 10-module mode only');
  assert.ok(v13EmsSrc.includes('SCORED_MODULES.forEach((m) => {'), 'v13/ems.js rail must list only the 10 guided modules');
  assert.ok(wsBridgeSrc.includes('mountV13Workspace'), 'CisfGridV13Workspace must mount V13 workspace');
  assert.ok(wsBridgeSrc.includes("assetBase: '/cisf-grid/assets'"), 'CisfGridV13Workspace must point sprites to /cisf-grid/assets');
  assert.ok(transportSrc.includes('/api/v1/terminal/ws/cisf-ot-grid'), 'platformTransport must wire terminal WS to cisf-ot-grid');
  assert.ok(transportSrc.includes('apiWebSocketUrl'), 'platformTransport must build WS URLs via apiWebSocketUrl');
  assert.ok(apiSrc.includes('X-Grid-Eval-Token'), 'api.ts must send X-Grid-Eval-Token on verify');
  assert.ok(apiSrc.includes('rec.error') && apiSrc.includes('rec.retry_after_s'), 'api.ts must surface checker error and retry_after_s');
  assert.doesNotMatch(pageSrc, /interactive=\{true\}/, 'Mascot must never be interactive inside CisfGridLabPage');

  // Verify all 40 Clay 3D WebP sprites are packaged under public/cisf-grid/assets
  const assetFiles = (await readdir(new URL('../public/cisf-grid/assets', import.meta.url))).filter((f) => f.endsWith('.webp'));
  assert.equal(assetFiles.length, 40, `Expected 40 Clay 3D WebP sprites in public/cisf-grid/assets, found ${assetFiles.length}`);

  // Verify V13 CSS is scoped strictly under .cg-v13-root and preserves CyberRange OKLCH ramps
  assert.ok(v13CssSrc.includes('html.dark .cg-v13-root'), 'v13Styles.css must scope Ember dark tokens to .cg-v13-root');
  assert.ok(v13CssSrc.includes('oklch(0.56 0.155 40)'), 'v13Styles.css must carry CyberRange Burnt Orange Ember primary token');
  assert.doesNotMatch(v13CssSrc, /^:root\b/m, 'v13Styles.css must not leak unscoped :root');

  const designMd = await readFile(new URL('../DESIGN.md', import.meta.url), 'utf8');
  assert.ok(designMd.includes('Decision 6'), 'DESIGN.md must document Decision 6 eighth allowed place');
  assert.ok(designMd.includes('living-lab-stage'), 'DESIGN.md must document living-lab-stage');

  const mascotSrc = await readFile(new URL('../src/components/mascot/Mascot.tsx', import.meta.url), 'utf8');
  assert.ok(mascotSrc.includes("shown !== 'point'"), 'Mascot.tsx must not clobber CSS point gaze when look is omitted');

  // L1, L3, L4 live-check regression invariants across page + V13 modules + RealTerminal
  assert.ok(
    pageSrc.includes('Your lab stopped. Start it again; your points are safe.'),
    'CisfGridLabPage must render L1 stopped-lab message',
  );
  assert.ok(v13EmsSrc.includes('activeCheckPollId'), 'v13/ems.js must isolate async check polling');
  assert.ok(
    v13EmsSrc.includes('syncPassedModulesFromSigned(s.passed_modules, false)') &&
      v13EmsSrc.includes('syncPassedModulesFromSigned(ids, true)'),
    'v13/ems.js must union live WS passed_modules so fresh containers after L1 restart never wipe Postgres completions',
  );
  assert.ok(v13EmsSrc.includes('beforeunload') && v13EmsSrc.includes('pagehide'), 'v13/ems.js must close EMS WebSocket cleanly on unload (L3)');
  assert.ok(v13TermSrc.includes('beforeunload') && v13TermSrc.includes('pagehide'), 'v13/terminal.js must close terminal WebSocket cleanly on unload (L3)');
  assert.ok(v13EmsSrc.includes('nm.title = fullName') && v13EmsSrc.includes('feeder: ${fullName}'), 'v13/ems.js must expose full feeder name via aria-label/title (L4)');

  const termSrc = await readFile(new URL('../src/components/RealTerminal.tsx', import.meta.url), 'utf8');
  assert.ok(termSrc.includes('beforeunload') && termSrc.includes('pagehide'), 'RealTerminal must close WebSocket cleanly on unload (L3)');
  assert.ok(termSrc.includes('enabled?: boolean'), 'RealTerminal must accept enabled prop (L3)');
  assert.ok(termSrc.includes('className="truncate" title={resolvedTitle}'), 'RealTerminal header title must truncate cleanly on narrow screens (L4)');
});

test('Live v13/modules.js enforces 10-module 1000-pt ladder, zero plaintext L3 hints, zero full_op, and C-13/C-17 parity', async () => {
  const { MODULES, SCORED_MODULES } = await import('../src/components/cisfGrid/v13/modules.js');
  const expected = [
    ['m01', 70, '45 to 60 min'],
    ['m02', 90, '50 to 65 min'],
    ['m03', 80, '45 to 60 min'],
    ['m04', 100, '55 to 70 min'],
    ['m05', 110, '55 to 75 min'],
    ['m06', 100, '55 to 70 min'],
    ['m07', 100, '50 to 65 min'],
    ['m08', 110, '55 to 75 min'],
    ['m09', 140, '60 to 75 min'],
    ['m10', 100, '55 to 70 min'],
  ];

  assert.equal(MODULES.length, 10, 'v13/modules.js must contain strictly 10 guided modules (no full_op)');
  assert.equal(SCORED_MODULES.length, 10, 'SCORED_MODULES must contain all 10 guided modules');
  assert.ok(!MODULES.some((m) => m.id === 'full_op' || m.isFullOp), 'full_op must be removed from v13/modules.js');
  assert.deepEqual(
    SCORED_MODULES.map((m) => [m.contractId, m.pts, m.time]),
    expected,
    'Live v13/modules.js points and target times must match seed_model.py',
  );
  assert.equal(
    SCORED_MODULES.reduce((acc, m) => acc + m.pts, 0),
    1000,
    'Live v13/modules.js total points must equal 1000',
  );

  // E-06 / C-12: Zero plaintext Level 3 hints in client bundle
  for (const m of MODULES) {
    assert.equal(m.hints.length, 2, `${m.contractId} must ship only L1 and L2 hints; L3 must come from server`);
  }

  // E-20: Multi-artifact selector lists for M8, M9, M10
  const byContract = Object.fromEntries(MODULES.map((m) => [m.contractId, m]));
  assert.deepEqual(byContract.m08.artifacts, ['policy.yaml', 'm8_evidence.json']);
  assert.deepEqual(byContract.m09.artifacts, ['restore_plan.yaml', 'restore_calc.json']);
  assert.deepEqual(byContract.m10.artifacts, ['grid_defense.zeek', 'handover_brief.json']);

  // C-13: Required CLI gates & exact schemas documented in module instructions
  const modText = await readFile(new URL('../src/components/cisfGrid/v13/modules.js', import.meta.url), 'utf8');
  for (const token of [
    'iec104-observe --bay',
    'http://10.204.20.10:8085/api/v1/export?window=15m',
    'dmz_access.tsv',
    'iec104-observe --probe',
    'select_qoc',
    'execute_qoc',
    'audit-query --self-check',
    'persistence_kind',
    '>4s4sHHBBH3I3BB20s',
    'grid-calc clpu',
    'Station -> Controls',
    'Safe Partial',
    'module iec104;',
    'ctx(c, is_orig)',
    'GridDefense::authorized_masters',
    'GridDefense::authorized_oa',
    'GridDefense::authorized_cas',
    'restoration_margin_mw',
  ]) {
    assert.ok(modText.includes(token), `v13/modules.js missing C-13 required token: ${token}`);
  }
  assert.ok(!modText.includes('trip replay in Station -> Alarms & SOE'), 'M9 brief must point trip replay to Station -> Controls');
  assert.ok(!modText.includes('Decoded target RTU IPs'), 'M7 rubric must not claim rtu1_ip/rtu2_ip are graded fields');

  // C-17: 2026-11-25 is Wednesday night
  const storyJson = JSON.parse(await readFile(new URL('../src/components/cisfGrid/v13/data/story.json', import.meta.url), 'utf8'));
  assert.ok(
    storyJson.coldOpen.beats[0].line.includes('Wednesday night'),
    'story.json cold open beat-1 must say Wednesday night (2026-11-25)',
  );
});

test('platformTransport runtime: M-07 403/eval-token retry, M-08 mtime conflicts, E-01/E-10 WS tickets, E-15 upstreamLost', async (t) => {
  const prevWindow = globalThis.window;
  globalThis.window = { location: { origin: 'https://academy.deeptrustxai.com' } };
  t.after(() => { globalThis.window = prevWindow; });

  const { createV13PlatformTransport } = await loadBundledPlatformTransport();

  // M-07: Non-eval-token 403 must NOT trigger ensureEvalToken(true) or be masked as 500
  let evalRefreshCalls = 0;
  const upstreamLostEvents = [];
  const transport403 = createV13PlatformTransport({
    apiFetch: async (path) => {
      if (path.includes('/verify')) {
        return new Response(JSON.stringify({ detail: 'Assignment is paused or inactive.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (path.includes('/shift-report')) {
        return new Response(JSON.stringify({ detail: 'Shift report locked until m10 passes.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (path.includes('/reset')) {
        return new Response(JSON.stringify({ error: 'verification check in progress' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 200 });
    },
    getToken: () => 'tok-1',
    assignmentId: 7,
    ensureEvalToken: async (force) => {
      if (force) evalRefreshCalls += 1;
      return 'eval-1';
    },
    onUpstreamLost: (status) => upstreamLostEvents.push(status),
  });

  const denyResp = await transport403.apiJson('POST', '/api/ems/verify', { module_id: 'm01' });
  assert.equal(denyResp.status, 403, 'Non-eval-token 403 must be preserved as HTTP 403, never 500');
  assert.equal(evalRefreshCalls, 0, 'Non-eval-token 403 must not force eval token refresh');

  const shiftResp = await transport403.apiJson('GET', '/api/ems/shift-report');
  assert.equal(shiftResp.status, 403, 'Locked shift report must preserve 403 status instead of collapsing to 404');

  // E-15: Mid-check 409 on reset-module must NOT trigger onUpstreamLost
  await transport403.apiJson('POST', '/api/ems/reset-module', { module_id: 'm01' });
  assert.equal(upstreamLostEvents.length, 0, 'Legitimate mid-check 409 must not trigger onUpstreamLost');

  // M-07: X-Grid-Error-Code: eval_token_expired DOES retry once with ensureEvalToken(true)
  let verifyAttempts = 0;
  let evalForced = 0;
  const transportExpiredEval = createV13PlatformTransport({
    apiFetch: async (path, opts) => {
      if (path.includes('/verify')) {
        verifyAttempts += 1;
        if (verifyAttempts === 1) {
          return new Response(JSON.stringify({ detail: 'Invalid evaluation token' }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'X-Grid-Error-Code': 'eval_token_expired',
            },
          });
        }
        assert.equal(opts?.headers?.['X-Grid-Eval-Token'], 'eval-fresh');
        return new Response(JSON.stringify({ check_id: 'chk-1', module_id: 'm01' }), { status: 202 });
      }
      return new Response('{}', { status: 200 });
    },
    getToken: () => 'tok-1',
    assignmentId: null,
    ensureEvalToken: async (force) => {
      if (force) {
        evalForced += 1;
        return 'eval-fresh';
      }
      return 'eval-stale';
    },
  });
  const okVerify = await transportExpiredEval.apiJson('POST', '/api/ems/verify', { module_id: 'm01' });
  assert.equal(okVerify.ok, true);
  assert.equal(evalForced, 1);

  // M-08: readFile preserves mtime, writeFile forwards expected_mtime and surfaces 409 current_mtime
  let capturedPutBody = null;
  const transportFiles = createV13PlatformTransport({
    apiFetch: async (path, opts) => {
      if (path.includes('/workspace/files/policy.yaml') && (!opts || opts.method !== 'PUT')) {
        return new Response(JSON.stringify({ name: 'policy.yaml', content: 'default_policy: deny\n', bytes: 21, mtime: 1700001.5 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (path.includes('/workspace/files/policy.yaml') && opts?.method === 'PUT') {
        capturedPutBody = JSON.parse(String(opts.body));
        return new Response(JSON.stringify({ error: 'file_modified_externally', current_mtime: 1700099.25 }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 200 });
    },
    getToken: () => 'tok-1',
    assignmentId: null,
    ensureEvalToken: async () => 'eval-1',
  });
  const readRes = await transportFiles.readFile('policy.yaml');
  assert.equal(readRes.ok, true);
  assert.equal(readRes.mtime, 1700001.5, 'readFile must preserve mtime');
  const writeRes = await transportFiles.writeFile('policy.yaml', 'default_policy: deny\nrules: []\n', 1700001.5);
  assert.equal(capturedPutBody.expected_mtime, 1700001.5, 'writeFile must forward expected_mtime');
  assert.equal(writeRes.ok, false);
  assert.equal(writeRes.status, 409);
  assert.equal(writeRes.error, 'file_modified_externally');
  assert.equal(writeRes.current_mtime, 1700099.25);

  // E-01 + E-10: WS ticket preferred; falls back dynamically to latest getToken() on 404
  let currentTok = 'jwt-initial';
  let ticketMode = 'ok';
  const transportWs = createV13PlatformTransport({
    apiFetch: async (path) => {
      if (path.includes('/ws-ticket')) {
        if (ticketMode === 'ok') {
          return new Response(JSON.stringify({ ticket: 'tkt-abc-123', expires_in: 30 }), { status: 200 });
        }
        return new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 });
      }
      return new Response('{}', { status: 200 });
    },
    getToken: () => currentTok,
    assignmentId: null,
    ensureEvalToken: async () => 'eval-1',
  });

  const termTicketUrl = await transportWs.getTerminalWsUrl();
  assert.match(termTicketUrl, /\?ticket=tkt-abc-123$/, 'Terminal WS must prefer single-use ?ticket=');
  const emsTicketUrl = await transportWs.getEmsWsUrl();
  assert.match(emsTicketUrl, /\?ticket=tkt-abc-123$/, 'EMS WS must prefer single-use ?ticket=');

  ticketMode = '404';
  currentTok = 'jwt-refreshed-2';
  const fallbackTermUrl = await transportWs.getTerminalWsUrl();
  assert.match(fallbackTermUrl, /\?token=jwt-refreshed-2$/, 'WS fallback must read fresh token dynamically after refresh');
});

test('C-04 runtime: formatSoeReplayEvents formats SOEEvent objects via code + detail without [object Object]', async () => {
  const { formatSoeReplayEvents } = await import('../src/components/cisfGrid/v13/panels.js');
  assert.equal(typeof formatSoeReplayEvents, 'function', 'panels.js must export formatSoeReplayEvents');
  const out = formatSoeReplayEvents([
    { seq: 12, sim_time_ms: 4200, utc: '16:10:04.200Z', code: 'ANSI_50_INSTANT_TRIP', asset: 'TR-1', detail: { loading_pct: 138.4, trip: true } },
    { seq: 13, sim_time_ms: 4201, utc: '16:10:04.201Z', code: 'LOCKOUT_86_LATCHED', asset: 'TR-1', detail: { reason: 'overcurrent' } },
  ], 138);
  assert.ok(!out.includes('[object Object]'), `SOE replay text must not contain [object Object]: ${out}`);
  assert.ok(!out.includes('undefined'), `SOE replay text must not contain undefined: ${out}`);
  assert.ok(out.includes('TR-1') && out.includes('ANSI_50_INSTANT_TRIP') && out.includes('loading_pct=138.4'), `Unexpected SOE text: ${out}`);
});

test('C-16 runtime: policy YAML round-trip preserves multiple ports on the same zone pair', async () => {
  const { parsePolicyYamlToRules, serializePolicyRulesToYaml } = await import('../src/components/cisfGrid/v13/panels.js');
  const yaml = [
    'default_policy: deny',
    'rules:',
    '  - id: r-dmz-8085',
    '    src_zone: RESPONDER',
    '    dst_zone: L35_DMZ',
    '    protocol: tcp',
    '    dst_port: 8085',
    '    action: allow',
    '  - id: r-dmz-8086',
    '    src_zone: RESPONDER',
    '    dst_zone: L35_DMZ',
    '    protocol: tcp',
    '    dst_port: 8086',
    '    action: allow',
  ].join('\n');
  const parsed = parsePolicyYamlToRules(yaml);
  assert.equal(parsed.defaultPolicy, 'deny');
  assert.ok(parsed.rules['RESPONDER->L35_DMZ:8085'], 'Must preserve port 8085 rule');
  assert.ok(parsed.rules['RESPONDER->L35_DMZ:8086'], 'Must preserve port 8086 rule on same zone pair');
  const outYaml = serializePolicyRulesToYaml(parsed.defaultPolicy, parsed.rules);
  assert.ok(outYaml.includes('dst_port: 8085') && outYaml.includes('dst_port: 8086'), 'Serialized YAML must keep both ports');
});

test('M-09 runtime: worker-entry.js sets baseline security headers on static SPA responses', async () => {
  const workerMod = await import('../../worker-entry.js');
  const worker = workerMod.default;
  const req = new Request('https://academy.deeptrustxai.com/labs/cisf-ot-grid');
  const res = await worker.fetch(req, {
    ASSETS: {
      fetch: async () => new Response('<!doctype html><html></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    },
  });
  assert.equal(res.status, 200);
  const csp = res.headers.get('Content-Security-Policy') || '';
  assert.ok(csp.includes("frame-ancestors 'self'"), `Missing frame-ancestors CSP: ${csp}`);
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(res.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
});

test('Track 3 static resilience & hardening invariants across AuthContext, LabPage, V13 workspace, and terminal', async () => {
  const authSrc = await readFile(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8');
  const reportSrc = await readFile(new URL('../src/pages/admin/StudentLabReportPage.tsx', import.meta.url), 'utf8');
  const pageSrc = await readFile(new URL('../src/pages/user/CisfGridLabPage.tsx', import.meta.url), 'utf8');
  const wsBridgeSrc = await readFile(new URL('../src/components/cisfGrid/CisfGridV13Workspace.tsx', import.meta.url), 'utf8');
  const emsSrc = await readFile(new URL('../src/components/cisfGrid/v13/ems.js', import.meta.url), 'utf8');
  const termSrc = await readFile(new URL('../src/components/cisfGrid/v13/terminal.js', import.meta.url), 'utf8');
  const sceneSrc = await readFile(new URL('../src/components/cisfGrid/v13/scene.js', import.meta.url), 'utf8');
  const panelsSrc = await readFile(new URL('../src/components/cisfGrid/v13/panels.js', import.meta.url), 'utf8');
  const tourSrc = await readFile(new URL('../src/components/cisfGrid/v13/tour.js', import.meta.url), 'utf8');
  const glossarySrc = await readFile(new URL('../src/components/cisfGrid/v13/glossary.js', import.meta.url), 'utf8');

  // M-10 + E-09: Safe localStorage + refresh + storage listener
  assert.ok(authSrc.includes('/api/v1/auth/refresh'), 'AuthContext must wire /api/v1/auth/refresh');
  assert.ok(authSrc.includes("addEventListener('storage'"), 'AuthContext must sync token across tabs via storage event');
  assert.ok(authSrc.includes('safeGetItem') && authSrc.includes('safeSetItem'), 'AuthContext must wrap localStorage safely');
  assert.ok(!reportSrc.includes("const token = localStorage.getItem('token');"), 'StudentLabReportPage must wrap localStorage in try/catch');

  // E-01: token not in useLayoutEffect deps
  assert.ok(!wsBridgeSrc.includes('[apiFetch, token, assignmentId'), 'CisfGridV13Workspace must not remount on token refresh');
  assert.ok(wsBridgeSrc.includes('tokenRef'), 'CisfGridV13Workspace must track token via ref');

  // E-11: separate stopping state and monotonic sessionReqSeqRef
  assert.ok(pageSrc.includes('Stopping lab session...'), 'CisfGridLabPage must render dedicated Stopping state');
  assert.ok(pageSrc.includes('sessionReqSeqRef'), 'CisfGridLabPage must guard refreshSession with monotonic sequence');

  // E-02..E-08, C-02..C-05, E-13..E-19
  assert.ok(emsSrc.includes('editorLoadSeq') && emsSrc.includes('r.status === 404'), 'ems.js must clear editor strictly on 404 and guard races');
  assert.ok(emsSrc.includes('verifyInFlight'), 'ems.js must lock Practice/Submit while check is in flight');
  assert.ok(emsSrc.includes('notesHydrated') && emsSrc.includes('notesDirtyOffline'), 'ems.js must guard offline notes hydration');
  assert.ok(emsSrc.includes('lastWsRxAt') && emsSrc.includes("'online'") && emsSrc.includes("'visibilitychange'"), 'ems.js must run WS liveness watchdog & online/visibility resume');
  assert.ok(emsSrc.includes('resp.data?.hint') || emsSrc.includes('resp.data.hint'), 'ems.js must render server-returned L3 hint');
  assert.ok(emsSrc.includes('total_load_p_mw') && emsSrc.includes('grid_tie_mw'), 'ems.js must bind station load to total_load_p_mw and track grid_tie_mw');
  assert.ok(emsSrc.includes('activeLockouts') && emsSrc.includes('NOT_LATCHED'), 'ems.js must track actual latched assets and check NOT_LATCHED');
  assert.ok(emsSrc.includes('/api/ems/governor/set') && emsSrc.includes('Static offset'), 'ems.js must wire governor control and Static offset');
  assert.ok(emsSrc.includes('pointercancel'), 'ems.js must handle pointercancel on drag/hold controls');
  assert.ok(emsSrc.includes('BroadcastChannel'), 'ems.js must include cross-tab sync awareness');

  // E-05 + M-09 + E-13: terminal keepalive, dynamic WS provider, bounded write queue
  assert.ok(termSrc.includes("type: 'ping'") || termSrc.includes('"ping"'), 'terminal.js must send JSON ping keepalive');
  assert.ok(termSrc.includes('pong'), 'terminal.js must handle JSON pong without printing to xterm');
  assert.ok(termSrc.includes('getWsUrl'), 'terminal.js must support dynamic async getWsUrl provider');
  assert.ok(termSrc.includes('visibilitychange') && termSrc.includes('online'), 'terminal.js must handle online/visibility resume');

  // M-10: notes input listener must be registered outside localStorage.getItem try block
  const notesGetIdx = emsSrc.indexOf('localStorage.getItem(STORAGE_NOTES)');
  const notesCatchIdx = emsSrc.indexOf('catch {}', notesGetIdx);
  const notesInputIdx = emsSrc.indexOf("el.notesArea.addEventListener('input'", notesGetIdx);
  assert.ok(
    notesGetIdx !== -1 && notesCatchIdx !== -1 && notesInputIdx > notesCatchIdx,
    'ems.js must register el.notesArea input listener outside the localStorage try/catch (M-10)',
  );

  // E-12 + E-14 + E-21
  assert.ok(sceneSrc.includes('this.tabHidden || this.offscreen || this.rafId'), 'scene.js renderStaticSnapshot must guard hidden/offscreen/active rAF');
  assert.ok(panelsSrc.includes('!document.hidden'), 'panels.js TrendsPanel.isVisible must guard document.hidden');
  assert.ok(tourSrc.includes('_flyAnim'), 'tour.js must track flying mascot animation for dispose cleanup');
  assert.ok(glossarySrc.includes('CSS.escape'), 'glossary.js must escape termId before querySelector');
});

test('E-01/E-05/E-13/M-09 runtime: PtyTerminal resolves dynamic URLs, coalesces binary writes, and filters JSON pong', async (t) => {
  const { PtyTerminal } = await import('../src/components/cisfGrid/v13/terminal.js');
  const prevWindow = globalThis.window;
  const prevDoc = globalThis.document;
  const prevRaf = globalThis.requestAnimationFrame;
  const prevCancelRaf = globalThis.cancelAnimationFrame;
  const prevWs = globalThis.WebSocket;

  const writes = [];
  const sockets = [];
  class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor(url) {
      this.url = url;
      this.readyState = FakeWebSocket.OPEN;
      this.sent = [];
      sockets.push(this);
    }
    send(data) { this.sent.push(data); }
    close() { this.readyState = FakeWebSocket.CLOSED; }
  }
  class FakeTerminal {
    constructor() { this.rows = 24; this.cols = 80; }
    open() {}
    loadAddon() {}
    onData() {}
    onResize() {}
    write(chunk) { writes.push(chunk); }
    focus() {}
    getSelection() { return ''; }
    dispose() {}
  }

  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.WebSocket = FakeWebSocket;
  t.after(() => {
    globalThis.window = prevWindow;
    globalThis.document = prevDoc;
    globalThis.requestAnimationFrame = prevRaf;
    globalThis.cancelAnimationFrame = prevCancelRaf;
    globalThis.WebSocket = prevWs;
  });

  let urlCalls = 0;
  const pty = new PtyTerminal({}, null, null, null, {
    TerminalCtor: FakeTerminal,
    getWsUrl: async () => {
      urlCalls += 1;
      return `wss://academy.deeptrustxai.com/api/v1/terminal/ws/cisf-ot-grid?ticket=tkt-${urlCalls}`;
    },
  });
  assert.equal(pty.mount(), true);
  await pty.connect();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(sockets.length, 1);
  assert.equal(sockets[0].url, 'wss://academy.deeptrustxai.com/api/v1/terminal/ws/cisf-ot-grid?ticket=tkt-1');

  // Pong frame must update liveness without printing to terminal
  sockets[0].onopen?.();
  sockets[0].onmessage?.({ data: JSON.stringify({ type: 'pong' }) });
  // Two binary chunks must coalesce into one Uint8Array write
  sockets[0].onmessage?.({ data: new Uint8Array([65, 66]).buffer });
  sockets[0].onmessage?.({ data: new Uint8Array([67, 68]).buffer });
  await new Promise((r) => setTimeout(r, 25));

  assert.equal(writes.length, 1, 'Consecutive binary frames must coalesce and pong must not be printed');
  assert.deepEqual(Array.from(writes[0]), [65, 66, 67, 68]);

  // Reconnect must invoke getWsUrl fresh for a new single-use ticket
  pty.reconnectNow();
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(sockets.length, 2);
  assert.equal(sockets[1].url, 'wss://academy.deeptrustxai.com/api/v1/terminal/ws/cisf-ot-grid?ticket=tkt-2');
  pty.dispose();
});
