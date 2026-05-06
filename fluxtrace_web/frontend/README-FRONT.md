# FluxTrace — frontend

Documentação da pasta `frontend/`: organização, stack e ligação ao backend. O pacote npm único do projecto vive na pasta **pai** (`fluxtrace_web/`): dependências, `pnpm install`, `pnpm dev` e `pnpm build` correm a partir de `fluxtrace_web/`, não dentro de `frontend/`.

## Stack tecnológica

| Área | Tecnologia |
|------|------------|
| UI | **React 19** + **TypeScript** |
| Build / dev server | **Vite 7** |
| Estilos | **Tailwind CSS 4** (+ `tw-animate-css`, variáveis em CSS; ver `src/styles/global.css`) |
| Componentes base | **shadcn/ui** (Radix UI + `class-variance-authority`), configurado em `components.json` |
| Rotas | **wouter** (SPA leve) |
| Dados do servidor | **tRPC v11** + **TanStack React Query** |
| Serialização | **superjson** (datas, `Map`, etc. no wire) |
| Formulários | **react-hook-form** + **Zod** (quando aplicável) |
| Gráficos / diagramas | **@xyflow/react**, **Mermaid**, **Recharts**, **dagre** |
| i18n | **i18next** + **react-i18next** (`src/i18n/`) |
| Testes | **Vitest** + **Testing Library** (`frontend/config/vitest.config.ts`) |
| Tipagem partilhada | Imports directos de `../backend/shared` via alias `@shared/*` (tipos e constantes alinhados com o servidor) |

Ferramentas de projeto (configs em `frontend/config/`): **Prettier**, patch **pnpm** para `wouter`, **@vitejs/plugin-react**, **@tailwindcss/vite**, **jsx-loc** (plugin de localização em JSX).

## Estrutura de pastas

Visão lógica da árvore (ficheiros soltos na raiz de `frontend/` e pastas principais de `src/`).

```
frontend/
├── README-FRONT.md          # este ficheiro
├── index.html               # entrada HTML; script → /src/app/main.tsx
├── tsconfig.json            # TS do cliente; paths @/*, @backend/*, @shared/*
├── components.json          # shadcn: aliases, CSS global Tailwind
├── public/
│   └── icons/
│       └── favicon.svg
├── config/                  # tooling (não é código da app)
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── prettier/
│   └── patches/             # patchedDependencies (pnpm)
└── src/
    ├── app/                 # bootstrap React
    │   ├── main.tsx         # createRoot, QueryClient, tRPC client, CSS global
    │   └── App.tsx          # providers UI, rotas wouter
    ├── pages/               # ecrãs por rota (agrupados por domínio)
    │   ├── auth/            # Login, Register, ForceChangePassword
    │   ├── home/            # Home, HomeDashboard, LandingPage, Home.test.tsx
    │   ├── admin/           # AdminUsers
    │   ├── reduce-logs/     # ReduceLogs, reduceLogsMonitor(.test).ts
    │   ├── analysis/        # InterpretacaoConsolidada, FuncoesMapeadas
    │   ├── account/         # Profile
    │   ├── dev/             # ComponentShowcase
    │   └── errors/          # NotFound
    ├── components/
    │   ├── ui/              # primitives shadcn (não mover — CLI espera @/components/ui)
    │   ├── layout/          # DashboardLayout, skeleton
    │   ├── shell/           # ErrorBoundary, tema, idioma
    │   ├── auth/            # branding login local
    │   ├── flow/            # grafos de fluxo
    │   ├── log-evidence/    # contextos e ícones de evidência
    │   ├── virus-total/, mitre/, widgets/, …
    ├── lib/                 # lógica cliente reutilizável
    │   ├── api/             # trpc (createTRPCReact)
    │   ├── analysis/        # fluxo, export JSON, Mermaid, UI de análise
    │   ├── reduce-logs/     # debug, Excel, sessão, métricas de ficheiro
    │   ├── log-evidence/    # PNG, carregamento de snippets
    │   ├── core/            # format, payload, brand, fileHash, …
    │   └── utils.ts         # cn() — mantido na raiz de lib (shadcn usa @/lib/utils)
 ├── services/               # cliente HTTP dedicado (ex.: uploads em `analysisService.ts`)
    ├── hooks/              # hooks genéricos
    ├── contexts/           # ThemeContext, etc.
    ├── config/             # auth público (URLs de login / OAuth no browser)
    ├── i18n/               # config + locales JSON
    ├── styles/
    │   └── global.css      # Tailwind + tema + tokens
    ├── types/
    │   └── vite-env.d.ts   # VITE_* tipados
    └── _core/hooks/        # ex.: useAuth (tRPC)
```

