# KAIZEN — HANDOFF COMPLETO — K-COMPUTE V1

**Data:** 26/10/2026  
**Owner:** Kaizen / K-OS  
**Missão:** executor isolado de tarefas para o ecossistema Kaizen sem alterar serviços existentes.

## 1. Premissas verificadas e limites financeiros

- Workspace Render: `Rogger's workspace`, ID `tea-d8cu13jtqb8s739adr50`, usuário `vkb@kaizen-org.com`.
- Screenshots de Billing apresentados pelo proprietário em 26/10/2026: plano Hobby; sem cartão; US$ 500,00 **restantes** em `Startup Launch Credits`, válidos até **31/05/2027**; cobrança acumulada/projetada de outubro US$ 0,00; julho, agosto e setembro com faturas US$ 0,00.
- Imagem mensal: 2,83/750 horas gratuitas; 5/25 serviços; 0 MB/5 GB banda; 0/500 minutos de pipeline — valores capturados na data, não garantia futura.
- **Não usar os créditos como autorização para contratar serviços pagos.** V1 configura plano `free` e execução de IA externa **impossibilitada no código**; serviços existentes inalterados.
- Render cobre infraestrutura elegível conforme seus termos, não tokens de qualquer API/GPU de terceiros. Se for necessário cartão, upgrade ou serviços pagos, solicitar autorização prévia e orçamento explícito.

## 2. Inventário legado preservado (consulta read-only)

| Render service | Tipo | Plano encontrado | Estado observado |
|---|---|---|---|
| `calito-form-backend` | web Node | free | Deploy de setembro live, logs de outubro; **preservar** |
| `kaizen-org` | web Node | free | Deploy live desde julho; preservar |
| `kaizen-navemae-back` | web Node | free | Últimos dois builds falharam em julho; **não excluir sem validação de dependências** |
| `k-atlas-assets` | static | free | Último deploy live junho; preservar |
| `k-atlas-os` | web Python | free | Último deploy live julho; preservar |

Na consulta não existiam Postgres nem Key Value criados no Render. A ausência de logs recentes não comprova ausência de dependências. Não houve exclusões, alterações de env, upgrades ou deploys nesses cinco serviços.

## 3. Arquitetura de responsabilidade

```text
K-SmartPDV  K-Publish  K-Market  K-Sales  outros produtos
     |         |          |          |
     +---------+----------+----------+  HTTPS + tenant scope (futuro)
                       |
               K-Compute API V1
                Render / Free
                node: HTTP server
                [Bearer tenant auth]
                [rate limit + quotas]
                [idempotência]
                [fila efêmera]
                [ledger efêmero]
                       |
             apenas tarefas gratuitas
             echo.test / estimate.tokens
                       |
           Sem acessos produtivos / sem GPU
```

O K-Compute não recebe privilégios de banco, não substitui Cloudflare, Supabase ou GitHub e não mistura catálogos, vendas, informações fiscais, estoque nem identidades de sistemas Kaizen. Integração com EVO/K-OS e K-Market ocorrerá somente por API versionada após autenticação e testes.

## 4. Implementação V1 concluída no código

- Node.js 20+ sem pacotes externos.
- `GET /health` e `GET /ready`.
- API v1 com `GET /v1/capabilities`, `POST /v1/jobs`, `GET /v1/jobs/:id`, `GET /v1/usage`.
- Isolamento de jobs por tenant; chave Bearer distinta por tenant, com comparação resistente a timing.
- `Idempotency-Key` obrigatório e separado por tenant. Reutilização com payload diferente retorna 409.
- Whitelist estrita de tarefas (eco e estimativa). Nenhum shell, URL externa, modelo externo nem chamada faturável.
- Respostas não permitem CORS indiscriminado; limites básicos de tamanho e quotas locais.
- Contabilização demonstrativa de tentativas, jobs concluídos e tokens estimados, com custos reais fixos em zero.
- Pipeline de validação via `npm run check` usa teste de runtime nativo; **não existe arquivo de GitHub Actions na ramificação**.

## 5. Limites INTENCIONAIS da versão

**Homologação — não usar com clientes reais:**

1. Jobs e métricas residem em RAM e **somem** em reinícios/scale-down. Idempotência não persiste entre reinícios.
2. Contadores por tenant são por processo; não podem ser utilizados para faturamento real nem limites comerciais em múltiplas instâncias.
3. Sem provider router, GPU, fila persistente, retry, dead-letter queue, webhooks reais ou billing de terceiros.
4. Sem um banco dedicado de tarefas, trilha de auditoria formal e chaveamento automático.
5. Plano gratuito do Render pode dormir por inatividade e demorar a responder após despertar.
6. A ferramenta GitHub conectada permite criar branches/commits, mas **não oferece criação de repositórios novos**. A ramificação dedicada é uma solução temporária; não houve commit na `main`.

## 6. Segurança e isolamento

**Permissões:** token Bearer somente em Render environment; nunca no repo, log, URL ou screenshot. `X-Kaizen-Tenant` determina escopo; o token deve coincidir exatamente com o tenant. Buscar job alheio retorna 404. Não há permissões administrativas.

**Bloqueio de custos:** variáveis `K_COMPUTE_MODE=sandbox`, `K_COMPUTE_EXTERNAL_AI_ENABLED=false`, `K_COMPUTE_MONTHLY_PAID_BUDGET_USD=0`; qualquer alteração para modo produtivo ou habilitação de IA paga falha no startup.

