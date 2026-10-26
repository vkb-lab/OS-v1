# KAIZEN K-Compute / K-Hemp — Piloto H3 (26/10/2026)

## Escopo e decisão

K-Hemp é um produto/tenant real de Kaizen com Publish, Brand Brain e agente `supabase/functions/khemp-agent-chat/index.ts` no `vkb-lab/kaizen-prisma`. A função de chat **pode gravar `kaizen_missions` e `content_items` e consultar dados reais**. Portanto NÃO chamá-la na homologação de processamento. Nenhuma escrita na `main`, produção, Instagram, WhatsApp, canais, banco MVP-KAIZEN, `kaizen-prisma` ou outros aplicativos foi autorizada nesta etapa.

## Teste executável

Utilizar `src/khemp-pilot.mjs` e `test/khemp-pilot.test.mjs` com credencial e tenant **fictícios** `khemp-pilot-ficticio`, distintos do slug de produção `k-hemp`. Os cenários são:

1. `brand-brain`: echo de orientação fictícia de identidade/FAQ sobre fibra têxtil.
2. `publish-draft`: estimativa local de tokens para mensagem neutra, sem geração nem publicação.
3. `sales-classification`: echo de interesse hipotético sem contato, CRM ou preços.
4. `approval-gate`: estimativa de tokens de status pending, sem efetuar aprovação.

Todas as operações passam **somente** por `KComputeSandboxClient` ao K-Compute. Credencial Bearer em teste local é gerada em memória, sem enviar dados reais. Nada em `runKhempSandboxPilot` se comunica com Supabase, K-Hemp, canais sociais ou provedores IA.

## Invariantes de segurança

- `mode=sandbox`, `external_ai=false`, `paid_budget_usd=0`, `persistence=ephemeral` obrigatórios.
- Tentativas de publicar, enviar DM, executar comandos ou cobrar são rejeitadas pela API.
- Cada tenant só pode consultar suas próprias tarefas; idempotência e limites diários são exigidos.
- Ausência de dados reais, dados de clientes, marcas comerciais específicas, chaves ou conteúdo já publicado.
- Não usar este teste para afirmar que o Brand Brain, Publish, Sales ou Instagram operam end-to-end de forma real.

## Gates de evolução

H3-a: testes locais e build Render; aprovação exige 18 testes anteriores + 8 casos K-Hemp.
H3-b: prova HTTP online /health, /ready, acesso sem credencial 401. Para HTTP autenticado, precisa de conexão segura ao segredo específico de sandbox; NUNCA exponha token em chat ou artefato.
H4: criar repositório próprio; separar Supabase banco transacional de homologação; garantir filas duráveis, logs, RLS, controles financeiros persistentes; integrar K-Hemp via EVO/K-OS somente com permissão explícita e gates humanos. Não ativar publicação automática.

## Limitações

O K-Compute V1 real apenas ecoa textos e estima tokens; não gera conteúdo, não usa modelos IA, não processa imagens, não publica nada. Render Free pode suspender por inatividade. Credits Render de US$ 500 não devem ser consumidos por upgrades sem aprovação.
