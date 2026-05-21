import {
  collectTa0005TechniqueIdsFromMitreEntry,
  isBehaviourMitreTreesByHashExport,
  listExportRootShaKeys,
  listSandboxNamesFromMitreEntry,
  pickMitreTreeEntryForBatch,
} from "./vtBehaviourMitreExport";
import { statsTotalEngines } from "./vtExportFingerprint";
import type { VirusTotalBatchLookupResult } from "./virusTotalReport";

/** Mínimo necessário para o view model (compatível com `FluxtraceUnifiedMitreVtMap`). */
export type UnifiedCompareInternalBySha = Record<
  string,
  {
    _fluxtrace: {
      sampleName: string;
      batchId: string;
      mitreDefenseEvasion: unknown;
      virusTotalFileReport: VirusTotalBatchLookupResult;
    };
  }
>;

function setDiff(a: string[], b: string[]): { onlyA: string[]; onlyB: string[]; both: string[] } {
  const sa = new Set(a);
  const sb = new Set(b);
  const both = [...sa].filter((x) => sb.has(x)).sort((x, y) => x.localeCompare(y));
  const onlyA = [...sa].filter((x) => !sb.has(x)).sort((x, y) => x.localeCompare(y));
  const onlyB = [...sb].filter((x) => !sa.has(x)).sort((x, y) => x.localeCompare(y));
  return { onlyA, onlyB, both };
}

