const rates=new Map(),cache=new Map();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function rate(request){const ip=request.headers.get('CF-Connecting-IP')||'local';const now=Date.now();let entry=rates.get(ip);if(!entry||now-entry.time>60000){entry={time:now,count:0};rates.set(ip,entry);}if(++entry.count>20)throw new AppError('Too many requests. Wait a minute.',429);if(rates.size>1000)for(const[k,v]of rates)if(now-v.time>60000)rates.delete(k);}
export default {async fetch(request,env={}){
 const url=new URL(request.url);try{
 if(request.method==='GET'&&url.pathname==='/')return new Response(PAGE,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com"}});
 if(request.method==='GET'&&url.pathname==='/app.js')return new Response(APP,{headers:{'Content-Type':'text/javascript','X-Content-Type-Options':'nosniff'}});
 if(request.method==='GET'&&url.pathname==='/premium.js')return new Response(PREMIUM,{headers:{'Content-Type':'text/javascript','X-Content-Type-Options':'nosniff'}});
 if(request.method==='GET'&&url.pathname==='/health')return json({ok:true});
 if(url.pathname.startsWith('/api/'))rate(request);
 if(request.method==='GET'&&url.pathname==='/api/search'){
 const q=url.searchParams.get('q'),provider=url.searchParams.get('provider')||'crossref',sort=url.searchParams.get('sort')||'relevance';const key=JSON.stringify([q,provider,sort]);const hit=cache.get(key);if(hit&&Date.now()-hit.time<300000)return json(hit.data);
 const data=await searchPapers(q,provider,env);if(cache.size>100)cache.clear();cache.set(key,{time:Date.now(),data});return json(data);}
 if(request.method==='POST'&&['/api/rewrite','/api/validate'].includes(url.pathname)){
 const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)throw new AppError('Cross-origin requests are rejected.',403);
 if(!request.headers.get('content-type')?.includes('application/json'))throw new AppError('JSON body required.',415);
 if(+(request.headers.get('content-length')||0)>100000)throw new AppError('Request is too large.',413);const raw=await request.text();if(raw.length>100000)throw new AppError('Request is too large.',413);let body;try{body=JSON.parse(raw);}catch{throw new AppError('Invalid JSON.');}
 if(typeof body.key!=='string'||!body.key.trim())throw new AppError('Connect your own model key in Writing settings.',409);
 if(url.pathname==='/api/rewrite')return json(await rewritePassage(body,env));
 if(body.consent!==true)throw new AppError('Explicit model-sharing consent is required.',403);
 if(typeof body.text!=='string'||typeof body.revised!=='string'||!body.text.trim()||!body.revised.trim()||body.text.length>24000||body.revised.length>48000)throw new AppError('Invalid comparison passages.');
 const config={provider:body.provider||'openai',model:body.model||env.LLM_MODEL,key:body.key||env.LLM_API_KEY};
 const analysis=await modelCall(config,'analysis',{text:body.text});const verification=await modelCall(config,'verification',{original:body.text,revised:body.revised,propositions:analysis.propositions,qualifications:analysis.qualifications});
 const issues=deterministicCheck(body.text,body.revised,[...analysis.technical_terms,...(typeof body.terms==='string'?body.terms.split(',').map(t=>t.trim()).filter(Boolean):[])]);
 return json({revised:body.revised,analysis,verification,issues,review_source:'model_review',review_level:'detailed',safe:issues.length===0&&verification.verdict==='consistent'&&!verification.omissions.length&&!verification.additions.length&&!verification.changed_relationships.length,notice:'Model review is advisory; independently check scientific statements.'});
 }
 return json({error:'Not found'},404);
 }catch(e){return json({error:e instanceof AppError?e.message:'The request could not complete. Please retry.'},e.status||500);}
}};
