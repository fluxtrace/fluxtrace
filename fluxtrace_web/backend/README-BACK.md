# Backend (FluxTrace API)

Express + tRPC, Drizzle/PostgreSQL, integrações externas. O cliente React vive em `../frontend/`. No padrão MVC, a **view** é esse SPA; o backend cobre model (`models/`), controllers (`controllers/`), services (`services/`) e partilha (`shared/`).

## Ficheiros na raiz desta pasta

| Ficheiro | Para que serve |
|----------|----------------|
| `drizzle.config.ts` | Configuração do Drizzle Kit (`pnpm db:push` na raiz `fluxtrace_web/` aponta para este ficheiro). |
| `vitest.config.ts` | Vitest só para o backend (`pnpm exec vitest run -c backend/vitest.config.ts`). |
| `tsconfig.json` | Projeto TypeScript do backend (`tsc -p backend/tsconfig.json`). |
| `.env.example` | Modelo de variáveis; o `.env` real fica em `fluxtrace_web/.env` (ver secção Ambiente). |

## Mapa rápido de pastas

| Pasta / ficheiro | Conteúdo |
|------------------|----------|
| `_core/server/` | Arranque HTTP (`index.ts`), contexto tRPC/sessão (`context.ts`), Vite em dev (`vite.ts`). |
| `_core/integrations/` | SDK WebDev/OAuth (`sdk.ts`), LLM (`llm.ts`), notificações (`notification.ts`), Forge Data API (`dataApi.ts`), helper Maps/Forge (`map.ts`). |
| `_core/config/` | Variáveis de ambiente (`env.ts`), cookies de sessão (`cookies.ts`). |
| `_core/postgres/` | URL/SSL PostgreSQL (`pgConnectionUrl`, `pgSslInference`), sync de schema no arranque (`postgresSchemaSync`). |
| `_core/trpc/` | Definição do router e procedures (`index.ts`). |
| `_core/debug/` | Snapshots de diagnóstico do processo (`serverProcessDebug`). |
| `_core/` (raiz restante) | `types/`, pastas `server/`, `integrations/`. |
| `controllers/` | tRPC `appRouter` (`routers.ts`), domínios em subpastas (`analysis/routes`, `analysis/handlers`, `auth/`, `admin/`, …). |
| `models/db/` | Persistência: `connection.ts`, `usersRepo.ts`, `analysisRepo.ts` (export barrel `index.ts`). |
| `models/storage/` | Cliente de storage remoto + artefactos locais (`index.ts`). |
| `models/analysis/` | Modelos auxiliares de análise (ex. calibração de tempos). |
| `services/` | Lógica de negócio por domínio: `analysis/`, `virusTotal/`, `flowGraph/`, `oidc/`, `media/`, `samples/`. |
| `shared/` | Código partilhado com o frontend (`@shared/*` no Vite; no backend usar `../shared/...`). Pastas: `analysis/` (schemas Zod + `index`), `auth/`, `const/`, `types/`, `mitre/`, `virusTotal/`, `flowGraph/`, `_core/`, `data/`. |
| `drizzle/` | Esquema Drizzle, migrações SQL, meta. |
| `scripts/` | Utilitários CLI em subpastas: `setup/`, `mitre/`, `db/`, `sql/` (detalhes na secção Operações). |
| `tests/` | Testes que envolvem vários módulos (ex. `mitreDefenseEvasion.test.ts`). |

## Comandos (raiz `fluxtrace_web/`)

- `pnpm run dev` — `tsx watch backend/_core/server/index.ts`
- `pnpm run build` — bundle do entrypoint `backend/_core/server/index.ts` → `dist/index.js`
- `pnpm run check` — `tsc` frontend + backend

## Imports `@shared` em runtime

O **frontend** usa o alias `@shared/*` (Vite). O **backend** em execução com **tsx** deve importar `../shared/...` (ou equivalente); não confiar em `node_modules/@shared`.

---

## Ambiente (variáveis)

**Fonte de verdade no código:** `_core/config/env.ts` (parse e regras, incl. validação em produção).

**Modelo para operadores:** `backend/.env.example` — copiar variáveis relevantes para `fluxtrace_web/.env` (raiz do pacote npm, ao lado de `package.json`). Não commitar `.env` com segredos.

### Conselhos

