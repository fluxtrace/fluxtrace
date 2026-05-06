# FluxTrace

Código em **`fluxtrace_web/`** (`frontend/` + `backend/`). Na raiz ficam só ficheiros mínimos para Git/npm e `render.yaml` (blueprint opcional).

O projeto usa **pnpm** (ver `packageManager` em `fluxtrace_web/package.json`). Não é necessário `package-lock.json` na pasta da app.

```bash
corepack enable
pnpm install --dir fluxtrace_web
pnpm --dir fluxtrace_web dev
```

Atalhos a partir da raiz (requerem pnpm):

```bash
pnpm dev
pnpm build
pnpm test
pnpm check
```

Variáveis em produção (ex.: Render): ver **`fluxtrace_web/backend/RENDER-ENV.md`**.

Dados pesados, `legacy_artifacts` e documentação antiga foram removidos deste clone; recupera no repositório anterior se precisares.
