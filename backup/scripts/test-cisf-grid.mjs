import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
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

test('CisfGridLabPage and V13 Living Stage port adhere to aesthetic, routing, security, and L1-L4 invariants', async () => {
  const files = [
    'src/pages/user/CisfGridLabPage.tsx',
    'src/components/cisfGrid/types.ts',
    'src/components/cisfGrid/api.ts',
    'src/components/cisfGrid/CisfGridV13Workspace.tsx',
    'src/components/cisfGrid/CisfGridCodeEditor.tsx',
    'src/components/cisfGrid/CisfGridStage.tsx',
    'src/components/cisfGrid/CisfGridTour.tsx',
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

  const pageSrc = await readFile(new URL('../src/pages/user/CisfGridLabPage.tsx', import.meta.url), 'utf8');
  const wsBridgeSrc = await readFile(new URL('../src/components/cisfGrid/CisfGridV13Workspace.tsx', import.meta.url), 'utf8');
  const transportSrc = await readFile(new URL('../src/components/cisfGrid/v13/platformTransport.ts', import.meta.url), 'utf8');
  const v13EmsSrc = await readFile(new URL('../src/components/cisfGrid/v13/ems.js', import.meta.url), 'utf8');
  const v13TermSrc = await readFile(new URL('../src/components/cisfGrid/v13/terminal.js', import.meta.url), 'utf8');
  const v13CssSrc = await readFile(new URL('../src/components/cisfGrid/v13/v13Styles.css', import.meta.url), 'utf8');
  const apiSrc = await readFile(new URL('../src/components/cisfGrid/api.ts', import.meta.url), 'utf8');

  assert.ok(pageSrc.includes('<CisfGridV13Workspace'), 'CisfGridLabPage must mount CisfGridV13Workspace when running');
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
