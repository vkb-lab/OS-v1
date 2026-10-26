# KAIZEN — K-Hemp / K-Compute H4: handoff de homologação (26/10/2026)

## Identificação e fronteira de segurança
- Produto de referência **K-Hemp**, fonte produtiva: `vkb-lab/kaizen-prisma` e `supabase/functions/khemp-agent-chat/index.ts`.
- A função real lê conteúdo, notícias, Brand Brain, contatos e missões e pode **gravar** missões e rascunhos. **NÃO foi chamada**.
- Motor de homologação: `vkb-lab/OS-v1`, branch exclusiva `k-compute-v1-sandbox-20261026`, serviço Render `srv-dbfmrsgu01pc73braq1g` (plano Free; auto deploy Off).
- Tenant exclusivo fictício `khemp-pilot-ficticio`, diferente de `k-hemp`. Somente fixtures fixas. Não enviar dados reais.
- Sem chamadas a Supabase, Instagram, Meta, WhatsApp, Mercado Pago, provedores de IA, K-Publish, K-Sales ou qualquer K-OS produtivo.

## O que H4 testa de fato
1. `KhempH4Staging.propose('brand-brain'|'publish-draft'|'sales-intake')` valida capacidades e saldo de IA zerado.
2. Solicita `echo.test` ou `estimate.tokens` via o **cliente HTTP real KComputeSandboxClient** contra servidor de teste in-process, com Bearer e idempotência.
3. Recupera tarefa concluída e verifica `cost_usd=0`, `external_ai_calls=0`.
4. Produz resposta determinística no **formato** do agente K-Hemp (campos reply/intent/capability/priority/funnel_stage/next_actions/lead_signal/draft).
5. Cria draft sintético em memória com `review=pending`, `approved_for_real_publish=false` e `external_actions` totalmente false.
6. O revisor simulado exige segredo adicional de 32+ caracteres, separado da API, e grava evento `approved_in_sandbox` ou `rejected_in_sandbox`, **sem jamais permitir publicar**.
7. Quota, idempotência, tenant, bloqueio de credencial e publicação são testados.

## Não significa
- Não existe integração do produto real via EVO/K-OS. Não há geração por LLM, busca regulatória, classificação comercial real, persistência transacional, UI humana, revisão legal, envio para Publish ou publicação.
- Aprovação em teste é um evento simulado, não homologação real por usuário autenticado.
- O Render Free pode suspender; filas e drafts em RAM desaparecem ao reiniciar.

## Banco isolado
Supabase conectada mostra `MVP-KAIZEN` e `casa-da-limpeza-pdv` ativos e `kaizen-pay-core` inativo. Não reaproveitar nenhuma dessas bases no H4.
- SQL privado candidato em `docs/sql/KHEMP_HML_PROPOSAL_NOT_APPLIED.sql` **não foi aplicado** e ainda requer revisão de schema/roles, criação de projeto dedicado com custo aprovado, testes RLS e testes de restore.
- Novos projetos podem gerar custos ou exceder limites do plano gratuito. Sem confirmação, não provisionar.

## Contrato técnico / integração posterior
- Somente backend server-to-server; tokens em secrets do provedor, nunca em frontend, GitHub, relatório ou log.
- Manter `K_COMPUTE_MODE=sandbox`, `K_COMPUTE_EXTERNAL_AI_ENABLED=false`, `K_COMPUTE_MONTHLY_PAID_BUDGET_USD=0`.
- Futuros endpoints de staging devem exigir autenticação de usuário real e RLS; aprovação real deve ocorrer no produto, não pela tokenização de testes.
- Gates: H4 local+Render build com regressão integral; H5 projeto/banco independente, persistência, integração do EVO e autenticação/revisão real; H6 publicação somente após aprovação explícita e auditoria.
- `KhempH4Staging` deve permanecer biblioteca/harness de homologação e **não é um novo servidor produtivo**.

## Checklist de aceite H4
- [x] Criação de fluxo sintético, caminho HTTP, resposta estruturada, rascunho pendente e revisão simulada.
- [x] Negar fixture arbitrária, tenant produtivo, token de revisão incorreto, aprovação repetida e ações externas.
- [x] Executar todos os testes locais sem dependências ou IA paga.
- [ ] Build no Render e smoke endpoints online do novo commit.
- [ ] Prova HTTP autenticada externa com segredo efêmero do tenant piloto, quando houver caminho seguro para injetar/ler credencial sem revelar segredos.
- [ ] Banco de homologação dedicado, review UI real e persistência.
- [ ] Auditoria de custo final no Render Billing.
