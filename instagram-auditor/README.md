# Auditor Instagram — Casa da Limpeza

Conector exclusivo para relacionar o que foi publicado no Instagram da Casa da Limpeza com as vendas mensais consultadas pelo Calito.

## Objetivo

Permitir perguntas como:

- O que foi publicado em agosto de 2024?
- Quais campanhas estavam ativas quando determinado produto vendeu mais?
- Houve aumento de vendas após uma publicação ou campanha?
- Quais formatos geraram maior alcance, interação e resultado comercial?
- Quais produtos foram divulgados, mas não responderam em vendas?

## Arquitetura inicial

1. **Meta Instagram API**: fonte oficial dos conteúdos e indicadores.
2. **GitHub Actions**: executa a coleta diária ou manual.
3. **Pasta `calito-data/instagram/`**: recebe arquivos normalizados por mês.
4. **Calito**: cruza os conteúdos por data com a base mensal de vendas.
5. **Render (opcional)**: será usado apenas se precisarmos de OAuth, renovação automática avançada de token, webhooks ou serviço permanente.

## Segurança

Nunca colocar no repositório:

- senha do Instagram;
- token de acesso da Meta;
- segredo do aplicativo Meta;
- token pessoal do GitHub.

Esses valores ficam em **GitHub → Configurações → Segredos e variáveis → Ações**.

## Segredos e variáveis necessários

### Secrets

- `META_ACCESS_TOKEN`: token autorizado da conta profissional.
- `META_IG_USER_ID`: ID da conta profissional do Instagram.

### Variables

- `META_GRAPH_VERSION`: versão vigente da Graph API, por exemplo a versão indicada no painel do aplicativo Meta.
- `META_MEDIA_INSIGHT_METRICS`: métricas de mídia autorizadas, separadas por vírgula.
- `META_ACCOUNT_INSIGHT_METRICS`: métricas da conta autorizadas, separadas por vírgula.

As listas de métricas são configuráveis porque a disponibilidade depende do tipo de mídia, versão da API e permissões aprovadas.

## Dados coletados

Para cada publicação disponível na API:

- ID da mídia;
- data e hora;
- tipo de mídia;
- texto/legenda;
- link permanente;
- URL de miniatura quando disponível;
- métricas públicas retornadas;
- insights autorizados;
- mês de referência;
- data da coleta.

## Estrutura gerada

```text
calito-data/
  instagram/
    index.json
    2024/
      08.json
      09.json
    2025/
      01.json
```

O `index.json` contém um resumo mensal para o Calito. Cada arquivo mensal guarda as publicações e métricas detalhadas daquele período.

## Limites importantes

- Dados disponíveis dependem das permissões, do tipo de conta e do histórico que a API oficial disponibiliza.
- Stories antigos podem não permanecer disponíveis da mesma forma que publicações e Reels.
- Campanhas pagas exigem integração adicional com a API de Marketing e o identificador da conta de anúncios.
- Correlação entre campanha e venda não prova causalidade. O Calito deverá apresentar como associação temporal e comercial.

## Próxima configuração manual

1. Confirmar que o Instagram da Casa da Limpeza é conta profissional.
2. Confirmar o aplicativo no painel Meta for Developers.
3. Autorizar a conta da loja no aplicativo.
4. Obter `META_IG_USER_ID` e `META_ACCESS_TOKEN`.
5. Cadastrar os segredos e variáveis no GitHub.
6. Executar o workflow `Sincronizar Instagram da Casa da Limpeza`.

Depois da primeira coleta real, o Calito será atualizado para combinar `vendas + marketing` na mesma resposta.
