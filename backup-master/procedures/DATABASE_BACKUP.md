# Procedimento: bancos de dados

## Supabase

Preservar separadamente:

- schema SQL;
- políticas RLS;
- funções, triggers e extensões;
- dump dos dados;
- inventário de Storage e exportação dos objetos;
- configuração de Auth sem segredos;
- versão do CLI e data da exportação.

## SQLite do Evo-OS

1. Parar o processo que escreve no banco ou usar o método seguro de backup da SQLite.
2. Copiar `data/sqlite/evo_os.db` para pasta datada.
3. Executar `PRAGMA integrity_check;` na cópia.
4. Calcular SHA-256.
5. Testar abertura e consultas essenciais.
6. Guardar no Google Drive privado em `04 — BANCOS DE DADOS E CHECKSUMS`.

Nunca enviar dumps reais ou arquivos SQLite para este repositório público.
