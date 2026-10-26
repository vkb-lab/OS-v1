import { randomUUID } from 'node:crypto';

// Identidade fictícia deliberadamente diferente do tenant produtivo "k-hemp".
export const KHEMP_PILOT_TENANT = 'khemp-pilot-ficticio';

// Somente dados de demonstração, sem lead, preço, pedido, telefone ou conteúdo real.
export const KHEMP_PILOT_CASES = Object.freeze([
  Object.freeze({
    id: 'brand-brain', type: 'echo.test',
    text: 'SIMULACAO K-HEMP: organizar identidade de marca e FAQ sobre fibra textil de canhamo. Dados inteiramente ficticios.'
  }),
  Object.freeze({
    id: 'publish-draft', type: 'estimate.tokens',
    text: 'SIMULACAO K-HEMP: rascunho educativo sem alegacoes medicas. Nao publicar no Instagram; exigir aprovacao humana.'
  }),
  Object.freeze({
    id: 'sales-classification', type: 'echo.test',
    text: 'SIMULACAO K-HEMP: intencao informativa sobre composicao de tecido; nenhum lead, pedido ou preco real.'
  }),
  Object.freeze({
    id: 'approval-gate', type: 'estimate.tokens',
    text: 'SIMULACAO K-HEMP: evento pending; nenhuma acao de publicar, enviar DM, cobrar ou mudar dados de cliente.'
  })
]);

// Esse adaptador NAO fala com Instagram, K-Publish, Supabase, K-Hemp ou provedores IA.
// A unica saida de rede eh o client K-Compute fornecido pelo chamador.
export async function runKhempSandboxPilot(client, { pilotRunId = randomUUID(), pollAttempts = 30, pollDelayMs = 10 } = {}) {
  if (!client || client.tenant !== KHEMP_PILOT_TENANT || typeof client.createJob !== 'function' || typeof client.capabilities !== 'function') {
    throw new Error('pilot_requires_dedicated_fictitious_tenant');
  }
  if (typeof pilotRunId !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(pilotRunId)) throw new Error('invalid_pilot_run_id');
  if (!Number.isInteger(pollAttempts) || pollAttempts < 1 || pollAttempts > 100) throw new Error('invalid_poll_attempts');
  if (!Number.isInteger(pollDelayMs) || pollDelayMs < 0 || pollDelayMs > 1000) throw new Error('invalid_poll_delay');

  const caps = await client.capabilities();
  if (caps.mode !== 'sandbox' || caps.external_ai !== false || caps.paid_budget_usd !== 0 || caps.persistence !== 'ephemeral'
      || !KHEMP_PILOT_CASES.every(c => caps.task_types?.includes(c.type))) {
    throw new Error('pilot_capabilities_not_safe');
  }
  const prior = await client.usage();
  if (prior.tenant !== KHEMP_PILOT_TENANT || !Number.isInteger(prior.daily_jobs) || !Number.isInteger(prior.limit_daily_jobs)
      || prior.daily_jobs + KHEMP_PILOT_CASES.length > prior.limit_daily_jobs || prior.spent_usd !== 0 || prior.external_ai_calls !== 0) {
    throw new Error('pilot_quota_or_cost_gate');
  }
  const outputs=[];
  for (const fixture of KHEMP_PILOT_CASES) {
    const idempotencyKey = `khemp-${pilotRunId}-${fixture.id}`;
    const created = await client.createJob(fixture.type, fixture.text, idempotencyKey);
    if (!created?.id || !['queued','running','succeeded'].includes(created.state)) throw new Error('pilot_job_not_accepted');
    let result;
    for (let i=0;i<pollAttempts;i++) {
      result=await client.getJob(created.id);
      if (result.state === 'succeeded' || result.state === 'failed') break;
      await new Promise(r=>setTimeout(r,pollDelayMs));
    }
    if (!result || result.state !== 'succeeded' || result.external_ai_calls !== 0 || result.cost_usd !== 0) {
      throw new Error('pilot_job_not_safe_or_complete');
    }
    outputs.push({fixture:fixture.id,job_id:created.id,task_type:result.type,state:result.state,result:result.result});
  }
  const last=await client.usage();
  if(last.spent_usd !== 0 || last.external_ai_calls !== 0)throw new Error('pilot_cost_invariant');
  return {
    pilot:'k-hemp',tenant:KHEMP_PILOT_TENANT,environment:'synthetic-sandbox',
    scenarios:outputs,
    safeguards:{external_ai_calls:0,ai_cost_usd:0,publication_performed:false,dm_sent:false,crm_changed:false,production_database_changed:false},
    caveat:'Apenas echo e estimativa local de tokens; nao prova geracao de conteudo, Publish ou Sales real.'
  };
}
