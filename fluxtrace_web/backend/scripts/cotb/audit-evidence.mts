/**
 * Auditoria de preservação de evidência (CotB), independente do motor.
 *
 * Relê cada .cdf original contando linhas por `\n` (como sed/editores) e confronta com o
 * `trace-index.json` e com `reduced/<cdf>.txt` gerados por run-official-batch.mts.
 *
 *   cd fluxtrace_web
 *   npx tsx backend/scripts/cotb/audit-evidence.mts
 *   npx tsx backend/scripts/cotb/audit-evidence.mts --only ed1e5e57 --limit 3
 *
 * Saídas (OUT_ROOT): fluxtrace-audit-<motor>.csv, fluxtrace-audit-<motor>.md,
 * <artefactos>/<hash>/audit.json e, quando houver, case-isdebuggerpresent.json.
 */
import { createReadStream } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { TRACE_ENGINE_VERSION, type TraceIndexHit } from "../../services/analysis/traceIndexArtifact";
import { callSiteSegment, isSystemCalleeModule } from "../../services/analysis/traceOrigin";

const UPLOAD_ROOT = process.env.COTB_UPLOAD_ROOT?.trim() || "G:\\cotb-pin-100\\fluxtrace-upload";
const OUT_ROOT = process.env.COTB_OUT_ROOT?.trim() || "G:\\cotb-pin-100";
const ARTIFACT_ROOT =
  process.env.COTB_ARTIFACT_ROOT?.trim() || join(OUT_ROOT, `fluxtrace-artifacts-${TRACE_ENGINE_VERSION}`);
const MANIFEST = join(UPLOAD_ROOT, "manifest-cdf.csv");
const AUDIT_CSV = join(OUT_ROOT, `fluxtrace-audit-${TRACE_ENGINE_VERSION}.csv`);
const AUDIT_MD = join(OUT_ROOT, `fluxtrace-audit-${TRACE_ENGINE_VERSION}.md`);

const CASE_API = "IsDebuggerPresent";
const CASE_MAX_CAPTURES = 3;
const CASE_AFTER_LINES = 40;
const CASE_BEFORE_LINES = 3;

type Kind = "interceptor" | "m1" | "m2" | "memory" | "dasm" | "instr" | "other";

function classifyCdf(name: string): Kind {
  const n = name.toLowerCase();
  if (n.includes("functioninterceptor")) return "interceptor";
  if (n.includes("tracefcncall.m1")) return "m1";
  if (n.includes("tracefcncall.m2")) return "m2";
  if (n.includes("tracememory")) return "memory";
  if (n.includes("tracedisassembly")) return "dasm";
  if (n.includes("traceinstructions")) return "instr";
  return "other";
}

const ORDER: Kind[] = ["interceptor", "m1", "m2", "memory", "dasm", "instr", "other"];

function parseArgs(argv: string[]) {
  const limitIdx = argv.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number.parseInt(argv[limitIdx + 1] ?? "0", 10) : 0;
  const onlyIdx = argv.indexOf("--only");
  const only = onlyIdx >= 0 ? (argv[onlyIdx + 1] ?? "").trim().toLowerCase() : "";
  return { limit: Number.isFinite(limit) && limit > 0 ? limit : 0, only };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cols[i] ?? "").trim()));
    return row;
  });
}

/** Linhas por `\n` (um `\r` final é removido). latin1 preserva bytes 1:1. */
async function forEachLine(path: string, onLine: (lineNumber: number, line: string) => void): Promise<number> {
  let n = 0;
  let carry: Buffer | null = null;
  for await (const chunk of createReadStream(path, { highWaterMark: 4 << 20 }) as AsyncIterable<Buffer>) {
    let buf: Buffer = carry ? Buffer.concat([carry, chunk]) : chunk;
    let start = 0;
    for (;;) {
      const nl = buf.indexOf(10, start);
      if (nl < 0) break;
      let end = nl;
      if (end > start && buf[end - 1] === 13) end -= 1;
      n += 1;
      onLine(n, buf.latin1Slice(start, end));
      start = nl + 1;
    }
    carry = start < buf.length ? buf.subarray(start) : null;
    buf = Buffer.alloc(0);
  }
  if (carry && carry.length) {
    n += 1;
    let end = carry.length;
    if (carry[end - 1] === 13) end -= 1;
    onLine(n, carry.latin1Slice(0, end));
  }
  return n;
}

