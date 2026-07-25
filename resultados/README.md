# Resultados experimentais

Pasta alinhada ao padrão de artefatos SBSEG (ex.: [TOMWare-DBI/TOMWare](https://github.com/TOMWare-DBI/TOMWare) → `Resultados/`).

## Conteúdo

| Subpasta | Descrição |
|----------|-----------|
| [`capturas-tela/`](capturas-tela/) | Capturas de ecrã dos experimentos (Sec. **4** do artigo) |
| [`artefatos/`](artefatos/) | Saídas exportadas da ferramenta (JSON, MD, Mermaid) por SHA-256 |

## Mapeamento captura → reivindicação

| Ficheiro | Reivindicação / uso |
|----------|---------------------|
| `fluxtrace_00.png` | Visão geral do pipeline (landing) |
| `fluxtrace_01.png` | Registo de conta |
| `fluxtrace_02.png` | Login local *(anonimizar e-mail em versão cega)* |
| `fluxtrace_03.png` | Dashboard agregado: lotes, estados e gráfico de tempos (Fig. 5) |
| `fluxtrace_04.png` | Submissão de lote grande (`0e3e95ee…`) |
| `fluxtrace_05.png` | Upload multipart (40%, 575 MB) |
| `fluxtrace_06.png` | Acompanhamento multi-GB (`49aa7438…`, 15 GB, 6 ficheiros) |
| `fluxtrace_07.png` | Interpretação: redução 99,7%, **329 603** linhas, **Trojan** (`49aa7438…`) |
| `fluxtrace_08.png` | Funções mapeadas (M1) |
| `fluxtrace_09.png` | Diagrama M1 anti-debug |
| `fluxtrace_10.png` | Grafo compacto 32→5 nós (**Backdoor**, lote `db32e48a…`) |
| `fluxtrace_11.png` | Evidência em log reduzido |
| `fluxtrace-arquitetura.png` | Diagrama funcional do pipeline (ingestão → redução → visualização) |

## Lotes processados — métricas reais (Sec. 4 do artigo)

Valores extraídos dos registos da ferramenta (PostgreSQL, `analysisInsights.summaryJson`) para os **15 lotes concluídos** no período dos experimentos; o 16.º lote (`fcd9f0a3…`) estava em processamento. Ordenação por volume bruto.

| SHA-256 (prefixo) | Arq. | Bruto (GB) | Linhas (mi) | Reduzido (MB) | Linhas mantidas (mil) | Redução (%) | Veredito |
|-------------------|------|------------|-------------|----------------|------------------------|-------------|----------|
| `db32e48a` | 6 | 27,94 | 164,56 | 40,5 | 230,1 | 99,86 | Backdoor |
| `166ffce3` | 6 | 24,20 | 164,64 | 8,6 | 48,7 | 99,97 | Backdoor |
| `57448277` | 6 | 20,86 | 101,85 | 103,2 | 537,2 | 99,47 | Trojan |
| `49aa7438` | 6 | 19,71 | 120,88 | 59,4 | 329,6 | 99,73 | Trojan |
| `a50581cd` | 6 | 14,77 | 106,37 | 46,5 | 258,8 | 99,76 | Backdoor |
| `1693df9d` | 6 | 12,65 | 71,03 | 80,9 | 468,1 | 99,34 | Trojan |
| `0e3e95ee` | 6 | 10,24 | 65,31 | 17,9 | 101,3 | 99,84 | Trojan |
| `66ebbc7d` | 6 | 5,58 | 33,71 | 75,5 | 418,9 | 98,76 | Trojan |
| `17c79863` | 6 | 5,53 | 33,40 | 71,3 | 395,0 | 98,82 | Trojan |
| `7de3df7d` | 6 | 3,37 | 17,83 | 61,6 | 193,4 | 98,92 | Backdoor |
| `1db3df87` | 6 | 2,78 | 15,37 | 80,8 | 294,8 | 98,08 | Backdoor |
| *(piloto, sem SHA)* | 5 | 0,88 | 8,70 | 1,1 | 11,8 | 99,86 | Trojan |
| `6e89b763` | 6 | 0,82 | 4,83 | 6,7 | 38,6 | 99,20 | Backdoor |
| `b640c53e` | 2 | 0,43 | 2,41 | 5,4 | 30,6 | 98,73 | Backdoor |
| `a0aeb837` | 6 | 0,39 | 2,20 | 6,5 | 36,1 | 98,36 | Trojan |
| **Total (15 lotes)** | | **150,1** | **913,1** | **666** | **3 393** | **99,56** | |

### Redução por arquivo — lote de referência `49aa7438…` (batch `ctr-JD-QvLcmsO`)

| Arquivo (tipo) | Linhas brutas | Linhas mantidas | Bruto | Reduzido | Tempo |
|----------------|---------------|------------------|-------|----------|-------|
| FunctionInterceptor | 1 925 | 1 548 | 54 KB | 52 KB | <1 s |
| TraceFcnCall.M1 | 11 | 11 | 0,8 KB | 0,8 KB | <1 s |
| TraceFcnCall.M2 | 25 | 18 | 1,8 KB | 1,3 KB | <1 s |
| TraceDisassembly | 265 859 | 5 | 8,3 MB | 166 B | 3 s |
| TraceMemory | 32 212 428 | 203 | 3,56 GB | 23 KB | 263 s |
| TraceInstructions | 88 400 552 | 327 818 | 16,14 GB | 59,28 MB | 1 100 s |
| **Total do lote** | **120 880 800** | **329 603** | **19,71 GB** | **59,35 MB** | |

Os relatórios e logs reduzidos correspondentes estão em [`artefatos/`](artefatos/), por SHA-256.

## Referência

Instruções de reprodução: secção **Experimentos** em [`README.md`](../README.md).  
Artefactos exportados: [`artefatos/README.md`](artefatos/README.md).
