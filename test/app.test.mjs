import test from 'node:test';
import assert from 'node:assert/strict';
import {config,createApp} from '../src/server.mjs';
const A='a'.repeat(40),B='b'.repeat(40);
async function fx(t,opts={}){const a=createApp(config({K_COMPUTE_KEYS_JSON:JSON.stringify({alpha:A,beta:B}),...opts}));await new Promise(ok=>a.listen(0,'127.0.0.1',ok));t.after(()=>new Promise(ok=>a.close(ok)));const url='http://127.0.0.1:'+a.address().port;return async(path,method='GET',body,tenant='alpha',token=A,key='job-key-123')=>{const res=await fetch(url+path,{method,headers:{'authorization':'Bearer '+token,'x-kaizen-tenant':tenant,'content-type':'application/json','idempotency-key':key},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,data:await res.json()};};}
const task=(text='hi')=>({type:'echo.test',input:{text}});
test('sandbox rejects cost and providers',()=>{assert.throws(()=>config({K_COMPUTE_EXTERNAL_AI_ENABLED:'true'}));assert.throws(()=>config({K_COMPUTE_MONTHLY_PAID_BUDGET_USD:'2'}));assert.throws(()=>config({K_COMPUTE_MODE:'production'}));});
test('public health, no external AI',async t=>{const call=await fx(t);const h=await call('/health');assert.equal(h.status,200);assert.equal(h.data.external_ai,false);});
test('auth required',async t=>{const call=await fx(t);assert.equal((await call('/v1/capabilities','GET',undefined,'alpha','wrong')).status,401);});
test('job accepted and processed',async t=>{const call=await fx(t);const a=await call('/v1/jobs','POST',task());assert.equal(a.status,202);await new Promise(ok=>setTimeout(ok,5));const b=await call('/v1/jobs/'+a.data.id);assert.equal(b.data.state,'succeeded');assert.equal(b.data.result.text,'hi');});
test('tenants isolated',async t=>{const call=await fx(t);const a=await call('/v1/jobs','POST',task());assert.equal((await call('/v1/jobs/'+a.data.id,'GET',undefined,'beta',B)).status,404);});
test('idempotent and conflict rejection',async t=>{const call=await fx(t);const a=await call('/v1/jobs','POST',task('one'));const b=await call('/v1/jobs','POST',task('one'));const c=await call('/v1/jobs','POST',task('two'));assert.equal(a.data.id,b.data.id);assert.equal(c.status,409);});
test('quota enforced',async t=>{const call=await fx(t,{K_COMPUTE_MAX_JOBS_DAY:'1'});await call('/v1/jobs','POST',task(),'alpha',A,'quota-001');assert.equal((await call('/v1/jobs','POST',task(),'alpha',A,'quota-002')).status,429);});
test('invalid task rejected',async t=>{const call=await fx(t);assert.equal((await call('/v1/jobs','POST',{type:'shell',input:{text:'run'}})).status,422);});