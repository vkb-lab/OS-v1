# K-Compute V1 — ramo de homologação exclusivo

Serviço independente do ecossistema KAIZEN, executado no Render **sem IA externa, sem gastos pagos e sem bancos produtivos**.

Este ramo `k-compute-v1-sandbox-20261026` substitui a árvore de arquivos **apenas neste branch**, não altera `main` e não traz workflows do GitHub Actions. O código foi feito para migrar a um repositório exclusivo quando a função de criação de repos estiver disponível.

## Iniciar
Node 20+, sem dependências externas. `npm test`; `npm start`.
No Render: plano `free`; autoDeploy `no`; build `npm test`; start `npm start`.
O segredo `K_COMPUTE_KEYS_JSON` (exemplo: `{"homologacao":"<token-aleatorio-32+caracteres>"}`) vai em Environment e nunca no repo.

## Endpoints
- `GET /health` público
- `GET /ready` readiness (sem secrets = 503)
- `GET /v1/capabilities` Bearer + X-Kaizen-Tenant
- `POST /v1/jobs` Bearer, X-Kaizen-Tenant, Idempotency-Key (8-128), JSON `{"type":"echo.test","input":{"text":"hello"}}`
- `GET /v1/jobs/:id`, `GET /v1/usage` isolados por tenant

Execução somente em RAM: jobs, limites, idempotência e consumo **são efêmeros e não servem para cobrança**. Sem integração com SmartPDV, K-Market, Publish, produção, GPU ou IA paga. Antes de clientes reais: banco isolado, filas duráveis, custo token real, auditoria, RLS e controles financeiros persistentes.

## Proteções
`K_COMPUTE_MODE=sandbox`, `K_COMPUTE_EXTERNAL_AI_ENABLED=false`, `K_COMPUTE_MONTHLY_PAID_BUDGET_USD=0`. Qualquer produção/IA paga é rejeitada no startup. Quotas por tenant em memória; sem CORS geral; sem shell ou URL arbitrárias. Não armazenar dados reais.

## Financeiro confirmado
Render workspace `tea-d8cu13jtqb8s739adr50`. Screenshots de 26/10/2026 mostraram **US$ 500.00** de Startup Launch Credits, válidos até **31/05/2027**, US$ 0.00 de cobranças outubro. Créditos não são autorização de upgrade. 5 serviços existentes preservados.

## Gates
H0: código/testes locais. H1: Render free deploy live + smoke /health e validação Billing. H2: SDK EVO/K-OS apenas sandbox. H3: migração para repo próprio, armazenamento transacional e gateway com billing antes do primeiro cliente real.

**Proibido:** merge no `main` dos sistemas legados, gastos pagos, inclusão de cartões, consumo de API de IA paga, integração produtiva sem aprovação explícita.
