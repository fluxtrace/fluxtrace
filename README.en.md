# **FluxTrace — Web application for Contradef trace correlation and flow analysis**

**FluxTrace** is a **full-stack web system** (React + Node) for **correlation**, **heuristic log reduction**, **flow visualisation**, and **analyst workflows** on artefacts produced in the **Contradef** instrumentation pipeline (e.g. `*.cdf` traces and related batches). It complements the [**Contradef**](https://github.com/contradef) pintool: Contradef **generates** traces; FluxTrace **ingests, manages, and explores** them through a browser UI, REST/tRPC APIs, and PostgreSQL persistence.

**Repository:** [github.com/fluxtrace/fluxtrace](https://github.com/fluxtrace/fluxtrace)

> **Note:** The **canonical artifact README** for SBSeg 2026 CTA / Tool Demo is **[README.md](README.md)** (Portuguese, full CTA template). This file is an English reference only.

## Abstract

FluxTrace targets analysts and researchers who work with **high-volume Contradef-style logs**. The application supports **batch ingestion** (“reduce logs”), **dashboards**, **consolidated interpretation** (flow graphs, evidence panels), optional **VirusTotal** and **MITRE ATT&CK** enrichment when the server is configured, and **user administration**. The codebase is a **monorepo slice**: `fluxtrace_web/` holds the npm package (frontend + backend in one process in development); **`test-samples/`** at the repository root holds optional **large sample archives** (see `test-samples/README.md`, Git LFS or external mirror).

---

## Quick start

```bash
git lfs install
git clone https://github.com/fluxtrace/fluxtrace.git
cd fluxtrace
git lfs pull
corepack enable
cd fluxtrace_web
cp backend/.env.example .env
# edit DATABASE_URL, JWT_SECRET, AUTH_MODE=local, VITE_AUTH_MODE=local
pnpm install
pnpm db:push
pnpm dev
```

Open `http://localhost:3000/`.

---

## Architecture

![FluxTrace functional pipeline](fluxtrace_web/docs/fluxtrace-arquitetura.png)

Three phases: **ingestion** (Contradef logs upload) → **processing & heuristic reduction** (M1 knowledge base, correlation engine) → **visualization** (M1 diagrams, compact malware flow graph, evidence panel, MITRE, consolidated interpretation).

Technical stack details: [`fluxtrace_web/docs/MANUAL-TECNICO.md`](fluxtrace_web/docs/MANUAL-TECNICO.md).

---

## Repository layout

```
fluxtrace/
├── README.md                 ← CTA artifact README (PT)
├── LICENSE                   ← MIT
├── fluxtrace_web/            ← main web application
├── test-samples/             ← 16 Contradef sample zips
├── funcoes-mapeadas/         ← M1 function catalog (47 APIs)
├── resultados/
│   ├── capturas-tela/        ← experiment screenshots (paper Sec. 4)
│   └── artefatos/            ← exported batch outputs (JSON, MD, Mermaid)
└── render.yaml
```

---

## Key experiment samples (paper Sec. 4)

| Claim | SHA-256 (prefix) | batchId | Reference |
|-------|------------------|---------|-----------|
| Reduction 99.7% / Trojan | `49aa7438…` | `ctr-JD-QvLcmsO` | `fluxtrace_07.png`, `resultados/artefatos/49aa7438…/` |
| Compact graph / Backdoor | `db32e48a…` | `ctr-ZbPqaQOXo0` | `fluxtrace_10.png`, `resultados/artefatos/db32e48a…/` |

**Aggregate (15 completed batches):** 150.1 GB raw (913.1 M lines) reduced to 666 MB (3.39 M lines) — **99.56% overall reduction** (98.08%–99.97% per batch), 0 failures. Full per-batch and per-file tables: [`resultados/README.md`](resultados/README.md).

Full reproduction steps: [README.md](README.md) (Portuguese, CTA template).

---

## Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Full CTA template (PT): seals, install, minimal test, experiments |
| [resultados/README.md](resultados/README.md) | Screenshot index and sample → figure mapping |
| [resultados/artefatos/README.md](resultados/artefatos/README.md) | Exported tool outputs per batch |
| [fluxtrace_web/readme-web.md](fluxtrace_web/readme-web.md) | Package operations |
| [fluxtrace_web/docs/MANUAL-DEV-LOCAL.md](fluxtrace_web/docs/MANUAL-DEV-LOCAL.md) | Local setup (PT) |
| [fluxtrace_web/docs/MANUAL-TECNICO.md](fluxtrace_web/docs/MANUAL-TECNICO.md) | Technical manual (PT) |
| [fluxtrace_web/docs/MANUAL-USUARIO.md](fluxtrace_web/docs/MANUAL-USUARIO.md) | User manual (PT) |
| [test-samples/README.md](test-samples/README.md) | Sample inventory |

---

## License

MIT — see [LICENSE](LICENSE).

**Contradef (DBI / traces):** [https://github.com/contradef](https://github.com/contradef)
