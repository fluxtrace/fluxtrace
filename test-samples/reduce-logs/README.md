# Resultados após upload e redução (FluxTrace)

Pacotes **arquivados** gerados após submissão e processamento na ferramenta FluxTrace (evidências experimentais). Cada subpasta corresponde ao **SHA-256** da amostra de entrada (mesmo identificador dos `.zip` em `test-samples/`).

## Conteúdo versionado

| SHA-256 (amostra) | Ficheiro | Tamanho (≈) | Notas |
| ----------------- | -------- | ----------- | ----- |
| `49aa74387680de248f21af321c6721c305a29a071279b5526627921daa812e42` | `1779726364330-1e17TVYX-49aa74387680de248f21af321c6721c305a29a071279b5526627921daa812e42.zip` | 1,52 GiB | Lote stress (~15 GiB `TraceInstructions`) |
| `fcd9f0a39b3e64d352e9e55df8d4b033814e65ee1c9ba299a5ef9d5e31829c29` | `1784471053266--T4vGSTL-fcd9f0a39b3e64d352e9e55df8d4b033814e65ee1c9ba299a5ef9d5e31829c29.zip` | 575 MiB | Upload multipart documentado nas capturas |

Subpastas com **apenas o nome SHA** e sem `.zip` reservam espaço para resultados adicionais da mesma amostra (exportar da UI ou copiar do diretório de trabalho do servidor após lote concluído).

## Git LFS

Ficheiros `.zip` nesta árvore usam **Git LFS** (ver `.gitattributes`: `test-samples/**/*.zip`).

```bash
git lfs install
git lfs pull
```

Volume total desta pasta pode exceder a quota LFS gratuita do GitHub (~1 GiB). Se `git lfs pull` falhar, use o espelho em [`../README.md`](../README.md) (Google Drive) ou contacte os autores.

## Relação com capturas de ecrã

| Evidência visual | Amostra relacionada |
| ---------------- | ------------------- |
| `resultados/capturas-tela/fluxtrace_05.png` | `fcd9f0a3…` (upload 575 MB) |
| `resultados/capturas-tela/fluxtrace_06.png` | `49aa7438…` (lote 15 GB) |
| `resultados/capturas-tela/fluxtrace_07.png` | Interpretação após redução |

## Adicionar novos resultados

1. Concluir lote na UI (**Reduzir logs** → **Interpretação consolidada**).
2. Exportar ou copiar o pacote de saída para `test-samples/reduce-logs/<SHA-256>/`.
3. Actualizar esta tabela e fazer commit + `git lfs push origin main`.
