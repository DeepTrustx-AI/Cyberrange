import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/pages/user/dashboardLabs.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { groupDashboardLabs } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('four assignments share one lab heading without losing dates or individual progress', () => {
  const rows = [104, 103, 102, 101].map((assignmentId, index) => ({
    id: 'iso-runtime-shield',
    assignmentId,
    startDatetime: `2026-11-0${5 - index}T09:00:00`,
    endDatetime: `2026-11-0${6 - index}T18:00:00`,
    solvedChallenges: index === 1 ? 3 : 0,
    totalChallenges: 6,
  }));
  const groups = groupDashboardLabs(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].lab, rows[0]);
  assert.deepEqual(groups[0].assignments, rows);
  assert.deepEqual(groups[0].assignments.map((row) => row.solvedChallenges), [0, 3, 0, 0]);
});

test('interleaved labs keep API order within each group and between first occurrences', () => {
  const rows = [
    { id: 'cloud', assignmentId: 7 },
    { id: 'linux', assignmentId: 6 },
    { id: 'cloud', assignmentId: 5 },
    { id: 'crypto', assignmentId: 4 },
    { id: 'linux', assignmentId: 3 },
  ];
  const groups = groupDashboardLabs(rows);
  assert.deepEqual(groups.map((group) => group.id), ['cloud', 'linux', 'crypto']);
  assert.deepEqual(groups.map((group) => group.assignments), [[rows[0], rows[2]], [rows[1], rows[4]], [rows[3]]]);
});

test('different lab IDs sharing a title remain distinct', () => {
  const rows = [{ id: 'course-a', title: 'Security lab' }, { id: 'course-b', title: 'Security lab' }];
  assert.deepEqual(groupDashboardLabs(rows).map((group) => group.assignments), [[rows[0]], [rows[1]]]);
});

test('rows without a usable lab ID cannot create blank routes or duplicate group keys', () => {
  const valid = { id: 'linux', assignmentId: 1 };
  assert.deepEqual(groupDashboardLabs([{ id: null }, {}, { id: '' }, valid]), [
    { id: 'linux', lab: valid, assignments: [valid] },
  ]);
});

test('grouping leaves frozen input and assignment progress untouched', () => {
  const first = Object.freeze({ id: 'linux', solvedChallenges: 2 });
  const second = Object.freeze({ id: 'linux', solvedChallenges: 4 });
  const rows = Object.freeze([first, second]);
  const [group] = groupDashboardLabs(rows);
  assert.equal(group.assignments[0], first);
  assert.equal(group.assignments[1], second);
  assert.deepEqual(rows, [first, second]);
  assert.equal(first.solvedChallenges, 2);
  assert.equal(second.solvedChallenges, 4);
});

test('empty and catalogue lists keep their original entries', () => {
  assert.deepEqual(groupDashboardLabs([]), []);
  const rows = [{ id: 'one', assignmentId: null }, { id: 'two', assignmentId: null }];
  assert.deepEqual(groupDashboardLabs(rows).map((group) => group.assignments), [[rows[0]], [rows[1]]]);
});

