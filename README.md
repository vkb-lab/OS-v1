# KAIZEN K-Compute V1 — Homologação isolada

**Status:** V1 implementada para teste sem provedores externos, sem gravação em bancos existentes e sem cobrança de IA. **Não é a fila de produção**; o estado de trabalhos é efêmero nesta versão.

O K-Compute é um serviço de processamento independente, consumido por outros produtos exclusivamente via HTTP API. Não possui dependência de SmartPDV, K-Publish, K-Market ou banco central Kaizen.

## Rodar e testar

Requer Node.js >=20; **nenhuma dependência NPM externa**.

```bash
npm run check
K_COMPUTE_KEYS_JSON='{"homolog-tenant":"uma-chave-forte-de-mais-de-trinta-e-dois-caracteres"}' PORT=10000 npm start
```

Exemplo (apenas ambiente local; não publique chaves em repositórios):

```bash
curl -fsS http://localhost:10000/health
curl -fsS -X POST http://localhost:10000/v1/jobs \
  -H 'Content-Type: application/json' \
  -H 'X-Kaizen-Tenant: homolog-tenant' \
  -H "Authorization: Bearer $K_COMPUTE_TOKEN" \
  -H 'Idempotency-Key: exemplo-unico-0001' \
  --data '{"type":"estimate.tokens","input":{"text":"Olá, Kaizen"}}'
```

`K_COMPUTE_TOKEN` deve ser o valor privado correspondente ao tenant em `K_COMPUTE_KEYS_JSON`.

## HTTP API

| Método | Rota | Auth | Resposta |
|---|---|---|---|
| GET | `/health` | Pública | Status, modo, persistência |
| GET | `/ready` | Pública | 200 se credenciais configuradas; caso contrário 503 |
| GET | `/v1/capabilities` | Bearer + tenant | Tipos suportados e chamadas externas desabilitadas |
| POST | `/v1/jobs` | Bearer + tenant + Idempotency-Key | Cria job de teste, devolve 202 e location |
| GET | `/v1/jobs/:id` | Bearer + tenant | Busca job somente do tenant autenticado |
| GET | `/v1/usage` | Bearer + tenant | Contadores efêmeros, gastos de IA = 0 |

Corpo de POST: `{"type":"echo.test"|"estimate.tokens","input":{"text":"até 2000 caracteres"}}`.

**Limites:** 8KB por pedido, 25 jobs/tenant/dia por padrão, 30 chamadas/tenant/minuto, 50 jobs em fila e 500 jobs em memória. São limites por instância, não distribuídos. Todos os dados de jobs desaparecem quando a instância reinicia. Não envie dados pessoais ou de clientes reais.

## Segurança / custo

- API privada por tenant e token Bearer forte; credenciais só nas environment variables do Render.
- Não há endpoints para executar comandos, abrir URLs ou gerar conteúdo pago.
- Qualquer `K_COMPUTE_EXTERNAL_AI_ENABLED` diferente de `false`, orçamento diferente de `0` ou modo diferente de `sandbox` faz o processo **falhar antes de subir**.
- Não há chaves de terceiros nem integração com bancos de dados neste marco.
- `autoDeploy=no`, plano `free`, nenhuma assinatura paga, nenhuma integração produtiva.

## Deploy Render isolado

Workspace: **Rogger's workspace** / `tea-d8cu13jtqb8s739adr50`.

Fonte temporária: ramificação exclusiva `k-compute-v1-sandbox-20261026` em `vkb-lab/OS-v1` (a API do conector GitHub não permite criar repositório novo). Essa ramificação tem a aplicação em sua raiz e **não deve ser mesclada na main**. Pode ser exportada para um repositório próprio sem alterações no código.

Runtime `node`, build `npm run check`, start `npm start`, plano `free`, auto deploy `no`, região Oregon. Configurar `K_COMPUTE_KEYS_JSON` com segredo de teste, `K_COMPUTE_EXTERNAL_AI_ENABLED=false`, `K_COMPUTE_MONTHLY_PAID_BUDGET_USD=0`, `K_COMPUTE_MODE=sandbox`.

Consulte `docs/HANDOFF_K_COMPUTE_V1_2026-10-26.md` para arquitetura, critérios de aceite, limites e sequência de homologação.

## Piloto K-Hemp (H3-a, dados fictícios)

`src/khemp-pilot.mjs` e `test/khemp-pilot.test.mjs` fornecem quatro cenários de homologação com a identidade **fictícia** `khemp-pilot-ficticio`, distinta de `k-hemp`. Testa Brand Brain (eco de texto), preparação de rascunho (estimativa de tokens), Sales (eco de interesse simulado) e gate de aprovação (estimativa). Não chama a função real do K-Hemp, nem faz qualquer publicação, gravação em banco ou IA paga.

Execute `npm run check`; veja `docs/KHEMP_PILOT_H3_2026-10-26.md`. A lista de testes agora inclui 8 casos adicionais K-Hemp. Isso **não comprova** processamento real das funções Publish/Sales/Brand Brain; comprova a segurança do contrato K-Compute que poderá ser integrado posteriormente por EVO/K-OS.
