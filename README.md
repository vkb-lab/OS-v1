# K-OS Cloud Pro

Sistema operacional nativo para agentes de IA, orquestração, memória persistente e conectores em nuvem.

## Objetivos

- Orquestração de agentes
- Memória persistente
- Conectores Google
- Integração GitHub
- Integração WhatsApp e Instagram
- Execução híbrida com Ollama e Gemini
- Operação 24/7 em nuvem

## Status

Projeto em fase de arquitetura com MVP operacional de API e dashboard.

## Dashboard operacional

O dashboard em `apps/dashboard/index.html` foi evoluído como central operacional responsiva para celular e computador, com tema escuro verde/preto e baixa poluição visual.

Telas disponíveis:

- Visão geral
- Agentes
- Conectores
- Tarefas
- Aprovações
- Novo comando
- Logs
- Custos
- Saúde do sistema
- Configurações

O painel consome apenas a API existente, não armazena segredos no frontend e inclui estados de carregamento, erro e lista vazia. O envio de novo comando exige confirmação antes de chamar a API e, após criado, o item aparece na fila de tarefas.

## Contratos da API

Não houve alteração nos contratos existentes:

- `GET /health`
- `GET /api/agents`
- `GET /api/connectors`
- `GET /api/tasks`
- `POST /api/commands`

Payload de comando mantido:

```json
{
  "text": "Audite o projeto",
  "project": "OS-v1"
}
```

## Validação local

```bash
pytest -q
python -m compileall apps
```

Para abrir o dashboard pela rota `/`:

```bash
uvicorn apps.api.main:app --host 0.0.0.0 --port 8000
```
