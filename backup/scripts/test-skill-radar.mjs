import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/pages/admin/skillRadar.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { skillChartKind, formatSkillLabel, wrapSkillLabel } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('a radar needs at least three skill areas; fewer fall back to bars', () => {
  assert.equal(skillChartKind(['general']), 'bars');
  assert.equal(skillChartKind(['linux', 'networking']), 'bars');
  assert.equal(skillChartKind(['a', 'b', 'c']), 'radar');
});

test('more than eight skill areas use bars, so every label can be read in full', () => {
  const names = (count) => Array.from({ length: count }, (_, i) => `Day ${i} · Foundation · Module ${i}`);
  assert.equal(skillChartKind(names(8)), 'radar');
  assert.equal(skillChartKind(names(9)), 'bars');
  assert.equal(skillChartKind(names(12)), 'bars');
});

test('track slugs read as words', () => {
  assert.equal(formatSkillLabel('unix-programming-environment'), 'Unix programming environment');
  assert.equal(formatSkillLabel('file_systems'), 'File systems');
  assert.equal(formatSkillLabel('general'), 'General');
  assert.equal(formatSkillLabel('OT Security'), 'OT Security');
  assert.equal(formatSkillLabel(''), 'General');
});

test('labels wrap on word boundaries and never exceed the line budget', () => {
  assert.deepEqual(wrapSkillLabel('Unix programming environment', 14, 2), ['Unix', 'programming…']);
  assert.deepEqual(wrapSkillLabel('Users and groups', 14, 2), ['Users and', 'groups']);
  assert.deepEqual(wrapSkillLabel('Networking', 14, 2), ['Networking']);
  for (const line of wrapSkillLabel('Supercalifragilisticexpialidocious systems', 14, 2)) {
    assert.ok(line.length <= 14, `"${line}" is longer than 14 characters`);
  }
});
