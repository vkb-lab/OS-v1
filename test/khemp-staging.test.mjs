import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp,loadConfig} from '../src/app.mjs';
import {KComputeSandboxClient} from '../src/client.mjs';
import {KhempH4Staging,H4_FIXTURES} from '../src/khemp-staging.mjs';
const apiToken='a'.repeat(48), reviewer='r'.repeat(48);
async function make(t,opts={}){
  const server=createApp(loadConfig({K_COMPUTE_KEYS_JSON:JSON.stringify({'khemp-pilot-ficticio':apiToken,another:'b'.repeat(48)}),...opts}));
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  t.after(()=>new Promise(ok=>server.close(ok)));
  const client=new KComputeSandboxClient({baseUrl:'http://127.0.0.1:'+server.address().port,tenant:'khemp-pilot-ficticio',token:apiToken,allowLocalHttp:true});
  return new KhempH4Staging({client,reviewerSecret:reviewer,runId:'h4-test-101'});
}
test('H4 case types mirror K-Hemp growth/Publish/Sales contract',()=>{
  assert.deepEqual(Object.keys(H4_FIXTURES),['brand-brain','publish-draft','sales-intake']);
  assert.deepEqual(Object.values(H4_FIXTURES).map(x=>x.capability),['brand_brain','kaizen_publish','kaizen_sales']);
});
test('H4 full pipeline: request > compute > simulated reply > pending draft > separate reviewer',async t=>{
  const p=await make(t);
  const d=await p.propose('publish-draft');
  assert.equal(d.organization_slug,'khemp-pilot-ficticio');
  assert.equal(d.review,'pending');
  assert.equal(d.approved_for_real_publish,false);
  assert.equal(d.agent_reply.draft.channel,'instagram');
  assert.equal(d.agent_reply.draft.content_type,'post');
  assert.equal(d.agent_reply.capability,'kaizen_publish');
  assert.equal(d.compute_job_id.length,36);
  assert.equal(d.external_actions.instagram,false);
  const confirmed=p.review({id:d.id,reviewerSecret:reviewer,actor:'hml-reviewer-a',decision:'approve'});
  assert.equal(confirmed.review,'approved_in_sandbox');
  assert.equal(confirmed.approved_for_real_publish,false);
  assert.equal(p.events.length,2);
  assert.throws(()=>p.publish(d.id),/disabled/);
});
test('H4 Brand Brain staging uses fixed synthetic context, never real facts',async t=>{
  const p=await make(t);const d=await p.propose('brand-brain');
  assert.equal(d.source,'synthetic');assert.equal(d.agent_reply.capability,'brand_brain');
  assert.equal(d.agent_reply.draft,null);assert.equal(d.agent_reply.priority,'secondary');
});
test('H4 Sales staging never creates CRM lead, payment or real contact',async t=>{
  const p=await make(t);const d=await p.propose('sales-intake');
  assert.equal(d.agent_reply.capability,'kaizen_sales');
  assert.equal(d.external_actions.salesCRM,false);
  assert.equal(d.external_actions.payments,false);
  assert.throws(()=>p.recordSale(d.id),/disabled/);
});
test('H4 no unapproved fixture or arbitrary messages accepted',async t=>{
  const p=await make(t);
  await assert.rejects(p.propose('live-content-from-client'),/synthetic_fixture_only/);
  await assert.rejects(p.propose('../publish'),/synthetic_fixture_only/);
});
test('H4 cannot use real tenant K-Hemp',async t=>{
  const p=await make(t);
  const evil={tenant:'k-hemp',capabilities:async()=>{},createJob:async()=>{},getJob:async()=>{},usage:async()=>{}};
  assert.throws(()=>new KhempH4Staging({client:evil,reviewerSecret:reviewer}),/dedicated_khemp/);
  assert.equal(p.tenant,'khemp-pilot-ficticio');
});
test('H4 separate reviewer secret and explicit simulated role required',async t=>{
  const p=await make(t);const d=await p.propose('publish-draft');
  assert.throws(()=>p.review({id:d.id,actor:'hml-reviewer-a',decision:'approve'}),/unauthorized/);
  assert.throws(()=>p.review({id:d.id,reviewerSecret:apiToken,actor:'hml-reviewer-a',decision:'approve'}),/unauthorized/);
  assert.throws(()=>p.review({id:d.id,reviewerSecret:reviewer,actor:'admin',decision:'approve'}),/invalid_reviewer/);
  assert.equal(p.getDraft(d.id).review,'pending');
});
test('H4 rejection path immutable decision, no publish',async t=>{
  const p=await make(t);const d=await p.propose('publish-draft');
  assert.equal(p.review({id:d.id,reviewerSecret:reviewer,actor:'hml-reviewer-a',decision:'reject'}).review,'rejected_in_sandbox');
  assert.throws(()=>p.review({id:d.id,reviewerSecret:reviewer,actor:'hml-reviewer-a',decision:'approve'}),/already_recorded/);
  assert.equal(p.getDraft(d.id).approved_for_real_publish,false);
});
test('H4 no publication or DM even after sandbox approval',async t=>{
  const p=await make(t);const d=await p.propose('publish-draft');
  p.review({id:d.id,reviewerSecret:reviewer,actor:'hml-reviewer-a',decision:'approve'});
  assert.throws(()=>p.publish(d.id));assert.throws(()=>p.sendDm(d.id));
});
test('H4 quotas enforced before any new job',async t=>{
  const p=await make(t,{K_COMPUTE_MAX_JOBS_DAY:'1'});
  await p.propose('brand-brain');
  await assert.rejects(p.propose('publish-draft'),/quota_or_cost_gate/);
});
test('H4 safe return values do not allow external mutation of stored approval',async t=>{
  const p=await make(t);const d=await p.propose('publish-draft');
  assert.throws(()=>{d.review='approved_for_real';});
  const copy=p.getDraft(d.id);assert.throws(()=>{copy.review='approved_for_real';});
  assert.equal(p.getDraft(d.id).review,'pending');
});
test('H4 foreign tenant cannot fetch K-Hemp job on the real HTTP sandbox',async t=>{
  const server=createApp(loadConfig({K_COMPUTE_KEYS_JSON:JSON.stringify({'khemp-pilot-ficticio':apiToken,other:'b'.repeat(48)})}));
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  t.after(()=>new Promise(ok=>server.close(ok)));
  const origin='http://127.0.0.1:'+server.address().port;
  const khemp=new KComputeSandboxClient({baseUrl:origin,tenant:'khemp-pilot-ficticio',token:apiToken,allowLocalHttp:true});
  const foreign=new KComputeSandboxClient({baseUrl:origin,tenant:'other',token:'b'.repeat(48),allowLocalHttp:true});
  const stage=new KhempH4Staging({client:khemp,reviewerSecret:reviewer,runId:'h4-cross-1'});
  const d=await stage.propose('brand-brain');
  await assert.rejects(foreign.getJob(d.compute_job_id),e=>e.status===404);
  const legitimate=await khemp.getJob(d.compute_job_id);
  assert.equal(legitimate.state,'succeeded');
});