## Aliases TypeScript / Vite

Definidos em `tsconfig.json` (e espelhados no Vite):

| Alias | Aponta para |
|-------|-------------|
| `@/*` | `frontend/src/*` |
| `@backend/*` | `backend/*` (uso pontual; o router tRPC vem tipado de `@backend/controllers/routers`) |
| `@shared/*` | `backend/shared/*` (tipos e constantes partilhados com o servidor) |

Variáveis de ambiente **do browser** (prefixo `VITE_`) estão descritas em `src/types/vite-env.d.ts` (ex.: `VITE_AUTH_MODE`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`). Valores efectivos: ficheiro `.env` na pasta **`fluxtrace_web/`** (não no `frontend/` isolado).

## Rotas (path → página)

Definição em **`src/app/App.tsx`** com **wouter** (`<Switch>` / `<Route>`). Qualquer alteração de URL ou componente deve reflectir-se aqui e nesta tabela.

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
| * (não listado acima) | `NotFound` | Última rota do `Switch` — captura 404 |

### Comportamento ligado à sessão (`trpc.auth.me`)

Antes de renderizar o mapa de rotas, `AppRouter` consulta **`trpc.auth.me`**:

- Se o utilizador tiver **`mustChangePassword`**, é forçada a navegação para **`/trocar-senha-obrigatorio`** (excepto se já estiver nesse path).
- Quem já mudou a palavra-passe e está em `/trocar-senha-obrigatorio` é redireccionado para **`/`**.
- Utilizador **não autenticado** em `/trocar-senha-obrigatorio` é enviado para **`/login`**.

Enquanto a query `auth.me` está a carregar, ou durante estes redireccionamentos intermédios, pode ver-se o ecrã de **loading** (`FullScreenLoad`).

## Comunicação com o backend

O servidor **Express** em `backend/` serve a API na **mesma origem** em desenvolvimento e em produção (após `build`, assets estáticos + API). O frontend não aponta para um host API separado por defeito: usa caminhos relativos `/api/...`.

### 1. tRPC (principal)

- **Cliente:** `src/lib/api/trpc.ts` — `createTRPCReact<AppRouter>()`, onde `AppRouter` é importado do backend (`@backend/controllers/routers`), garantindo **contrato tipado** ponta a ponta.
- **Montagem:** `src/app/main.tsx` cria o cliente com `httpBatchLink` sobre **`/api/trpc`**, `superjson` como transformer, `credentials: "include"` para enviar **cookies** de sessão, e cabeçalhos opcionais de debug (`getTrpcClientDebugHeaders`).
- **Uso na UI:** `trpc.*.useQuery` / `useMutation` dentro de componentes envoltos por `<trpc.Provider>` e `QueryClientProvider`.
- **Erros de auth:** subscrições ao `QueryClient` e `MutationCache` tratam mensagens conhecidas (`UNAUTHED_ERR_MSG`, `MUST_CHANGE_PASSWORD_ERR_MSG`) e redireccionam para login ou troca obrigatória de senha.

### 2. HTTP REST (casos específicos)

Para fluxos que não passam pelo router tRPC (ex.: **upload em chunks** de ficheiros grandes), o módulo `src/services/analysisService.ts` usa **`fetch`** para rotas sob **`/api/reduce-logs/...`** (init, chunk, complete, capacidades, etc.), também com `credentials: "include"` onde aplicável. Tipos partilhados com páginas podem vir de `@shared/*` ou de módulos locais em `pages/reduce-logs/`.

### 3. Partilha de tipos com o servidor

Além do `AppRouter`, muitos tipos vêm de **`backend/shared`** (`@shared/...`), evitando duplicar definições de análise, constantes de erro, etc.

## Comandos úteis (executar em `fluxtrace_web/`)

- **Servidor de desenvolvimento** (Express + Vite em middleware): `pnpm dev`
- **Typecheck do frontend:** `tsc --noEmit -p frontend/tsconfig.json` (ou `pnpm check` para front + back)
- **Testes do frontend:** `pnpm exec vitest run -c frontend/config/vitest.config.ts`
- **Build da SPA:** `vite build --config frontend/config/vite.config.ts` (o `pnpm build` da raiz também compila o bundle do servidor)

## Leitura adicional

- Manuais na pasta **`docs/`** ([`MANUAL-TECNICO.md`](../docs/MANUAL-TECNICO.md), [`MANUAL-USUARIO.md`](../docs/MANUAL-USUARIO.md), [`README.md`](../docs/README.md))
- Visão geral do repositório: `fluxtrace_web/README.md`
- Backend e API: `fluxtrace_web/backend/README-BACK.md` (ou código em `backend/_core/server/`)
