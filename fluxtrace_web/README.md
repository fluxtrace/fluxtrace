# FluxTrace — aplicação web

- **`frontend/`** — React, `src/`, `index.html`, `components.json` (shadcn); Vite e Vitest em `frontend/config/`; Prettier em `frontend/config/prettier/`. Detalhe: [`frontend/README-FRONT.md`](frontend/README-FRONT.md).
- **`backend/`** — Node, tRPC, Drizzle (`drizzle.config.ts`), scripts CLI, documentação em [`backend/README-BACK.md`](backend/README-BACK.md), `.env.example`.
- **`docs/`** — Manuais: [**Manual técnico**](docs/MANUAL-TECNICO.md) (arquitectura, API, ambiente) e [**Manual do utilizador**](docs/MANUAL-USUARIO.md) (funcionalidades e uso, com espaços para capturas de ecrã). Índice: [`docs/README.md`](docs/README.md).

Variáveis de ambiente: copie `backend/.env.example` para **`.env` nesta pasta** (`fluxtrace_web/.env`).

```bash
pnpm install
pnpm dev
```

Typecheck: `pnpm check` (usa `frontend/tsconfig.json` e `backend/tsconfig.json`).