const normAddr = (s: string) => s.trim().toLowerCase().replace(/^0x/, "").replace(/^0+(?=.)/, "");

const FI_HEADER = /^\s*\[\+\]\s+([A-Za-z_][A-Za-z0-9_]*)\.\.\.\s*$/;
const FI_THREAD = /^\s*Thread:\s*(\d+)/;
const FI_CALL_ID = /^\s*Id de chamada:\s*(\d+)/;
const FI_ROUTINE = /^\s*Endere.{1,3}o da rotina:\s*(?:0x)?([0-9a-fA-F]+)/;
const FI_CALLER = /^\s*Endere.{1,3}o da fun.{1,6}o chamante:\s*(?:0x)?([0-9a-fA-F]+)/;
const FI_PARAMS = /^\s*Par.{1,3}metros:/;
const FI_RETURN = /^\s*(?:Retorno\s+([A-Za-z_][A-Za-z0-9_]*)|Valor de retorno)\s*:/;
const M_LINE = /^\s*([0-9a-fA-F]{6,16})\s+T\[(\d+)\]\s+.*:([A-Za-z_][A-Za-z0-9_]*)\s*$/;
/** A Contradef grava `ret addr` em hex (`0x…`) ou em decimal, consoante a versão. */
const TI_RET_ADDR = /ret addr:\s*(0x[0-9a-fA-F]+|\d+)/;
const retAddrHex = (raw: string) => (raw.startsWith("0x") ? normAddr(raw) : BigInt(raw).toString(16));
const TI_CALL = /^(?:\| )*(?:Call|Tailcall)\b/;
const TI_RETURN_FN = /^(?:\| )*Return\s+0x[0-9a-fA-F]+\s+\S+?:([A-Za-z_][A-Za-z0-9_]*)/;
const TI_JCC = /\s(?!jmp\b)(j[a-z]{1,4})\s+0x/i;
const TI_TEST_CMP = /\s(test|cmp)\s/i;

type FiEvent = {
  api: string;
  line: number;
  endLine: number;
  thread: string | null;
  callId: string | null;
  routine: string | null;
  caller: string | null;
  hasParams: boolean;
  hasReturn: boolean;
};

type Capture = { startLine: number; lines: Array<{ n: number; text: string }>; sawReturn: boolean; sawJcc: boolean; left: number };

