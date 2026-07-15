# Arquitetura K-OS Cloud Pro

## Objetivo

O K-OS é um sistema operacional nativo para agentes de IA. A primeira versão estabelece um painel operacional, uma API central e contratos para agentes, skills e conectores.

## Fluxo principal

```text
Celular / computador
        ↓
Dashboard / API
        ↓
Orquestrador ORQ-001
        ↓
Agente especializado
        ↓
Skill
        ↓
Conector
        ↓
Validação / aprovação
        ↓
Execução / memória / auditoria
```

## Camadas

1. **Interface** — painel responsivo para comandos, tarefas, conectores e aprovações.
2. **API** — entrada padronizada e healthcheck.
3. **Orquestração** — roteamento de tarefas, agentes, skills e modelos.
4. **Agentes** — unidades especializadas com permissões limitadas.
5. **Skills** — capacidades reutilizáveis com entrada e saída estruturadas.
6. **Conectores** — integração com GitHub, Google Cloud, Ollama, Render, Meta e outros.
7. **Memória** — sessão, usuário, projeto, técnica e pesquisa.
8. **Segurança** — aprovação humana, auditoria e privilégio mínimo.
9. **Observabilidade** — logs, métricas, custos, falhas e saúde.

## Agentes fundamentais

- ORQ-001 Orquestrador
- ROU-001 Roteador de modelos
- MEM-001 Gestor de memória
- AUD-001 Auditor
- VAL-001 Validador
- MON-001 Supervisor 24/7
- DEV-001 Programador
- GIT-001 Operador GitHub
- OPS-001 Operações
- WEB-001 Navegador
- RES-001 Pesquisador
- CON-001 Gestor de conectores

## Estado do MVP

O MVP atual possui:

- dashboard responsivo;
- API FastAPI;
- healthcheck;
- catálogo inicial de agentes;
- catálogo inicial de conectores;
- criação de comandos em fila local;
- testes automatizados;
- container de produção.

## Próximas integrações

1. Persistência PostgreSQL/Cloud SQL.
2. Pub/Sub para fila distribuída.
3. Ollama para roteamento local.
4. Google ADK ou LangGraph para execução coordenada.
5. Autenticação e perfis.
6. Central real de aprovações.
7. Conectores Google Workspace, WhatsApp e Instagram.