1. Depois de alterar `VITE_*`, voltar a fazer **build** do frontend — valores ficam embutidos no bundle.
2. Chaves só de servidor (ex.: `VIRUSTOTAL_API_KEY`, `JWT_SECRET`) **não** devem usar prefixo `VITE_`.
3. Para matriz detalhada de deploy no Render, ver a secção **Deploy no Render** abaixo e a tabela no final de `.env.example`.

---

## Operações e manutenção

### Drizzle e base de dados

- **Esquema (fonte):** `drizzle/schema/` (`schema.ts`, `relations.ts`); import da app: `drizzle/schema`.
- **Saída do `drizzle-kit generate`:** `drizzle/migrations/` (ficheiros `.sql` + pasta `meta/` com `_journal.json`).
- **Empurrar esquema para a BD:** na raiz `fluxtrace_web/`, `pnpm db:push` (usa `backend/drizzle.config.ts`).
- **Arranque:** `_core/postgres/postgresSchemaSync.ts` pode aplicar alterações em certos ambientes; desativar com `SKIP_DB_AUTO_PUSH=1` se necessário.

### Migrações / SQL manual

| Ficheiro | Uso |
|----------|-----|
| `drizzle/migrations/manual/rename_analysis_jobs_to_batches.sql` | Renomear tabela legacy (referência SQL); script de apoio `pnpm db:migrate-rename-jobs-to-batches` |
| `scripts/sql/delete-analysis-batch-cascade.sql` | Referência para limpeza manual em SQL |

### Scripts em `backend/scripts/`

| Área | Conteúdo |
|------|-----------|
| `setup/` | `ensure-7zip-executable.mjs` — `postinstall` na raiz |
| `mitre/` | `generate-ta0005-catalog.mjs`, `ta0005-source.md` (dados fonte) — `pnpm mitre:ta0005-catalog` |
| `db/` | `query-batch-once.mts`, `run-rename-jobs-to-batches.mts`, `sync-legacy-backlog.mts` |
| `sql/` | SQL de referência (ex.: limpeza em cascata) |

| Script | Notas |
|--------|--------|
| `setup/ensure-7zip-executable.mjs` | Garante binário 7zip executável em Linux (pipelines) |
| `mitre/generate-ta0005-catalog.mjs` | Gera `shared/data/mitreTa0005Catalog.json` |
| `db/query-batch-once.mts` | Diagnóstico pontual de um lote |
| `db/run-rename-jobs-to-batches.mts` | Migração nome jobs → batches (`pnpm db:migrate-rename-jobs-to-batches`) |
| `db/sync-legacy-backlog.mts` | Sincronização de backlog legacy (importa router em `controllers/analysis/routes/`) |

---

## Testes (backend)

### Convenção

- **`services/`** — preferir testes **colocalizados** (`*.test.ts` junto ao módulo) por subpasta de domínio (ex.: `virusTotal/`, `analysis/`, `flowGraph/`).
- **`controllers/`** — testes de router/tRPC ou rotas Express junto aos controladores (ex.: `analysis/routes/analysisRouter.test.ts`, `analysis/handlers/reduceLogsUpload.test.ts`, `auth/auth.logout.test.ts`).
- **`models/`** — testes de modelo puro junto ao ficheiro (ex.: `models/analysis/analysisWallCalibration.test.ts`).
- **`tests/`** — testes que cortam **vários módulos** ou dados estáticos grandes (ex.: `mitreDefenseEvasion.test.ts`).

### Execução

Na raiz `fluxtrace_web/`: `pnpm run test` (frontend + backend Vitest). Só backend: `pnpm exec vitest run -c backend/vitest.config.ts`.

---

## Deploy no Render (produção)

Defina estas variáveis no **Web Service** (Settings → Environment).  
**Importante:** qualquer alteração a `VITE_*` exige **novo deploy** (com *build*), porque o Vite incorpora esses valores no bundle do cliente.

### Cenário recomendado: login local + PostgreSQL

