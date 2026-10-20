import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=dirname(fileURLToPath(import.meta.url)),runner=join(root,'run.mjs');
function fixture(){const dir=mkdtempSync(join(tmpdir(),'humanizeai-bench-test-'));const env={...process.env};delete env.OPENROUTER_API_KEY;delete env.LLM_API_KEY;return{dir,env,run(args=[],extra={}){return spawnSync(process.execPath,[...extra.nodeArgs||[],runner,'--out',join(dir,'out'),...args],{encoding:'utf8',env:{...env,...extra.env},timeout:15000});},read(name){return JSON.parse(readFileSync(join(dir,'out',name),'utf8'));},clean(){rmSync(dir,{recursive:true,force:true});}};}
test('plan mode sends no requests and emits a 36-initial-request pilot plan',()=>{const f=fixture();try{const r=f.run();assert.equal(r.status,0,r.stderr);assert.equal(f.read('plan.json').initial_requests_up_to,36);assert.equal(f.read('plan.json').status,'not_run');assert.throws(()=>f.read('results.json'));}finally{f.clean();}});
test('missing credentials produce blocked status, not fabricated quality results',()=>{const f=fixture();try{const r=f.run(['--live']);assert.equal(r.status,2);assert.deepEqual(f.read('status.json'),{status:'blocked_missing_key',live_requests:0,quality_results:null});assert.throws(()=>f.read('results.json'));}finally{f.clean();}});
test('paid model IDs are rejected',()=>{const f=fixture();try{const r=f.run(['--models','openai/paid-model']);assert.notEqual(r.status,0);assert.ok(r.stderr.includes('Only explicit :free'));}finally{f.clean();}});
test('controlled transport verifies checkpointing, secret exclusion and request cap; no live model is used',()=>{const f=fixture();try{const hook=join(f.dir,'fixture.mjs');writeFileSync(hook,`globalThis.fetch=async(url,init)=>{const body=JSON.parse(init.body),stage=body.response_format.json_schema.name,p=JSON.parse(body.messages[1].content);const value=stage==='analysis'?{purpose:'Fixture',propositions:[],qualifications:[],technical_terms:[],citation_notes:[]}:stage==='rewrite'?{revised:p.passage,explanations:[],evidence_needed:[]}:{verdict:'consistent',omissions:[],additions:[],changed_relationships:[],explanation:'Fixture only'};return new Response(JSON.stringify({model:'fixture-model-only',choices:[{message:{content:JSON.stringify(value)}}]}));};`);
const extra={nodeArgs:['--import',hook],env:{OPENROUTER_API_KEY:'fake-test-token-not-a-real-key'}};
const r=f.run(['--live','--models','openai/gpt-oss-120b:free','--max-requests','1'],extra);assert.equal(r.status,0,r.stderr);const data=f.read('results.json');assert.equal(data.requests_this_invocation,1);assert.equal(data.rows.length,1);assert.equal(data.rows[0].error_category,'request_budget');assert.ok(!JSON.stringify(data).includes('fake-test-token'));
}finally{f.clean();}});
