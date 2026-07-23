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

## Referência

Instruções de reprodução: secção **Experimentos** em [`README.md`](../README.md).  
Artefactos exportados: [`artefatos/README.md`](artefatos/README.md).
