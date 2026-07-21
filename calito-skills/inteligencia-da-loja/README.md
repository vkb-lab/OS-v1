# Skill — Inteligência da Loja

Módulo de decisão operacional do Calito para apoiar João na gestão da Casa da Limpeza.

## Objetivo

Transformar histórico real de vendas, margem, categorias, sazonalidade e marketing em recomendações explicáveis de prioridade operacional.

## O que responde

- O que devo reforçar para agosto?
- Quais produtos sustentam determinado mês?
- Quais produtos combinam alto giro e boa margem?
- Quais itens merecem cautela?
- Quais categorias crescem em determinado intervalo?
- Qual foi o comportamento histórico de um mês do calendário?
- Que campanhas coincidiram com períodos de melhor desempenho?

## Regras de segurança decisória

1. A skill recomenda **prioridade**, não quantidade de compra, enquanto não houver estoque atual, mercadoria em trânsito, prazo do fornecedor e pedido mínimo.
2. Não usa a palavra “encalhado” como fato sem posição de estoque. Pode indicar baixo giro histórico ou queda de relevância.
3. Margem sempre significa margem bruta histórica, não lucro líquido.
4. Relação marketing × venda é tratada como associação temporal, nunca causalidade comprovada.
5. Toda recomendação deve indicar os dados que sustentam a decisão.

## Arquitetura de produto

A skill fica isolada em `calito-skills/inteligencia-da-loja/`, permitindo futuramente habilitação por plano/assinatura sem reescrever o núcleo do Calito.