function fluxtraceDefenseEvasionTechniqueIds(mitre: unknown): string[] {
  if (mitre === null || typeof mitre !== "object") return [];
  const techniques = (mitre as { techniques?: unknown }).techniques;
  if (!Array.isArray(techniques)) return [];
  const ids = new Set<string>();
  for (const t of techniques) {
    if (t && typeof t === "object" && typeof (t as { id?: string }).id === "string") {
      const id = (t as { id: string }).id.trim();
      if (id) ids.add(id);
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

export type UnifiedMitreHashCard = {
  sha: string;
  sampleName: string;
  batchId: string;
  sandboxes: string[];
  /** TA0005 do export JSON externo (sandboxes VT). */
  exportVtTa0005: string[];
  /** TA0005 do resumo FluxTrace. */
  fluxTa0005: string[];
  inBoth: string[];
  onlyExportVt: string[];
  onlyFluxtrace: string[];
  virusTotalFileReport: VirusTotalBatchLookupResult;
};

export type UnifiedMitreCompareViewModel =
  | { kind: "unsupported" }
  | {
      kind: "ta0005_map";
      summary: {
        hashesImported: number;
        hashesFluxtrace: number;
        intersection: number;
        onlyImported: number;
        onlyFluxtrace: number;
      };
      onlyImportedRows: Array<{ sha: string; exportVtTa0005: string[] }>;
      onlyFluxtraceRows: Array<{ sha: string; sampleName: string; fluxTa0005: string[] }>;
      perHash: UnifiedMitreHashCard[];
    };

/**
 * Dados estruturados para UI (cards por hash, cores externo vs FluxTrace).
 */
export function buildUnifiedMitreCompareViewModel(params: {
  externalRoot: unknown;
  internalBySha: UnifiedCompareInternalBySha;
}): UnifiedMitreCompareViewModel {
  const { externalRoot, internalBySha } = params;

  if (!isBehaviourMitreTreesByHashExport(externalRoot)) {
    return { kind: "unsupported" };
  }

  const extKeys = new Set(listExportRootShaKeys(externalRoot));
  const intKeys = new Set(Object.keys(internalBySha));

  const onlyExt = [...extKeys].filter((k) => !intKeys.has(k)).sort();
  const onlyInt = [...intKeys].filter((k) => !extKeys.has(k)).sort();
  const both = [...extKeys].filter((k) => intKeys.has(k)).sort();

  const onlyImportedRows = onlyExt.map((sha) => {
    const pick = pickMitreTreeEntryForBatch(externalRoot, sha);
    return { sha, exportVtTa0005: collectTa0005TechniqueIdsFromMitreEntry(pick.entry) };
  });

  const onlyFluxtraceRows = onlyInt.map((sha) => {
    const entry = internalBySha[sha];
    return {
      sha,
      sampleName: entry?._fluxtrace.sampleName ?? "—",
      fluxTa0005: fluxtraceDefenseEvasionTechniqueIds(entry?._fluxtrace.mitreDefenseEvasion),
    };
  });

  const perHash: UnifiedMitreHashCard[] = [];
  for (const sha of both) {
    const pick = pickMitreTreeEntryForBatch(externalRoot, sha);
    const exportVtTa0005 = collectTa0005TechniqueIdsFromMitreEntry(pick.entry);
    const entry = internalBySha[sha]!;
    const fluxTa0005 = fluxtraceDefenseEvasionTechniqueIds(entry._fluxtrace.mitreDefenseEvasion);
    const { onlyA: onlyFluxtrace, onlyB: onlyExportVt, both: inBoth } = setDiff(fluxTa0005, exportVtTa0005);
    perHash.push({
      sha,
      sampleName: entry._fluxtrace.sampleName,
      batchId: entry._fluxtrace.batchId,
      sandboxes: listSandboxNamesFromMitreEntry(pick.entry),
      exportVtTa0005,
      fluxTa0005,
      inBoth,
      onlyExportVt,
      onlyFluxtrace,
      virusTotalFileReport: entry._fluxtrace.virusTotalFileReport,
    });
  }

  return {
    kind: "ta0005_map",
    summary: {
      hashesImported: extKeys.size,
      hashesFluxtrace: intKeys.size,
      intersection: both.length,
      onlyImported: onlyExt.length,
      onlyFluxtrace: onlyInt.length,
    },
    onlyImportedRows,
    onlyFluxtraceRows,
    perHash,
  };
}

function vtLookupOneLiner(vt: VirusTotalBatchLookupResult): string {
  if (vt.ok === false) {
    return `**VT API:** falha (\`${vt.code}\`) — ${vt.message}`;
  }
  const total = statsTotalEngines(vt.stats ?? undefined);
  return `**VT API:** ${vt.meaningfulName ?? "—"} · soma \`last_analysis_stats\`: **${total}**`;
}

/** Texto Markdown legado / LLM input (paralelo ao view model). */
export function unifiedMitreCompareMarkdownFromViewModel(
  vm: Extract<UnifiedMitreCompareViewModel, { kind: "ta0005_map" }>,
): string {
  const lines: string[] = [];
  const s = vm.summary;
  lines.push("## Comparação unificada — **MITRE TA0005** (Defence Evasion)");
  lines.push("");
  lines.push(
    "O servidor construiu um mapa **SHA-256 → dados FluxTrace** a partir dos lotes seleccionados (campo `_fluxtrace`). " +
      "O ficheiro importado segue o padrão **mapa SHA-256 → behaviour_mitre_trees** (sandboxes VirusTotal). " +
      "Para cada hash presente em **ambos** os lados, comparam-se técnicas sob a tática **TA0005**.",
  );
  lines.push("");
  lines.push("### Resumo");
  lines.push(`- **Hashes no ficheiro importado:** ${s.hashesImported}`);
  lines.push(`- **Hashes no agregado FluxTrace (lotes seleccionados):** ${s.hashesFluxtrace}`);
  lines.push(`- **Intersecção (comparado pormenorizadamente):** ${s.intersection}`);
  lines.push(`- **Só no ficheiro importado:** ${s.onlyImported}`);
  lines.push(`- **Só no FluxTrace:** ${s.onlyFluxtrace}`);
  lines.push("");

  if (
    vm.perHash.length === 0 &&
    vm.onlyImportedRows.length === 0 &&
    vm.onlyFluxtraceRows.length === 0
  ) {
    lines.push("*Nenhum hash SHA-256 reconhecível em ambos os lados.*");
    lines.push("");
    return lines.join("\n");
  }

  if (vm.onlyImportedRows.length) {
    lines.push("### Apenas no JSON importado");
    for (const row of vm.onlyImportedRows.slice(0, 80)) {
      const extTa0005 = row.exportVtTa0005;
      lines.push(
        `- \`${row.sha}\` — TA0005 no export VT: ${extTa0005.length ? extTa0005.map((x) => `\`${x}\``).join(", ") : "—"}`,
      );
    }
    if (vm.onlyImportedRows.length > 80) {
      lines.push(`- … e mais **${vm.onlyImportedRows.length - 80}** hash(es).`);
    }
    lines.push("");
  }

  if (vm.onlyFluxtraceRows.length) {
    lines.push("### Apenas no agregado FluxTrace");
    for (const row of vm.onlyFluxtraceRows.slice(0, 80)) {
      lines.push(
        `- \`${row.sha}\` · ${row.sampleName} — técnicas no resumo FluxTrace: ${row.fluxTa0005.length ? row.fluxTa0005.map((x) => `\`${x}\``).join(", ") : "—"}`,
      );
    }
    if (vm.onlyFluxtraceRows.length > 80) {
      lines.push(`- … e mais **${vm.onlyFluxtraceRows.length - 80}** hash(es).`);
    }
    lines.push("");
  }

  if (vm.perHash.length) {
    lines.push("### Por hash (presente nos dois lados)");
    lines.push("");
  }

  for (const h of vm.perHash) {
    lines.push(`#### \`${h.sha}\``);
    lines.push(`- **Amostra (FluxTrace):** ${h.sampleName}`);
    lines.push(`- **Lote:** \`${h.batchId}\``);
    lines.push(`- **Sandboxes no export VT:** ${h.sandboxes.length ? h.sandboxes.join(", ") : "—"}`);
    lines.push(
      `- **TA0005 FluxTrace:** ${h.fluxTa0005.length ? h.fluxTa0005.map((x) => `\`${x}\``).join(", ") : "—"}`,
    );
    lines.push(
      `- **TA0005 export VT:** ${h.exportVtTa0005.length ? h.exportVtTa0005.map((x) => `\`${x}\``).join(", ") : "—"}`,
    );
    lines.push(`- **Em ambos:** ${h.inBoth.length ? h.inBoth.map((x) => `\`${x}\``).join(", ") : "—"}`);
    lines.push(`- **Só FluxTrace:** ${h.onlyFluxtrace.length ? h.onlyFluxtrace.map((x) => `\`${x}\``).join(", ") : "—"}`);
    lines.push(`- **Só export VT:** ${h.onlyExportVt.length ? h.onlyExportVt.map((x) => `\`${x}\``).join(", ") : "—"}`);
    lines.push(`- ${vtLookupOneLiner(h.virusTotalFileReport)}`);
    lines.push("");
  }

  return lines.join("\n");
}
