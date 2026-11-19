import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { assignmentId, cisfClient, lessonValid, resultValid } = await load('../src/features/cisfLabs/client.ts');
const { labPath, assignmentLabPath } = await load('../src/utils/labRoutes.ts');
const { moduleMinutes, labHours } = await load('../src/utils/labCopy.ts');
const lesson = { schema_version: 1, lab_id: 'aws-cisf', assignment_id: 7, mode: 'guided-practice', title:'AWS CISF',
  minutes:15, points:100, completed:false, summary:'Keep a sample file private.', introduction:'Cloud storage keeps files.',
  analogy:'A records room.', scenario:'A fictional example.', safety:'Practice only.', takeaway:'Keep access narrow.',
  terms:[{ word:'Permission', meaning:'An allowed action.' }],
  tasks:['sharing','permission','reason'].map(id => ({ id, title:id, instruction:'Choose a setting.', hint:'Think about access.',
    initial:null, options:[{ id:'a', label:'First', effect:'First outcome' },{ id:'b', label:'Second', effect:'Second outcome' }] })) };
const report = { lab_id:'aws-cisf', mode:'guided-practice', passed:true, checks_passed:3, checks_total:3,
  checks:lesson.tasks.map(task=>({ id:task.id, title:task.title, passed:true, feedback:'Correct.' })),
  observations:[{ title:'Sharing', result:'Private.' },{ title:'Access', result:'Read only.' }],
  message:'Sample settings only.', completion:null };

test('four catalogue and assignment routes retain identity and short durations', () => {
  for (const [id,minutes] of [['aws-cisf',15],['gcp-cisf',10],['kubernetes-cisf',20],['iac-cisf',15]]) {
    assert.equal(labPath(id),`/labs/${id}`);
    assert.equal(assignmentLabPath(id,7),`/labs/${id}?assignment_id=7`);
    assert.equal(moduleMinutes(id,`${id}_cisf_basics`,45),minutes);
    assert.equal(labHours(id,1.5),minutes/60);
  }
});
test('bad and ambiguous assignment references are rejected', () => {
  for (const id of [null,'','0','-1','1.1','1e3',' 7','9007199254740993']) assert.equal(assignmentId(id),null);
  assert.equal(assignmentId('7'),7);
});
test('a different assignment, lab, mode or malformed lesson cannot enter the page', () => {
  assert.equal(lessonValid(lesson,'aws-cisf',7),true);
  for (const change of [{ assignment_id:8 },{ lab_id:'gcp-cisf' },{ mode:'live-cloud' },{ tasks:[] },{ completed:'yes' }])
    assert.equal(lessonValid({ ...lesson,...change },'aws-cisf',7),false);
});
test('counts, duplicate criteria and completion claims must agree with the report', () => {
  assert.equal(resultValid(report,lesson,false),true);
  assert.equal(resultValid(report,lesson,true),false);
  for (const change of [{checks_passed:2},{passed:false},{checks:[report.checks[0],report.checks[0],report.checks[2]]},
    {lab_id:'iac-cisf'},{completion:{points_awarded:100,already_completed:false,new_total_score:100}}])
    assert.equal(resultValid({...report,...change},lesson,false),false);
  const done={...report,completion:{points_awarded:100,already_completed:false,new_total_score:100}};
  assert.equal(resultValid(done,lesson,true),true);
  assert.equal(resultValid({...done,completion:{...done.completion,already_completed:true}},lesson,true),false);
});
test('transport sends choices and assignment, never client-supplied score', async () => {
  const requests=[];
  const fetch=async (path,init) => { requests.push({path,init}); return new Response(JSON.stringify(path.includes('workspace')?lesson:report)); };
  const api=cisfClient(fetch,'aws-cisf',7);
  await api.workspace();
  await api.grade(lesson,{sharing:'a',permission:'b',reason:'a'},false);
  assert.equal(requests[0].path,'/api/v1/cisf-labs/aws-cisf/workspace?assignment_id=7');
  assert.equal(requests[1].path,'/api/v1/cisf-labs/aws-cisf/check');
  assert.deepEqual(JSON.parse(requests[1].init.body),{assignment_id:7,choices:{sharing:'a',permission:'b',reason:'a'}});
});
test('network and service failures never become local success', async () => {
  await assert.rejects(cisfClient(async()=>new Response('unavailable',{status:503}),'aws-cisf',7).workspace(),/unavailable/);
  await assert.rejects(cisfClient(async()=>{throw new Error('offline');},'aws-cisf',7).workspace(),/Cannot reach/);
});
