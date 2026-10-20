import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomInt} from 'node:crypto';
import {rewritePassage,modelCall,deterministicCheck,MODES} from '../src/core.js';
const out=process.env.COMPARISON_OUT;if(!out)throw Error('Set COMPARISON_OUT to a new directory');
await mkdir(out,{recursive:true});
const corpus=JSON.parse(await readFile(new URL('./cases.json',import.meta.url),'utf8'));
const cases=[corpus.cases.find(c=>c.id==='statistics'),corpus.cases.find(c=>c.id==='hedging'),{id:'verbose-workflow',mode:'Academic Clarity',terms:'',text:'In order to organize the review process, the team made use of a shared checklist. The checklist was used by reviewers to record the status of each document. After the review was completed, the coordinator collected the checklists and prepared a summary of the recorded decisions.',invariants:['Retain team checklist, reviewer document-status recording, coordinator collection and decision summary. Do not invent outcomes or automation.']}];
const meta={model:'@cf/qwen/qwen3.8-27b',endpoint:'https://qwen-lounge.piyochoudhary.workers.dev',max_generations:9,engine_sha256:createHash('sha256').update(await readFile(new URL('../src/core.js',import.meta.url))).digest('hex'),created_at:new Date().toISOString(),limitations:['One run per case, same Qwen model for both paths; this is not a ChatGPT comparison.','Synthetic passages; unchanged text is not editing success.','No human preference data until readers submit ratings.'],cases};
await writeFile(out+'/plan.json',JSON.stringify(meta,null,2));
if(process.env.COMPARISON_LIVE!=='1'){console.log('Plan only; zero calls.');process.exit(0);}
const key=process.env.QWEN_API_KEY_FILE?(await readFile(process.env.QWEN_API_KEY_FILE,'utf8')).trim():process.env.QWEN_API_KEY;if(!key)throw Error('Key unavailable');
let generations=0;const fetcher=async(url,init)=>{if(new URL(url).origin!==meta.endpoint)throw Error('Endpoint blocked');if(init.method==='POST'&&++generations>9)throw Error('Generation cap');return fetch(url,init);};
const config={provider:'qwen-lounge',model:meta.model,key};const rows=[];
for(const c of cases){const row={id:c.id,original:c.text,invariants:c.invariants};
 for(const path of ['humanizeai','plain_qwen']){const t=performance.now(),before=generations;
  try{if(path==='humanizeai'){row[path]=await rewritePassage({...c,...config,reviewLevel:'detailed',consent:true},{},fetcher);}else{const r=await modelCall(config,'rewrite',{passage:c.text,mode:MODES[c.mode],context:'',sample:'',analysis:{purpose:'Improve academic prose',propositions:[],qualifications:[],technical_terms:[],citation_notes:[]}},fetcher);row[path]={...r,issues:deterministicCheck(c.text,r.revised,c.terms.split(',').filter(Boolean))};}}
  catch(e){row[path]={error:e.message};}
  row[path].latency_ms=Math.round(performance.now()-t);row[path].generations=generations-before;console.log(c.id+' / '+path+': '+(row[path].error||'completed'));
 }
 rows.push(row);await writeFile(out+'/results.json',JSON.stringify({...meta,generations,rows},null,2));
 if(row.humanizeai.error||row.plain_qwen.error)break;
}
const mapping=[];let review='# Anonymous writing comparison\n\nFor each passage, compare A and B against the original. Rate meaning preservation, clarity and repetition. Choose A, B, tie, or neither; explain your choice. Candidate order is randomized. Do not open results.json or mapping.json until ratings are finalized. No ratings have been collected yet.\n\n';
for(const row of rows){if(row.humanizeai.error||row.plain_qwen.error)continue;const order=randomInt(2)?['humanizeai','plain_qwen']:['plain_qwen','humanizeai'];mapping.push({id:row.id,A:order[0],B:order[1]});review+='## '+row.id+'\n\nOriginal:\n\n'+row.original+'\n\nA:\n\n'+row[order[0]].revised+'\n\nB:\n\n'+row[order[1]].revised+'\n\nPreference (A / B / tie / neither): ___\nMeaning errors: ___\nClarity and repetition: ___\n\n';}
await writeFile(out+'/anonymous-review.md',review);await writeFile(out+'/mapping.json',JSON.stringify(mapping,null,2));
console.log('Finished: '+generations+' generations.');
