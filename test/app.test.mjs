import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp,loadConfig } from '../src/app.mjs';

const TA='a'.repeat(40), TB='b'.repeat(40);
async function fixture(t,extra={}) {
  const app = createApp(loadConfig({K_COMPUTE_KEYS_JSON:JSON.stringify({'tenant-alpha':TA,'tenant-beta':TB}),...extra}));
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>app.close(resolve)));
  const url = `http://127.0.0.1:${app.address().port}`;
  async function call(path,{method='GET',tenant='tenant-alpha',token=TA,idempotency,body,headers={}}={}) {
    const h={authorization:`Bearer ${token}`,'x-kaizen-tenant':tenant,...headers};
    if (body!==undefined) h['content-type']='application/json';
    if(idempotency) h['idempotency-key']=idempotency;
    const r=await fetch(url+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,body:await r.json(),headers:r.headers};
  }
  return {call,url};
}
const job = (text='sample')=>({type:'echo.test',input:{text}});

test('health is public and sandbox only',async t=>{
 const {call}=await fixture(t);const x=await call('/health',{headers:{authorization:''}}); assert.equal(x.status,200);assert.equal(x.body.mode,'sandbox');assert.equal(x.body.persistence,'ephemeral');
});
test('fails closed without credentials',async t=>{
 const a=createApp(loadConfig({})); await new Promise(ok=>a.listen(0,ok));t.after(()=>new Promise(ok=>a.close(ok)));
 const r=await fetch(`http://127.0.0.1:${a.address().port}/v1/usage`);assert.equal(r.status,503);
});
test('rejects unsafe configuration',()=>{
 assert.throws(()=>loadConfig({K_COMPUTE_EXTERNAL_AI_ENABLED:'true'}));
 assert.throws(()=>loadConfig({K_COMPUTE_MONTHLY_PAID_BUDGET_USD:'1'}));
 assert.throws(()=>loadConfig({K_COMPUTE_MODE:'production'}));
});
test('rejects missing or invalid auth',async t=>{
 const {call}=await fixture(t);assert.equal((await call('/v1/capabilities',{token:'wrong'})).status,401);
 assert.equal((await call('/v1/capabilities',{tenant:'tenant-beta',token:TA})).status,401);
});
test('capabilities forbid external AI',async t=>{
 const {call}=await fixture(t);const r=await call('/v1/capabilities');assert.equal(r.status,200);assert.equal(r.body.external_ai,false);assert.equal(r.body.paid_budget_usd,0);
});
test('accepts and completes isolated sandbox job',async t=>{
 const {call}=await fixture(t);const a=await call('/v1/jobs',{method:'POST',idempotency:'unique-job-1',body:job('hello')});
 assert.equal(a.status,202);let r;for(let i=0;i<10;i++){r=await call('/v1/jobs/'+a.body.id);if(r.body.state==='succeeded')break;await new Promise(ok=>setTimeout(ok,5));}
 assert.equal(r.status,200);assert.deepEqual(r.body.result,{text:'hello'});assert.equal(r.body.cost_usd,0);
});
test('tenant cannot see another tenant job',async t=>{
 const {call}=await fixture(t);const a=await call('/v1/jobs',{method:'POST',idempotency:'isolation1',body:job()});
 const b=await call('/v1/jobs/'+a.body.id,{tenant:'tenant-beta',token:TB});assert.equal(b.status,404);
});
test('idempotency prevents duplicate jobs and conflict',async t=>{
 const {call}=await fixture(t);let a=await call('/v1/jobs',{method:'POST',idempotency:'same-key-1',body:job('a')});
 let b=await call('/v1/jobs',{method:'POST',idempotency:'same-key-1',body:job('a')});
 let c=await call('/v1/jobs',{method:'POST',idempotency:'same-key-1',body:job('b')});
 assert.equal(a.body.id,b.body.id);assert.equal(b.status,200);assert.equal(c.status,409);
});
test('idempotency key is tenant-scoped',async t=>{
 const {call}=await fixture(t);let a=await call('/v1/jobs',{method:'POST',idempotency:'same-key-1',body:job()});
 let b=await call('/v1/jobs',{method:'POST',tenant:'tenant-beta',token:TB,idempotency:'same-key-1',body:job()});assert.notEqual(a.body.id,b.body.id);
});
test('daily job quota is enforced',async t=>{
 const {call}=await fixture(t,{K_COMPUTE_MAX_JOBS_DAY:'1'});assert.equal((await call('/v1/jobs',{method:'POST',idempotency:'quota-001',body:job()})).status,202);
 assert.equal((await call('/v1/jobs',{method:'POST',idempotency:'quota-002',body:job()})).status,429);
});
test('per-tenant request rate is enforced',async t=>{
 const {call}=await fixture(t,{K_COMPUTE_MAX_REQUESTS_MINUTE:'2'});
 assert.equal((await call('/v1/capabilities')).status,200);assert.equal((await call('/v1/usage')).status,200);
 assert.equal((await call('/v1/usage')).status,429);
});
test('rejects invalid tasks and missing idempotency key',async t=>{
 const {call}=await fixture(t);assert.equal((await call('/v1/jobs',{method:'POST',body:job()})).status,400);
 assert.equal((await call('/v1/jobs',{method:'POST',idempotency:'bad-job-01',body:{type:'execute.shell',input:{text:'rm -rf /'}}})).status,422);
});
test('estimates tokens without calling provider',async t=>{
 const {call}=await fixture(t);let a=await call('/v1/jobs',{method:'POST',idempotency:'estimate-01',body:{type:'estimate.tokens',input:{text:'hello world!'}}});
 let b;for(let i=0;i<10;i++){b=await call('/v1/jobs/'+a.body.id);if(b.body.state==='succeeded')break;await new Promise(ok=>setTimeout(ok,5));}
 assert.equal(b.body.result.estimated_tokens,3);let u=await call('/v1/usage');assert.equal(u.body.external_ai_calls,0);assert.equal(u.body.spent_usd,0);
});
