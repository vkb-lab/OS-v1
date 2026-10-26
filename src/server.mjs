import http from 'node:http';
import crypto from 'node:crypto';
export function config(env=process.env){
  if((env.K_COMPUTE_MODE||'sandbox')!=='sandbox'||env.K_COMPUTE_EXTERNAL_AI_ENABLED==='true'||Number(env.K_COMPUTE_MONTHLY_PAID_BUDGET_USD||0)!==0)throw Error('Sandbox only; external AI disabled; budget zero');
  const keys=JSON.parse(env.K_COMPUTE_KEYS_JSON||'{}');
  for(const [t,k] of Object.entries(keys))if(!/^[a-z0-9_-]{2,64}$/i.test(t)||typeof k!=='string'||k.length<32)throw Error('Invalid tenant credential');
  return {keys,limit:Number(env.K_COMPUTE_MAX_JOBS_DAY||25),rate:Number(env.K_COMPUTE_MAX_REQUESTS_MINUTE||30)};
}
function response(res,code,body,headers={}){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers});res.end(JSON.stringify(body));}
function eq(a,b){const ha=crypto.createHash('sha256').update(a).digest(),hb=crypto.createHash('sha256').update(b).digest();return crypto.timingSafeEqual(ha,hb)&&a.length===b.length;}
function read(req){return new Promise((resolve,reject)=>{let s='';req.on('data',x=>{s+=x;if(s.length>8192){reject('payload_too_large');req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(s));}catch{reject('invalid_json');}});req.on('error',()=>reject('body_error'));});}
export function createApp(cfg=config()){
 const jobs=new Map(),keys=new Map(),usage=new Map(),rate=new Map(),counts=new Map(),queue=[];
 const day=t=>t+':'+new Date().toISOString().slice(0,10);
 const stats=t=>{if(!usage.has(t))usage.set(t,{submitted:0,completed:0,estimated_tokens:0,external_ai_calls:0,spent_usd:0});return usage.get(t);};
 const publicJob=j=>({id:j.id,type:j.type,state:j.state,created_at:j.created_at,completed_at:j.completed_at||null,result:j.result||null,cost_usd:0,external_ai_calls:0});
 const drain=()=>setImmediate(()=>{while(queue.length){const j=queue.shift();j.state='running';if(j.type==='echo.test')j.result={text:j.input.text};else {const n=Math.ceil(j.input.text.length/4);j.result={estimated_tokens:n,disclaimer:'approximation only'};stats(j.tenant).estimated_tokens+=n;}j.state='succeeded';j.completed_at=new Date().toISOString();stats(j.tenant).completed++;}});
 const handler=async(req,res)=>{
  const p=new URL(req.url||'/','http://localhost').pathname;
  if(req.method==='GET'&&p==='/health')return response(res,200,{service:'k-compute',mode:'sandbox',status:'ok',external_ai:false,persistence:'ephemeral'});
  if(req.method==='GET'&&p==='/ready')return response(res,Object.keys(cfg.keys).length?200:503,{ready:!!Object.keys(cfg.keys).length});
  if(!p.startsWith('/v1/'))return response(res,404,{error:'not_found'});
  if(!Object.keys(cfg.keys).length)return response(res,503,{error:'credentials_not_configured'});
  const tenant=req.headers['x-kaizen-tenant'],token=(req.headers.authorization||'').replace(/^Bearer /,'');
  if(typeof tenant!=='string'||typeof token!=='string'||!cfg.keys[tenant]||!eq(token,cfg.keys[tenant]))return response(res,401,{error:'unauthorized'});
  const now=Date.now(),window=(rate.get(tenant)||[]).filter(x=>now-x<60000);if(window.length>=cfg.rate)return response(res,429,{error:'rate_limited'});window.push(now);rate.set(tenant,window);
  if(req.method==='GET'&&p==='/v1/capabilities')return response(res,200,{mode:'sandbox',task_types:['echo.test','estimate.tokens'],external_ai:false,paid_budget_usd:0,persistence:'ephemeral'});
  if(req.method==='GET'&&p==='/v1/usage')return response(res,200,{tenant,daily_jobs:counts.get(day(tenant))||0,daily_job_limit:cfg.limit,...stats(tenant)});
  if(req.method==='GET'&&p.startsWith('/v1/jobs/')){const j=jobs.get(p.slice(9));return j&&j.tenant===tenant?response(res,200,publicJob(j)):response(res,404,{error:'not_found'});}
  if(req.method==='POST'&&p==='/v1/jobs'){
   if(!/^application\/json/i.test(req.headers['content-type']||''))return response(res,415,{error:'json_required'});
   const key=req.headers['idempotency-key'];if(typeof key!=='string'||!/^[\w-]{8,128}$/.test(key))return response(res,400,{error:'idempotency_key_required'});
   let body;try{body=await read(req);}catch(e){if(!res.destroyed)return response(res,e==='payload_too_large'?413:400,{error:e});return;}
   if(!body||!['echo.test','estimate.tokens'].includes(body.type)||typeof body.input?.text!=='string'||!body.input.text.length||body.input.text.length>2000)return response(res,422,{error:'invalid_job'});
   const sig=crypto.createHash('sha256').update(JSON.stringify({type:body.type,input:body.input})).digest('hex'),kid=tenant+':'+key,prev=keys.get(kid);
   if(prev){if(prev.sig!==sig)return response(res,409,{error:'idempotency_conflict'});return response(res,200,publicJob(jobs.get(prev.id)));}
   if((counts.get(day(tenant))||0)>=cfg.limit)return response(res,429,{error:'daily_quota_exceeded'});
   if(jobs.size>=500||queue.length>=50)return response(res,503,{error:'sandbox_capacity_exceeded'});
   const j={id:crypto.randomUUID(),tenant,type:body.type,input:{text:body.input.text},state:'queued',created_at:new Date().toISOString()};
   jobs.set(j.id,j);keys.set(kid,{id:j.id,sig});counts.set(day(tenant),(counts.get(day(tenant))||0)+1);stats(tenant).submitted++;queue.push(j);drain();
   return response(res,202,publicJob(j),{location:'/v1/jobs/'+j.id});
  }
  return response(res,404,{error:'not_found'});
 };
 return http.createServer((req,res)=>{handler(req,res).catch(()=>{if(!res.headersSent&&!res.destroyed)response(res,500,{error:'internal_error'});});});
}
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1])){const cfg=config(),port=Number(process.env.PORT||10000);createApp(cfg).listen(port,'0.0.0.0',()=>console.log(JSON.stringify({service:'k-compute',port,mode:'sandbox'})));}