# Calito — acesso restrito

Este repositório é a base oficial do Calito da Casa da Limpeza.

## Perfis

- **Rogger:** administrador.
- **João:** usuário da operação.

## Segredos obrigatórios

Cadastrar em **Settings > Secrets and variables > Actions > New repository secret**:

- `CALITO_ADMIN_PASSWORD`
- `CALITO_JOAO_PASSWORD`

Regras recomendadas para as senhas:

- pelo menos 16 caracteres;
- combinar letras, números e símbolos;
- não reutilizar senha de e-mail, banco ou rede social;
- compartilhar a senha do João por canal privado.

As senhas não são gravadas no repositório. Durante o deploy, a aplicação é criptografada separadamente para cada perfil. O GitHub Pages publica somente a tela de acesso e os pacotes criptografados.

## Segurança e limites

- O conteúdo não fica legível sem a senha correta.
- A proteção usa PBKDF2-SHA256 e AES-256-GCM.
- O perfil João tem os controles administrativos ocultos na versão entregue a ele.
- Esta é uma proteção adequada para a fase atual, mas dados jurídicos, bancários, senhas, documentos pessoais e dados sensíveis de clientes não devem ser armazenados no GitHub Pages.
- Para auditoria empresarial completa e múltiplos usuários, a evolução futura deverá usar autenticação e autorização no servidor.

## Integração do ChatGPT com GitHub

A instalação GitHub conectada à conta `vkb-lab` possui atualmente permissão administrativa no repositório `vkb-lab/OS-v1`.

O acesso continuará disponível enquanto:

1. o aplicativo GitHub permanecer instalado na conta;
2. o repositório continuar liberado para a instalação;
3. as permissões não forem revogadas ou reduzidas;
4. a conexão do ChatGPT com GitHub permanecer ativa.

Nenhum arquivo consegue garantir acesso permanente caso a integração seja removida pelo proprietário ou pelo GitHub.
