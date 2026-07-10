# Brief para executora do Dashboard K-OS

## Missão

Evoluir o painel existente sem alterar os contratos da API. O painel deve funcionar em celular e computador e manter aparência profissional, escura, verde/preto, com baixa poluição visual.

## Rotas atuais

- `GET /health`
- `GET /api/agents`
- `GET /api/connectors`
- `GET /api/tasks`
- `POST /api/commands`

Payload de comando:

```json
{
  "text": "Audite o projeto",
  "project": "OS-v1"
}
```

## Telas obrigatórias

1. Visão geral
2. Agentes
3. Conectores
4. Tarefas
5. Aprovações
6. Novo comando
7. Logs
8. Custos
9. Saúde do sistema
10. Configurações

## Regras visuais

- tema escuro verde/preto;
- layout responsivo;
- navegação lateral no desktop e compacta no celular;
- status com rótulo e não apenas cor;
- ações críticas destacadas;
- sem gráficos decorativos;
- foco em operação e leitura rápida.

## Regras técnicas

- não guardar segredos no frontend;
- consumir apenas a API;
- manter estados de loading, vazio e erro;
- incluir acessibilidade básica;
- não executar ações críticas sem confirmação;
- preparar integração futura com autenticação Google.

## Critério de aceite

O operador deve conseguir abrir o painel, verificar a saúde da API, ver agentes e conectores, enviar um comando e vê-lo aparecer na fila de tarefas.