**Ataques:** limitar request a 8 KB, tamanho de texto a 2.000 caracteres, jobs/dia e requests/min; sem execução de código, arquivo, shell ou webhook arbitrário. Não usar dados reais na sandbox. Nenhuma credencial em repositórios.

## 7. Acordo de API — K-Compute V1

`POST /v1/jobs`

Headers: `Authorization: Bearer <token>`, `X-Kaizen-Tenant: <tenant>`, `Idempotency-Key: <string >=8>`, `Content-Type: application/json`.

Body:
```json
{"type":"estimate.tokens","input":{"text":"Olá Kaizen"}}
```

202 Accepted:
```json
{"id":"<uuid>","type":"estimate.tokens","state":"queued","created_at":"<ISO date>","completed_at":null,"result":null,"error":null,"cost_usd":0,"external_ai_calls":0}
```

Após processar, `GET /v1/jobs/<uuid>` retorna `state=succeeded`, resultado de tokenização aproximada e zero cobranças.

Erro esperado: 401 autenticação, 404 job ausente/de outro tenant, 409 reuso conflituoso da chave, 413 corpo grande, 415 tipo errado, 422 payload inválido, 429 cota, 503 credenciais não configuradas/capacidade atingida.

## 8. Plano de homologação / gates

### Gate H0 — concluído localmente

- Código isolado, sem dependências externas e sem conexões a dados Kaizen.
- Comando `npm run check` precisa concluir testes sem falhas; registrar número exato.
- Verificar auth, isolamento, idempotência, limite, zero custo, startup fail-closed.

### Gate H1 — Render FREE sem produção

- Criar novo Web Service `kaizen-k-compute-v1-hml` no workspace confirmado, plano `free`, `autoDeploy=no` e branch exclusiva.
- Build: `npm run check`; start: `npm start`; health: `/health` (se serviço usar verificação TCP por padrão, testar GET externo).
- Apenas `K_COMPUTE_MODE=sandbox`, `K_COMPUTE_EXTERNAL_AI_ENABLED=false`, `K_COMPUTE_MONTHLY_PAID_BUDGET_USD=0`; segredo de tenant em variável Render se testes autenticados forem necessários.
- Confirmar deploy `live` e obter HTTP 200 em `/health` antes de declarar funcional.
- Verificar Billing para garantir US$ 0,00 de encargos e US$ 500,00 de saldo depois do smoke.

### Gate H2 — integração controlada com EVO/K-OS

- Contrato de cliente SDK / proxy sem copiar segredos para front-end.
- Idempotência e assinaturas por tenant, timeout, retry de leitura, circuit-breaker.
- Sem tocar no banco central e sem ativar SmartPDV/K-Market/Publish.

### Gate H3 — persistência antes de qualquer cliente real

- Migrar para repositório independente dedicado.
- Criar projeto de banco/filas isolado de homologação com migração versionada, RLS, logs imutáveis e rastreio de tenant.
- Persistência de jobs, estados, payload seguro e TTL; reserva atômica de orçamento, idempotência transacional, retries/backoff e dead-letter.
- Limites globais e por tenant em banco/Redis, não RAM. Criptografia e política de retenção/LGPD.
- Integração com gateway de modelos; medição de tokens reais por provider/modelo, precificação versionada e ledger.
- Teste de restart, falha de banco, concorrência, duplicate delivery, overspend e tenant hopping.
- Ativação de créditos Render para instância paga e provedores externos **apenas após orçamento e aprovação expressa**.

## 9. Custos e programa startup

- Crédito Render confirmado: US$ 500,00 em 26/10/2026; validade 31/05/2027; não significa que uso atual tenha custo.
- Serviços existentes Free; não excluir sem dependências auditadas.
- Nunca criar serviços pagos ou incluir cartão como parte da homologação automaticamente.
- Reconciliar mensalmente `Billing > Unbilled Charges`, `Credit Balance`, `Invoice History`.
- Limite de dólares internos V1 = 0 para IA/terceiros; credit balance deve ser monitorado no painel do Render, não assumido via ferramenta técnica.

## 10. Riscos, decisões e handoff

| Risco | Contenção | Próxima evolução |
|---|---|---|
| Custo acidental | Sandbox fail-closed e free tier | Orçamento por job e alertas reais |
| Fila volátil | Somente jobs de teste | Persistência e fila transacional |
| Segredos vazados | Environment secrets + no logs | Cofre central + rotação |
| Mistura de tenants | Auth/consulta segregada | RLS, integração auditável |
| Limites GitHub Actions | Sem workflow no branch e Render constrói | Repositório próprio com pipeline econômico |
| Perda de integração atual | Nenhuma alteração a apps/bancos existentes | Contratos de API versionados |

**Papel do próximo executor:** verificar deploy Render e smoke sem writes reais; só depois executar H2/H3 isoladamente. **Proibido** merge na main dos repositórios existentes, criação de conta paga, alteração de Cloudflare/SmartPDV/Supabase ou entrada de usuários reais sem autorização explícita.

## Continuação de 26/10/2026 — marco H2
- H1: commit 503f808 implantado no Render e confirmado `live`, testes 13/13 e validações HTTP externas /health 200, /ready 200 e endpoint privado retornando 401 sem token.
- H2: SDK `src/client.mjs` server-to-server e cinco novos testes locais (18 testes no total); integração com EVO/K-OS **ainda não conectada**.
- Não houve merge em main, escrita em bancos produtivos, cobrança de API externa nem habilitação de IA.
- Ainda não foi executado POST autenticado diretamente no endpoint público; a credencial do Render foi preservada e não extraída.
