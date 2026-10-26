import test from 'node:test';
import assert from 'node:assert/strict';
import { KComputeSandboxClient, KComputeHttpError } from '../src/client.mjs';
import { createApp, loadConfig } from '../src/app.mjs';

const token = 'a'.repeat(48);
async function fixture(t) {
  const app = createApp(loadConfig({K_COMPUTE_KEYS_JSON:JSON.stringify({homolog:token})}));
  await new Promise(ok=>app.listen(0,'127.0.0.1',ok));
  t.after(()=>new Promise(ok=>app.close(ok)));
  return new KComputeSandboxClient({baseUrl:'http://127.0.0.1:' + app.address().port,tenant:'homolog',token,allowLocalHttp:true});
}
test('client enforces HTTPS by default, rejects secrets in URL',()=>{
  assert.throws(()=>new KComputeSandboxClient({baseUrl:'http://example.com/',tenant:'homolog',token}));
  assert.throws(()=>new KComputeSandboxClient({baseUrl:'https://u:p@example.com/',tenant:'homolog',token}));
  assert.throws(()=>new KComputeSandboxClient({baseUrl:'https://example.com/?token=x',tenant:'homolog',token}));
});
test('client submits sandbox job and polls result',async t=>{
  const api=await fixture(t);
  const capabilities=await api.capabilities();assert.equal(capabilities.external_ai,false);
  const job=await api.createJob('estimate.tokens','hello world!','client-job-001');
  assert.ok(job.id);
  let state;
  for(let n=0;n<15;n++){
    state=await api.getJob(job.id);
    if(state.state==='succeeded')break;
    await new Promise(ok=>setTimeout(ok,5));
  }
  assert.equal(state.state,'succeeded');
  assert.equal(state.result.estimated_tokens,3);
  assert.equal((await api.usage()).spent_usd,0);
});
test('client does not disclose token in error messages',async t=>{
  const api=await fixture(t);
  const bad=new KComputeSandboxClient({baseUrl:api.baseUrl,tenant:'homolog',token:'x'.repeat(48),allowLocalHttp:true});
  await assert.rejects(bad.capabilities(),err=>err instanceof KComputeHttpError&&err.status===401&&!err.message.includes(token));
});
test('client retries safe GET once but never retries POST',async()=>{
  let n=0;
  const transport=async()=>{n++;return{ok:n>1,status:n>1?200:503,json:async()=>({status:'ok'})};};
  const api=new KComputeSandboxClient({baseUrl:'https://example.com',tenant:'homolog',token,fetchImpl:transport,readRetries:1});
  await api.capabilities();assert.equal(n,2);
  n=0;await assert.rejects(api.createJob('echo.test','hi','sdk-test-001'),e=>e.status===503);
  assert.equal(n,1);
});
test('client rejects shell and invalid IDs without network calls',async()=>{
  const api=new KComputeSandboxClient({baseUrl:'https://example.com',tenant:'homolog',token,fetchImpl:()=>{throw Error('network should never run');}});
  assert.throws(()=>api.createJob('execute.shell','ls'));
  assert.throws(()=>api.getJob('../somewhere'));
});
