# Sequência oficial de execução — K-OS Cloud Pro

Este arquivo é a fila mestra do projeto. Nenhuma etapa deve ser pulada sem registrar a decisão.

## Fase 1 — Fundação

- [x] API FastAPI
- [x] Dashboard inicial
- [x] Fila local de tarefas
- [x] Testes automatizados
- [x] GitHub Actions
- [x] Dockerfile

## Fase 2 — Núcleo de conectores

- [x] Contrato de conector
- [x] Connector Registry v1
- [x] Catálogo de capacidades
- [x] Healthcheck lógico
- [x] Matriz de risco por ação
- [x] Approval Engine v1
- [x] Manifesto GitHub
- [x] Manifesto Filesystem
- [x] Manifesto PowerShell
- [ ] GitHub runtime autenticado
- [ ] Worker local autenticado

## Fase 3 — Persistência

- [ ] PostgreSQL
- [ ] Migrações
- [ ] Tarefas persistentes
- [ ] Logs persistentes
- [ ] Aprovações persistentes
- [ ] Registro de memória
- [ ] pgvector

## Fase 4 — Execução

- [ ] Orquestrador real
- [ ] Worker local Windows
- [ ] Executor sandboxed
- [ ] Fila assíncrona
- [ ] Retentativas
- [ ] Cancelamento
- [ ] Pausa geral

## Fase 5 — Modelos

- [ ] Ollama
- [ ] Roteador de modelos
- [ ] Gemini
- [ ] Política de custo
- [ ] Cache semântico

## Fase 6 — Google Workspace e domínio

- [ ] Vincular kaizen-org.com ao Google Workspace
- [ ] Criar conta de sistema
- [ ] Configurar DNS e e-mail
- [ ] Publicar site
- [ ] OAuth consent screen
- [ ] Gmail connector
- [ ] Drive connector
- [ ] Calendar connector
- [ ] Sheets connector

## Fase 7 — Canais externos

- [ ] WhatsApp
- [ ] Instagram
- [ ] Telegram

## Bloqueios externos atuais

1. O runtime do K-OS ainda não recebeu credencial própria para a API do GitHub.
2. O worker local ainda não foi instalado como serviço no Windows.
3. O Google Workspace e o domínio kaizen-org.com exigem configuração administrativa e DNS fora do repositório.
4. O banco persistente ainda não foi provisionado.