// Render the real component and its shared date/progress/route helpers. No browser,
// API calls or live student data are used; SSR does not run ThemeProvider effects.
test('grouped dashboard rendered content', async (t) => {
  const { createServer } = await import('vite');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MemoryRouter } = await import('react-router-dom');
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  });
  try {
    const { DashboardLabGroups } = await server.ssrLoadModule('/src/pages/user/DashboardLabGroups.tsx');
    const { ThemeProvider } = await server.ssrLoadModule('/src/context/ThemeContext.tsx');
    const { SegmentedBar } = await server.ssrLoadModule('/src/components/ui/SegmentedBar.tsx');
    const render = (labs) => renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(ThemeProvider, null, createElement(DashboardLabGroups, { labs }))));
    const base = {
      id: 'live-kubernetes-security-lab', title: 'Kubernetes security', category: 'Security',
      status: 'live', durationHours: 4, totalChallenges: 6,
    };

    await t.test('one title, four dated rows, separate progress and assignment links', () => {
      const rows = [104, 103, 102, 101].map((assignmentId, index) => ({
        ...base, assignmentId, solvedChallenges: index === 1 ? 3 : 0,
        startDatetime: `2026-11-0${5 - index}T09:00:00`,
        endDatetime: `2026-11-0${6 - index}T18:00:00`,
      }));
      const html = render(rows);
      assert.equal((html.match(/<h3\b/g) ?? []).length, 1);
      assert.match(html, /4 assignments/);
      assert.equal((html.match(/<th scope="col"/g) ?? []).length, 3);
      const body = html.split('<tbody')[1];
      assert.equal((body.match(/<tr\b/g) ?? []).length, 4);
      assert.equal((body.match(/role="progressbar"/g) ?? []).length, 4);
      assert.equal((body.match(/<time\b/g) ?? []).length, 8);
      for (const row of rows) {
        assert.ok(html.includes(`href="/labs/live-kubernetes-security-lab?assignment_id=${row.assignmentId}"`));
        assert.ok(html.includes(`dateTime="${row.startDatetime}.000Z"`));
        assert.ok(html.includes(`dateTime="${row.endDatetime}.000Z"`));
      }
      assert.deepEqual([...body.matchAll(/aria-valuenow="(\d+)"/g)].map((match) => Number(match[1])), [0, 3, 0, 0]);
      assert.doesNotMatch(html, /> Complete</);
    });

    await t.test('missing and malformed dates remain honest and rows stay visible', () => {
      const html = render([{ ...base, assignmentId: 1, startDatetime: null, endDatetime: 'invalid', solvedChallenges: 0 }]);
      assert.match(html, /Not scheduled/);
      assert.match(html, /No deadline/);
      assert.match(html, /0\/6 modules/);
      assert.doesNotMatch(html, /<time\b|Invalid Date/);
    });

    await t.test('long assignments use the existing continuous bar without losing real progress', () => {
      for (const solvedChallenges of [12, 24]) {
        const html = render([{
          ...base, assignmentId: 1, totalChallenges: 24, solvedChallenges,
          startDatetime: null, endDatetime: null,
        }]);
        assert.match(html, new RegExp(`${solvedChallenges}/24 modules`));
        assert.match(html, /aria-valuemax="24"/);
        assert.match(html, new RegExp(`aria-valuenow="${solvedChallenges}"`));
        assert.match(html, new RegExp(`width:${solvedChallenges / 24 * 100}%`));
        assert.equal((html.match(/segment-fill /g) ?? []).length, 1);
      }
    });

    await t.test('short assignments stay segmented and zero-module assignments stay empty', () => {
      const html = render([{ ...base, assignmentId: 1, startDatetime: null, endDatetime: null, solvedChallenges: 3 }]);
      assert.equal((html.match(/segment-fill /g) ?? []).length, 3);
      const empty = render([{ ...base, assignmentId: 2, startDatetime: null, endDatetime: null, solvedChallenges: 0, totalChallenges: 0 }]);
      assert.match(empty, /0\/0 modules/);
      assert.match(empty, /aria-valuenow="0"/);
      assert.doesNotMatch(empty, /segment-fill |NaN|Infinity/);
    });

    await t.test('shared progress bar keeps the existing default limit for other pages', () => {
      const normal = renderToStaticMarkup(createElement(SegmentedBar, { done: 24, total: 24 }));
      assert.equal((normal.match(/segment-fill /g) ?? []).length, 24);
      const long = renderToStaticMarkup(createElement(SegmentedBar, { done: 25, total: 25 }));
      assert.equal((long.match(/segment-fill /g) ?? []).length, 1);
    });

    await t.test('catalogue fallback keeps lab navigation and progress without invented assignments', () => {
      const html = render([{ ...base, id: 'vulnshop', assignmentId: null, startDatetime: null, endDatetime: null, solvedChallenges: 2 }]);
      assert.match(html, /href="\/labs\/vulnshop"/);
      assert.match(html, /In progress/);
      assert.match(html, /aria-valuenow="2"/);
      assert.doesNotMatch(html, /<table\b|assignment_id|Not scheduled/);
    });
  } finally {
    await server.close();
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