| Variável | Obrigatório | Valor / exemplo | Notas |
|----------|-------------|-----------------|--------|
| `NODE_VERSION` | Recomendado | `22.12.0` (ou `20.x` LTS) | Garante Corepack + pnpm conforme o projeto. |
| `NODE_ENV` | Sim | `production` | |
| `AUTH_MODE` | Sim | `local` | Login com email e palavra-passe; registo em `/register`. |
| `VITE_AUTH_MODE` | Sim | `local` | Deve coincidir com `AUTH_MODE`; entra no **build**. |
| `JWT_SECRET` | Sim | String longa e aleatória | Não commite nem partilhe. |
| `DATABASE_URL` | Sim | `postgresql://USER:PASS@HOST:5432/DB?sslmode=require` | Use a instância Postgres do Render ou outra; `sslmode` se o host exigir TLS. |
| `DATABASE_SSL` | Opcional | `true` | Só se precisar de TLS e a URL não trouxer `sslmode`. |

### OAuth institucional (WebDev), além do login local (opcional)

**Predefinição recomendada:** não defina `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` nem `VITE_APP_ID` — fica só login e registo com email e palavra-passe; a UI não mostra OAuth. No Render, **apague** essas variáveis se existirem e faça **novo build** para retirar `VITE_*` do bundle.

Se quiser o botão **«Entrar com OAuth»** funcional, preencha **também** (além da tabela acima):

| Variável | Obrigatório | Valor / exemplo | Notas |
|----------|-------------|-----------------|--------|
| `OAUTH_SERVER_URL` | Sim para OAuth | `https://<sua-api-webdev>` | Base da API que expõe `ExchangeToken` / serviço WebDev. |
| `VITE_OAUTH_PORTAL_URL` | Sim para OAuth | `https://<url-do-portal-no-browser>` | Página onde o utilizador faz login institucional. **Build + runtime.** |
| `VITE_APP_ID` | Sim para OAuth | id da aplicação WebDev | No **servidor** e no build; necessário para trocar o código OAuth. |

Registe o redirect **exato**: `https://<nome-do-serviço>.onrender.com/api/oauth/callback` no fornecedor OAuth / consola WebDev.

**404 em `/app-auth`:** Não uses o URL do teu Web Service no Render como `VITE_OAUTH_PORTAL_URL` nem como `OAUTH_SERVER_URL`. Esta app **não** define a rota `/app-auth`; ela existe no **portal WebDev** (browser) e na **API WebDev** que expõe `ExchangeToken`. Copia esses dois URLs a partir da documentação ou do painel da plataforma onde criaste o `appId` (`srv-…`).

### Semente de administrador (opcional, só `AUTH_MODE=local`)

| Variável | Obrigatório | Exemplo | Notas |
|----------|-------------|---------|--------|
| `DEFAULT_LOCAL_ADMIN_EMAIL` | Opcional | `admin@empresa.com` | Criada/actualizada no arranque se ainda não existir. |
| `DEFAULT_LOCAL_ADMIN_PASSWORD` | Opcional | palavra-passe temporária | Altere de seguida no perfil; use palavra forte em produção. |

### Só com `AUTH_MODE=oidc` (Google / Microsoft)

| Variável | Obrigatório | Notas |
|----------|-------------|--------|
| `AUTH_MODE` | | `oidc` |
| `VITE_AUTH_MODE` | | `oidc` |
| `PUBLIC_APP_URL` | Sim | `https://<sua-app>.onrender.com` (sem `/` no fim) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Pelo menos um fornecedor | Com Microsoft em alternativa. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` | | |

### Outros (opcionais)

| Variável | Uso |
|----------|------|
| `SKIP_DB_AUTO_PUSH` | `1` — desliga o *drizzle push* automático no arranque. |
| `OWNER_OPEN_ID` | Cenários legado / *owner* WebDev. |
| `CONTRADEF_WORK_TMP`, `CONTRADEF_REDUCE_LOGS_TMP` | Caminhos de disco para trabalhos pesados. |

**Build e start** sugeridos: ver ficheiro `render.yaml` na raiz do repositório.

---

## Documentação alargada

- **Manual técnico** (arquitectura completa, cliente, deploy): [`../docs/MANUAL-TECNICO.md`](../docs/MANUAL-TECNICO.md)
- **Manual do utilizador** (funcionalidades e uso): [`../docs/MANUAL-USUARIO.md`](../docs/MANUAL-USUARIO.md)
- **Índice `docs/`**: [`../docs/README.md`](../docs/README.md)
- **Frontend** (rotas, tRPC no browser): [`../frontend/README-FRONT.md`](../frontend/README-FRONT.md)
