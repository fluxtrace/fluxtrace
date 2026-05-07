# Amostras de teste (FluxTrace)

Ficheiros **`.zip`** para testes manuais e desenvolvimento. Esta pasta fica na **raiz do repositório** (ao lado de `fluxtrace_web/`).

Os `.zip` grandes são versionados com **[Git LFS](https://git-lfs.com/)** (ver `.gitattributes` na raiz do repo).

Para correr a aplicação com estes dados: **`fluxtrace_web/readme-web.md`**.

### Tempos de envio + processamento (referência)

Valores **aproximados** alinhados ao gráfico **«Tempo envio + processamento — lotes concluídos»** do dashboard (somatório upload + processamento; lotes antigos podem estar **estimados** por regressão pelo tamanho). Dependem de rede, carga do servidor e do ambiente.

A coluna **SHA-256** é o identificador do pacote: coincide com o **nome do ficheiro `.zip`** em `amostras-testes/` (sem `.zip`). O rótulo **ficheiro** é o nome convencional usado nos relatórios / gráfico; dentro do arquivo vêm sobretudo `.cdf` Contradef (não um `.csv` com esse nome).

| Ficheiro (rótulo) | SHA-256 (pacote `.zip`) | Tempo de processamento (aprox.) |
| ----------------- | ------------------------- | -------------------------------- |
| `amostra_100k.csv` | `a0aeb837cb5e762fc0b7d657c71d343e765cccb5780cd315756f682418b3cdfe` | ~50 s |
| `amostra_200k.csv` | `b640c53e2c02f08aa8ca3db62c628abcaa1694ffec33a59d69d88f5e2d1552aa` | ~45 s |
| `amostra_500k.csv` | `6e89b763cd4dd79f0c3082f09813efbd3dac4374a95455fe86ed27c363309a45` | ~20 s |
| `amostra_1M.csv` | `1db3df87facac7ad4bf2fc7f9c49392f6f1cd69ce3d5db0d7b1a23074ad0dd69` | ~25 s |
| `amostra_5M.csv` | `7de3df7d279686adf7a3f9a3160dbbd35be0024cd3de2a22cae911efb61fef8c` | ~150 s (~2,5 min) |
| `amostra_10M.csv` | `36685efcf34c7a7a6f6dd2e48199e4700b5ab8fe3945a50297703dd8daced74f` | ~180 s (~3 min) |
| `amostra_20M.csv` | `17c7986320e427a1106f3bbed1e122bcb0d9d38611d159c120df11d9689f4ec4` | ~350 s (~5,8 min) |
| `amostra_50M.csv` | `db32e48a61c59884c1ce4c28f12feee426d361982e2491fbaaf7cb4e75a501dd` | ~550 s (~9,2 min) |

Na mesma pasta existem ainda os pacotes `66ebbc7d5f4e3c2b392af7f624ad328c8b4dc2e198f7bf585506b132607e9fbd` e `a50581cd1845d7072037b1f42e30139b6a48cdb0b28edd3368d3bb31a31007bc` (tamanho intermédio entre as entradas «10M» e «50M» da tabela); não entram no gráfico de referência acima.

A coluna **Ficheiro** foi alinhada à coluna **SHA-256** por **ordem crescente** do tamanho em arquivo de `TraceInstructions.cdf` em cada `.zip`. Se no dashboard o nome do lote (`sampleName`) for diferente destes rótulos, use o **SHA-256** como identificador certo do pacote e confira o nome no detalhe do lote ou na exportação.

---

## Opção 1 — Google Drive

[Abrir / descarregar no Google Drive](https://drive.google.com/file/d/1kpHaI8c_e7HLqdY4dTNYfZVqWR9wTMNh/view?usp=drive_link)

URL: `https://drive.google.com/file/d/1kpHaI8c_e7HLqdY4dTNYfZVqWR9wTMNh/view?usp=drive_link`

---

## Opção 2 — FSF (Git LFS no repositório)

**FSF** = amostras pela **fonte versionada** com LFS (`amostras-testes/*.zip`).

Na raiz do repo (pasta que contém `fluxtrace_web/` e `amostras-testes/`):

```bash
git lfs install
git clone https://github.com/fluxtrace/fluxtrace.git
cd fluxtrace
git lfs pull
```

Quota LFS no GitHub (plano gratuito ~1 GiB); volumes maiores: Drive ou outro armazenamento LFS.

| Opção | Quando usar |
|-------|-------------|
| **1 — Google Drive** | Download simples |
| **2 — FSF (Git LFS)** | Clone do repositório com os `.zip` em `amostras-testes/` |

---

## Contribuir (adicionar ou atualizar amostras)

```bash
git lfs install
git add amostras-testes/
git commit -m "amostras: …"
git push
```
