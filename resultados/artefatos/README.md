# Artefactos gerados pela ferramenta (FluxTrace)

Saídas **reais** após redução e correlação: relatórios, logs reduzidos (JSON), grafo de fluxo e diagramas Mermaid.

## Onde a ferramenta grava (antes de exportar)

| Local | Conteúdo | Versionar? |
|-------|----------|------------|
| **`CONTRADEF_REDUCE_LOGS_TMP`** (ex.: `F:/contradef-tmp/reduce-logs/<SHA>/`) | Upload multipart **em curso** (cópia do `.zip` enviado) | **Não** — staging temporário |
| **`CONTRADEF_WORK_TMP`** (ex.: `F:/contradef-tmp/analysis/<SHA>/`) | Extração temporária do arquivo durante processamento | **Não** — trabalho intermédio |
| **`CONTRADEF_WORK_TMP/<batchId>/artifacts/`** (ex.: `F:/contradef-tmp/analysis/ctr-JD-QvLcmsO/artifacts/`) | **Resultados do lote** | **Sim** — exportar para esta pasta |

### Ficheiros gerados por lote (`artifacts/reports/`)

| Ficheiro | Descrição |
|----------|-----------|
| `reduced-logs.json` | Logs **reduzidos** (linhas filtradas, metadados por ficheiro `.cdf`) |
| `final-report.md` | Relatório / veredito técnico (Markdown) |
| `flow-graph.json` | Grafo consolidado (nós, arestas, fases) |
| `malware-flow-map.md` | Mapa mental / **Mermaid** do fluxo de malware |

Com `CONTRADEF_DISCARD_ORIGINAL_LOGS_AFTER_SUCCESS=1` (recomendado em dev), os logs **brutos** em `artifacts/source/` **não** são mantidos após sucesso.

Metadados do lote (métricas, classificação) ficam também na base **PostgreSQL** (`analysisBatches.summaryJson`).

## Estrutura versionada neste repositório

```text
resultados/artefatos/
└── <SHA-256 da amostra>/     ← ou ctr-… se SHA desconhecido
    ├── manifest.json         ← batchId, sampleName, data de exportação
    └── reports/
        ├── reduced-logs.json
        ├── final-report.md
        ├── flow-graph.json
        └── malware-flow-map.md
```

## Exportar da máquina local para o Git

Com PostgreSQL e lotes concluídos em `F:/contradef-tmp/analysis/`:

```bash
cd fluxtrace_web
npx tsx backend/scripts/export-batch-artifacts.mts
```

Um lote específico:

```bash
npx tsx backend/scripts/export-batch-artifacts.mts ctr-JD-QvLcmsO
```

Depois:

```bash
git add resultados/artefatos/
git lfs push origin main   # reduced-logs.json grandes
git push origin main
```

## Exportações adicionais na UI (browser)

Na **Interpretação consolidada**, o analista pode descarregar (não ficam automaticamente no disco do servidor):

- Excel da análise / fluxo
- JSON do grafo / resumo
- Links Mermaid Live (diagrama dirigido e mindmap)
- XLSX comparativo MITRE Flux×VT (quando aplicável)

Para evidência no artigo, exporte pela UI ou copie de `artifacts/reports/`.

## Lote de referência (artigo)

| batchId | SHA-256 | Notas |
|---------|---------|-------|
| `ctr-JD-QvLcmsO` | `49aa7438…` | Redução ~99,7%, Trojan/critical (captura `fluxtrace_07`) |

## Git LFS

`reduced-logs.json` pode ter dezenas ou centenas de MB por lote. Ver `.gitattributes` (`resultados/artefatos/**/reduced-logs.json`).
