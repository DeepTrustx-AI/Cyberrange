/** Lightweight contract tests. Run with `npm ci && node scripts/test-live-k8s-ui.mjs`. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve('src');
function source(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function compile(file) {
  const result = ts.transpileModule(source(file), {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.equal(result.diagnostics?.length ?? 0, 0, `Syntax errors: ${file}`);
  const exports = {};
  vm.runInNewContext(result.outputText, { exports, require: () => { throw new Error('unexpected runtime dependency'); } }, { filename: file });
  return exports;
}
const client = compile('features/liveK8s/client.ts');
const workflow = compile('features/liveK8s/workflow.ts');

function makeCatalog() {
  return {
    lab_id: client.LAB_ID,
    module_id: 'live-kubernetes-security-lab_live-k8s_assessment',
    max_points: 500,
    investigation: Array.from({ length: 6 }, (_, i) => ({ id: `q${i}` })),
    assessment: Array.from({ length: 4 }, (_, i) => ({ id: `q${i}` })),
    actions: Object.keys(workflow.ACTION_LABELS).map((id) => ({ id })),
    stages: workflow.PHASES.map(({ id, points }) => ({ id, points })),
  };
}

test('assignment ID and session ID parsing refuses untrusted path input', () => {
  for (const value of ['', '0', '-1', '2.5', '0x10', '1e2', 'NaN', '9007199254740992', '12?admin=1']) {
    assert.equal(client.parseAssignmentId(value), null);
  }
  assert.equal(client.parseAssignmentId('47'), 47);
  assert.equal(client.validSessionId('a'.repeat(32)), true);
  assert.equal(client.validSessionId('A'.repeat(32)), false);
  assert.equal(client.validSessionId('../secrets'), false);
});

test('all four phases require server progress, including six repairs', () => {
  assert.equal(workflow.nextPhase(), 'investigate');
  assert.equal(workflow.phaseUnlocked('assess'), false);
  const initial = { stages: { investigate: true, assess: false, remediate: false, verify: false }, actions_applied: [] };
  assert.equal(workflow.nextPhase(initial), 'assess');
  assert.equal(workflow.phaseUnlocked('remediate', initial), false);
  const assessed = { stages: { ...initial.stages, assess: true }, actions_applied: [] };
  assert.equal(workflow.nextPhase(assessed), 'remediate');
  assert.equal(workflow.phaseUnlocked('verify', assessed), false);
  const ready = { ...assessed, actions_applied: Object.keys(workflow.ACTION_LABELS) };
  assert.equal(workflow.nextPhase(ready), 'verify');
  assert.equal(workflow.phaseUnlocked('verify', ready), true);
  assert.equal(workflow.readyForAssessment('ALLOCATING'), false);
  assert.equal(workflow.readyForAssessment('READY', false), false);
  assert.equal(workflow.readyForAssessment('READY', true), true);
});

test('catalog mismatches fail closed rather than showing wrong prompts or actions', () => {
  const good = makeCatalog();
  assert.equal(workflow.validCatalog(good), true);
  assert.equal(workflow.validCatalog({ ...good, max_points: 250 }), false);
  assert.equal(workflow.validCatalog({ ...good, actions: [...good.actions.slice(0, 5), { id: 'exec-shell' }] }), false);
  assert.equal(workflow.validCatalog({ ...good, stages: [{ id: 'verify', points: 500 }] }), false);
});

test('requests send only assignment, fixed choices and revision, never Kubernetes objects', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ passed: true }) };
  };
  const api = client.liveK8sClient(fakeFetch);
  const sid = 'a'.repeat(32);
  await api.catalog(21);
  await api.start(21);
  await api.session(21, sid);
  await api.evidence(21, sid);
  await api.grade(21, sid, 'investigate', 7, { 'pod-security': 'baseline' });
  await api.action(21, sid, 'harden-workload', 8);
  await api.verify(21, sid, 9);
  await api.stop(21, sid);
  assert.equal(calls.length, 8);
  assert.equal(calls[0].url, '/api/v1/live-k8s/catalog?assignment_id=21');
  assert.deepEqual(JSON.parse(calls[4].init.body), { assignment_id: 21, expected_revision: 7, answers: { 'pod-security': 'baseline' } });
  assert.deepEqual(JSON.parse(calls[5].init.body), { assignment_id: 21, expected_revision: 8 });
  assert.equal(calls[5].url, `/api/v1/live-k8s/sessions/${sid}/actions/harden-workload`);
  assert.equal(calls[7].init.method, 'DELETE');
  for (const call of calls) assert.ok(!/kubeconfig|raw_yaml|namespace_uid|target_ip|kubectl/i.test(JSON.stringify(call)));
});

test('backend 503 explains unavailability and does not fabricate success', async () => {
  const api = client.liveK8sClient(async () => ({ ok: false, status: 503, json: async () => ({ detail: 'Live Kubernetes student sessions are not enabled' }) }));
  await assert.rejects(api.start(4), /not enabled/);
});

test('page is syntactically valid TSX and has an explicit disabled-by-default release gate', () => {
  const file = 'pages/user/LiveKubernetesSecurityLabPage.tsx';
  const result = ts.transpileModule(source(file), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(result.diagnostics?.length ?? 0, 0);
  const page = source(file);
  assert.match(page, /VITE_LIVE_K8S_UI_ENABLED === 'true'/);
  assert.match(page, /!liveEnabled \? /, 'expected guarded content');
  assert.ok(!/\bfetch\s*\(/.test(page), 'must use authenticated apiFetch');
  assert.ok(!/localStorage/.test(page), 'do not persist lab decisions to long-term browser storage');
});

test('assignment routing preserves its assignment ID for this lab only', () => {
  const routes = source('utils/labRoutes.ts');
  const assigned = source('pages/user/AssignedLabsPage.tsx');
  const app = source('App.tsx');
  assert.match(routes, /live-kubernetes-security-lab/);
  assert.match(assigned, /assignment_id=\$\{lab\.id\}/);
  assert.match(app, /LiveKubernetesSecurityLabPage/);
  assert.match(app, /\/labs\/live-kubernetes-security-lab/);
});
