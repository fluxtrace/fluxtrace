# Amostras de testes

Ficheiros `.zip` com dados para testes locais ou de integração. Pode obtê-los de **duas formas** (equivalentes em conteúdo, consoante o que for mais simples para a sua equipa).

---

## Opção 1 — Download via Google Drive

Descarregue o pacote de amostras a partir do **Google Drive**:

[Abrir / descarregar no Google Drive](https://drive.google.com/file/d/1kpHaI8c_e7HLqdY4dTNYfZVqWR9wTMNh/view?usp=drive_link)

- **Link directo (ficheiro):**  
  `https://drive.google.com/file/d/1kpHaI8c_e7HLqdY4dTNYfZVqWR9wTMNh/view?usp=drive_link`
- No Google Drive, use **Ficheiro → Transferir** (ou o botão de download) para obter o ficheiro localmente.  
- Extraia ou coloque os `.zip` conforme a estrutura que a equipa adoptar; se o Drive entregar um único arquivo, siga as instruções do pacote.

---

## Opção 2 — FSF (Fonte no repositório com Git LFS)

**FSF** neste documento significa: obter as amostras pela **fonte versionada no repositório**, usando **Git** e **[Git Large File Storage (LFS)](https://git-lfs.com/)** — os `.zip` em `amostras-testes/` são armazenados como ponteiros LFS, não como blobs normais no histórico.

### Passos

1. Instale o [Git LFS](https://git-lfs.com/) (uma vez por máquina):

   ```bash
   git lfs install
   ```

2. Clone o repositório e materialize os ficheiros LFS:

   ```bash
   git clone https://github.com/fluxtrace/fluxtrace.git
   cd fluxtrace
   git lfs pull
   ```

3. As amostras ficam em **`amostras-testes/*.zip`**.

Se já tinha um clone antigo: na raiz do repo execute `git lfs pull` após `git pull`.

### Quota no GitHub (LFS)

O volume total pode ser da ordem de **vários gigabytes**. O plano gratuito do GitHub inclui **1 GiB** de armazenamento LFS; pode ser necessário um [**pacote de dados LFS**](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-storage-and-bandwidth-usage) ou usar sobretudo a **Opção 1 (Google Drive)** quando a quota LFS for insuficiente.

---

## Resumo

| Opção | Nome | Quando usar |
|-------|------|-------------|
| **1** | **Google Drive** | Download único simples, sem Git ou sem quota LFS. |
| **2** | **FSF** (repositório + **Git LFS**) | Quem já trabalha com clone do repo e quer as mesmas amostras na pasta `amostras-testes/`. |

---

## Contribuir (quem altera os `.zip` no repositório)

Após adicionar ou alterar `.zip` nesta pasta no Git:

```bash
git lfs install
git add amostras-testes/
git commit -m "chore: atualizar amostras de teste"
git push
```

*(Mantenha o Google Drive actualizado pela equipa se a **Opção 1** for oficial para parceiros sem acesso ao Git.)*
