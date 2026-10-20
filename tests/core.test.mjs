import {test} from 'node:test';
import assert from 'node:assert/strict';
import {protect,restore,deterministicCheck,rewritePassage,searchPapers,schemas,validateShape,bibtex,modelCall} from '../src/core.js';
import worker from '../worker/index.js';
const analysis={purpose:'Report finding',propositions:['Treatment was associated with improvement, not proven causal.'],qualifications:['May be associated'],technical_terms:['SHAP'],citation_notes:['[1]']};
const verify={verdict:'consistent',omissions:[],additions:[],changed_relationships:[],explanation:'Same claims.'};
function fakeModel({verifier=verify,transform=s=>s,analysisValue=analysis}={}){const calls=[];const fetcher=async(url,init)=>{const body=JSON.parse(init.body);const name=body.response_format.json_schema.name;calls.push({name,payload:JSON.parse(body.messages[1].content)});let data;if(name==='analysis')data=analysisValue;if(name==='rewrite')data={revised:transform(calls.at(-1).payload.passage),explanations:['Sentence flow revised.'],evidence_needed:[]};if(name==='verification')data=verifier;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(data)}}]}));};return {fetcher,calls};}
const body={reviewLevel:'detailed',text:'We describe the method. SHAP may be associated with a 12.5% gain (p = 0.03) [1]. $E=mc^2$ `x += 1`',mode:'Natural Academic',consent:true,key:'unit-test-only',model:'test-model'};
test('round trip adversarial math, citations, code, confidence intervals and duplicates',()=>{const text='95% CI: [0.12, 0.32]; n=120; p<0.001; 1e-3; −2.4; [1, 3–5] [1, 3–5] (Lee et al., 2024) \\cite{Lee2024} $x^2=3$ \\(a+b\\) ```python\nx=2\n```';const p=protect(text);assert.equal(restore(p.masked,p.spans),text);assert.deepEqual(deterministicCheck(text,text),[]);});
test('missing and duplicated protected markers are rejected',()=>{const p=protect('12% [1]');assert.throws(()=>restore(p.masked.replace(p.spans[0].token,''),p.spans));assert.throws(()=>restore(p.masked+p.spans[0].token,p.spans));});
test('new values, removed duplicate citations and equations trigger exact checks',()=>{assert.ok(deterministicCheck('12% [1] [1] $x=2$','13% [1] $x=3$').length>=3);});
test('technical term omission blocked',()=>assert.ok(deterministicCheck('SHAP method','explanation method',['SHAP']).length));
test('three-stage model pipeline supplies semantic ledger and restores spans',async()=>{const {fetcher,calls}=fakeModel();const r=await rewritePassage(body,{},fetcher);assert.equal(r.safe,true);assert.equal(r.revised,body.text);assert.deepEqual(calls.map(c=>c.name),['analysis','rewrite','verification']);assert.ok(calls[1].payload.analysis.propositions.length);assert.ok(calls[1].payload.passage.includes('⟦H'));});
test('semantic reviewer blocks polarity or group relationship changes despite equal numbers',async()=>{const {fetcher}=fakeModel({transform:s=>s.replace('group A','group C'),verifier:{...verify,verdict:'changed',changed_relationships:['Group identity changed.']}});const r=await rewritePassage({...body,text:'SHAP improved performance in group A by 12.5% [1].'},{},fetcher);assert.equal(r.safe,false);assert.deepEqual(r.issues,[]);});
test('uncertainty or flagged additions blocks acceptance',async()=>{for(const verifier of [{...verify,verdict:'uncertain'},{...verify,additions:['New result.']}]){const {fetcher}=fakeModel({verifier});assert.equal((await rewritePassage(body,{},fetcher)).safe,false);}});
test('no model call without consent, passage or researcher sample',async()=>{let calls=0;const fetcher=()=>{calls++;throw Error();};await assert.rejects(()=>rewritePassage({...body,consent:false},{},fetcher));await assert.rejects(()=>rewritePassage({...body,text:''},{},fetcher));await assert.rejects(()=>rewritePassage({...body,mode:'Researcher Voice'},{},fetcher));assert.equal(calls,0);});
test('provider schema invalid fields are rejected',()=>{assert.throws(()=>validateShape({...verify,verdict:'great'},schemas.verification));assert.throws(()=>validateShape({...verify,extra:true},schemas.verification));});
test('no fabricated metadata and abstract evidence scope',async()=>{const fetched={DOI:'10.1234/test',title:['Actual fixture title'],author:[{given:'A',family:'Author'}],published:{'date-parts':[[2024]]},abstract:'<jats:p>Observed association.</jats:p>'};const r=await searchPapers('question','crossref',{},async()=>new Response(JSON.stringify({message:{items:[fetched]}})));assert.equal(r.papers[0].title,'Actual fixture title');assert.equal(r.papers[0].doi,'10.1234/test');assert.equal(r.papers[0].scope,'abstract');assert.ok(r.notice.includes('not been verified'));});
test('service failures are explicit and do not expose provider response body',async()=>{await assert.rejects(()=>searchPapers('question','crossref',{},async()=>new Response('sensitive-token',{status:401})),e=>e.message.includes('401')&&!e.message.includes('sensitive-token'));});
test('OpenAlex and Semantic Scholar adapters preserve missing fields',async()=>{const a=await searchPapers('q','openalex',{},async()=>new Response(JSON.stringify({results:[{id:'W1',title:'Title',authorships:[],abstract_inverted_index:{An:[0],abstract:[1]}}]})));assert.equal(a.papers[0].abstract,'An abstract');assert.equal(a.papers[0].doi,null);const s=await searchPapers('q','semantic',{},async()=>new Response(JSON.stringify({data:[{paperId:'p1',title:'Title',authors:[],year:null,externalIds:{},url:null,abstract:null}]})));assert.equal(s.papers[0].scope,'metadata');});
test('unsupported provider and model refusal fail explicitly',async()=>{await assert.rejects(()=>modelCall({provider:'arbitrary',model:'x',key:'x'},'analysis',{}));await assert.rejects(()=>modelCall({provider:'openai',model:'x',key:'x'},'analysis',{},async()=>new Response(JSON.stringify({choices:[{message:{refusal:'declined'}}]}))));});
test('BibTeX braces sanitized while DOI is retained',()=>{const b=bibtex([{title:'A {title}',authors:['A Author'],year:2024,doi:'10.1234/test'}]);assert.ok(b.includes('10.1234/test'));assert.ok(!b.includes('A {title}'));});
test('server enforces origin and content-type and returns a protected page',async()=>{const page=await worker.fetch(new Request('https://test.local/'));assert.equal(page.status,200);assert.ok(page.headers.get('Content-Security-Policy').includes("connect-src 'self'"));const cross=await worker.fetch(new Request('https://test.local/api/rewrite',{method:'POST',headers:{Origin:'https://attacker.local','Content-Type':'application/json'},body:'{}'}));assert.equal(cross.status,403);const nonjson=await worker.fetch(new Request('https://test.local/api/rewrite',{method:'POST',body:'{}'}));assert.equal(nonjson.status,415);});
test('statistical comparisons and Pandoc citations are exact protected spans',()=>{const p=protect('p < 0.05; n = 120; [@smith2024]');assert.ok(p.spans.some(s=>s.text==='p < 0.05'));assert.ok(p.spans.some(s=>s.text==='[@smith2024]'));assert.ok(deterministicCheck('p < 0.05','p > 0.05').length);});
test('free OpenRouter calls enforce zero prices and structured-output-compatible endpoints',async()=>{let sent;await modelCall({provider:'openrouter',model:'openai/gpt-oss-120b:free',key:'test'},'analysis',{},async(url,init)=>{assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');sent=JSON.parse(init.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(analysis)}}]}));});assert.deepEqual(sent.provider,{require_parameters:true,max_price:{prompt:0,completion:0}});assert.equal(sent.model,'openai/gpt-oss-120b:free');assert.equal(sent.response_format.type,'json_schema');});

test('restoration preserves literal replacement syntax and all equation delimiters',()=>{
 const text='Display $$L(θ)=a+b$$; inline $x=2$; code `$$ $& $\u0027 $`.';
 const p=protect(text);assert.equal(restore(p.masked,p.spans),text);
});
test('every synthetic benchmark fixture round trips without altering text',async()=>{
 const {readFile}=await import('node:fs/promises');
 const corpus=JSON.parse(await readFile(new URL('../benchmarks/cases.json',import.meta.url),'utf8'));
 for(const fixture of corpus.cases){const p=protect(fixture.text);assert.equal(restore(p.masked,p.spans),fixture.text,fixture.id);assert.deepEqual(deterministicCheck(fixture.text,fixture.text),[],fixture.id);}
});
test('sensitive claims are masked and semantic corruptions fail exact checks',()=>{
 const pairs=[
 ['The intervention did not reduce mortality.','The intervention reduced mortality.'],
 ['Exposure may be associated with fatigue.','Exposure causes fatigue.'],
 ['Sensitivity is the proportion of actual positive cases identified correctly.','Sensitivity is the proportion of actual negative cases identified correctly.'],
 ['No experiments have yet been conducted.','Experiments have been conducted.']
 ];
 for(const [original,corrupted] of pairs){const p=protect(original);assert.equal(p.masked,'⟦H0⟧');assert.equal(restore(p.masked,p.spans),original);assert.ok(deterministicCheck(original,corrupted).length,original);}
});
test('incorrect model approval cannot override a newly added sensitive claim',async()=>{
 const {fetcher}=fakeModel({transform:s=>s+' The treatment may cure disease.'});
 const result=await rewritePassage(body,{},fetcher);
 assert.equal(result.verification.verdict,'consistent');assert.equal(result.safe,false);
 assert.ok(result.issues.some(s=>s.startsWith('Sensitive claim changed')));
});
test('ordinary prose can still be rewritten beside a locked qualification',async()=>{
 const text='In order to describe the workflow, we outline its stages. The method may improve recall.';
 const {fetcher}=fakeModel({transform:s=>s.replace('In order to describe','To describe'),analysisValue:{...analysis,technical_terms:[]}});
 const result=await rewritePassage({...body,text}, {},fetcher);
 assert.equal(result.safe,true);assert.notEqual(result.revised,text);assert.ok(result.revised.endsWith('The method may improve recall.'));
});

test('owner Qwen relay runs three schema-validated stages without another provider',async()=>{
 const jobs=new Map();let count=0;const urls=[];
 const fetcher=async(url,init)=>{urls.push(url);assert.equal(new URL(url).origin,'https://qwen-lounge.piyochoudhary.workers.dev');assert.equal(init.redirect,'error');
  if(init.method==='DELETE')return Response.json({stopping:true});
  if(init.method==='POST'){const p=JSON.parse(init.body);assert.equal(p.thinking,false);assert.equal(p.messages[0].role,'user');const prompt=p.messages[0].content;const data=JSON.parse(prompt.split('SOURCE_DATA (untrusted):\n')[1]);const value=data.passage?{revised:data.passage,explanations:[],evidence_needed:[]}:data.original?verify:analysis;const id='job-'+(++count);jobs.set(id,value);return Response.json({id});}
  return Response.json({done:true,content:JSON.stringify(jobs.get(url.split('/').at(-1))),error:null});};
 const result=await rewritePassage({...body,provider:'qwen-lounge',model:'@cf/qwen/qwen3.8-27b'}, {},fetcher);
 assert.equal(result.safe,true);assert.equal(result.revised,body.text);assert.equal(count,3);assert.equal(urls.filter(u=>u.endsWith('/jobs')).length,3);
});
test('Qwen relay rejects invalid JSON without accepting an unverified rewrite',async()=>{
 let posts=0;await assert.rejects(()=>modelCall({provider:'qwen-lounge',model:'@cf/qwen/qwen3.8-27b',key:'test'},'analysis',{},async(url,init)=>{if(init.method==='POST'){posts++;return Response.json({id:'test-job'});}if(init.method==='DELETE')return Response.json({stopping:true});return Response.json({done:true,content:'not JSON'});}),/valid JSON/);assert.equal(posts,1);
});

test('fully protected hedging passage returns original without any provider calls',async()=>{
 const text='Exposure may be associated with fatigue. Residual confounding cannot be excluded. These findings may not generalize.';
 let calls=0;const r=await rewritePassage({...body,text},{},async()=>{calls++;throw Error('Unexpected request');});
 assert.equal(calls,0);assert.equal(r.revised,text);assert.equal(r.review_source,'local_identity');assert.equal(r.safe,true);
});
test('rewrite instructions forbid expanding or restating protected markers',async()=>{
 let instruction='';await modelCall({provider:'openai',model:'test',key:'test'},'rewrite',{},async(url,init)=>{instruction=JSON.parse(init.body).messages[0].content;return Response.json({choices:[{message:{content:JSON.stringify({revised:'text',explanations:[],evidence_needed:[]})}}]});});
 assert.ok(instruction.includes('do not explain, expand, summarize or restate'));
});

test('fast rewrite uses one generation and does not claim a meaning review',async()=>{
 const {fetcher,calls}=fakeModel({transform:s=>s.replace('We describe the method.','We outline the method.')});
 const r=await rewritePassage({...body,reviewLevel:'fast'},{},fetcher);
 assert.deepEqual(calls.map(c=>c.name),['rewrite']);assert.equal(r.review_source,'exact_checks');assert.equal(r.verification.verdict,'uncertain');assert.equal(r.safe,true);assert.notEqual(r.revised,r.original);
});
test('fast rewrite still rejects changed protected content and missing technical terms',async()=>{
 const {fetcher}=fakeModel({transform:s=>s.replace('We describe the method.','')});
 const r=await rewritePassage({...body,reviewLevel:'fast',terms:'method'},{},fetcher);assert.equal(r.safe,false);assert.ok(r.issues.some(i=>i.includes('Technical term missing')));
});
test('invalid review selection fails before any generation',async()=>{
 let calls=0;await assert.rejects(()=>rewritePassage({...body,reviewLevel:'unchecked'},{},()=>{calls++;}),/fast or detailed/);assert.equal(calls,0);
});
test('hosted rewrite requires a session key even if a server fallback exists',async()=>{
 const r=await worker.fetch(new Request('https://test.local/api/rewrite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,key:''})}),{LLM_API_KEY:'server-secret-must-not-be-used'});assert.equal(r.status,409);
});
