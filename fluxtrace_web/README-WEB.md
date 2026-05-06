# FluxTrace — aplicação web

- **`frontend/`** — React, Vite, Vitest (UI), Prettier, `components.json` (shadcn). Detalhe: [`frontend/README-FRONT.md`](frontend/README-FRONT.md).
- **`backend/`** — Node, tRPC, Drizzle (`drizzle.config.ts`), scripts CLI, documentação em [`backend/README-BACK.md`](backend/README-BACK.md), `.env.example`.
- **`docs/`** — [`Manual técnico`](docs/MANUAL-TECNICO.md), [`Manual do utilizador`](docs/MANUAL-USUARIO.md), [`índice`](docs/README.md).

Variáveis de ambiente: copie `backend/.env.example` para **`.env` nesta pasta** (`fluxtrace_web/.env`).

```bash
pnpm install
pnpm dev
```

Typecheck: `pnpm check` (usa `frontend/tsconfig.json` e `backend/tsconfig.json`).
