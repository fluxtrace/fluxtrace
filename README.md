# FluxTrace: Uma Ferramenta Baseada em Logs para Análise de Comportamentos Evasivos

## Resumo

O **FluxTrace** é uma aplicação web (*full-stack*: React + Node.js/Express + PostgreSQL) para **correlação**, **redução heurística de logs**, **visualização de fluxo** e **fluxos de trabalho do analista** sobre rastros gerados pelo pipeline de instrumentação **[Contradef](https://github.com/contradef)** (`*.cdf`, lotes `.zip`). O artefato complementa a pintool Contradef: a Contradef **gera** rastros em ambiente controlado; o FluxTrace **ingere, reduz, persiste e explora** esses dados via interface web, APIs REST/tRPC e exportações (Excel, JSON, Mermaid).

Este repositório contém o código-fonte da ferramenta, **16 pacotes de amostras** Contradef em `test-samples/`, documentação de **47 funções mapeadas (M1)** em `funcoes-mapeadas/`, capturas de evidência experimental em `resultados/capturas-tela/` e instruções para reproduzir as principais reivindicações do artigo *FluxTrace: Uma Ferramenta Baseada em Logs para Análise de Comportamentos Evasivos* (SBSeg 2026 / Salão de Ferramentas).

**Repositório:** [github.com/fluxtrace/fluxtrace](https://github.com/fluxtrace/fluxtrace)

---

## Sumário

- [Estrutura do readme.md](#estrutura-do-readmemd)
- [Selos considerados](#selos-considerados)
- [Informações básicas](#informações-básicas)
- [Dependências](#dependências)
- [Preocupações com segurança](#preocupações-com-segurança)
- [Instalação](#instalação)
- [Teste mínimo](#teste-mínimo)
- [Experimentos](#experimentos)
- [LICENSE](#license)
- [Documentação complementar](#documentação-complementar)

---

## Estrutura do readme.md

Este README segue o [modelo obrigatório do CTA SBSeg 2026](https://doc-artefatos.github.io/sbseg2026/subinstrucoes.html) e organiza-se em:

1. **Resumo** — objetivo do artefato e ligação ao artigo.
2. **Estrutura do readme.md** — mapa deste documento e do repositório.
3. **Selos considerados** — selos pleiteados na avaliação (D, F, S, R).
4. **Informações básicas** — componentes, arquitetura e ambiente de execução.
5. **Dependências** — software, versões e recursos externos.
6. **Preocupações com segurança** — riscos e mitigação para avaliadores.
7. **Instalação** — clone, configuração e arranque da aplicação.
8. **Teste mínimo** — validação rápida (automática + fluxo na interface).
9. **Experimentos** — reprodução das reivindicações do artigo.
10. **LICENSE** — termos de uso do código.

### Estrutura do repositório

```text
fluxtrace/
├── README.md                       ← este ficheiro (artefato CTA / SF)
├── README.en.md                    ← versão em inglês (referência)
├── LICENSE                         ← MIT
├── fluxtrace_web/                  ← aplicação web (pnpm: frontend + backend)
│   ├── frontend/                   ← React 19, Vite 7, SPA
│   ├── backend/                    ← Express, tRPC, Drizzle, serviços
│   ├── docs/                       ← MANUAL-DEV-LOCAL, MANUAL-TECNICO, MANUAL-USUARIO
│   ├── package.json
│   ├── readme-web.md               ← referência operacional do pacote
│   └── .env                        ← não versionado (copiar de backend/.env.example)
├── test-samples/                   ← 16 pacotes .zip Contradef (+ README, Git LFS)
├── funcoes-mapeadas/               ← catálogo M1 (47 funções, fluxos, xlsx)
├── resultados/
│   └── capturas-tela/              ← evidências visuais dos experimentos (Sec. 5)
├── render.yaml                     ← blueprint opcional (Render.com)
├── package.json                    ← atalhos pnpm na raiz
└── .gitattributes                  ← Git LFS para .zip grandes
```

| Pasta / ficheiro | Papel |
|------------------|--------|
| `fluxtrace_web/` | Código principal da ferramenta |
| `test-samples/` | Dados de entrada para testes e experimentos |
| `funcoes-mapeadas/` | Documentação correlacionada ao escopo M1 da Contradef |
| `resultados/capturas-tela/` | Capturas referenciadas no artigo e neste README |
| `fluxtrace_web/docs/` | Manuais detalhados (PT) para instalador, técnico e utilizador |

---

## Selos considerados

Os autores solicitam a avaliação do artefato para **todos os selos disponíveis** no processo CTA SBSeg 2026:

| Selo | Nome | Justificativa no FluxTrace |
|------|------|----------------------------|
| **Selo D** | Artefatos Disponíveis | Código-fonte, amostras (`test-samples/`), documentação M1 e capturas públicas em [github.com/fluxtrace/fluxtrace](https://github.com/fluxtrace/fluxtrace), com README completo e licença MIT. |
| **Selo F** | Artefatos Funcionais | Instalação documentada (`pnpm install`, PostgreSQL, `pnpm dev`); **teste mínimo** automatizado (`pnpm check`, `pnpm test`) e **fluxo UI** (upload de amostra → redução → interpretação). |
| **Selo S** | Artefatos Sustentáveis | Código modular (`frontend/`, `backend/services/`, testes Vitest); manuais PT (`MANUAL-TECNICO`, `MANUAL-USUARIO`, `readme-web.md`); catálogo `funcoes-mapeadas/` com hiperligações por função. |
| **Selo R** | Experimentos Reprodutíveis | Secção [Experimentos](#experimentos) com SHA-256 das amostras, passos na UI, tempos de referência, resultados esperados e capturas em `resultados/capturas-tela/`. |

> **Apêndice LaTeX (HotCRP):** chaves opcionais (`VIRUSTOTAL_API_KEY`, LLM) e credenciais privadas devem ser declaradas no apêndice do CTA, não neste README. Modelo: [Exemplo-Apendice](https://doc-artefatos.github.io/sbseg2026/subinstrucoes.html).

> **Salão de Ferramentas (SF) 2026:** modalidade **Código Aberto** — incluir URL do **vídeo técnico** na submissão SF (instalação + demonstração). Placeholder sugerido no README: secção [Vídeo técnico (SF)](#vídeo-técnico-sf).

---

## Informações básicas

### Relação com a Contradef

| Projeto | Função |
|---------|--------|
| [**Contradef**](https://github.com/contradef) | DBI (Intel Pin): gera rastros `*.cdf` em VM Windows isolada. |
| **FluxTrace** (este repo) | Plataforma web: upload, redução heurística, dashboards, interpretação consolidada, grafo de fluxo, funções M1, exportações e enriquecimento opcional VT/MITRE. |

### Capacidades principais

- **Lotes de análise** — submissão multipart, fila, estados (`queued`, `running`, `completed`), métricas de tempo.
- **Redução heurística** — preservação de APIs sensíveis, gatilhos e contexto mínimo (janelas 4+4, cabeçalhos).
- **Interpretação consolidada** — categoria, risco, APIs suspeitas, veredito técnico (LLM opcional ou resumo determinístico).
- **Fluxo de malware compacto** — grafo reduzido por fases (evasão, execução, persistência).
- **Funções mapeadas (M1)** — planilha e diagramas das 47 funções interceptadas.
- **Integrações opcionais** — VirusTotal v3, MITRE TA0005, export XLSX comparativo Flux×VT.

### Arquitetura

```mermaid
flowchart LR
  subgraph browser[Navegador React SPA]
    UI[FluxTrace UI]
  end
  subgraph node[Node.js Express + Vite]
    API[tRPC + REST]
  end
  DB[(PostgreSQL)]
  UI --> API
  API --> DB
```

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19, Vite 7, TanStack Query, tRPC, Tailwind |
| Backend | Node.js, Express, tRPC, Drizzle ORM |
| Persistência | PostgreSQL 14+ |
| Empacotamento | pnpm (Corepack), TypeScript |

### Ambiente de execução recomendado

| Item | Especificação |
|------|----------------|
| **SO** | Windows 10/11, Linux ou macOS |
| **CPU / RAM** | ≥ 4 núcleos; **≥ 8 GB RAM** (16 GB recomendado para amostras multi‑GB) |
| **Disco** | ≥ **20 GB livres** para clones + amostras médias; lotes stress (15 GB+) exigem mais |
| **Node.js** | **20 LTS** ou **22** |
| **PostgreSQL** | **14+** (local, Docker ou hospedado) |
| **Browser** | Chrome, Edge ou Firefox recente |
| **Ambiente dos experimentos do artigo** | Windows 11 x64, Intel Core i7-1165G7, 16 GB RAM |

### Modo de execução

- **Desenvolvimento:** `pnpm dev` — um processo serve API + Vite na mesma origem (tipicamente `http://localhost:3000/`).
- **Produção:** `pnpm build` + `pnpm start` (ver `render.yaml` e `fluxtrace_web/readme-web.md`).

---

## Dependências

| Dependência | Versão / notas |
|-------------|----------------|
| **Git** | Qualquer versão recente |
| **Git LFS** | Recomendado para `test-samples/*.zip` ([git-lfs.com](https://git-lfs.com/)) |
| **Node.js** | 20 LTS ou 22 |
| **Corepack + pnpm** | `corepack enable`; versão fixada em `fluxtrace_web/package.json` |
| **PostgreSQL** | 14+; variável `DATABASE_URL` |
| **7-Zip** | Via npm `7zip-bin` (pós-`pnpm install`) |
| **Docker** | Opcional — contentor Postgres (ver `MANUAL-DEV-LOCAL.md`) |

### Dependências opcionais (experimento completo)

| Recurso | Uso | Obrigatório? |
|---------|-----|--------------|
| `VIRUSTOTAL_API_KEY` | Aba VirusTotal na interpretação consolidada | Não |
| `CONTRADEF_LLM_*` / OpenAI | Veredito técnico via LLM | Não (há resumo determinístico) |
| Google Drive (espelho) | Amostras se LFS não couber na quota | Alternativa a `git lfs pull` |

### Amostras de teste

Inventário completo: [`test-samples/README.md`](test-samples/README.md) — **16** pacotes `.zip`, SHA-256 = nome do ficheiro.

| Rótulo | SHA-256 (`.zip`) | Tamanho `.zip` (≈) | Tempo ref. |
|--------|------------------|---------------------|------------|
| `amostra_100k` | `a0aeb837cb5e762fc0b7d657c71d343e765cccb5780cd315756f682418b3cdfe` | 24 MiB | ~50 s |
| `amostra_1M` | `1db3df87facac7ad4bf2fc7f9c49392f6f1cd69ce3d5db0d7b1a23074ad0dd69` | 164 MiB | ~25 s |
| `amostra_50M` | `db32e48a61c59884c1ce4c28f12feee426d361982e2491fbaaf7cb4e75a501dd` | 366 MiB | ~9 min |

Espelho Google Drive: link em `test-samples/README.md`.

---

## Preocupações com segurança

### Riscos para avaliadores

| Risco | Descrição |
|-------|-----------|
| **Malware em amostras** | Pacotes `.zip` contêm rastros de binários maliciosos **já executados** na Contradef. Tratar uploads como **não confiáveis**. |
| **Segredos** | Nunca commitar `.env`; proteger `JWT_SECRET`, `DATABASE_URL`, `VIRUSTOTAL_API_KEY`. |
| **Auth indevida** | `AUTH_MODE=none` só em desenvolvimento isolado. |
| **Esgotamento de disco** | Lotes multi‑GB podem encher disco temporário (`CONTRADEF_*` no `.env.example`). |

### Medidas recomendadas

1. Executar o FluxTrace em **VM ou host dedicado**, não na máquina pessoal principal.
2. **Não** reexecutar malware — usar apenas os `.zip` pré-coletados em `test-samples/`.
3. Restringir egress de rede se não precisar de VT/LLM externos.
4. Usar `AUTH_MODE=local` com credenciais fortes em qualquer exposição à rede.
5. Anonimizar capturas de ecrã se contiverem e-mail ou dados sensíveis (`fluxtrace_02.png`).

### Isenção de responsabilidade

Software **as-is** para pesquisa e operações de segurança autorizadas. VirusTotal, Intel Pin (via Contradef) e outros terceiros têm os seus próprios termos de uso.

---

## Instalação

> **Guia ilustrado (máquina limpa):** [`fluxtrace_web/docs/MANUAL-DEV-LOCAL.md`](fluxtrace_web/docs/MANUAL-DEV-LOCAL.md)

### 1. Clonar o repositório

```bash
git lfs install
git clone https://github.com/fluxtrace/fluxtrace.git
cd fluxtrace
git lfs pull
```

Se algum `.zip` aparecer como pointer LFS (~130 bytes), use o [Google Drive](test-samples/README.md) ou `git lfs pull` com quota disponível.

### 2. Instalar dependências Node

```bash
corepack enable
cd fluxtrace_web
pnpm install
```

### 3. Configurar ambiente

```bash
cp backend/.env.example .env
```

Edite `fluxtrace_web/.env` — **mínimo obrigatório:**

```env
DATABASE_URL=postgresql://SEU-USUARIO:SUA_SENHA@127.0.0.1:5432/fluxtrace_dev
JWT_SECRET=uma-string-longa-e-aleatoria
AUTH_MODE=local
VITE_AUTH_MODE=local
DEFAULT_LOCAL_ADMIN_EMAIL=seu-email@exemplo.org
DEFAULT_LOCAL_ADMIN_PASSWORD=SuaSenhaSegura
```

**Recomendado** (funções M1 — caminho absoluto à pasta na raiz do clone):

```env
FUNCOES_MAPEADAS=/caminho/absoluto/para/fluxtrace/funcoes-mapeadas
```

> No Windows use barras `/`, ex.: `FUNCOES_MAPEADAS=D:/MMB/DBI/fluxtrace/funcoes-mapeadas`. Se omitido, o servidor tenta `../funcoes-mapeadas` relativo a `fluxtrace_web/`.

### 4. Criar esquema da base de dados

```bash
pnpm db:push
```

### 5. Arrancar a aplicação

```bash
pnpm dev
```

Abra o URL indicado no terminal (em geral **`http://localhost:3000/`**).

**Atalhos a partir da raiz do repo:**

```bash
pnpm --dir fluxtrace_web install
pnpm --dir fluxtrace_web db:push
pnpm dev
```

---

## Teste mínimo

O teste mínimo tem **duas partes**: validação do toolchain e demonstração funcional na interface.

### Parte A — Toolchain (≈ 2 min)

Com PostgreSQL a correr e `.env` configurado:

```bash
cd fluxtrace_web
pnpm check
pnpm test
```

**Resultado esperado:** ambos terminam com código 0 (typecheck + testes Vitest frontend/backend).

Opcional:

```bash
pnpm build
```

### Parte B — Fluxo funcional na UI (≈ 3–5 min)

1. Com `pnpm dev` activo, abra **`http://localhost:3000/`**.
2. **Registar** (`/register`) ou **entrar** (`/login`) com as credenciais do `.env`.
3. Aceda a **Reduzir logs** (`/reduce-logs`).
4. Submeta a amostra pequena:
   - **SHA-256:** `a0aeb837cb5e762fc0b7d657c71d343e765cccb5780cd315756f682418b3cdfe`
   - **Ficheiro:** `test-samples/a0aeb837cb5e762fc0b7d657c71d343e765cccb5780cd315756f682418b3cdfe.zip`
   - **Nome de validação:** `teste-minimo-cta`
5. Aguarde estado **concluído** (≈ **50 s** em hardware de referência; depende de CPU/disco).
6. Abra **Interpretação consolidada** — confirme cartões de redução, APIs e painéis carregados.
7. Abra **Funções mapeadas** (`/funcoes-mapeadas`) — confirme planilha M1 (requer `funcoes-mapeadas/` acessível).

**Resultado esperado:** lote concluído sem erro; dashboard actualizado; interpretação e funções mapeadas visíveis.

**Capturas de referência:** `resultados/capturas-tela/fluxtrace_04.png` (submissão), `fluxtrace_07.png` (interpretação).

---

## Experimentos

Esta secção reproduz as **quatro métricas** do artigo (Sec. 5.2): **(i)** tempo de processamento; **(ii)** redução de volume; **(iii)** eventos correlacionados; **(iv)** eventos críticos / evasão.

> **Nota:** tempos são **aproximados** (CPU i7-1165G7, 16 GB RAM, SSD). Lotes multi‑GB podem levar horas — use amostras menores primeiro.

### Pré-requisitos comuns

- Instalação concluída ([Instalação](#instalação)).
- Servidor `pnpm dev` em execução.
- Conta autenticada (`AUTH_MODE=local`).
- Amostras disponíveis em `test-samples/` (LFS ou Drive).

---

### Reivindicação 1 — Redução heurística de logs (métrica ii)

**Objetivo:** demonstrar redução superior a **90%** do volume mantendo linhas críticas para análise.

| Campo | Valor |
|-------|--------|
| **Amostra** | `db32e48a61c59884c1ce4c28f12feee426d361982e2491fbaaf7cb4e75a501dd.zip` (`amostra_50M`) |
| **Recursos** | ≈ 366 MiB upload; ≈ 2–4 GB RAM; ≈ 10 min CPU |
| **Captura** | `resultados/capturas-tela/fluxtrace_07.png` |

**Passos:**

1. `/reduce-logs` → SHA `db32e48a…` → enviar o `.zip` → nome `exp-reducao-50M`.
2. Monitorizar progresso por ficheiro (colunas Antes / Reduz.).
3. Após **concluído**, abrir **Interpretação consolidada** do lote.

**Resultado esperado (referência experimental):**

- Redução **≥ 99%** (valor observado: **99,7%**).
- **≈ 329 603** linhas preservadas (ordem de grandeza; varia ligeiramente por versão).
- APIs sensíveis e gatilhos visíveis nos cartões.

---

### Reivindicação 2 — Tempo de processamento e escala (métrica i)

**Objetivo:** mostrar variabilidade de tempo conforme volume e acompanhamento assíncrono.

| Campo | Valor |
|-------|--------|
| **Amostra rápida** | `a0aeb837…` — ≈ 50 s |
| **Amostra média** | `1db3df87…` — ≈ 25 s |
| **Amostra stress** | `fcd9f0a39b3e64d352e9e55df8d4b033814e65ee1c9ba299a5ef9d5e31829c29.zip` (575 MiB) ou `49aa7438…` (15 GB) |
| **Capturas** | `fluxtrace_05.png`, `fluxtrace_06.png` |

**Passos:**

1. Submeter `a0aeb837…` e registar tempo total (dashboard ou UI do lote).
2. Submeter `fcd9f0a3…` (ou pacote 15 GB se houver disco/tempo) e observar **upload multipart** + ETA por ficheiro.
3. Consultar **dashboard** (`/`) — gráfico «Tempo envio + processamento».

**Resultado esperado:**

- Amostras pequenas concluem em **dezenas de segundos a poucos minutos**.
- Lotes multi‑GB mostram progresso contínuo (%, linhas/s, ETA) sem bloquear a UI.
- Dashboard agrega tempos dos lotes concluídos.

---

### Reivindicação 3 — Correlação e grafo compacto (métrica iii)

**Objetivo:** compactar grafo extenso preservando fases comportamentais.

| Campo | Valor |
|-------|--------|
| **Amostra** | `db32e48a61c59884c1ce4c28f12feee426d361982e2491fbaaf7cb4e75a501dd` |
| **Rota** | `/funcoes-mapeadas/fluxo-malware` (seleccionar o lote concluído) |
| **Capturas** | `fluxtrace_10.png`, `fluxtrace_09.png`, `fluxtrace_11.png` |

**Passos:**

1. Após Reivindicação 1 concluída, abrir **Fluxo malware** para o mesmo lote.
2. Verificar contadores de nós/arestas antes e depois da compactação.
3. Abrir painel de **evidências** no log reduzido (`GetProcAddress`, etc.).

**Resultado esperado (referência):**

- Grafo: **32 → 5** nós, **58 → 4** arestas.
- Fases: *Evasão → Execução maliciosa → Persistência*.
- Veredito agregado compatível com **Backdoor** / resolução dinâmica de APIs.

---

### Reivindicação 4 — Detecção de comportamento evasivo (métrica iv)

**Objetivo:** destacar APIs sensíveis, gatilhos heurísticos e técnicas MITRE.

| Campo | Valor |
|-------|--------|
| **Amostra** | Mesmo lote da Reivindicação 1 (`db32e48a…`) ou lote com veredito **Trojan** |
| **Rota** | `/interpretacao-consolidada` |
| **Capturas** | `fluxtrace_07.png`, `fluxtrace_08.png` |

**Passos:**

1. Abrir interpretação consolidada do lote concluído.
2. Registar: **categoria**, **risco**, **APIs suspeitas**, **gatilhos**, **técnicas MITRE**.
3. Abrir **Funções mapeadas** — confirmar catálogo das **47** funções M1 com links para fluxos.

**Resultado esperado (referência experimental):**

| Indicador | Valor ref. |
|-----------|------------|
| Categoria | Trojan (ou equivalente evasivo) |
| Risco | Crítico |
| APIs suspeitas | 19 |
| Gatilhos heurísticos | 63 |
| Técnicas MITRE destacadas | 9 |
| Funções M1 documentadas | 47 |

Evidências típicas no veredito: `IsDebuggerPresent`, `CheckRemoteDebuggerPresent`, `Sleep`, `VirtualProtect` (RW→RX), `GetProcAddress`.

> **VirusTotal / LLM:** opcionais. Sem chaves, o veredito usa **resumo determinístico** — suficiente para SeloR das reivindicações de redução/correlação/evasão heurística.

---

### Tabela resumo dos experimentos

| Reivindicação | Amostra (SHA prefixo) | Tempo ref. | Evidência |
|---------------|------------------------|------------|-----------|
| Redução ≥ 99% | `db32e48a…` | ~9 min | `fluxtrace_07.png` |
| Tempo / escala | `a0aeb837…` / `fcd9f0a3…` | 50 s – horas | `fluxtrace_05–06.png` |
| Grafo compacto | `db32e48a…` | após lote | `fluxtrace_10.png` |
| Evasão / MITRE | `db32e48a…` | após lote | `fluxtrace_07–08.png` |

---

## LICENSE

Este projeto está licenciado sob a **MIT License** — ver ficheiro [`LICENSE`](LICENSE).

Dependências (React, Drizzle, Express, PostgreSQL driver, etc.) mantêm as suas licenças respectivas. Intel Pin (Contradef) e VirusTotal têm termos próprios.

---

## Documentação complementar

| Documento | Conteúdo |
|-----------|----------|
| [`README.en.md`](README.en.md) | Versão em inglês deste artefato |
| [`fluxtrace_web/readme-web.md`](fluxtrace_web/readme-web.md) | Rotas, env, deploy |
| [`fluxtrace_web/docs/MANUAL-DEV-LOCAL.md`](fluxtrace_web/docs/MANUAL-DEV-LOCAL.md) | Instalação passo a passo (PT) |
| [`fluxtrace_web/docs/MANUAL-TECNICO.md`](fluxtrace_web/docs/MANUAL-TECNICO.md) | Arquitetura e operação |
| [`fluxtrace_web/docs/MANUAL-USUARIO.md`](fluxtrace_web/docs/MANUAL-USUARIO.md) | Manual do utilizador |
| [`test-samples/README.md`](test-samples/README.md) | Inventário das 16 amostras |
| [`resultados/capturas-tela/`](resultados/capturas-tela/) | Capturas dos experimentos |

---

## Vídeo técnico (SF)

Para o **Salão de Ferramentas 2026** (modalidade Código Aberto), incluir na submissão um vídeo com:

1. Instalação em máquina limpa (clone → `pnpm install` → `.env` → `pnpm dev`).
2. Teste mínimo (Parte B).
3. Demonstração de redução, interpretação consolidada e grafo compacto.

**URL do vídeo:** *(preencher antes da submissão SF — YouTube não listado ou Google Drive)*

---

**Contradef (DBI):** [https://github.com/contradef](https://github.com/contradef)
