# Amostras de testes

Ficheiros `.zip` com dados para testes locais ou de integração. **Estão armazenados via [Git LFS](https://git-lfs.com/)** (não são blobs normais no histórico).

## Clonar o repositório com as amostras

1. Instale o [Git LFS](https://git-lfs.com/) (uma vez por máquina):

   ```bash
   git lfs install
   ```

2. Clone como habitualmente; os ponteiros LFS são substituídos pelos ficheiros reais no checkout:

   ```bash
   git clone https://github.com/fluxtrace/fluxtrace.git
   cd fluxtrace
   git lfs pull
   ```

   Se já tinha o clone antes de existir LFS: `git lfs pull` na raiz do repo.

## Quota no GitHub

O volume total das amostras é da ordem de **vários gigabytes**. O plano gratuito do GitHub inclui **1 GiB** de armazenamento LFS; para equipas com mais dados pode ser necessário [**Git LFS data pack**](https://docs.github.com/en/repositories/working-with-files/managing-large-files/installing-git-large-file-storage) ou alojar estes ficheiros noutro sítio (Release, object storage) e manter aqui só um índice.

## Contribuir

Após adicionar ou alterar `.zip` nesta pasta:

```bash
git lfs install
git add amostras-testes/
git commit -m "chore: atualizar amostras de teste"
git push
```