async function auditSample(row: Record<string, string>, fiCallers: Set<string>) {
  const fiCallerMatched = new Set<string>();
  const hash = row.hash!.toLowerCase();
  const artifactDir = join(ARTIFACT_ROOT, hash);
  const index = JSON.parse(await readFile(join(artifactDir, "trace-index.json"), "utf8")) as {
    hits: TraceIndexHit[];
    sourceFiles: Array<{ fileName: string; sha256: string }>;
  };
  const cdfs = (await readdir(row.dest!))
    .filter((f) => f.toLowerCase().endsWith(".cdf"))
    .sort((a, b) => ORDER.indexOf(classifyCdf(a)) - ORDER.indexOf(classifyCdf(b)) || a.localeCompare(b));

  const hitsByFile = new Map<string, TraceIndexHit[]>();
  for (const h of index.hits) {
    const arr = hitsByFile.get(h.fileName) ?? [];
    arr.push(h);
    hitsByFile.set(h.fileName, arr);
  }

  const out = {
    hash,
    label: row.label ?? "",
    index_entries: index.hits.length,
    verified_entries: 0,
    mismatched_entries: 0,
    mismatch_examples: [] as Array<{ fileName: string; lineNumber: number; apis: string[]; text: string }>,
    fi_events: 0,
    fi_events_indexed: 0,
    fi_with_params: 0,
    fi_with_return: 0,
    fi_block_fully_reduced: 0,
    fi_reduced_available: 0,
    m_lines: 0,
    m_lines_indexed: 0,
    recall_skipped_files: [] as string[],
    assoc_name: 0,
    assoc_name_addr: 0,
    assoc_name_addr_thread: 0,
    assoc_unique: 0,
    assoc_ambiguous: 0,
    fi_caller_in_ti_ret: 0,
    ti_lines: 0,
    origin_evidence: {} as Record<string, number>,
    case_captures: 0,
  };

  for (const h of index.hits) {
    const kind = (h.originEvidence ?? "").split(":")[0] || "none";
    const key = `${h.origin ?? "unknown"}/${kind}`;
    out.origin_evidence[key] = (out.origin_evidence[key] ?? 0) + (h.occurrences ?? 1);
  }

  const fiEvents: FiEvent[] = [];
  const mIndex = new Map<string, { count: number; threads: Map<string, number> }>();
  const mNames = new Set<string>();
  const caseFi: Array<{ n: number; text: string }> = [];
  const caseM: Array<{ fileName: string; n: number; text: string }> = [];
  const captures: Array<{ fileName: string } & Capture> = [];

  for (const fileName of cdfs) {
    const path = join(row.dest!, fileName);
    const kind = classifyCdf(fileName);
    const fileHits = hitsByFile.get(fileName) ?? [];
    const wanted = new Map<number, TraceIndexHit[]>();
    for (const h of fileHits) {
      const arr = wanted.get(h.lineNumber) ?? [];
      arr.push(h);
      wanted.set(h.lineNumber, arr);
    }
    const aggregated = fileHits.some((h) => (h.occurrences ?? 1) > 1);
    const indexedApiAt = (n: number, api: string) => (wanted.get(n) ?? []).some((h) => h.apis.includes(api));
    if (aggregated && (kind === "interceptor" || kind === "m1" || kind === "m2")) out.recall_skipped_files.push(fileName);

    let cur: FiEvent | null = null;
    const ring: Array<{ n: number; text: string }> = [];
    const openCaptures: Capture[] = [];

    await forEachLine(path, (n, line) => {
      const here = wanted.get(n);
      if (here) {
        for (const h of here) {
          const ok = h.apis.every((api) => line.includes(api));
          if (ok) out.verified_entries += 1;
          else {
            out.mismatched_entries += 1;
            if (out.mismatch_examples.length < 5) {
              out.mismatch_examples.push({ fileName, lineNumber: n, apis: h.apis, text: line.slice(0, 200) });
            }
          }
        }
      }

      if (kind === "interceptor") {
        const hm = line.match(FI_HEADER);
        if (hm) {
          if (cur) fiEvents.push(cur);
          cur = null;
          if (!/^Informa/i.test(hm[1]!)) {
            cur = { api: hm[1]!, line: n, endLine: n, thread: null, callId: null, routine: null, caller: null, hasParams: false, hasReturn: false };
            out.fi_events += 1;
            if (!aggregated && indexedApiAt(n, cur.api)) out.fi_events_indexed += 1;
          }
        } else if (cur) {
          cur.endLine = n;
          let m: RegExpMatchArray | null;
          if ((m = line.match(FI_THREAD))) cur.thread = m[1]!;
          else if ((m = line.match(FI_CALL_ID))) cur.callId = m[1]!;
          else if ((m = line.match(FI_ROUTINE))) cur.routine = normAddr(m[1]!);
          else if ((m = line.match(FI_CALLER))) cur.caller = normAddr(m[1]!);
          else if (FI_PARAMS.test(line)) cur.hasParams = true;
          else if ((m = line.match(FI_RETURN)) && (m[1] === undefined || m[1] === cur.api)) cur.hasReturn = true;
          if (line.trimStart().startsWith("[*]")) {
            fiEvents.push(cur);
            cur = null;
          }
        }
        if (cur?.api === CASE_API && caseFi.length < 40) caseFi.push({ n, text: line });
      } else if (kind === "m1" || kind === "m2") {
        const m = line.match(M_LINE);
        if (m) {
          const [, addr, thread, api] = m;
          out.m_lines += 1;
          if (!aggregated && indexedApiAt(n, api!)) out.m_lines_indexed += 1;
          mNames.add(api!);
          const key = `${api}|${normAddr(addr!)}`;
          const e = mIndex.get(key) ?? { count: 0, threads: new Map<string, number>() };
          e.count += 1;
          e.threads.set(thread!, (e.threads.get(thread!) ?? 0) + 1);
          mIndex.set(key, e);
          if (api === CASE_API && caseM.length < 6) caseM.push({ fileName, n, text: line });
        }
      } else if (kind === "instr") {
        out.ti_lines += 1;
        const ret = line.includes("ret addr:") ? line.match(TI_RET_ADDR) : null;
        if (ret) {
          const addr = retAddrHex(ret[1]!);
          if (fiCallers.has(addr)) fiCallerMatched.add(addr);
        }

        for (const c of openCaptures) {
          if (c.left <= 0) continue;
          c.lines.push({ n, text: line });
          c.left -= 1;
          const fn = line.match(TI_RETURN_FN);
          if (fn?.[1] === CASE_API) c.sawReturn = true;
          else if (c.sawReturn && TI_JCC.test(line)) {
            c.sawJcc = true;
            c.left = Math.min(c.left, 2);
          }
        }
        if (
          captures.length + openCaptures.length < CASE_MAX_CAPTURES &&
          TI_CALL.test(line) &&
          line.includes(`:${CASE_API}`)
        ) {
          const site = callSiteSegment(line);
          const exe = site.match(/([A-Za-z0-9_\-]+\.exe)\b/i);
          if (exe && !isSystemCalleeModule(exe[1]!)) {
            openCaptures.push({
              startLine: n,
              lines: [...ring.slice(-CASE_BEFORE_LINES), { n, text: line }],
              sawReturn: false,
              sawJcc: false,
              left: CASE_AFTER_LINES,
            });
          }
        }
        ring.push({ n, text: line });
        if (ring.length > CASE_BEFORE_LINES) ring.shift();
        for (let i = openCaptures.length - 1; i >= 0; i -= 1) {
          if (openCaptures[i]!.left <= 0) captures.push({ fileName, ...openCaptures.splice(i, 1)[0]! });
        }
      }
    });
    if (cur) fiEvents.push(cur);
    for (const c of openCaptures) captures.push({ fileName, ...c });

    if (kind === "interceptor") {
      const reducedPath = join(artifactDir, "reduced", `${fileName}.txt`);
      const kept = new Set<number>();
      const haveReduced = await stat(reducedPath).then(() => true, () => false);
      if (haveReduced) {
        await forEachLine(reducedPath, (_n, line) => {
          const tab = line.indexOf("\t");
          if (tab > 0) kept.add(Number(line.slice(0, tab)));
        });
      }
      const original = new Map<number, string>();
      const spans = fiEvents.map((e) => [e.line, e.endLine] as const);
      if (haveReduced && spans.length) {
        await forEachLine(path, (n, line) => {
          for (const [a, b] of spans) {
            if (n >= a && n <= b) {
              original.set(n, line);
              break;
            }
          }
        });
      }
      for (const e of fiEvents) {
        if (e.hasParams) out.fi_with_params += 1;
        if (e.hasReturn) out.fi_with_return += 1;
        if (haveReduced) {
          out.fi_reduced_available += 1;
          let full = true;
          for (let n = e.line; n <= e.endLine; n += 1) {
            if ((original.get(n) ?? "").trim() && !kept.has(n)) {
              full = false;
              break;
            }
          }
          if (full) out.fi_block_fully_reduced += 1;
        }
      }
    }
  }

  for (const e of fiEvents) {
    if (!mNames.has(e.api)) continue;
    out.assoc_name += 1;
    const entry = e.routine ? mIndex.get(`${e.api}|${e.routine}`) : undefined;
    if (!entry) continue;
    out.assoc_name_addr += 1;
    const sameThread = e.thread != null ? entry.threads.get(e.thread) ?? 0 : 0;
    if (sameThread > 0) {
      out.assoc_name_addr_thread += 1;
      const fiSame = fiEvents.filter((o) => o.api === e.api && o.routine === e.routine && o.thread === e.thread).length;
      if (sameThread === 1 && fiSame === 1) out.assoc_unique += 1;
      else out.assoc_ambiguous += 1;
    }
  }
  out.fi_caller_in_ti_ret = fiEvents.filter((e) => e.caller && fiCallerMatched.has(e.caller)).length;

  const keptInReduced = new Map<string, Set<number>>();
  for (const c of captures) {
    if (keptInReduced.has(c.fileName)) continue;
    const want = new Set(captures.filter((o) => o.fileName === c.fileName).flatMap((o) => o.lines.map((l) => l.n)));
    const kept = new Set<number>();
    const reducedPath = join(artifactDir, "reduced", `${c.fileName}.txt`);
    if (await stat(reducedPath).then(() => true, () => false)) {
      await forEachLine(reducedPath, (_n, line) => {
        const v = Number(line.slice(0, line.indexOf("\t")));
        if (want.has(v)) kept.add(v);
      });
    }
    keptInReduced.set(c.fileName, kept);
  }

  const casePayload =
    captures.length || caseFi.length || caseM.length
      ? {
          hash,
          label: row.label,
          api: CASE_API,
          sourceFiles: index.sourceFiles,
          interceptor: caseFi,
          fcnCall: caseM,
          instructions: captures.map((c) => ({
            fileName: c.fileName,
            callLine: c.startLine,
            returnSeen: c.sawReturn,
            branchAfterReturn: c.sawJcc,
            testOrCmpAfterReturn: c.lines.some((l) => l.n > c.startLine && TI_TEST_CMP.test(l.text)),
            lines: c.lines.map((l) => ({ ...l, inReduced: keptInReduced.get(c.fileName)?.has(l.n) ?? false })),
          })),
        }
      : null;
  out.case_captures = captures.length;
  return { out, casePayload };
}

