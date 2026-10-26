import crypto, { randomUUID } from 'node:crypto';
import { KHEMP_PILOT_TENANT } from './khemp-pilot.mjs';

// Fixed, invented fixtures. Real K-Hemp content and customer data are deliberately inaccessible.
export const H4_FIXTURES = Object.freeze({
  'brand-brain': Object.freeze({
    type: 'echo.test',
    text: 'SINTETICO H4 K-HEMP: pergunta ficticia sobre tecido feito com fibra industrial. Sem afirmacao clinica ou regulatoria.',
    intent: 'brand_faq', capability: 'brand_brain',
  }),
  'publish-draft': Object.freeze({
    type: 'estimate.tokens',
    text: 'SINTETICO H4 K-HEMP: texto educativo sobre propriedades e usos de fibras texteis, sem alegacoes medicas. Nao publicar.',
    intent: 'content_draft', capability: 'kaizen_publish',
  }),
  'sales-intake': Object.freeze({
    type: 'echo.test',
    text: 'SINTETICO H4 K-HEMP: consulta hipotetica sobre materiais texteis. Sem dados de lead, produto, valor ou pagamento.',
    intent: 'lead_triage', capability: 'kaizen_sales',
  }),
});
const allowedActions = Object.freeze({ instagram:false, whatsapp:false, salesCRM:false, publish:false, payments:false });
function digest(secret) {return crypto.createHash('sha256').update(secret).digest();}
function equals(a,b) {const A=digest(a),B=digest(b);return crypto.timingSafeEqual(A,B);}
function validateSafeCapabilities(c) {
  if (c?.mode !== 'sandbox' || c.external_ai !== false || c.paid_budget_usd !== 0 || c.persistence !== 'ephemeral' ||
      !H4_FIXTURES['publish-draft'] || !Object.values(H4_FIXTURES).every(f=>c.task_types?.includes(f.type))) {
    throw new Error('unsafe_compute_capabilities');
  }
}
function sealed(result) {return Object.freeze(structuredClone(result));}

// Runs entirely within a test or trusted back-end. No exposed review endpoint and no external social/CRM/database SDKs.
export class KhempH4Staging {
  #client;
  #reviewerSecret;
  #drafts=new Map();
  #events=[];
  #runId;
  constructor({ client, reviewerSecret, runId=randomUUID(), maxPolls=20 }={}) {
    if (!client || client.tenant !== KHEMP_PILOT_TENANT || typeof client.capabilities!=='function' || typeof client.createJob!=='function' || typeof client.getJob!=='function' || typeof client.usage!=='function') {
      throw Error('dedicated_khemp_synthetic_tenant_required');
    }
    if (typeof reviewerSecret !== 'string' || reviewerSecret.length < 32) throw Error('separate_reviewer_secret_required');
    if (typeof runId !== 'string' || !/^[a-z0-9_-]{8,64}$/i.test(runId)) throw Error('invalid_run_id');
    if (!Number.isInteger(maxPolls) || maxPolls<1 || maxPolls>100) throw Error('invalid_poll_limit');
    this.#client=client;
    this.#reviewerSecret=reviewerSecret;
    this.#runId=runId;
    this.maxPolls=maxPolls;
  }
  get tenant(){return KHEMP_PILOT_TENANT;}
  get events(){return structuredClone(this.#events);}
  get pendingCount(){return [...this.#drafts.values()].filter(d=>d.review==='pending').length;}
  getDraft(id){const d=this.#drafts.get(id);return d?sealed(d):null;}
  async propose(fixtureId) {
    // Only pre-approved fixture ID, never arbitrary text or identifiers from the live product.
    if (!Object.hasOwn(H4_FIXTURES,fixtureId)) throw Error('synthetic_fixture_only');
    const fixture=H4_FIXTURES[fixtureId];
    validateSafeCapabilities(await this.#client.capabilities());
    const before=await this.#client.usage();
    if(before.tenant!==this.tenant||before.spent_usd!==0||before.external_ai_calls!==0||!Number.isInteger(before.daily_jobs)||!Number.isInteger(before.limit_daily_jobs)||before.daily_jobs>=before.limit_daily_jobs){throw Error('quota_or_cost_gate');}
    const created=await this.#client.createJob(fixture.type,fixture.text,`h4-${this.#runId}-${fixtureId}`);
    if(!created?.id||!['queued','running','succeeded'].includes(created.state))throw Error('job_not_accepted');
    let job;
    for(let i=0;i<this.maxPolls;i++){
      job=await this.#client.getJob(created.id);
      if(['succeeded','failed'].includes(job?.state))break;
      await new Promise(r=>setTimeout(r,5));
    }
    if(job?.state!=='succeeded'||job.cost_usd!==0||job.external_ai_calls!==0)throw Error('unsafe_or_incomplete_job');
    const after=await this.#client.usage();
    if(after.spent_usd!==0||after.external_ai_calls!==0)throw Error('post_job_cost_gate');
    const id=`h4-${this.#runId}-${fixtureId}`;
    const draft={
      id, source:'synthetic',organization_slug:'khemp-pilot-ficticio',
      model_output_type:fixture.type, compute_job_id:job.id,
      schema:'khemp-agent-chat-v1',
      agent_reply:{
        reply:'SIMULAÇÃO. Resultado local, não gerado por IA externa.',intent:fixture.intent,capability:fixture.capability,
        priority:'secondary',funnel_stage:fixtureId==='sales-intake'?'lead':'visualizacao',next_actions:['Revisão humana de demonstração'],
        lead_signal:'none',draft:fixtureId==='publish-draft'?{
          title:'[SIMULAÇÃO] Fibras têxteis e suas aplicações',
          body:'Conteúdo demonstrativo, sem comprovação de propriedade específica, sem recomendação médica ou jurídica.',
          channel:'instagram',content_type:'post'
        }:null,
      },
      review:'pending',approved_for_real_publish:false,external_actions:allowedActions,
      simulated_result:job.result,created_at:new Date().toISOString()
    };
    this.#drafts.set(id,draft);
    this.#events.push({type:'draft.created',id,source:'synthetic',at:draft.created_at});
    return sealed(draft);
  }
  review({id, reviewerSecret, actor, decision}={}) {
    const d=this.#drafts.get(id);
    if (!d) throw Error('draft_not_found');
    if (typeof reviewerSecret!=='string'||!equals(reviewerSecret,this.#reviewerSecret))throw Error('reviewer_unauthorized');
    if(typeof actor!=='string'||!/^hml-reviewer-[a-z0-9-]{1,32}$/i.test(actor))throw Error('invalid_reviewer');
    if(!['approve','reject'].includes(decision))throw Error('invalid_decision');
    if(d.review!=='pending')throw Error('review_already_recorded');
    d.review=decision==='approve'?'approved_in_sandbox':'rejected_in_sandbox';
    d.reviewed_at=new Date().toISOString();
    d.reviewer=actor;
    d.approved_for_real_publish=false;
    this.#events.push({type:'draft.reviewed',id,actor,decision,result:d.review,at:d.reviewed_at});
    return sealed(d);
  }
  // Cannot be enabled by reviewer: no side effect integrations exist in this module.
  publish(){throw Error('publication_permanently_disabled_in_h4');}
  sendDm(){throw Error('messaging_permanently_disabled_in_h4');}
  recordSale(){throw Error('sales_permanently_disabled_in_h4');}
}
