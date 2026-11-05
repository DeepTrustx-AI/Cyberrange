import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}

// Exercise the production helpers in Node without a DOM or additional packages.
const stateUrl = moduleUrl(await readFile(new URL('../src/utils/assignmentState.ts', import.meta.url), 'utf8'));
const source = (await readFile(new URL('../src/pages/user/assignedLabsSorting.ts', import.meta.url), 'utf8'))
  .replace("'../../utils/assignmentState'", JSON.stringify(stateUrl));
const { parseAssignmentSort, sortAssignments } = await import(moduleUrl(source));
const { assignmentState } = await import(stateUrl);

const now = new Date('2026-11-05T06:00:00Z');
const rows = [
  { id: 41, start: '2026-11-01T00:00:00Z', end: '2026-11-06T00:00:00Z', progress: 0 },
  { id: 44, start: '2026-11-01T00:00:00Z', end: '2026-11-04T00:00:00Z', progress: 0 },
  { id: 40, start: '2026-11-01T00:00:00Z', end: '2026-11-15T00:00:00Z', progress: 20 },
  { id: 45, start: '2026-11-01T00:00:00Z', end: '2026-11-06T12:00:00Z', progress: 100 },
  { id: 43, start: '2026-11-01T00:00:00Z', end: '2026-11-06T06:00:00Z', progress: 0 },
  { id: 42, start: '2026-11-10T00:00:00Z', end: '2026-11-16T00:00:00Z', progress: 0 },
];
const ids = (items) => items.map((item) => item.id);

test('My Work defaults to newest assignments across every status', () => {
  assert.deepEqual(ids(sortAssignments(rows)), [45, 44, 43, 42, 41, 40]);
});

test('oldest first reverses creation order without grouping by status', () => {
  assert.deepEqual(ids(sortAssignments(rows, 'oldest', now)), [40, 41, 42, 43, 44, 45]);
});

test('most urgent first retains the existing status and deadline ordering', () => {
  assert.deepEqual(ids(sortAssignments(rows, 'urgent', now)), [41, 43, 40, 42, 44, 45]);
});

test('status filtering preserves the selected newest/oldest order and counts', () => {
  const dueSoon = (order) => sortAssignments(rows, order, now)
    .filter((row) => assignmentState(row, now) === 'due-soon');
  assert.deepEqual(ids(dueSoon('newest')), [43, 41]);
  assert.deepEqual(ids(dueSoon('oldest')), [41, 43]);
  assert.equal(dueSoon('urgent').length, 2);
});

test('rescheduling a lab does not change which assignment is newest', () => {
  const rescheduled = [
    { id: 1, start: '2027-01-01T00:00:00Z', end: null, progress: 0 },
    { id: 2, start: '2026-10-01T00:00:00Z', end: null, progress: 0 },
  ];
  assert.deepEqual(ids(sortAssignments(rescheduled, 'newest', now)), [2, 1]);
});

test('every sort leaves the fetched array and assignment objects unchanged', () => {
  const frozen = Object.freeze(rows.map((row) => Object.freeze({ ...row })));
  for (const order of ['newest', 'oldest', 'urgent']) {
    const result = sortAssignments(frozen, order, now);
    assert.notEqual(result, frozen);
    assert.deepEqual(ids(frozen), [41, 44, 40, 45, 43, 42]);
    assert.ok(result.every((row) => frozen.includes(row)));
  }
});

test('empty and single-assignment lists work with every sort', () => {
  for (const order of ['newest', 'oldest', 'urgent']) {
    assert.deepEqual(sortAssignments([], order, now), []);
    assert.deepEqual(sortAssignments([rows[0]], order, now), [rows[0]]);
  }
});

test('absent and invalid URL sort values fall back to newest first', () => {
  for (const value of [null, '', 'reverse', 'NEWEST']) assert.equal(parseAssignmentSort(value), 'newest');
  for (const value of ['newest', 'oldest', 'urgent']) assert.equal(parseAssignmentSort(value), value);
});
