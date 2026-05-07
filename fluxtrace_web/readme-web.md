# FluxTrace — aplicação web (`fluxtrace_web`)

**Único README desta pasta.** Toda a documentação operacional do pacote npm está aqui (inclui o que antes existia em `frontend/README-FRONT.md` e `backend/README-BACK.md`).

| Secção | Conteúdo |
|--------|-----------|
| [Arranque rápido](#arranque-rápido) | `pnpm`, `.env`, comandos |
| [Documentação e manuais](#documentação-e-manuais) | PDF-style em `docs/` |
| [Frontend](#frontend) | Stack, pastas, rotas, tRPC, REST |
| [Backend](#backend-api) | Pastas, ambiente, Drizzle, deploy Render, testes |
| [Amostras](../test-samples/README.md) | `.zip` na raiz do repo; LFS e Drive (documentação nessa pasta) |

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

**Capturas de ecrã** para o manual do utilizador: colar imagens em **`docs/_screenshots/`** (nomes sugeridos no `MANUAL-USUARIO.md`).

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
| `/funcoes-mapeadas` | `FuncoesMapeadas` | `src/pages/analysis/FuncoesMapeadas.tsx` |
| `/component-showcase` | `ComponentShowcase` | `src/pages/dev/ComponentShowcase.tsx` |
| `/404` | `NotFound` | `src/pages/errors/NotFound.tsx` |
| *outros* | `NotFound` | última rota do `Switch` |

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
- `pnpm db:push` na raiz (usa `backend/drizzle.config.ts`).
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
| `db/` | `query-batch-once.mts`, `run-rename-jobs-to-batches.mts`, `sync-legacy-backlog.mts` |
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

#### Outros

`SKIP_DB_AUTO_PUSH`, `OWNER_OPEN_ID`, `CONTRADEF_WORK_TMP`, `CONTRADEF_REDUCE_LOGS_TMP`, etc. — ver `.env.example`.

**Build/start:** ver `render.yaml` na raiz do repositório Git (se existir).

---

## Amostras de testes

Toda a informação (Google Drive, Git LFS, como contribuir) está em **[`test-samples/README.md`](../test-samples/README.md)** na raiz do repositório Git.

---

*Última consolidação: um único `readme-web.md` em `fluxtrace_web/`; actualizar este ficheiro quando mudarem rotas, deploy ou estrutura relevante. Amostras: `test-samples/README.md`.*
