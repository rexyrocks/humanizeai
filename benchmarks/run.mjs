import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
const hash=s=>createHash('sha256').update(s).digest('hex');
const root=dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const allowed=new Set(['--live','--full','--models','--out','--max-requests','--engine']);
for(let i=0;i<args.length;i++){if(!allowed.has(args[i]))throw Error('Unknown option: '+args[i]);if(!['--live','--full'].includes(args[i]))i++;}
const enginePath=resolve(option('--engine',resolve(root,'../src/core.js')));
const {rewritePassage,deterministicCheck}=await import(pathToFileURL(enginePath));
const corpusRaw=await readFile(resolve(root,'cases.json'),'utf8');const corpus=JSON.parse(corpusRaw);
const models=option('--models','')?option('--models','').split(','):JSON.parse(await readFile(resolve(root,'models.json'),'utf8'));
if(!models.length||models.some(m=>!m.endsWith(':free')||!m.includes('/')))throw Error('Only explicit :free model IDs are allowed. No paid fallback or auto-router.');
const cases=args.includes('--full')?corpus.cases:corpus.cases.slice(0,3);
const maxRequests=Number(option('--max-requests','40'));if(!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>1000)throw Error('Request budget must be 1–1000.');
const out=resolve(option('--out',resolve(root,'results/pilot')));await mkdir(out,{recursive:true});
const engineHash=hash(await readFile(enginePath));const corpusHash=hash(corpusRaw);
const plan={status:'not_run',created_at:new Date().toISOString(),engine_sha256:engineHash,corpus_sha256:corpusHash,provenance:corpus.provenance,models,cases:cases.map(c=>c.id),initial_requests_up_to:cases.length*models.length*3,max_requests_this_invocation:maxRequests,limitations:['Synthetic screening fixtures, not a representative academic benchmark.','Three calls per pipeline; transient retries consume extra requests.','The same model analyzes, rewrites and reviews; model approval is not independent truth.','No claim of clarity or scientific accuracy without blinded human review.','Free availability and structured-output support are checked live, not assumed.']};
await writeFile(resolve(out,'plan.json'),JSON.stringify(plan,null,2)+'\n');
if(!args.includes('--live')){console.log(`Plan only: ${models.length} models × ${cases.length} cases; up to ${plan.initial_requests_up_to} initial calls. No model requests sent.\n${out}/plan.json`);process.exit(0);}
const key=process.env.OPENROUTER_API_KEY||process.env.LLM_API_KEY;
if(!key){await writeFile(resolve(out,'status.json'),JSON.stringify({status:'blocked_missing_key',live_requests:0,quality_results:null},null,2)+'\n');console.error('Live benchmark not run: set OPENROUTER_API_KEY locally. Do not paste a key into chat.');process.exit(2);}
let requests=0,exhausted=false;
let results=[];try{const previous=JSON.parse(await readFile(resolve(out,'results.json'),'utf8'));if(previous.engine_sha256!==engineHash||previous.corpus_sha256!==corpusHash)throw Error('Existing results use another engine/corpus. Choose a new --out directory.');results=previous.rows||[];}catch(e){if(e.code!=='ENOENT')throw e;}
const initialDone=results.filter(r=>r.status==='completed').length;
const header=s=>String(s??'').replace(/\|/g,'\\|').replace(/\n/g,' ');
async function save(){
 const data={...plan,status:'partial',updated_at:new Date().toISOString(),requests_this_invocation:requests,rows:results};
 const expected=models.length*cases.length;
 if(results.filter(r=>models.includes(r.model)&&cases.some(c=>c.id===r.case_id)).length===expected)data.status='finished_attempts';
 await writeFile(resolve(out,'results.json'),JSON.stringify(data,null,2)+'\n');
 let md='# HumanizeAI pilot results\n\nStatus: '+data.status+'. Human editorial review: pending. No winner is established.\n\n';
 md+='| Model | Completed / attempted | Exact span checks passed / completed | Gate allowed / completed | Median completed latency |\n|---|---:|---:|---:|---:|\n';
 for(const model of models){const rows=results.filter(r=>r.model===model&&cases.some(c=>c.id===r.case_id)),done=rows.filter(r=>r.status==='completed'),lat=done.map(r=>r.latency_ms).sort((a,b)=>a-b);const median=lat.length?(lat[Math.floor((lat.length-1)/2)]+lat[Math.floor(lat.length/2)])/2:null;md+=`| ${header(model)} | ${done.length} / ${rows.length} | ${done.filter(r=>!r.exact_issues.length).length} / ${done.length} | ${done.filter(r=>r.result.safe).length} / ${done.length} | ${median===null?'n/a':(median/1000).toFixed(1)+' s'} |\n`;}
 md+='\nGate approval is a system behavior metric, not a measure of factual correctness. Exact checks operate on recognized spans; they can miss altered relationships. Identity rewrites are reported and must not be counted as quality improvements. Completion rate includes failures; latency includes all stages and any retries within a completed pipeline. These sample sizes do not support rankings.\n\n';
 md+='## Failures\n'+results.filter(r=>r.status!=='completed').map(r=>`- ${r.model} / ${r.case_id}: ${r.error_category} (HTTP ${r.http_status||'n/a'}).`).join('\n')+'\n\n## Limitations\n'+plan.limitations.map(s=>'- '+s).join('\n')+'\n';
 await writeFile(resolve(out,'report.md'),md);
 const review=[...results.filter(r=>r.status==='completed')].sort((a,b)=>hash(a.trial_id).localeCompare(hash(b.trial_id)));
 let blinded='# Blinded editorial review\n\nSynthetic fixtures. Do not open results.json or report.md until labels are finalized. Candidate identity is hidden; prose may still reveal model style.\n\nReview each pair against every invariant. Label each criterion: pass / fail / uncertain. Clarity: improved / unchanged / worse. Do not use the generating model as the final judge.\n\n';
 const labels=[];
 for(const row of review){const fixture=cases.find(c=>c.id===row.case_id);blinded+=`## ${row.trial_id}\n\nMode: ${fixture.mode}\n\n### Original\n\n${fixture.text}\n\n### Revision\n\n${row.result.revised}\n\n### Required invariants\n\n${fixture.invariants.map(i=>'- '+i).join('\n')}\n\n`;labels.push({trial_id:row.trial_id,meaning:'pending',qualifications:'pending',numbers_math_code:'pending',citations:'pending',no_unsupported_claims:'pending',clarity:'pending',notes:''});}
 await writeFile(resolve(out,'review.md'),blinded);
 // Preserve annotations if a reviewer has already started.
 try{await readFile(resolve(out,'human-labels.json'));}catch(e){if(e.code==='ENOENT')await writeFile(resolve(out,'human-labels.json'),JSON.stringify(labels,null,2)+'\n');else throw e;}
}
for(const fixture of cases){for(const model of models){
 if(exhausted)break;
 const trial_id='trial-'+hash([engineHash,corpusHash,model,fixture.id].join('|')).slice(0,12);
 if(results.some(r=>r.trial_id===trial_id))continue;
 const trace=[];const start=performance.now();
 const wrappedFetch=async(url,init)=>{
 if(requests>=maxRequests){exhausted=true;throw Error('Request budget exhausted');}
 requests++;
 const body=JSON.parse(init.body);if(body.provider?.max_price?.prompt!==0||body.provider?.max_price?.completion!==0)throw Error('Free routing constraint missing');
 const t=performance.now();const response=await fetch(url,init);
 let data;try{data=await response.clone().json();}catch{}
 trace.push({stage:body.response_format.json_schema.name,status:response.status,latency_ms:Math.round(performance.now()-t),requested_model:model,served_model:data?.model||null,provider:data?.provider||null,usage:data?.usage||null,request_body_sha256:hash(init.body)});
 return response;
 };
 let row;
 try{const result=await rewritePassage({reviewLevel:'detailed',text:fixture.text,mode:fixture.mode,terms:fixture.terms,sample:fixture.sample||'',context:'Benchmark of synthetic editorial fixtures. Do not invent evidence.',consent:true,provider:'openrouter',model,key},{},wrappedFetch);row={trial_id,case_id:fixture.id,model,status:'completed',latency_ms:Math.round(performance.now()-start),unchanged:result.revised.trim()===fixture.text.trim(),exact_issues:deterministicCheck(fixture.text,result.revised,fixture.terms.split(',').filter(Boolean)),result,trace};}
 catch(e){const last=trace.at(-1);const category=exhausted?'request_budget':last?.status===429?'rate_limit':last?.status===401||last?.status===403?'authentication_or_access':last?.status===404?'endpoint_unavailable':/structured|JSON|field|category/.test(e.message)?'schema_or_output':/protected|marker/.test(e.message)?'preservation_failure':'pipeline_or_network';row={trial_id,case_id:fixture.id,model,status:'failed',error_category:category,http_status:last?.status||null,latency_ms:Math.round(performance.now()-start),trace};}
 results.push(row);await save();console.log(`${fixture.id} / ${model}: ${row.status}${row.error_category?' ('+row.error_category+')':''}`);
 if(row.error_category==='authentication_or_access'){exhausted=true;break;}
 if(requests>=maxRequests)exhausted=true;
 }}
await save();console.log(`Recorded ${results.length} attempts (${initialDone} completed before this invocation). ${requests} live requests this invocation. Human review pending.\n${out}/report.md`);
