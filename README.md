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
- [Vídeos de demonstração (playlist)](#vídeos-de-demonstração-playlist)

---

## Estrutura do readme.md

Este README segue o [modelo obrigatório do CTA SBSeg 2026](https://doc-artefatos.github.io/sbseg2026/subinstrucoes.html) e organiza-se em:

1. **Resumo** — objetivo do artefato e ligação ao artigo.
2. **Estrutura do readme.md** — mapa deste documento e do repositório; **playlist de vídeos** (secção final, padrão [TOMWare](https://github.com/TOMWare-analises/TOMWare) §1.4).
3. **Selos considerados** — selos pleiteados na avaliação (D, F, S, R).
4. **Informações básicas** — componentes, arquitetura e ambiente de execução.
5. **Dependências** — software, versões, [pacote de instaladores (Drive)](#pacote-de-instaladores-google-drive) e espelho de amostras.
6. **Preocupações com segurança** — riscos e mitigação para avaliadores.
7. **Instalação** — clone, configuração e arranque da aplicação (vídeos **06–12**).
8. **Teste mínimo** — validação rápida (automática + fluxo na interface; vídeos **13–14**).
9. **Experimentos** — reprodução das reivindicações do artigo (vídeo **15** + capturas).
10. **LICENSE** — termos de uso do código.
11. **Vídeos de demonstração (playlist)** — download → instalação → configuração → execução → resultados.

### Estrutura do repositório

```text
fluxtrace/
├── README.md                       ← este ficheiro (artefato CTA / SF)
├── README.en.md                    ← versão em inglês (referência)
├── LICENSE                         ← MIT
├── fluxtrace_web/                  ← aplicação web (pnpm: frontend + backend)
│   ├── frontend/                   ← React 19, Vite 7, SPA
│   ├── backend/                    ← Express, tRPC, Drizzle, serviços
│   ├── docs/                       ← MANUAL-DEV-LOCAL, MANUAL-TECNICO, MANUAL-USUARIO, fluxtrace-arquitetura.png
│   ├── package.json
│   ├── readme-web.md               ← referência operacional do pacote
│   └── .env                        ← não versionado (copiar de backend/.env.example)
├── test-samples/                   ← 16 pacotes .zip Contradef (+ README, Git LFS)
├── funcoes-mapeadas/               ← catálogo M1 (47 funções, fluxos, xlsx)
├── resultados/
│   ├── capturas-tela/              ← evidências visuais (Sec. 4 do artigo)
│   └── artefatos/                  ← saídas da ferramenta (reports/, LFS)
├── render.yaml                     ← blueprint opcional (Render.com)
├── package.json                    ← atalhos pnpm na raiz
└── .gitattributes                  ← Git LFS para .zip grandes
```

| Pasta / ficheiro | Papel |
|------------------|--------|
| `fluxtrace_web/` | Código principal da ferramenta |
| `test-samples/` | Amostras Contradef de entrada (`.zip` na raiz) |
| `funcoes-mapeadas/` | Documentação correlacionada ao escopo M1 da Contradef |
| `resultados/capturas-tela/` | Capturas referenciadas no artigo e neste README |
| `resultados/artefatos/` | Relatórios, `reduced-logs.json`, grafo e Mermaid exportados da ferramenta |
| `fluxtrace_web/docs/` | Manuais detalhados (PT) para instalador, técnico e utilizador |

---

## Selos considerados

Os autores solicitam a avaliação do artefato para **todos os selos disponíveis** no processo CTA SBSeg 2026:

| Selo | Nome | Justificativa no FluxTrace |
|------|------|----------------------------|
| **Selo D** | Artefatos Disponíveis | Código-fonte, amostras (`test-samples/`), documentação M1 e capturas públicas em [github.com/fluxtrace/fluxtrace](https://github.com/fluxtrace/fluxtrace); pastas Drive [`instaladores`](https://drive.google.com/drive/folders/1XqR8_CynMEV7oGc8AC7jGSnmUv6JdSOg?usp=sharing), [`demonstracao`](https://drive.google.com/drive/folders/1PVQBnYi5gXSyhSvYnkqgdOvoj5xhCEZf?usp=sharing) e [`amostras`](https://drive.google.com/drive/folders/1FJOeVxw23scx84wSle-e5d1UssIqq8gV?usp=drive_link); licença MIT. |
| **Selo F** | Artefatos Funcionais | Dependências e [pacote de instaladores](#pacote-de-instaladores-google-drive); [Instalação](#instalação); **teste mínimo** (`pnpm check`, `pnpm test`) e **fluxo UI** (upload → redução → interpretação); playlist **01–15**. |
| **Selo S** | Artefatos Sustentáveis | Código modular (`frontend/`, `backend/services/`, testes Vitest); manuais PT (`MANUAL-TECNICO`, `MANUAL-USUARIO`, `readme-web.md`); catálogo `funcoes-mapeadas/` com hiperligações por função. |
| **Selo R** | Experimentos Reprodutíveis | Secção [Experimentos](#experimentos) com SHA-256, passos na UI, tempos de referência e capturas em `resultados/capturas-tela/`; playlist como demonstração do fluxo (não substitui os lotes stress do artigo). |

> **Apêndice LaTeX (HotCRP):** chaves opcionais (`VIRUSTOTAL_API_KEY`, LLM) e credenciais privadas devem ser declaradas no apêndice do CTA, não neste README. Modelo: [Exemplo-Apendice](https://doc-artefatos.github.io/sbseg2026/subinstrucoes.html).

> **Salão de Ferramentas (SF) 2026:** modalidade **Código Aberto** — URL da playlist = pasta Drive [`demonstracao`](https://drive.google.com/drive/folders/1PVQBnYi5gXSyhSvYnkqgdOvoj5xhCEZf?usp=sharing) (ver [Vídeos de demonstração (playlist)](#vídeos-de-demonstração-playlist)).

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

![FluxTrace — pipeline funcional: ingestão, processamento/redução e visualização](fluxtrace_web/docs/fluxtrace-arquitetura.png)

O FluxTrace organiza-se em **três fases** (ver diagrama acima):

| Fase | Módulos / saídas | Implementação na app web |
|------|-------------------|---------------------------|
| **1. Ingestão** | Analista submete logs Contradef (`.cdf` / `.zip`, multi‑GB); módulo de ingestão; logs filtrados | `/reduce-logs` — upload multipart, fila, estados do lote |
| **2. Processamento e redução** | Redutor heurístico (ex.: **99,7%** no lote `49aa7438…`); banco M1 (**47** APIs); agregador (`TraceFcnCall`, `TraceMemory`, `TraceInstructions`, `FunctionInterceptor`); engine de correlação | `backend/services/analysis/` — redução, heurísticas, correlação |
| **3. Visualização e saída** | Diagrama M1; grafo compacto (**32→5** nós, lote `db32e48a…`); painel de evidências; MITRE ATT&CK; interpretação consolidada e veredito | `/funcoes-mapeadas`, `/funcoes-mapeadas/fluxo-malware`, `/interpretacao-consolidada` |

#### Stack técnico (camadas de software)

| Camada | Tecnologia |
|--------|------------|
| **Cliente** | React 19, Vite 7, TanStack Query, tRPC, wouter, Tailwind 4, @xyflow/react |
| **Servidor** | Node.js 20/22, Express, tRPC (`/api/trpc`), REST (`/api/reduce-logs/*`), OAuth |
| **Persistência** | PostgreSQL 14+, Drizzle ORM |
| **Dados auxiliares** | `funcoes-mapeadas/` (M1), `test-samples/` |
| **Integrações opcionais** | VirusTotal v3, LLM, S3/Forge |
| **Empacotamento** | pnpm (Corepack), TypeScript |

Diagrama técnico detalhado (protocolos e pastas): [`fluxtrace_web/docs/MANUAL-TECNICO.md`](fluxtrace_web/docs/MANUAL-TECNICO.md).

### Ambiente de execução recomendado

| Item | Especificação |
|------|----------------|
| **SO** | Windows 10/11, Linux ou macOS |
| **CPU / RAM** | ≥ 4 núcleos; **≥ 8 GB RAM** (16 GB recomendado para amostras multi‑GB) |
| **Disco** | ≥ **20 GB livres** para clones + amostras médias; lotes stress (15 GB+) exigem mais |
| **Node.js** | **20 LTS** ou **22** |
| **PostgreSQL** | **14+** (local, Docker ou hospedado) |
| **Browser** | Chrome, Edge ou Firefox recente |
| **Ambiente dos experimentos do artigo** | Windows 11 x64 **25H2**, Intel Core **i5-1135G7** @ 2,42 GHz, 16 GB RAM |

### Modo de execução

- **Desenvolvimento:** `pnpm dev` — um processo serve API + Vite na mesma origem (tipicamente `http://localhost:3000/`).
- **Produção:** `pnpm build` + `pnpm start` (ver `render.yaml` e `fluxtrace_web/readme-web.md`).

---

## Dependências

| Dependência | Versão / notas |
|-------------|----------------|
| **Git** | Qualquer versão recente |
| **Git LFS** | Recomendado para `test-samples/*.zip` ([git-lfs.com](https://git-lfs.com/)) |
| **Node.js** | **20 LTS ou 22** (playlist usa Node.js **22** LTS) |
| **Corepack + pnpm** | `corepack enable`; versão fixada em `fluxtrace_web/package.json` |
| **PostgreSQL** | **14+** (playlist: instalador EDB **18**); variável `DATABASE_URL` |
| **Visual Studio Code** | Editor opcional (recomendado na playlist) |
| **7-Zip** | Via npm `7zip-bin` (pós-`pnpm install`) |
| **Docker** | Opcional — contentor Postgres (ver `MANUAL-DEV-LOCAL.md`) |

### Pacote de instaladores (Google Drive)

Espelho dos sites oficiais (Git, Node.js, Git LFS, EDB PostgreSQL, VS Code), no mesmo espírito da pasta `Instaladores` do [TOMWare](https://github.com/TOMWare-analises/TOMWare). Prefira as páginas oficiais quando possível; use o Drive para montar o ambiente mais rápido.

**Pasta:** [`instaladores`](https://drive.google.com/drive/folders/1XqR8_CynMEV7oGc8AC7jGSnmUv6JdSOg?usp=sharing)

| # | Arquivo (Drive) | O que é | Onde usar | Playlist / README |
|---|-----------------|---------|-----------|-------------------|
| 1 | `Git-*-64-bit.exe` | Git for Windows | Host | vídeos **01**, **06** · [Instalação](#instalação) |
| 2 | `git-lfs-windows-*.exe` | Git LFS | Host (após Git) | vídeos **03**, **06** · `test-samples/` |
| 3 | `node-v22.*-x64.msi` | Node.js 22 LTS | Host | vídeos **02**, **07** · `corepack enable pnpm` |
| 4 | `postgresql-*-windows-x64.exe` | PostgreSQL (EDB) | Host | vídeos **04**, **08** · `DATABASE_URL` |
| 5 | `VSCodeUserSetup-*.exe` | Visual Studio Code | Host (opcional) | vídeos **05**, **09** |

#### Sequência correta de instalação

Ordem alinhada à playlist (**06–12**) e a esta secção:

| Passo | Ação | Arquivo(s) / comando |
|------:|------|----------------------|
| 1 | Instalar **Git** + **Git LFS** | `Git-*-64-bit.exe`, `git-lfs-windows-*.exe` → `git lfs install` |
| 2 | Instalar **Node.js 22** + activar pnpm | `node-v22.*-x64.msi` → `corepack enable` / `corepack enable pnpm` |
| 3 | Instalar **PostgreSQL** e criar BD | instalador EDB → serviço a correr; base p.ex. `fluxtrace_dev` |
| 4 | (Opcional) Instalar **VS Code** | `VSCodeUserSetup-*.exe` |
| 5 | Clonar o repositório + LFS | `git clone` + `git lfs pull` (vídeo **10**; espelho [`amostras`](https://drive.google.com/drive/folders/1FJOeVxw23scx84wSle-e5d1UssIqq8gV?usp=drive_link) se a quota LFS falhar) |
| 6 | Configurar `.env` + `pnpm install` / `pnpm db:push` / `pnpm dev` | vídeos **11–12** · [Instalação](#instalação) |

> O FluxTrace **não** requer VM, Intel Pin nem Visual Studio C++ — analisa logs **já gerados** pela [Contradef](https://github.com/contradef).

### Dependências opcionais (experimento completo)

| Recurso | Uso | Obrigatório? |
|---------|-----|--------------|
| `VIRUSTOTAL_API_KEY` | Aba VirusTotal na interpretação consolidada | Não |
| `CONTRADEF_LLM_*` / OpenAI | Veredito técnico via LLM | Não (há resumo determinístico) |
| Google Drive (espelho) | Amostras se LFS não couber na quota | Alternativa a `git lfs pull` |

### Amostras de teste

Inventário completo: [`test-samples/README.md`](test-samples/README.md) — **16** pacotes `.zip`, SHA-256 = nome do ficheiro.

| Rótulo | SHA-256 (`.zip`) | Tamanho `.zip` (≈) | Tempo ref. | Uso na demo |
|--------|------------------|---------------------|------------|-------------|
| `amostra_100k` | `a0aeb837cb5e762fc0b7d657c71d343e765cccb5780cd315756f682418b3cdfe` | 24 MiB | ~50 s | Playlist **14–15** (teste mínimo / SF) |
| `amostra_1M` | `1db3df87facac7ad4bf2fc7f9c49392f6f1cd69ce3d5db0d7b1a23074ad0dd69` | 164 MiB | ~25 s | Escala intermédia |
| `amostra_50M` | `db32e48a61c59884c1ce4c28f12feee426d361982e2491fbaaf7cb4e75a501dd` | 366 MiB | ~9 min | [Experimentos](#experimentos) (grafo 32→5) |

Espelho Google Drive: pasta [`amostras`](https://drive.google.com/drive/folders/1FJOeVxw23scx84wSle-e5d1UssIqq8gV?usp=drive_link) — detalhe em `test-samples/README.md`.

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
> **Vídeos:** playlist **06–12** na pasta [`demonstracao`](https://drive.google.com/drive/folders/1PVQBnYi5gXSyhSvYnkqgdOvoj5xhCEZf?usp=sharing); binários em [`instaladores`](https://drive.google.com/drive/folders/1XqR8_CynMEV7oGc8AC7jGSnmUv6JdSOg?usp=sharing).

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

Esta secção reproduz as **quatro métricas** do artigo (Sec. **4** — *Experimentos e Avaliação*): **(i)** tempo de processamento; **(ii)** redução de volume; **(iii)** eventos correlacionados; **(iv)** eventos críticos / evasão.

> **Amostras de referência:** redução **99,7%** / Trojan → `49aa7438…` (`ctr-JD-QvLcmsO`); grafo compacto **32→5** / Backdoor → `db32e48a…` (`ctr-ZbPqaQOXo0`). Artefactos pré-exportados em [`resultados/artefatos/`](resultados/artefatos/README.md).

> **Nota:** tempos são **aproximados** (Win 11 25H2, CPU i5-1135G7 @ 2,42 GHz, 16 GB RAM, SSD). Lotes multi‑GB podem levar horas — use amostras menores primeiro.

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
| **Amostra** | `49aa74387680de248f21af321c6721c305a29a071279b5526627921daa812e42.zip` (lote stress **15 GB** descomprimido) |
| **batchId ref.** | `ctr-JD-QvLcmsO` |
| **Recursos** | ≈ 1,52 GiB upload; ≈ 15 GiB `TraceInstructions.cdf`; **horas** de CPU (hardware ref.) |
| **Captura** | `resultados/capturas-tela/fluxtrace_07.png` |

**Passos:**

1. `/reduce-logs` → SHA `49aa7438…` → enviar o `.zip` → nome `exp-reducao-15G`.
2. Monitorizar progresso por ficheiro (colunas Antes / Reduz.) — ver também `fluxtrace_06.png` (acompanhamento multi‑GB).
3. Após **concluído**, abrir **Interpretação consolidada** do lote.

**Resultado esperado (referência experimental — lote `49aa7438…`):**

- Redução **≥ 99%** (valor observado: **99,7%**).
- **329 603** linhas preservadas (exportadas em `resultados/artefatos/49aa7438…/reports/`).
- Classificação **Trojan**, risco **crítico**; APIs sensíveis e gatilhos visíveis nos cartões.

> **Alternativa rápida:** amostra `db32e48a…` (`amostra_50M`, ≈ 9 min) também reduz ≥ 99%, mas com **≈ 230 082** linhas e veredito **Backdoor** — usar para a Reivindicação 3, não para estes números do artigo.

---

### Reivindicação 2 — Tempo de processamento e escala (métrica i)

**Objetivo:** mostrar variabilidade de tempo conforme volume e acompanhamento assíncrono.

| Campo | Valor |
|-------|--------|
| **Amostra rápida** | `a0aeb837…` — ≈ 50 s |
| **Amostra média** | `1db3df87…` — ≈ 25 s |
| **Amostra stress** | `fcd9f0a39b3e64d352e9e55df8d4b033814e65ee1c9ba299a5ef9d5e31829c29.zip` (575 MiB) ou `49aa7438…` (15 GB) |
| **Capturas** | `fluxtrace_05.png`, `fluxtrace_06.png`; dashboard agregado: `fluxtrace_03.png` *(regenerável — ver [`resultados/README.md`](resultados/README.md))* |

**Passos:**

1. Submeter `a0aeb837…` e registar tempo total (dashboard ou UI do lote).
2. Submeter `fcd9f0a3…` (575 MiB) ou `49aa7438…` (15 GB, se houver disco/tempo) e observar **upload multipart** + ETA por ficheiro.
3. Consultar **dashboard** (`/`) — gráfico «Tempo envio + processamento» (Fig. 5 do artigo).

**Resultado esperado:**

- Amostras pequenas concluem em **dezenas de segundos a poucos minutos**.
- Lotes multi‑GB mostram progresso contínuo (%, linhas/s, ETA) sem bloquear a UI.
- Dashboard agrega tempos dos lotes concluídos.

---

### Reivindicação 3 — Correlação e grafo compacto (métrica iii)

**Objetivo:** compactar grafo extenso preservando fases comportamentais.

| Campo | Valor |
|-------|--------|
| **Amostra** | `db32e48a61c59884c1ce4c28f12feee426d361982e2491fbaaf7cb4e75a501dd` (`amostra_50M`, ≈ 9 min) |
| **batchId ref.** | `ctr-ZbPqaQOXo0` |
| **Rota** | `/funcoes-mapeadas/fluxo-malware` (seleccionar o lote concluído) |
| **Capturas** | `fluxtrace_10.png`, `fluxtrace_09.png`, `fluxtrace_11.png` |

**Passos:**

1. Submeter `db32e48a…` (ou reutilizar artefacto em `resultados/artefatos/db32e48a…/`) e abrir **Fluxo malware** para esse lote.
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
| **Amostra** | Mesmo lote da Reivindicação 1 — `49aa7438…` (`ctr-JD-QvLcmsO`, veredito **Trojan**) |
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
| Redução ≥ 99% / Trojan | `49aa7438…` | horas (15 GB) | `fluxtrace_07.png` |
| Tempo / escala | `a0aeb837…` / `fcd9f0a3…` / `49aa7438…` | 50 s – horas | `fluxtrace_05–06.png`, dashboard (`fluxtrace_03.png`) |
| Grafo compacto / Backdoor | `db32e48a…` | ~9 min | `fluxtrace_10.png` |
| Evasão / MITRE | `49aa7438…` | após lote | `fluxtrace_07–08.png` |

**Métricas agregadas (15 lotes concluídos):** 150,1 GB brutos (913,1 mi linhas) → 666 MB (3,39 mi linhas), **redução global de 99,56%** (por lote: 98,08%–99,97%), 0 falhas. Tabela completa por lote e por arquivo: [`resultados/README.md`](resultados/README.md#lotes-processados--métricas-reais-sec-4-do-artigo).

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
| [`fluxtrace_web/docs/fluxtrace-arquitetura.png`](fluxtrace_web/docs/fluxtrace-arquitetura.png) | Diagrama funcional (ingestão → redução → visualização) |
| [`fluxtrace_web/docs/MANUAL-USUARIO.md`](fluxtrace_web/docs/MANUAL-USUARIO.md) | Manual do utilizador |
| [`test-samples/README.md`](test-samples/README.md) | Inventário das 16 amostras |
| [`resultados/README.md`](resultados/README.md) | Índice de capturas e mapeamento amostra → figura |
| [`resultados/capturas-tela/`](resultados/capturas-tela/) | Capturas dos experimentos |
| [`resultados/artefatos/README.md`](resultados/artefatos/README.md) | Logs reduzidos, Mermaid, relatórios por lote (SHA-256) |

---

## Vídeos de demonstração (playlist)

Screencasts com **legendas queimadas** (PT-BR). A playlist é uma **demonstração do fluxo** (download → instalação → configuração → execução → resultados), alinhada a este README e ao apêndice de demonstração do artigo — no mesmo formato do [TOMWare](https://github.com/TOMWare-analises/TOMWare) §1.4. **Não** pretende cobrir todos os 16 lotes nem as corridas stress de [Experimentos](#experimentos).

| Recurso | URL |
|---------|-----|
| Pasta Drive **`demonstracao`** (vídeos `.mp4`) | [abrir](https://drive.google.com/drive/folders/1PVQBnYi5gXSyhSvYnkqgdOvoj5xhCEZf?usp=sharing) |
| Pasta Drive **`instaladores`** (binários oficiais) | [abrir](https://drive.google.com/drive/folders/1XqR8_CynMEV7oGc8AC7jGSnmUv6JdSOg?usp=sharing) — ver [pacote de instaladores](#pacote-de-instaladores-google-drive) |
| Pasta Drive **`amostras`** (espelho de `test-samples/`) | [abrir](https://drive.google.com/drive/folders/1FJOeVxw23scx84wSle-e5d1UssIqq8gV?usp=drive_link) |
| Código-fonte | [github.com/fluxtrace/fluxtrace](https://github.com/fluxtrace/fluxtrace) — `git clone https://github.com/fluxtrace/fluxtrace.git` |

### Sequência (ordem de assistir)

| # | Fase | O que o vídeo mostra | Arquivo | README |
|---|------|----------------------|---------|--------|
| 01 | Download | Git for Windows | `01-git-download.mp4` | [Dependências](#dependências) / instaladores |
| 02 | Download | Node.js 22 LTS (+ pnpm via Corepack) | `02-download-nodejs.mp4` | [Dependências](#dependências) |
| 03 | Download | Git LFS (`test-samples/*.zip`) | `03-download-git-lfs.mp4` | [Amostras](#amostras-de-teste) |
| 04 | Download | PostgreSQL (instalador EDB) | `04-download-postgres.mp4` | [Dependências](#dependências) |
| 05 | Download | Visual Studio Code | `05-download-vscode.mp4` | [Dependências](#dependências) |
| 06 | Instalação | Instalar Git + Git LFS | `06-instalacao-git-git-lfs.mp4` | [Instalação](#instalação) · passo 1 |
| 07 | Instalação | Instalar Node.js + activar pnpm | `07-instalacao-nodejs-pnpm.mp4` | [Instalação](#instalação) · passo 2 |
| 08 | Instalação | Instalar PostgreSQL | `08-instalacao-postgres.mp4` | [Instalação](#instalação) · `DATABASE_URL` |
| 09 | Instalação | Instalar VS Code | `09-instalacao-vscode.mp4` | opcional |
| 10 | Configuração | `git clone` + `git lfs pull` (ou ZIP / Drive `amostras`) | `10-configuracao-clone.mp4` | [Instalação](#instalação) · passo 1 |
| 11 | Configuração | Copiar `.env` e preencher credenciais locais | `11-configuracao-env.mp4` | [Instalação](#instalação) · passo 3 |
| 12 | Configuração | `pnpm install` → `pnpm db:push` → `pnpm dev` | `12-configuracao-pnpm-dev.mp4` | [Instalação](#instalação) · passos 2–5 |
| 13 | Execução | Criar utilizador local + login → dashboard | `13-execucao-login.mp4` | [Teste mínimo](#teste-mínimo) |
| 14 | Execução | Upload + redução — amostra `a0aeb837…` | `14-execucao-reduzir-logs.mp4` | [Teste mínimo](#teste-mínimo) · apêndice SF (i) |
| 15 | Resultados | Interpretação consolidada: MITRE, evidências, fluxos e grafo compacto (`a0aeb837…`) | `15-resultados-interpretacao.mp4` | [Experimentos](#experimentos) · apêndice SF (ii)–(iii) |

Convenção de nomes: `NN-fase-assunto.mp4` (ordem lexicográfica = ordem de assistir). Legendas **queimadas** no MP4.

**Notas de alinhamento**

- A demo rápida da playlist usa a amostra **`a0aeb837…`** (vídeos **14–15**), a mesma do [teste mínimo](#teste-mínimo) e do momento (i) do apêndice SF.
- Os lotes stress do artigo (`49aa7438…` redução 99,7%; `db32e48a…` grafo 32→5 / M1) estão documentados em [Experimentos](#experimentos) e em `resultados/` — **não** há vídeos **16+** separados na pasta `demonstracao`.
- Não há vídeo só de «download do repositório / amostras»: use o vídeo **10** e as pastas Drive desta secção.

Para o **Salão de Ferramentas 2026** (modalidade Código Aberto), a URL da playlist a indicar na submissão é a pasta [`demonstracao`](https://drive.google.com/drive/folders/1PVQBnYi5gXSyhSvYnkqgdOvoj5xhCEZf?usp=sharing).

---

**Contradef (DBI):** [https://github.com/contradef](https://github.com/contradef)
