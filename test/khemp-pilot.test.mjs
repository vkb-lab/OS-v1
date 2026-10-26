import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, loadConfig } from '../src/app.mjs';
import { KComputeSandboxClient } from '../src/client.mjs';
import { KHEMP_PILOT_TENANT, KHEMP_PILOT_CASES, runKhempSandboxPilot } from '../src/khemp-pilot.mjs';

const KEY='f'.repeat(48), OTHER='g'.repeat(48);
const createTestClient = async(t,env={}) => {
  const server = createApp(loadConfig({K_COMPUTE_KEYS_JSON:JSON.stringify({[KHEMP_PILOT_TENANT]:KEY,'outro-teste':OTHER}),...env}));
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  t.after(()=>new Promise(done=>server.close(done)));
  const baseUrl=`http://127.0.0.1:${server.address().port}`;
  return {
    api: new KComputeSandboxClient({baseUrl,tenant:KHEMP_PILOT_TENANT,token:KEY,allowLocalHttp:true}),
    other: new KComputeSandboxClient({baseUrl,tenant:'outro-teste',token:OTHER,allowLocalHttp:true})
  };
};

test('K-Hemp synthetic pilot completes four job workflows, no paid AI or publication',async t=>{
  const {api}=await createTestClient(t);
  const result=await runKhempSandboxPilot(api,{pilotRunId:'khemp-20261026-01'});
  assert.equal(result.scenarios.length,4);
  assert.ok(result.scenarios.every(j=>j.state==='succeeded'));
  assert.deepEqual(result.scenarios.map(j=>j.fixture),KHEMP_PILOT_CASES.map(j=>j.id));
  assert.equal(result.safeguards.external_ai_calls,0);
  assert.equal(result.safeguards.ai_cost_usd,0);
  assert.equal(result.safeguards.publication_performed,false);
  assert.equal(result.safeguards.production_database_changed,false);
  const usage=await api.usage();assert.equal(usage.daily_jobs,4);assert.equal(usage.spent_usd,0);
});

test('K-Hemp pilot cannot use another tenant or production K-Hemp slug',async t=>{
  const {api,other}=await createTestClient(t);
  await assert.rejects(runKhempSandboxPilot(other),/dedicated_fictitious_tenant/);
  const prod=new KComputeSandboxClient({baseUrl:api.baseUrl,tenant:'k-hemp',token:KEY,allowLocalHttp:true});
  await assert.rejects(runKhempSandboxPilot(prod),/dedicated_fictitious_tenant/);
});

test('K-Hemp cannot read jobs belonging to another tenant',async t=>{
  const {api,other}=await createTestClient(t);
  const job=await api.createJob('echo.test','somente simulacao','khemp-tenant-001');
  await assert.rejects(other.getJob(job.id),err=>err.status===404);
});

test('K-Hemp preflight refuses free quota too small for pilot',async t=>{
  const {api}=await createTestClient(t,{K_COMPUTE_MAX_JOBS_DAY:'3'});
  await assert.rejects(runKhempSandboxPilot(api),/quota_or_cost_gate/);
  assert.equal((await api.usage()).daily_jobs,0);
});

test('K-Hemp rejects an external AI / paid budget capability at preflight',async()=>{
  let called=0;
  const mock={tenant:KHEMP_PILOT_TENANT,capabilities:async()=>({mode:'sandbox',external_ai:true,paid_budget_usd:1,persistence:'ephemeral',task_types:['echo.test','estimate.tokens']}),usage:async()=>({tenant:KHEMP_PILOT_TENANT,daily_jobs:0,limit_daily_jobs:25,spent_usd:0,external_ai_calls:0}),createJob:async()=>{called++;}};
  await assert.rejects(runKhempSandboxPilot(mock),/capabilities_not_safe/);
  assert.equal(called,0);
});

test('K-Hemp cannot submit publishing, DM or shell jobs',async t=>{
  const {api}=await createTestClient(t);
  for(const type of ['publish.instagram','send.whatsapp','execute.shell','sales.charge'])assert.throws(()=>api.createJob(type,'ficticio'));
  assert.equal((await api.usage()).daily_jobs,0);
});

test('K-Hemp replay idempotency does not create additional jobs',async t=>{
  const {api}=await createTestClient(t);
  const first=await runKhempSandboxPilot(api,{pilotRunId:'khemp-repeat-2026'});
  const replay=await runKhempSandboxPilot(api,{pilotRunId:'khemp-repeat-2026'});
  assert.deepEqual(first.scenarios.map(x=>x.job_id),replay.scenarios.map(x=>x.job_id));
  assert.equal((await api.usage()).daily_jobs,4);
});

test('K-Hemp fixture is synthetic and contains no production identifiers',()=>{
  assert.ok(KHEMP_PILOT_CASES.every(f=>f.text.includes('SIMULACAO K-HEMP')));
  assert.ok(KHEMP_PILOT_CASES.every(f=>f.text.length<2000));
  assert.ok(KHEMP_PILOT_CASES.every(f=>!/(\+\d{10,}|@khemp\.br|supabase\.co|Bearer\s|CNPJ\s*\d)/i.test(f.text)));
});
