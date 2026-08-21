# Amostras de teste (FluxTrace)

Ficheiros **`.zip`** para testes manuais e desenvolvimento. Esta pasta fica na **raiz do repositório** (ao lado de `fluxtrace_web/`).

Os `.zip` grandes são versionados com **[Git LFS](https://git-lfs.com/)** (ver `.gitattributes` na raiz do repo).

Para correr a aplicação com estes dados: **`fluxtrace_web/readme-web.md`**.

Cada pacote é um diretório nomeado pelo **SHA-256** do bundle, com ficheiros Contradef (`FunctionInterceptor`, `TraceFcnCall.M1`/`.M2`, `TraceInstructions`, `TraceMemory`, `TraceDisassembly`, etc.).

---

## Inventário (16 pacotes)

Ordenação por tamanho **descomprimido** de `TraceInstructions.cdf` dentro do `.zip` (referência objectiva para escolher carga de teste). A coluna **SHA-256** coincide com o **nome do ficheiro** `.zip` (sem extensão).

| Rótulo convencional | SHA-256 (pacote `.zip`) | `TraceInstructions.cdf` (≈) | Arquivo `.zip` (≈) | Tempo envio + processamento (ref.) |
| ------------------- | ------------------------- | ----------------------------- | ------------------- | ----------------------------------- |
| `amostra_100k.csv` | `a0aeb837cb5e762fc0b7d657c71d343e765cccb5780cd315756f682418b3cdfe` | 0,35 GiB | 24 MiB | ~50 s |
| `amostra_200k.csv` | `b640c53e2c02f08aa8ca3db62c628abcaa1694ffec33a59d69d88f5e2d1552aa` | 0,40 GiB | 28 MiB | ~45 s |
| `amostra_500k.csv` | `6e89b763cd4dd79f0c3082f09813efbd3dac4374a95455fe86ed27c363309a45` | 0,69 GiB | 46 MiB | ~20 s |
| `amostra_1M.csv` | `1db3df87facac7ad4bf2fc7f9c49392f6f1cd69ce3d5db0d7b1a23074ad0dd69` | 1,91 GiB | 164 MiB | ~25 s |
| `amostra_5M.csv` | `7de3df7d279686adf7a3f9a3160dbbd35be0024cd3de2a22cae911efb61fef8c` | 2,31 GiB | 187 MiB | ~150 s (~2,5 min) |
| `amostra_10M.csv` | `36685efcf34c7a7a6f6dd2e48199e4700b5ab8fe3945a50297703dd8daced74f` | 3,92 GiB | 130 MiB | ~180 s (~3 min) |
| `amostra_20M.csv` | `17c7986320e427a1106f3bbed1e122bcb0d9d38611d159c120df11d9689f4ec4` | 4,76 GiB | 351 MiB | ~350 s (~5,8 min) |
| — | `66ebbc7d5f4e3c2b392af7f624ad328c8b4dc2e198f7bf585506b132607e9fbd` | 4,80 GiB | 356 MiB | a medir |
| — | `0e3e95ee6649238171fb409c143c8a944bc54332f0ce85b94c651b5d0bf95343` | 7,11 GiB | 844 MiB | a medir |
| — | `1693df9d970e011cf1c827fceaf49a3724f4478bc0ed7dc50f2d90ea417b6d38` | 8,17 GiB | 708 MiB | a medir |
| — | `a50581cd1845d7072037b1f42e30139b6a48cdb0b28edd3368d3bb31a31007bc` | 10,33 GiB | 468 MiB | a medir |
| — | `49aa74387680de248f21af321c6721c305a29a071279b5526627921daa812e42` | 15,03 GiB | 1,52 GiB | a medir |
| — | `fcd9f0a39b3e64d352e9e55df8d4b033814e65ee1c9ba299a5ef9d5e31829c29` | 15,05 GiB | 575 MiB | a medir |
| — | `166ffce34fd49a69076a31cc5c7eb23584b47c153f744936e240f871144990be` | 18,00 GiB | 1,22 GiB | a medir |
| — | `574482778792874721df6f4461490efbc7bbc6dfb833184f20e77ecd61e68270` | 19,43 GiB | 1,75 GiB | a medir |
| `amostra_50M.csv` | `db32e48a61c59884c1ce4c28f12feee426d361982e2491fbaaf7cb4e75a501dd` | 24,08 GiB | 366 MiB | ~550 s (~9,2 min) |

### Tempos de envio + processamento (referência)

Valores **aproximados** na coluna **Tempo** aplicam-se às entradas com rótulo `amostra_*` usadas no gráfico **«Tempo envio + processamento — lotes concluídos»** do dashboard (somatório upload + processamento; lotes antigos podem estar **estimados** por regressão). Dependem de rede, CPU, disco e carga do servidor.

Os **seis pacotes** sem rótulo `amostra_*` na parte inferior da tabela (SHA `0e3e95ee…` até `57448277…`) são **amostras adicionais** para testes de escala e acompanhamento de processamento em localhost; os tempos **a medir** devem ser registados após corridas no teu ambiente e, se fizer sentido, integrados no gráfico com novos rótulos.

O rótulo **ficheiro** (`amostra_100k.csv`, etc.) é convencional nos relatórios; dentro do `.zip` vêm sobretudo `.cdf` Contradef (não um `.csv` com esse nome). Se no dashboard o `sampleName` do lote for diferente, use sempre o **SHA-256** como identificador do pacote.

---

## Opção 1 — Google Drive (espelho estável — preferível se LFS falhar)

Espelho dos mesmos `.zip` (nome = SHA-256). Use esta opção se o `git lfs pull` for **lento, instável ou esgotar a quota**.

[Abrir / descarregar no Google Drive](https://drive.google.com/drive/folders/1FJOeVxw23scx84wSle-e5d1UssIqq8gV?usp=drive_link)

URL: `https://drive.google.com/drive/folders/1FJOeVxw23scx84wSle-e5d1UssIqq8gV?usp=drive_link`

Coloque os ficheiros descarregados em `test-samples/` (substituindo pointers LFS de ~130 bytes, se existirem).

---

## Opção 2 — FSF (Git LFS no repositório)

**FSF** = amostras pela **fonte versionada** com LFS (`test-samples/*.zip`).

Na raiz do repo (pasta que contém `fluxtrace_web/` e `test-samples/`):

```bash
git lfs install
git clone https://github.com/fluxtrace/fluxtrace.git
cd fluxtrace
git lfs pull
```

Quota LFS no GitHub (plano gratuito ~1 GiB); volumes maiores ou falhas de rede: use o **Google Drive** (Opção 1).

| Opção | Quando usar |
|-------|-------------|
| **1 — Google Drive** | Download estável dos `.zip` (recomendado na avaliação CTA se o LFS falhar) |
| **2 — FSF (Git LFS)** | Clone do repositório com os `.zip` em `test-samples/` |

---

## Contribuir (adicionar ou atualizar amostras)

```bash
git lfs install
git add test-samples/
git commit -m "test-samples: …"
git push
```

Ao acrescentar pacotes, actualize **esta tabela** (SHA-256, tamanho de `TraceInstructions.cdf`, tamanho do `.zip` e, quando existir, tempo de referência).

---

## Resultados após redução

### Artefactos gerados (`resultados/artefatos/`)

Saídas **reais** da ferramenta por lote concluído:

- `reports/reduced-logs.json` — logs reduzidos
- `reports/final-report.md` — veredito / relatório
- `reports/flow-graph.json` — grafo consolidado
- `reports/malware-flow-map.md` — diagrama **Mermaid**

Exportação a partir do disco local: `cd fluxtrace_web && npx tsx backend/scripts/export-batch-artifacts.mts`

Ver [`resultados/artefatos/README.md`](resultados/artefatos/README.md).

### Upload multipart (`reduce-logs/` — staging)

A pasta `test-samples/reduce-logs/` (se existir localmente) espelha **uploads temporários**, não os logs reduzidos. Ver [`reduce-logs/README.md`](reduce-logs/README.md).

```text
test-samples/
├── *.zip              ← amostras Contradef de entrada
└── reduce-logs/       ← opcional: cópias de upload (staging), não substituem artefatos/
resultados/artefatos/  ← evidências pós-processamento (versionar)
```