/** Endereços chamantes do FI, lidos antes para casar com `ret addr` do TI numa só passagem. */
async function collectFiCallers(dest: string): Promise<Set<string>> {
  const set = new Set<string>();
  for (const f of await readdir(dest)) {
    if (classifyCdf(f) !== "interceptor") continue;
    await forEachLine(join(dest, f), (_n, line) => {
      const m = line.match(FI_CALLER);
      if (m) set.add(normAddr(m[1]!));
    });
  }
  return set;
}

const CSV_FIELDS = [
  "hash",
  "label",
  "index_entries",
  "verified_entries",
  "mismatched_entries",
  "fi_events",
  "fi_events_indexed",
  "fi_with_params",
  "fi_with_return",
  "fi_reduced_available",
  "fi_block_fully_reduced",
  "m_lines",
  "m_lines_indexed",
  "assoc_name",
  "assoc_name_addr",
  "assoc_name_addr_thread",
  "assoc_unique",
  "assoc_ambiguous",
  "fi_caller_in_ti_ret",
  "ti_lines",
  "case_captures",
  "recall_skipped_files",
] as const;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestRows = parseCsv(await readFile(MANIFEST, "utf8"));
  let rows = [...manifestRows];
  if (args.only) rows = rows.filter((r) => r.hash!.toLowerCase().startsWith(args.only));
  rows.sort((a, b) => Number(a.instr_bytes || 0) - Number(b.instr_bytes || 0));
  if (args.limit) rows = rows.slice(0, args.limit);
  console.log(`auditoria engine=${TRACE_ENGINE_VERSION} n=${rows.length} artefactos=${ARTIFACT_ROOT}`);

  type AuditOut = Awaited<ReturnType<typeof auditSample>>["out"];
  let i = 0;
  for (const row of rows) {
    i += 1;
    const hash = row.hash!.toLowerCase();
    const t0 = Date.now();
    process.stdout.write(`[${i}/${rows.length}] ${row.label} ${hash.slice(0, 12)} ... `);
    try {
      const { out, casePayload } = await auditSample(row, await collectFiCallers(row.dest!));
      await writeFile(join(ARTIFACT_ROOT, hash, "audit.json"), JSON.stringify(out, null, 2), "utf8");
      if (casePayload) {
        await writeFile(join(ARTIFACT_ROOT, hash, "case-isdebuggerpresent.json"), JSON.stringify(casePayload, null, 2), "utf8");
      }
      console.log(`ok ${((Date.now() - t0) / 1000).toFixed(1)}s  verif=${out.verified_entries}/${out.index_entries}`);
    } catch (err) {
      console.log("FALHA");
      console.error(err);
    }
  }

  const results: AuditOut[] = [];
  for (const row of manifestRows) {
    const p = join(ARTIFACT_ROOT, row.hash!.toLowerCase(), "audit.json");
    const raw = await readFile(p, "utf8").catch(() => "");
    if (raw) results.push(JSON.parse(raw) as AuditOut);
  }
  let csv = CSV_FIELDS.join(",") + "\n";
  for (const out of results) {
    csv +=
      CSV_FIELDS.map((k) => {
        const v = (out as Record<string, unknown>)[k];
        const s = Array.isArray(v) ? v.join("|") : String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",") + "\n";
  }
  await writeFile(AUDIT_CSV, csv, "utf8");

  const sum = (k: keyof (typeof results)[number]) => results.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(2)}%` : "—");
  const originTotals: Record<string, number> = {};
  for (const r of results) for (const [k, v] of Object.entries(r.origin_evidence)) originTotals[k] = (originTotals[k] ?? 0) + v;
  const md = [
    `# Auditoria de evidência — motor \`${TRACE_ENGINE_VERSION}\` (n=${results.length})`,
    "",
    "Leitura independente do .cdf (linhas por `\\n`).",
    "",
    "## Auditoria (ficheiro:linha)",
    `- Entradas do índice verificadas: ${sum("verified_entries")}/${sum("index_entries")} (${pct(sum("verified_entries"), sum("index_entries"))}); divergentes: ${sum("mismatched_entries")}`,
    "",
    "## Extracção (recontagem independente)",
    `- Eventos FunctionInterceptor indexados na linha do cabeçalho: ${sum("fi_events_indexed")}/${sum("fi_events")} (${pct(sum("fi_events_indexed"), sum("fi_events"))})`,
    `- Linhas TraceFcnCall M1/M2 indexadas: ${sum("m_lines_indexed")}/${sum("m_lines")} (${pct(sum("m_lines_indexed"), sum("m_lines"))})`,
    `- Ficheiros FI/M1/M2 com índice agregado (recall não medido): ${results.reduce((a, r) => a + r.recall_skipped_files.length, 0)}`,
    "",
    "## Contexto",
    `- Eventos FI com Parâmetros: ${sum("fi_with_params")}/${sum("fi_events")}; com Retorno: ${sum("fi_with_return")}/${sum("fi_events")}`,
    `- Blocos FI integralmente na saída reduzida: ${sum("fi_block_fully_reduced")}/${sum("fi_reduced_available")} (${pct(sum("fi_block_fully_reduced"), sum("fi_reduced_available"))})`,
    "",
    "## Associação FI ↔ M1/M2",
    `- Mesmo nome: ${sum("assoc_name")}/${sum("fi_events")}`,
    `- Nome + endereço da rotina: ${sum("assoc_name_addr")}/${sum("fi_events")}`,
    `- Nome + endereço + thread: ${sum("assoc_name_addr_thread")}/${sum("fi_events")} (únicas ${sum("assoc_unique")}, ambíguas ${sum("assoc_ambiguous")})`,
    `- Endereço chamante FI = \`ret addr\` em TraceInstructions: ${sum("fi_caller_in_ti_ret")}/${sum("fi_events")}`,
    "",
    "## Origem (ocorrências por evidência)",
    ...Object.entries(originTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `- ${k}: ${v}`),
    "",
    `## Estudo de caso (${CASE_API} chamado por .exe em TraceInstructions)`,
    ...results.filter((r) => r.case_captures > 0).map((r) => `- ${r.hash} (${r.label}): ${r.case_captures} captura(s)`),
    "",
  ];
  await writeFile(AUDIT_MD, md.join("\n"), "utf8");
  console.log(`csv=${AUDIT_CSV}\nmd=${AUDIT_MD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
