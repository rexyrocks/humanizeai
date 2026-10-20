import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {rewritePassage} from '../src/core.js';
const args=process.argv.slice(2),out=args.includes('--out')?args[args.indexOf('--out')+1]:null;
if(!out||args.some((x,i)=>!['--live','--out'].includes(x)&&args[i-1]!=='--out'))throw Error('Use [--live] --out <new-result-directory>');
await mkdir(out,{recursive:true});
const corpus=JSON.parse(await readFile(new URL('./cases.json',import.meta.url),'utf8'));
const plan={model:'@cf/qwen/qwen3.8-27b',provider:'qwen-lounge',endpoint:'https://qwen-lounge.piyochoudhary.workers.dev',cases:corpus.cases.slice(0,3).map(c=>c.id),max_generations:9,engine_sha256:createHash('sha256').update(await readFile(new URL('../src/core.js',import.meta.url))).digest('hex'),created_at:new Date().toISOString(),status:'plan_only'};
await writeFile(out+'/plan.json',JSON.stringify(plan,null,2));
if(!args.includes('--live')){console.log('Plan only: 3 synthetic cases, at most 9 generations.');process.exit(0);}
const key=process.env.QWEN_API_KEY||(process.env.QWEN_API_KEY_FILE? (await readFile(process.env.QWEN_API_KEY_FILE,'utf8')).trim():'');
if(!key)throw Error('Configure QWEN_API_KEY_FILE or QWEN_API_KEY securely outside chat.');
let generations=0;const rows=[];
const fetcher=async(url,init)=>{
 const parsed=new URL(url);
 if(parsed.origin!==plan.endpoint||!/^\/(jobs(?:\/[A-Za-z0-9_-]+)?|health)$/.test(parsed.pathname))throw Error('Endpoint not allowed');
 if(init.method==='POST'&&++generations>9)throw Error('Generation cap reached');
 return fetch(url,init);
};
for(const c of corpus.cases.slice(0,3)){
 const start=performance.now();
 try{const result=await rewritePassage({...c,reviewLevel:'detailed',consent:true,provider:plan.provider,model:plan.model,key},{},fetcher);rows.push({id:c.id,status:'completed',latency_ms:Math.round(performance.now()-start),unchanged:result.original===result.revised,result});}
 catch(e){rows.push({id:c.id,status:'failed',latency_ms:Math.round(performance.now()-start),error:e.message});}
 await writeFile(out+'/results.json',JSON.stringify({...plan,status:'running',generations,rows},null,2));
 console.log(c.id+': '+rows.at(-1).status+(rows.at(-1).error?' — '+rows.at(-1).error:''));
 if(rows.at(-1).status==='failed')break;
}
await writeFile(out+'/results.json',JSON.stringify({...plan,status:rows.length===3?'finished':'stopped_after_failure',generations,rows},null,2));
await writeFile(out+'/review.md',rows.filter(r=>r.status==='completed').map(r=>'## '+r.id+'\n\n### Original\n'+r.result.original+'\n\n### Revision\n'+r.result.revised+'\n\n').join('\n'));
console.log('Generation requests: '+generations+'. Results: '+out);
