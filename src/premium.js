// Pro preview utilities contain no credentials or payment entitlements.
const MODES=['Natural Academic','Researcher Voice','Academic Clarity','Technical Preservation','Advanced Research Editing'];
export function writingProfile(name,mode,terms,reviewLevel){
 if(typeof name!=='string'||!name.trim()||name.trim().length>60)throw Error('Give the profile a name of 1–60 characters.');
 if(!MODES.includes(mode)||!['fast','detailed'].includes(reviewLevel))throw Error('Invalid writing preferences.');
 if(typeof terms!=='string'||terms.length>1500)throw Error('Preserved terms must be at most 1,500 characters.');
 return {name:name.trim(),mode,terms,reviewLevel};
}
export function batchPlan(sections,selected,reviewLevel){
 if(!['fast','detailed'].includes(reviewLevel))throw Error('Choose fast or detailed review.');
 if(!Array.isArray(selected)||!selected.length||selected.length>3||new Set(selected).size!==selected.length)throw Error('Select one to three different sections.');
 const items=selected.map(name=>{const text=sections[name];if(typeof text!=='string'||!text.trim())throw Error(name+': add text before reviewing.');if(text.length>24000)throw Error(name+': shorten to 24,000 characters or fewer.');return {name,original:text};});
 return {items,reviewLevel,maxModelCalls:items.length*(reviewLevel==='detailed'?3:1)};
}
export async function reviewBatch(plan,rewrite,{onProgress=()=>{},shouldStop=()=>false}={}){
 const rows=[];let stopped=false;
 for(const item of plan.items){
  if(stopped||shouldStop()){rows.push({...item,status:'not_run',error:'Not submitted.'});continue;}
  try{const result=await rewrite(item.original,item.name);if(!result||typeof result.revised!=='string')throw Error('Invalid review response.');rows.push({...item,status:'completed',result:{revised:result.revised,safe:result.safe===true,review_source:result.review_source||'unknown',issues:Array.isArray(result.issues)?result.issues:[],explanations:Array.isArray(result.explanations)?result.explanations:[],verification_explanation:result.verification?.explanation||''}});}
  catch(error){rows.push({...item,status:'failed',error:error.message||'Review failed.'});stopped=true;}
  await onProgress([...rows]);
 }
 return rows;
}
export function canApplyReview(row,currentText){return row.status==='completed'&&row.result?.safe===true&&typeof row.result.revised==='string'&&currentText===row.original;}
export function revisionReport(report){
 return '# Manuscript revision report\n\nProject: '+report.projectTitle+'\nCreated: '+report.created+'\nReview: '+report.reviewLevel+'\n\nAutomated checks are advisory. Fast mode does not run a model meaning review. Unchanged text is not a writing improvement.\n\n'+report.rows.map(row=>'## '+row.name+'\n\nStatus: '+row.status+(row.result?' | Checks: '+(row.result.safe?'passed':'blocked')+' | Review source: '+row.result.review_source:'')+'\n\n### Original\n\n'+row.original+'\n\n'+(row.result?'### Proposal\n\n'+row.result.revised+'\n\n### Review notes\n\n'+[...row.result.issues,...row.result.explanations,row.result.verification_explanation].filter(Boolean).map(s=>'- '+s).join('\n'):'Error: '+row.error)+'\n').join('\n');
}
