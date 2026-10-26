-- PREPARAÇÃO / NÃO EXECUTAR NO BANCO PRODUTIVO.
-- Aplicar APENAS em um NOVO projeto Supabase dedicado ao K-HEMP HML, após aprovação de custo/isolamento.
-- Private schema not exposed through Supabase Data API; no grants to anon or authenticated.
BEGIN;
CREATE SCHEMA IF NOT EXISTS k_compute_hml;
REVOKE ALL ON SCHEMA k_compute_hml FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS k_compute_hml.jobs (
  job_id uuid PRIMARY KEY,
  tenant_key text NOT NULL CHECK (tenant_key = 'khemp-pilot-ficticio'),
  job_kind text NOT NULL CHECK (job_kind IN ('echo.test','estimate.tokens')),
  input_sha256 text NOT NULL CHECK (length(input_sha256) = 64),
  state text NOT NULL CHECK (state IN ('queued','running','succeeded','failed')),
  idempotency_key text NOT NULL,
  result_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (tenant_key,idempotency_key)
);
CREATE TABLE IF NOT EXISTS k_compute_hml.drafts (
  draft_id uuid PRIMARY KEY,
  compute_job_id uuid NOT NULL REFERENCES k_compute_hml.jobs(job_id),
  tenant_key text NOT NULL CHECK (tenant_key = 'khemp-pilot-ficticio'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved_in_sandbox','rejected_in_sandbox')),
  payload jsonb NOT NULL,
  source text NOT NULL DEFAULT 'synthetic' CHECK (source = 'synthetic'),
  approved_for_real_publish boolean NOT NULL DEFAULT false CHECK (approved_for_real_publish = false),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS k_compute_hml.review_events (
  event_id uuid PRIMARY KEY,
  draft_id uuid NOT NULL REFERENCES k_compute_hml.drafts(draft_id),
  actor text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  event_type text NOT NULL DEFAULT 'sandbox_review' CHECK (event_type = 'sandbox_review'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE k_compute_hml.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE k_compute_hml.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE k_compute_hml.review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA k_compute_hml FROM PUBLIC,anon,authenticated;
-- No frontend access, no policies, no public RPC. Dedicated backend role and audited grants must be designed separately.
COMMIT;
