# Política de segurança do backup

1. O repositório é público; nenhuma informação confidencial pode ser commitada.
2. Segredos devem permanecer em gerenciador de senhas ou cofre criptografado.
3. A senha mestra e a chave de recuperação ficam fora do Google Drive.
4. Nunca versionar `.env`, `*.key`, `*.pem`, seeds, tokens ou dumps reais.
5. Caso um segredo seja commitado, apagar o arquivo não basta: revogar/rotacionar imediatamente e limpar o histórico.
6. Contas críticas devem usar 2FA e códigos de recuperação offline.
7. Backups privados devem usar acesso mínimo necessário e revisão periódica de compartilhamento.

## Padrões adicionais de exclusão

Recomenda-se manter no `.gitignore`: `.env*`, `*.sqlite*`, `*.db`, `*.dump`, `*.backup`, `exports/privado/`, `secrets/`, `vault/`, `*.kdbx`, `*.zip` e arquivos de mídia originais.
