# **FluxTrace — Web application for Contradef trace correlation and flow analysis**

**FluxTrace** is a **full-stack web system** (React + Node) for **correlation**, **heuristic log reduction**, **flow visualisation**, and **analyst workflows** on artefacts produced in the **Contradef** instrumentation pipeline (e.g. `*.cdf` traces and related batches). It complements the [**Contradef**](https://github.com/contradef) pintool: Contradef **generates** traces; FluxTrace **ingests, manages, and explores** them through a browser UI, REST/tRPC APIs, and PostgreSQL persistence.

**Repository:** [github.com/fluxtrace/fluxtrace](https://github.com/fluxtrace/fluxtrace)

## Abstract

FluxTrace targets analysts and researchers who work with **high-volume Contradef-style logs**. The application supports **batch ingestion** (“reduce logs”), **dashboards**, **consolidated interpretation** (flow graphs, evidence panels), optional **VirusTotal** and **MITRE ATT&CK** enrichment when the server is configured, and **user administration**. The codebase is a **monorepo slice**: `fluxtrace_web/` holds the npm package (frontend + backend in one process in development); **`amostras-testes/`** at the repository root holds optional **large sample archives** (see `amostras-testes/README.md`, Git LFS or external mirror).

---

## Table of contents

* [1. README organization](#1-readme-organization)
  * [1.1 Document structure](#11-document-structure)
  * [1.2 Contents of this repository](#12-contents-of-this-repository)
  * [1.3 Repository layout](#13-repository-layout)
* [2. Relationship to Contradef](#2-relationship-to-contradef)
* [3. Basic information](#3-basic-information)
  * [3.1 Introduction](#31-introduction)
  * [3.2 Main capabilities](#32-main-capabilities)
  * [3.3 Architecture](#33-architecture)
  * [3.4 How the stack is run](#34-how-the-stack-is-run)
  * [3.5 Recommended environment](#35-recommended-environment)
* [4. Dependencies](#4-dependencies)
* [5. Security concerns](#5-security-concerns)
* [6. Installation and running locally](#6-installation-and-running-locally)
* [7. Minimal test](#7-minimal-test)
* [8. Samples and heavy artefacts](#8-samples-and-heavy-artefacts)
* [9. License](#9-license)
* [Portuguese documentation](#portuguese-documentation)

---

# 1. README organization

## 1.1 Document structure

1. **README organization** — how this file and the repo are structured.
2. **Relationship to Contradef** — link to the DBI tool and trace format.
3. **Basic information** — scope, features, architecture, runtime model.
4. **Dependencies** — Node, pnpm, PostgreSQL, optional tooling.
5. **Security concerns** — malware samples, isolation, secrets, auth modes.
6. **Installation and running locally** — clone, env, database, dev server.
7. **Minimal test** — quick validation without a full production setup.
8. **Samples and heavy artefacts** — `amostras-testes/`, LFS, mirrors.
9. **License** — terms for this repository.

## 1.2 Contents of this repository

* **`fluxtrace_web/`** — single **pnpm** package: **React (Vite)** SPA + **Express** API (**tRPC**, **Drizzle**, PostgreSQL).
* **`amostras-testes/`** — optional **`.zip`** sample bundles for testing (may use **Git LFS**); see `amostras-testes/README.md`.
* **Root metadata** — `render.yaml` (optional PaaS blueprint), `.gitattributes` (LFS patterns), this `README.md`.

Operational detail for developers (routes, env vars, deploy checklist) lives in **`fluxtrace_web/readme-web.md`**. Step-by-step setup on a **clean machine** (including VS Code) is in **`fluxtrace_web/docs/MANUAL-DEV-LOCAL.md`** (Portuguese).

## 1.3 Repository layout

```
fluxtrace/                         ← repository root (name may differ when extracted from .zip)
├── fluxtrace_web/                  ← main web application (pnpm project root)
│   ├── frontend/                   ← React, Vite, Tailwind, SPA entry
│   ├── backend/                    ← Express, tRPC, Drizzle, services
│   ├── docs/                       ← MANUAL-TECNICO, MANUAL-USUARIO, MANUAL-DEV-LOCAL, …
│   ├── package.json                ← scripts: dev, build, test, db:push, …
│   ├── readme-web.md               ← single package README (operations + structure)
│   └── .env                        ← not version-controlled (copy from backend/.env.example)
├── amostras-testes/                ← optional test zips (+ README); may be Git LFS
├── render.yaml                     ← optional Render blueprint
├── .gitattributes                  ← e.g. LFS for large zips under amostras-testes/
└── README.md                       ← this file
```

---

# 2. Relationship to Contradef

| Project | Role |
|---------|------|
| [**Contradef**](https://github.com/contradef) (organization [**github.com/contradef**](https://github.com/contradef)) | **Dynamic binary instrumentation** (Intel Pin): records instruction flow, memory, API calls into **`*.cdf`** (and related) traces inside a **controlled** Windows analysis VM. |
| **FluxTrace** (this repo) | **Web platform** to upload, reduce, store, and **analyse** Contradef-oriented workloads: dashboards, correlation, consolidated interpretation, exports, optional VT/MITRE when configured. |

> **Important:** Running **malware samples** belongs in an **isolated, offline VM** with snapshots, as described in the Contradef documentation. FluxTrace is typically run on an **analyst workstation or server** that processes **already collected** trace bundles — still treat uploads as **untrusted** and harden the deployment (auth, network, backups).

---

# 3. Basic information

## 3.1 Introduction

FluxTrace exposes a **single origin** in development: **Express** serves the **Vite** dev middleware and the `/api/...` routes (tRPC at `/api/trpc`, uploads and other REST handlers as documented in `readme-web.md`). The browser loads the SPA and talks to the same host/port (typically **`http://localhost:3000/`** when port 3000 is free).

## 3.2 Main capabilities

* **Analysis batches** — create, monitor, and inspect jobs (“reduce logs”, status, artifacts).
* **Reduced logs & correlation** — heuristics and UI for exploring trace-derived evidence.
* **Interpretation views** — consolidated views, flow-related visualisations, optional **VirusTotal** file/behaviour summaries when `VIRUSTOTAL_API_KEY` is set server-side.
* **MITRE / taxonomies** — framework-aligned material when the deployment provides data (see technical manual).
* **Identity** — configurable modes: local email/password, OIDC, development bypass (`AUTH_MODE` / `VITE_AUTH_MODE` — must stay aligned).
* **Administration** — user management for privileged accounts when enabled.

## 3.3 Architecture

| Layer | Responsibility |
|-------|----------------|
| **Browser** | React 19 SPA (Vite 7), TanStack Query, tRPC client, wouter routes. |
| **Node (Express)** | HTTP API, tRPC router, file upload pipelines, OAuth hooks (if configured), static assets in production. |
| **PostgreSQL** | Persistent state via **Drizzle ORM** (users, batches, analysis data). |
| **External APIs** | Optional VirusTotal v3, object storage / proxies depending on `.env`. |

```mermaid
flowchart LR
  subgraph browser[BROWSER (React SPA)]
    UI[FluxTrace UI]
  end
  subgraph node[Node: Express + Vite dev or static]
    API[tRPC + REST]
    Vite[Vite dev / static]
  end
  DB[(PostgreSQL)]
  UI --> Vite
  UI --> API
  API --> DB
```

## 3.4 How the stack is run

1. **Development** — `pnpm dev` (from `fluxtrace_web/`) runs `tsx watch` on `backend/_core/server/index.ts`; Vite attaches as middleware; API and UI share one port (`PORT` or default **3000**, with fallback ports if busy).
2. **Production** — `pnpm build` produces server bundle + static frontend; `pnpm start` serves built assets and the API (see `readme-web.md` / `render.yaml`).

## 3.5 Recommended environment

| Layer | Suggestion |
|-------|------------|
| **Host (dev)** | **Windows 10/11**, **Linux**, or **macOS**; **Node.js 20 LTS or 22**; **pnpm** via **Corepack**. |
| **RAM** | ≥ **8 GB** for comfortable dev (more for large local uploads). |
| **Database** | **PostgreSQL 14+** locally, in Docker, or hosted (SSL parameters via `DATABASE_URL` / `DATABASE_SSL`). |
| **Browser** | Recent **Chrome**, **Edge**, or **Firefox** for the SPA. |

---

# 4. Dependencies

| Dependency | Notes |
|------------|--------|
| **Git** | Clone and update this repository. |
| **Node.js** | **20 LTS** or **22** (see `fluxtrace_web/package.json` / organization policy). |
| **Corepack + pnpm** | `corepack enable`; install with **`pnpm install`** inside **`fluxtrace_web/`** (do not rely on `npm install` for the app root). |
| **PostgreSQL** | Required for normal operation (`DATABASE_URL`). |
| **Optional: Docker** | Convenient for a local Postgres container (see `MANUAL-DEV-LOCAL.md`). |
| **Optional: Git LFS** | If sample `*.zip` under `amostras-testes/` are stored as LFS pointers (see `.gitattributes`). Official: [Git LFS](https://git-lfs.com/). |

---

# 5. Security concerns

## 5.1 Main risk vectors

| Vector | Description |
|--------|-------------|
| **Malware in samples** | Trace bundles may originate from **malicious binaries**. Treat uploads as **untrusted**; restrict network egress in sensitive deployments. |
| **Secrets** | Never commit **`.env`**; keep **`JWT_SECRET`**, database credentials, and **`VIRUSTOTAL_API_KEY`** out of version control and client bundles (`VITE_*` only for non-secret config). |
| **Auth misconfiguration** | `AUTH_MODE=none` is for **development**; do not expose unauthenticated admin surfaces to the internet. |
| **Large uploads** | Disk exhaustion and DoS risk — configure limits, monitoring, and temp paths (`CONTRADEF_*` in `.env.example`). |

## 5.2 Mandatory measures (production-oriented checklist)

1. Use **strong** `JWT_SECRET` and **rotated** database credentials.
2. Set **`AUTH_MODE` / `VITE_AUTH_MODE`** appropriately (e.g. **local** or **oidc**); rebuild/redeploy when changing `VITE_*`.
3. Place the service **behind HTTPS** and reverse proxy; Express uses `trust proxy` for secure cookies.
4. **Isolate** analyst VMs used with Contradef from production FluxTrace hosts if policy requires it.

## 5.3 Disclaimer

This software is provided **as-is** for **research and authorised security operations**. The authors are **not liable** for damage from misuse, execution of malware outside an isolated environment, or misconfigured deployments. Third-party data (e.g. VirusTotal) is subject to **their** terms of use.

---

# 6. Installation and running locally

> **Full walkthrough** (clean Windows machine, VS Code, screenshots): **`fluxtrace_web/docs/MANUAL-DEV-LOCAL.md`**.  
> **Package-centric reference**: **`fluxtrace_web/readme-web.md`**.

**Short path** (from repository root):

```bash
corepack enable
cd fluxtrace_web
```

Copy **`backend/.env.example`** to **`fluxtrace_web/.env`**, set at least **`DATABASE_URL`** and **`JWT_SECRET`**, then:

```bash
pnpm install
pnpm db:push
pnpm dev
```

Open the URL printed in the terminal (typically **`http://localhost:3000/`**).

**Shortcuts from repository root** — the root `package.json` forwards **`dev`**, **`build`**, **`test`**, and **`check`** into `fluxtrace_web/`:

```bash
pnpm dev
pnpm build
pnpm test
pnpm check
```

Run **`pnpm install`** and **`pnpm db:push`** from **`fluxtrace_web/`** the first time (or use `--dir fluxtrace_web` as below).

**From repo root without `cd`** (if your toolchain prefers):

```bash
corepack enable
pnpm install --dir fluxtrace_web
pnpm --dir fluxtrace_web db:push
pnpm --dir fluxtrace_web dev
```

Production environment variables (e.g. Render): see **`fluxtrace_web/backend/RENDER-ENV.md`**.

---

# 7. Minimal test

After `pnpm install` and a working `.env` + database:

```bash
cd fluxtrace_web
pnpm check    # Typecheck frontend + backend
pnpm test     # Vitest (frontend + backend)
```

If both succeed, the toolchain is consistent. Optionally run **`pnpm build`** to validate a production build.

---

# 8. Samples and heavy artefacts

* **`amostras-testes/README.md`** — download mirrors, **Git LFS** usage, optional performance reference table (package names = SHA-256 of bundles).
* Large binaries may **not** be present in shallow clones; follow the README for **Drive** or **LFS** fetch instructions.

Heavy paths and legacy trees may have been trimmed from some clones; recover from your organization’s **canonical** Git remote if files are missing.

---

# 9. License

The application package in **`fluxtrace_web/`** is licensed under the **MIT License** (see `fluxtrace_web/package.json`). Dependencies (React, Drizzle, Express, etc.) remain under their respective licenses.

> **Third-party:** When integrating **VirusTotal**, **Intel Pin** (via Contradef), or other tools, comply with **their** license and acceptable-use terms.

---

## Portuguese documentation

This README stays in **English** so it mirrors the style of the [**Contradef**](https://github.com/contradef) artefact README and is easy to share internationally. **Full guides in Portuguese** are maintained inside **`fluxtrace_web/`**:

| Document | Purpose |
|----------|---------|
| [`fluxtrace_web/readme-web.md`](fluxtrace_web/readme-web.md) | Single operational README for the web package (stack, routes, env, deploy summary). |
| [`fluxtrace_web/docs/MANUAL-DEV-LOCAL.md`](fluxtrace_web/docs/MANUAL-DEV-LOCAL.md) | Step-by-step **local setup** (clean machine, VS Code, PostgreSQL, `.env`, `pnpm dev`). |
| [`fluxtrace_web/docs/MANUAL-TECNICO.md`](fluxtrace_web/docs/MANUAL-TECNICO.md) | Technical architecture and operations. |
| [`fluxtrace_web/docs/MANUAL-USUARIO.md`](fluxtrace_web/docs/MANUAL-USUARIO.md) | End-user manual for the web UI. |
| [`amostras-testes/README.md`](amostras-testes/README.md) | Test sample bundles (LFS / mirrors, reference timings). |

Duplicating the entire English README here in Portuguese would be **long** and **hard to keep in sync**; prefer updating the files above when details change.

---

**Contradef (DBI / traces):** [https://github.com/contradef](https://github.com/contradef)
