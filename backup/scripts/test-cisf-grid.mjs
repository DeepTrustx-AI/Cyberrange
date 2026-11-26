import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function loadTsModule(relPath) {
  const source = await readFile(new URL(`../${relPath}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

test('labRoutes maps cisf-ot-grid and preserves assignment_id query param', async () => {
  const { labPath, assignmentLabPath } = await loadTsModule('src/utils/labRoutes.ts');
  assert.equal(labPath('cisf-ot-grid'), '/labs/cisf-ot-grid');
  assert.equal(assignmentLabPath('cisf-ot-grid', 42), '/labs/cisf-ot-grid?assignment_id=42');
  assert.equal(labPath('cisf-honeypot'), '/labs/cisf-honeypot');
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

test('CisfGridLabPage adheres to aesthetic, routing, and Decision 6 invariants', async () => {
  const files = [
    'src/pages/user/CisfGridLabPage.tsx',
    'src/components/cisfGrid/types.ts',
    'src/components/cisfGrid/api.ts',
    'src/components/cisfGrid/CisfGridCodeEditor.tsx',
    'src/components/cisfGrid/CisfGridStage.tsx',
    'src/components/cisfGrid/CisfGridTour.tsx',
  ];
  for (const rel of files) {
    const src = await readFile(new URL(`../${rel}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /[\u2013\u2014]/, `${rel} must not contain em/en dashes`);
    assert.doesNotMatch(src, /transition-all|transition:\s*all/, `${rel} must not use transition-all`);
    assert.doesNotMatch(src, /\b(?:purple|violet|indigo)-\d{2,3}\b/, `${rel} must not use purple/violet/indigo`);
    assert.doesNotMatch(src, /\bfetch\s*\(/, `${rel} must not call raw fetch()`);
  }

  const pageSrc = await readFile(new URL('../src/pages/user/CisfGridLabPage.tsx', import.meta.url), 'utf8');
  assert.ok(pageSrc.includes('wsPath="/api/v1/terminal/ws/cisf-ot-grid"'), 'CisfGridLabPage must wire RealTerminal to cisf-ot-grid');
  assert.ok(pageSrc.includes('activeCheckRef'), 'CisfGridLabPage must isolate async check_id polling');
  assert.ok(pageSrc.includes('X-Grid-Eval-Token') || (await readFile(new URL('../src/components/cisfGrid/api.ts', import.meta.url), 'utf8')).includes('X-Grid-Eval-Token'), 'Must send X-Grid-Eval-Token on verify');
  assert.doesNotMatch(pageSrc, /interactive=\{true\}/, 'Mascot must never be interactive inside CisfGridLabPage');

  const designMd = await readFile(new URL('../DESIGN.md', import.meta.url), 'utf8');
  assert.ok(designMd.includes('Decision 6'), 'DESIGN.md must document Decision 6 eighth allowed place');
  assert.ok(designMd.includes('living-lab-stage'), 'DESIGN.md must document living-lab-stage');

  // Regression assertions for Frontend Verifier Round 1 findings:
  const mascotSrc = await readFile(new URL('../src/components/mascot/Mascot.tsx', import.meta.url), 'utf8');
  assert.ok(mascotSrc.includes("shown !== 'point'"), 'Mascot.tsx must not clobber CSS point gaze when look is omitted');

  const stageSrc = await readFile(new URL('../src/components/cisfGrid/CisfGridStage.tsx', import.meta.url), 'utf8');
  assert.ok(stageSrc.includes('telemetry?.gen_mw'), 'CisfGridStage must render live gen_mw from SCADA telemetry');
  assert.ok(stageSrc.includes('telemetry?.districts'), 'CisfGridStage must render City Grid from telemetry.districts');
  assert.ok(stageSrc.includes('Red = Closed (live)'), 'CisfGridStage must show ANSI/IEC breaker polarity legend');
  assert.doesNotMatch(stageSrc, /DISTRICT_FALLBACKS/, 'CisfGridStage must never hardcode permuted BAY-01..06 to districts');

  const apiSrc = await readFile(new URL('../src/components/cisfGrid/api.ts', import.meta.url), 'utf8');
  assert.ok(apiSrc.includes('rec.error') && apiSrc.includes('rec.retry_after_s'), 'api.ts must surface checker error and retry_after_s');

  const editorSrc = await readFile(new URL('../src/components/cisfGrid/CisfGridCodeEditor.tsx', import.meta.url), 'utf8');
  assert.ok(editorSrc.includes('loadSeqRef'), 'CisfGridCodeEditor must guard async file loads with sequence token');
  assert.ok(editorSrc.includes('otherWorkspaceFiles'), 'CisfGridCodeEditor must deduplicate select options');

  assert.ok(pageSrc.includes('moduleSwitchSeqRef') && pageSrc.includes('.resetModule(modId'), 'CisfGridLabPage must sync active module to container on switch');
  assert.ok(pageSrc.includes('let evalToken = await ensureEvalToken()'), 'CisfGridLabPage must refresh eval_token in practice and verify');

  // P3-6: Module points table parity against canonical 10-module ladder (total 1000 pts)
  const { CISF_GRID_MODULES } = await loadTsModule('src/components/cisfGrid/types.ts');
  const expected = [
    ['m01', 70],
    ['m02', 90],
    ['m03', 80],
    ['m04', 100],
    ['m05', 110],
    ['m06', 100],
    ['m07', 100],
    ['m08', 110],
    ['m09', 140],
    ['m10', 100],
  ];
  assert.deepEqual(
    CISF_GRID_MODULES.map((m) => [m.id, m.pts]),
    expected,
    'Frontend CISF_GRID_MODULES points must match canonical 10-module ladder',
  );
  assert.equal(
    CISF_GRID_MODULES.reduce((acc, m) => acc + m.pts, 0),
    1000,
  );

  // L1, L3, L4 live-check regression invariants
  assert.ok(
    pageSrc.includes('Your lab stopped. Start it again; your points are safe.'),
    'CisfGridLabPage must render L1 stopped-lab message',
  );
  assert.ok(pageSrc.includes('enabled={isRunning}'), 'CisfGridLabPage must gate RealTerminal socket on isRunning (L3)');
  assert.ok(pageSrc.includes('height="100%"'), 'CisfGridLabPage must stretch RealTerminal to fill right column (L4)');
  assert.doesNotMatch(stageSrc, /truncate text-xs text-slate-500/, 'CisfGridStage must not truncate bay feeder names (L4)');
  assert.ok(stageSrc.includes('title={fullFeederName}'), 'CisfGridStage must expose full feeder name via title/aria-label (L4)');

  const termSrc = await readFile(new URL('../src/components/RealTerminal.tsx', import.meta.url), 'utf8');
  assert.ok(termSrc.includes('beforeunload') && termSrc.includes('pagehide'), 'RealTerminal must close WebSocket cleanly on unload (L3)');
  assert.ok(termSrc.includes('enabled?: boolean'), 'RealTerminal must accept enabled prop (L3)');
  assert.ok(termSrc.includes('className="truncate" title={resolvedTitle}'), 'RealTerminal header title must truncate cleanly on narrow screens (L4)');
});
