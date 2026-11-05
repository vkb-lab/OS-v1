# Procedimento: backup Git completo

Para cada repositório acessível:

```powershell
$Date = Get-Date -Format "yyyy-MM-dd_HHmmss"
git clone --mirror https://github.com/OWNER/REPO.git "REPO_$Date.git"
git -C "REPO_$Date.git" fsck --full
git -C "REPO_$Date.git" bundle create "..\\REPO_$Date.bundle" --all
Get-FileHash "..\\REPO_$Date.bundle" -Algorithm SHA256
Compress-Archive -Path "REPO_$Date.git" -DestinationPath "REPO_$Date.mirror.zip"
```

Guardar `.bundle`, `.mirror.zip` e checksum na pasta privada do Google Drive. Não commitar os arquivos binários no repositório público.

## Teste de restauração

```powershell
git clone "REPO_DATA.bundle" "REPO_RESTORE_TEST"
git -C "REPO_RESTORE_TEST" log --all --oneline --decorate -n 20
git -C "REPO_RESTORE_TEST" fsck --full
```
