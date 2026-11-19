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
  minutes:60, points:100, completed:false, summary:'Keep a sample file private.', introduction:'Cloud storage keeps files.',
  analogy:'A records room.', scenario:'A fictional example.', safety:'Practice only.', takeaway:'Keep access narrow.',
  stage_id:'basics', stage_title:'Private attendance', stage_minutes:15, course_completed:false,
  stages:[{id:'basics',title:'Private attendance',minutes:15,completed:false,available:true}, {id:'signin',title:'Protect the account',minutes:15,completed:false,available:false}, {id:'recovery',title:'Keep a backup',minutes:15,completed:false,available:false}, {id:'incident',title:'Report a change',minutes:15,completed:false,available:false}],
  timing:[{title:'Read',minutes:5},{title:'Try',minutes:6},{title:'Explain',minutes:4}],
  terms:[{ word:'Permission', meaning:'An allowed action.' }],
  tasks:['sharing','permission','reason'].map(id => ({ id, title:id, instruction:'Choose a setting.', hint:'Think about access.',
    initial:null, options:[{ id:'a', label:'First', effect:'First outcome' },{ id:'b', label:'Second', effect:'Second outcome' }] })) };
const report = { assignment_id:7, stage_id:'basics', stages:lesson.stages, course_completed:false, lab_id:'aws-cisf', mode:'guided-practice', passed:true, checks_passed:3, checks_total:3,
  checks:lesson.tasks.map(task=>({ id:task.id, title:task.title, passed:true, feedback:'Correct.' })),
  observations:[{ title:'Sharing', result:'Private.' },{ title:'Access', result:'Read only.' }],
  message:'Sample settings only.', completion:null };

test('four catalogue and assignment routes retain identity and short durations', () => {
  for (const [id,minutes] of [['aws-cisf',60],['gcp-cisf',30],['kubernetes-cisf',90],['iac-cisf',60]]) {
    assert.equal(labPath(id),`/labs/${id}`);
    assert.equal(assignmentLabPath(id,7),`/labs/${id}?assignment_id=7`);
    assert.equal(moduleMinutes(id,`${id}_cisf_basics`,45),id === 'gcp-cisf' ? 10 : 15);
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
  const done={...report,stages:report.stages.map((s,i)=>({...s,completed:i===0,available:i<2})),completion:{points_awarded:100,already_completed:false,new_total_score:100}};
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
  assert.deepEqual(JSON.parse(requests[1].init.body),{assignment_id:7,stage_id:'basics',choices:{sharing:'a',permission:'b',reason:'a'}});
});
test('network and service failures never become local success', async () => {
  await assert.rejects(cisfClient(async()=>new Response('unavailable',{status:503}),'aws-cisf',7).workspace(),/unavailable/);
  await assert.rejects(cisfClient(async()=>{throw new Error('offline');},'aws-cisf',7).workspace(),/Cannot reach/);
});

test('activities, timing and assignment context cannot be mixed', () => {
  assert.equal(lessonValid({...lesson,minutes:61},'aws-cisf',7),false);
  assert.equal(lessonValid(lesson,'aws-cisf',7,'signin'),false);
  assert.equal(lessonValid({...lesson,stages:lesson.stages.map(s=>({...s,available:true}))},'aws-cisf',7),false);
  assert.equal(resultValid({...report,stage_id:'signin'},lesson,false),false);
  assert.equal(resultValid({...report,assignment_id:8},lesson,false),false);
});
