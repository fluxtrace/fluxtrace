# FluxTrace — aplicação web (`fluxtrace_web`)

**Único README desta pasta.** Toda a documentação operacional do pacote npm está aqui (inclui o que antes existia em `frontend/README-FRONT.md` e `backend/README-BACK.md`).

| Secção | Conteúdo |
|--------|-----------|
| [Arranque rápido](#arranque-rápido) | `pnpm`, `.env`, comandos |
| [Documentação e manuais](#documentação-e-manuais) | PDF-style em `docs/` |
| [Frontend](#frontend) | Stack, pastas, rotas, tRPC, REST |
| [Backend](#backend-api) | Pastas, ambiente, Drizzle, deploy Render, testes |
| [Amostras](../test-samples/README.md) | 16 `.zip` na raiz (`test-samples/`); inventário, LFS e Drive |

---

## Arranque rápido

- **`frontend/`** — React, Vite, Vitest, Prettier, `components.json` (shadcn). Código em `frontend/src/`.
- **`backend/`** — Node, Express, tRPC, Drizzle, `.env.example`.

**Variáveis:** copie `backend/.env.example` para **`.env` nesta pasta** (`fluxtrace_web/.env`).

```bash
pnpm install
pnpm dev
pnpm check    # tsc frontend + backend
pnpm test     # Vitest front + back
pnpm build
```

---

## Documentação e manuais

Ficheiros em **`docs/`** (além deste README):

| Documento | Público |
|-----------|---------|
| [`docs/MANUAL-DEV-LOCAL.md`](docs/MANUAL-DEV-LOCAL.md) | Desenvolvimento — **passo a passo** ambiente local, VS Code, Postgres, `.env`, `pnpm dev`, testes |
| [`docs/MANUAL-USUARIO.md`](docs/MANUAL-USUARIO.md) | Utilizadores — funcionalidades e uso |
| [`docs/MANUAL-TECNICO.md`](docs/MANUAL-TECNICO.md) | Desenvolvedores / DevOps — arquitectura, API, operação |

**Documentação em `docs/`:** apenas **`MANUAL-DEV-LOCAL.md`**, **`MANUAL-TECNICO.md`** e **`MANUAL-USUARIO.md`** (sem subpastas de figuras versionadas).

---

## Frontend

Documentação da pasta `frontend/`. Comandos `pnpm` correm na **raiz `fluxtrace_web/`** (não dentro de `frontend/`).

### Stack tecnológica

| Área | Tecnologia |
|------|------------|
| UI | **React 19** + **TypeScript** |
| Build / dev server | **Vite 7** |
| Estilos | **Tailwind CSS 4** (+ `tw-animate-css`; `src/styles/global.css`) |
| Componentes base | **shadcn/ui** (Radix), `components.json` |
| Rotas | **wouter** |
| Dados | **tRPC v11** + **TanStack React Query** |
| Serialização | **superjson** |
| Formulários | **react-hook-form** + **Zod** (quando aplicável) |
| Gráficos / diagramas | **@xyflow/react**, **Mermaid**, **Recharts**, **dagre** |
| i18n | **i18next** + **react-i18next** (`src/i18n/`) |
| Testes | **Vitest** + Testing Library (`frontend/config/vitest.config.ts`) |
| Tipagem partilhada | `@shared/*` → `backend/shared/*` |

Configs de tooling: `frontend/config/` (Vite, Vitest, Prettier, patches pnpm).

### Estrutura de pastas (`frontend/`)

```
frontend/
├── index.html               # entrada; script → /src/app/main.tsx
├── tsconfig.json            # paths @/*, @backend/*, @shared/*
├── components.json          # shadcn
├── public/icons/favicon.svg
├── config/                  # vite, vitest, prettier, patches
└── src/
    ├── app/                 # main.tsx, App.tsx
    ├── pages/               # auth, home, admin, reduce-logs, analysis, account, dev, errors
    ├── components/          # ui/, layout/, shell/, flow/, log-evidence/, …
    ├── lib/                 # api/trpc, analysis/, reduce-logs/, log-evidence/, core/, utils.ts
    ├── services/            # ex. analysisService (fetch uploads)
    ├── hooks/, contexts/, config/, i18n/, styles/, types/, _core/hooks/
```

### Aliases (`tsconfig.json` / Vite)

| Alias | Aponta para |
|-------|-------------|
| `@/*` | `frontend/src/*` |
| `@backend/*` | `backend/*` |
| `@shared/*` | `backend/shared/*` |

`VITE_*`: tipos em `src/types/vite-env.d.ts`; valores no `.env` de **`fluxtrace_web/`**.

### Rotas (path → página)

Fonte: **`src/app/App.tsx`**.

| Path | Página | Ficheiro |
|------|--------|----------|
| `/` | `Home` | `src/pages/home/Home.tsx` |
| `/login` | `Login` | `src/pages/auth/Login.tsx` |
| `/register` | `Register` | `src/pages/auth/Register.tsx` |
| `/trocar-senha-obrigatorio` | `ForceChangePassword` | `src/pages/auth/ForceChangePassword.tsx` |
| `/perfil` | `Profile` | `src/pages/account/Profile.tsx` |
| `/admin/usuarios` | `AdminUsers` | `src/pages/admin/AdminUsers.tsx` |
| `/interpretacao-consolidada` | `InterpretacaoConsolidada` | `src/pages/analysis/InterpretacaoConsolidada.tsx` |
| `/reduce-logs` | `ReduceLogs` | `src/pages/reduce-logs/ReduceLogs.tsx` |
| `/funcoes-mapeadas/fluxo-malware` | `FluxoMalware` | `src/pages/analysis/FluxoMalware.tsx` |
| `/analisar-json-vt` | `VtJsonCompare` | `src/pages/analysis/VtJsonCompare.tsx` |
| `/funcoes-mapeadas` | `FuncoesMapeadas` | `src/pages/analysis/FuncoesMapeadas.tsx` |
| `/component-showcase` | `ComponentShowcase` | `src/pages/dev/ComponentShowcase.tsx` |
| `/404` | `NotFound` | `src/pages/errors/NotFound.tsx` |
| *outros* | `NotFound` | última rota do `Switch` |

**Analisar JSON VT (`/analisar-json-vt`; redirecionamento de `/funcoes-mapeadas/analisar-json-vt`):** o lote escolhido não vai na query string — fica em `sessionStorage` (`fluxtrace.vtJsonCompare.batchId`). As mutations tRPC enviam `batchId` no corpo (POST). Inclui mutation `analysis.compareVtJsonExport` — compara o ficheiro importado com o lote seleccionado. Dois formatos: relatório de ficheiro VT v3 com `last_analysis_stats`, ou mapa de hashes (ex. `respostas_virustotal.json`) com respostas **behaviour_mitre_trees**; neste caso cruza técnicas **MITRE TA0005** com `mitreDefenseEvasion` do lote e ainda mostra contexto da API VT (`VIRUSTOTAL_API_KEY`). Para o mesmo formato *multi-hash*, a página oferece **modo unificado:** query `analysis.unifiedVtMitreFluxtraceExport` descarrega um JSON agregado (chaves = SHA-256, valor = objeto com `_fluxtrace` + mitre + relatório VT); mutation `analysis.compareUnifiedVtMitreExport` compara o ficheiro importado com esse agregado gerado no servidor (últimos *N* lotes acessíveis). A página também expõe a mutation **`analysis.mitreFluxtraceVsVtTableXlsxExport`**: workbook com folha **`Comparativo`** (SHA-256; TA0005 FluxTrace; só TA0005 no comportamento VT; todas as técnicas VT; nas colunas E–G, **percentual + lista das técnicas** na linha seguinte por célula, comparando apenas B×C sobre |B∪C|) e folha **`Grafico`** com os mesmos três percentuais em número — no Excel pode seleccionar a tabela dessa folha e usar **Inserir → Gráfico → barras empilhadas 100 %**. O formato OOXML não inclui o desenho do gráfico embutido (limitação típica de `xlsx`/SheetJS OSS). Serve os últimos lotes **concluídos** segundo o limite/`batchIds`. O tamanho máximo do JSON enviado nas duas primeiras mutations é `VT_COMPARE_EXTERNAL_JSON_MAX_CHARS` (~15 MB de texto, ver `backend/shared/virusTotal/vtJsonCompareLimits.ts`), coerente com `express.json({ limit: "50mb" })`. Resumo interpretativo opcional via LLM (`CONTRADEF_LLM_API_KEY` / `CONTRADEF_SKIP_LLM` / mesma lógica do insight).

**Interpretação consolidada (`/interpretacao-consolidada`):** o cartão «Veredito técnico» inclui etiqueta sobre o modo de interpretação textual (`insight.modelName`). MITRE ATT&CK (TA0005) e VirusTotal continuam apenas nos separadores sob «Indicadores da análise».

**Sessão (`trpc.auth.me`):** se `mustChangePassword`, redireciona para `/trocar-senha-obrigatorio`; utilizador sem sessão nessa rota vai para `/login`; após corrigir senha, redireciona para `/`. Enquanto carrega pode aparecer `FullScreenLoad`.

### Comunicação com o backend

Mesma origem: caminhos **`/api/...`**.

1. **tRPC** — `src/lib/api/trpc.ts`, `httpBatchLink` em **`/api/trpc`**, `superjson`, `credentials: "include"`. Erros de auth tratados em `src/app/main.tsx`.
2. **REST** — `src/services/analysisService.ts` → **`/api/reduce-logs/...`** (uploads em chunks).
3. **Tipos** — `backend/shared` via `@shared/*`.

### Comandos úteis (frontend)

- Dev: `pnpm dev` (único servidor)
- Typecheck front: `tsc --noEmit -p frontend/tsconfig.json`
- Testes front: `pnpm exec vitest run -c frontend/config/vitest.config.ts`
- Build SPA: `vite build --config frontend/config/vite.config.ts`

---

## Backend (API)

Express + tRPC, Drizzle/PostgreSQL, integrações. **View:** SPA em `frontend/`. MVC lógico: `models/`, `controllers/`, `services/`, `shared/`.

### Ficheiros na raiz de `backend/`

| Ficheiro | Uso |
|----------|-----|
| `drizzle.config.ts` | Drizzle Kit (`pnpm db:push` na raiz `fluxtrace_web/`) |
| `vitest.config.ts` | Vitest backend |
| `tsconfig.json` | TS backend |
| `.env.example` | Modelo; `.env` efectivo em `fluxtrace_web/.env` |

### Mapa de pastas (`backend/`)

| Pasta | Conteúdo |
|-------|----------|
| `_core/server/` | `index.ts`, `context.ts`, `vite.ts` |
| `_core/integrations/` | WebDev/OAuth, LLM, notificações, Forge, mapas |
| `_core/config/` | `env.ts`, cookies |
| `_core/postgres/` | Postgres URL/SSL, `postgresSchemaSync` |
| `_core/trpc/` | Router base |
| `_core/debug/` | `serverProcessDebug` |
| `controllers/` | `routers.ts`, `analysis/`, `auth/`, `admin/`, … |
| `models/db/` | DB, repos |
| `models/storage/` | Storage remoto / local |
| `models/analysis/` | Modelos auxiliares |
| `services/` | `analysis/`, `virusTotal/`, `flowGraph/`, `oidc/`, … |
| `shared/` | Partilhado com o front (`@shared/*` no Vite; no back `../shared/...`) |
| `drizzle/` | Schema, migrações |
| `scripts/` | `setup/`, `mitre/`, `db/`, `sql/` |
| `tests/` | Testes transversais |

**Imports `@shared` no backend:** usar `../shared/...` em runtime (tsx), não `node_modules/@shared`.

### Comandos (raiz `fluxtrace_web/`)

- `pnpm run dev` — `tsx watch backend/_core/server/index.ts`
- `pnpm run build` — bundle servidor → `dist/index.js`
- `pnpm run check` — tsc front + back

### Ambiente (variáveis)

**Fonte de verdade:** `backend/_core/config/env.ts`.  
**Modelo:** `backend/.env.example` → copiar para `fluxtrace_web/.env`.

1. Alterar `VITE_*` implica **novo build** do frontend.  
2. Segredos de servidor (`JWT_SECRET`, `VIRUSTOTAL_API_KEY`, …) **sem** prefixo `VITE_`.  
3. Matriz de deploy: secção **Deploy no Render** abaixo e tabela no fim de `.env.example`.

### Drizzle e base de dados

- Esquema: `drizzle/schema/`.
- Migrações geradas: `drizzle/migrations/`.
- `pnpm db:push` na raiz de `fluxtrace_web/` (pré-verifica a ligação PostgreSQL e depois chama `backend/drizzle.config.ts`).
- Arranque pode fazer push automático; `SKIP_DB_AUTO_PUSH=1` para desligar.

### Migrações / SQL manual

| Ficheiro | Uso |
|----------|-----|
| `drizzle/migrations/manual/rename_analysis_jobs_to_batches.sql` | Referência; script `pnpm db:migrate-rename-jobs-to-batches` |
| `scripts/sql/delete-analysis-batch-cascade.sql` | Limpeza manual |

### Scripts `backend/scripts/`

| Área | Conteúdo |
|------|-----------|
| `setup/` | `ensure-7zip-executable.mjs` — `postinstall` |
| `mitre/` | `generate-ta0005-catalog.mjs` — `pnpm mitre:ta0005-catalog` |
| `db/` | `push-schema.mts` (`pnpm db:push`), `query-batch-once.mts`, `run-rename-jobs-to-batches.mts`, `sync-legacy-backlog.mts` |
| `sql/` | SQL de referência |

### Testes (backend)

- Colocalizados em `services/`, `controllers/`, `models/`.
- Transversais: `backend/tests/`.
- `pnpm test` ou `pnpm exec vitest run -c backend/vitest.config.ts`.

### Deploy no Render (produção)

Qualquer alteração a **`VITE_*`** exige **novo deploy** com build.

#### Login local + PostgreSQL

| Variável | Obrigatório | Notas |
|----------|-------------|--------|
| `NODE_VERSION` | Recomendado | ex. `22.12.0` |
| `NODE_ENV` | Sim | `production` |
| `AUTH_MODE` | Sim | `local` |
| `VITE_AUTH_MODE` | Sim | `local` — alinhado com `AUTH_MODE` |
| `JWT_SECRET` | Sim | string longa |
| `DATABASE_URL` | Sim | Postgres; `sslmode` se necessário |
| `DATABASE_SSL` | Opcional | `true` se a URL não definir SSL e o host exigir |

#### OAuth institucional (opcional)

Sem `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID` → só login local.

Com OAuth: preencher as três; redirect registado: `https://<serviço>.onrender.com/api/oauth/callback`. **Não** usar o URL do próprio Render como portal `VITE_OAUTH_PORTAL_URL` (rota `/app-auth` é do portal WebDev).

#### Semente admin (`AUTH_MODE=local`)

`DEFAULT_LOCAL_ADMIN_EMAIL`, `DEFAULT_LOCAL_ADMIN_PASSWORD` (opcional).

#### `AUTH_MODE=oidc`

`PUBLIC_APP_URL`, credenciais Google/Microsoft conforme `.env.example`.

#### Forge / modelo de linguagem (opcional)

**Storage (uploads):** `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` — proxy Forge para artefactos remotos.

**Resumo da análise (chat completions):** o cliente usa `backend/_core/integrations/llm.ts`.

- **URL base** (anexa `/v1/chat/completions`): ordem `CONTRADEF_LLM_API_URL` → `BUILT_IN_FORGE_API_URL` → se ambos vazios, `https://api.openai.com`.
- **Chave Bearer**: ordem `CONTRADEF_LLM_API_KEY` → `BUILT_IN_FORGE_API_KEY` → `OPENAI_API_KEY` (este último é sobretudo para **testes locais** com OpenAI ou outro endpoint compatível sem Forge).
- **Modelo**: `CONTRADEF_LLM_MODEL` (predefinição `gemini-2.5-flash`, adequada ao proxy Forge). Para OpenAI direto na tua máquina, algo como `gpt-4o-mini`.
- Extensões Gemini no JSON (`thinking`): activadas por defeito só se o nome do modelo contiver `gemini`; para forçar ou desactivar use `CONTRADEF_LLM_GEMINI_EXTENSIONS` (`1` / `true`).
- **Sem chaves e sem redes externas**: `CONTRADEF_SKIP_LLM=1` faz o servidor **não tentar** chat completions — usa sempre o **resumo determinístico** e não regista avisos de falta de credencial LLM (`backend/.env.example`).


Sem qualquer chave acima o servidor mantém-se funcional com **resumo determinístico**.

#### Funções mapeadas — cópia local (`funcoes-mapeadas/` no repo FluxTrace)

O menu **Funções mapeadas** lê apenas **ficheiros no disco**: `fluxos_mapeados.xlsx` + pastas por função ([árvore pública no mesmo repositório](https://github.com/fluxtrace/fluxtrace/tree/main/funcoes-mapeadas)). **Não há pull automático** — a cópia local deve existir sob `FUNCOES_MAPEADAS` ou nos defaults ao lado de `fluxtrace_web/`.

1. **Colocar a pasta ao lado do `fluxtrace_web/`** na raiz do mono-repositório FluxTrace (`fluxtrace/` contém `.git`, `fluxtrace_web/` e a pasta dos fluxos — ex.: `D:/MMB/DBI/fluxtrace/funcoes-mapeadas`), usando uma destas formas:
   - Pasta **`funcoes-mapeadas`** (alinhado ao ramo público FluxTrace — preferido) ou **`legacy_artifacts`** (nome legado compatível ao migrar outros clones); ou
   - Outros nomes de fallback (**`funcoes_mapeadas`**, **`funcoes-maepadas`**) quando nenhuma das pastas preferidas existir ao mesmo nível (`../` relativamente ao `cwd` habitual do servidor).
2. **Recomendado:** definir **`FUNCOES_MAPEADAS`** no **`.env`** em `fluxtrace_web/` com o caminho absoluto da cópia (`fluxos_mapeados.xlsx` na raiz dessa pasta). Assim podes ter a pasta noutro disco ou outro nome em dev/produção. Exemplo com a pasta na raiz deste repositório: `FUNCOES_MAPEADAS=D:/MMB/DBI/fluxtrace/funcoes-mapeadas` (ajuste ao nome real da pasta no disco).

Obter ou actualizar materiais de referência **a partir de `fluxtrace`**: trabalhar dentro do ramo onde a pasta **`funcoes-mapeadas/`** já está versionada, ou sincronizar com o estado remoto de [fluxtrace/fluxtrace](https://github.com/fluxtrace/fluxtrace). Reinicia o servidor (`pnpm dev`) depois de alterar o `.env`.

#### Outros

`SKIP_DB_AUTO_PUSH`, `OWNER_OPEN_ID`, `CONTRADEF_WORK_TMP` (trabalho da análise e artefactos no disco), `CONTRADEF_REDUCE_LOGS_TMP` (temporários do upload multipart legado), `CONTRADEF_DISCARD_ORIGINAL_LOGS_AFTER_SUCCESS` (`1` = não guardar log bruto após redução; poupa espaço local). No Windows, se omitires ambos paths, o backend usa por defeito `F:\contradef-tmp\...` — ver `backend/_core/config/contradefPaths.ts` e `.env.example`.

**Build/start:** ver `render.yaml` na raiz do repositório Git (se existir).

---

## Amostras de testes

**16 pacotes** `.zip` em **`test-samples/`** (série de referência `amostra_100k` … `amostra_50M` e pacotes adicionais de grande escala). Inventário completo, tamanhos de `TraceInstructions.cdf`, tempos de referência e instruções LFS/Drive: **[`test-samples/README.md`](../test-samples/README.md)** na raiz do repositório Git.

---

*Última consolidação: um único `readme-web.md` em `fluxtrace_web/`; actualizar este ficheiro quando mudarem rotas, deploy ou estrutura relevante. Amostras: `test-samples/README.md`.*
