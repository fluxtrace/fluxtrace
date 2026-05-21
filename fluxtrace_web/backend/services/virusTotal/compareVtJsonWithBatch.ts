import { getAnalysisBatchDetail } from "../analysis/analysisService";
import { getAnalysisBatchByBatchId } from "../../models/db";
import { normalizeOptionalSampleSha256 } from "../../shared/virusTotal";
import {
  collectTa0005TechniqueIdsFromMitreEntry,
  isBehaviourMitreTreesByHashExport,
  listSandboxNamesFromMitreEntry,
  pickMitreTreeEntryForBatch,
} from "../../shared/virusTotal/vtBehaviourMitreExport";
import type { VirusTotalBatchLookupResult } from "../../shared/virusTotal/virusTotalReport";
import {
  diffVtStats,
  extractVtExportFingerprint,
  type VtExportFingerprint,
  statsTotalEngines,
} from "../../shared/virusTotal/vtExportFingerprint";
import { virusTotalLookupFile } from "./virusTotalLookup";

export type CompareVtJsonResult =
  | { ok: false; code: string; message: string }
  | {
      ok: true;
      comparisonKind: "last_analysis_stats" | "mitre_ta0005_behaviour_trees";
      batchId: string;
      batchSha256: string | null;
      internalVt: VirusTotalBatchLookupResult;
      externalFingerprint: VtExportFingerprint;
      hashMatch: boolean | null;
      statsDiff: ReturnType<typeof diffVtStats>;
      summaryMarkdown: string;
    };

function buildSummaryMarkdownStats(params: {
  batchSha: string | null;
  ext: VtExportFingerprint;
  internalVt: VirusTotalBatchLookupResult;
  hashMatch: boolean | null;
  statsDiff: ReturnType<typeof diffVtStats>;
}): string {
  const { batchSha, ext, internalVt, hashMatch, statsDiff } = params;
  const lines: string[] = [];
  lines.push("## Comparação VirusTotal (\`last_analysis_stats\`)");
  lines.push("");
  lines.push(
    `- **SHA-256 no lote FluxTrace:** ${batchSha ? `\`${batchSha}\`` : "*(sem hash no lote)*"}`,
  );
  lines.push(
    `- **SHA-256 no JSON importado:** ${ext.sha256 ? `\`${ext.sha256}\`` : "*(não detetado no ficheiro)*"}`,
  );
  if (hashMatch === null) {
    lines.push("- **Coincidência de hash:** *inconclusiva* (falta hash num dos lados).");
  } else {
    lines.push(`- **Coincidência de hash:** **${hashMatch ? "Sim" : "Não"}**`);
  }
  lines.push("");

  if (internalVt.ok === false) {
    lines.push(`### Relatório FluxTrace (API no servidor)`);
    lines.push(`- Estado: **falha** (${internalVt.code}) — ${internalVt.message}`);
    lines.push("");
  } else {
    const inStats = internalVt.stats;
    const inTotal = statsTotalEngines(inStats ?? undefined);
    lines.push(`### Relatório FluxTrace (API no servidor)`);
    lines.push(
      `- Nome sugerido (VT): ${internalVt.meaningfulName ?? "—"} · Tipo: ${internalVt.typeDescription ?? "—"}`,
    );
    lines.push(`- Soma de contagens \`last_analysis_stats\`: **${inTotal}** (engines nos buckets).`);
    lines.push("");
  }

  lines.push(`### JSON importado (outro sistema)`);
  for (const note of ext.parseNotes) {
    lines.push(`- ${note}`);
  }
  if (ext.meaningfulName) {
    lines.push(`- Nome sugerido (VT): ${ext.meaningfulName}`);
  }
  if (ext.typeDescription) {
    lines.push(`- Tipo / descrição: ${ext.typeDescription}`);
  }
  if (ext.lastAnalysisDate != null) {
    lines.push(`- \`last_analysis_date\` (Unix s): ${ext.lastAnalysisDate}`);
  }
  lines.push("");

  const hasExtStats = ext.stats != null;
  const hasInStats = internalVt.ok === true && internalVt.stats != null;

  if (!hasExtStats || !hasInStats) {
    lines.push("### Contagens por campo (\`last_analysis_stats\`)");
    lines.push(
      "*Comparação numérica indisponível:* o export não trouxe \`last_analysis_stats\` válido e/ou a consulta FluxTrace ao ficheiro falhou ou está sem chave VT.",
    );
    lines.push("");
    return lines.join("\n");
  }

  lines.push("### Contagens por campo (\`last_analysis_stats\`)");
  lines.push("| Campo | FluxTrace | JSON importado | Igual |");
  lines.push("| --- | ---: | ---: | :---: |");
  for (const row of statsDiff) {
    lines.push(`| ${row.key} | ${row.fluxtrace} | ${row.exportado} | ${row.igual ? "✓" : "✗"} |`);
  }
  lines.push("");

  const extTotal = statsTotalEngines(ext.stats ?? undefined);
  const inTotal =
    internalVt.ok === true ? statsTotalEngines(internalVt.stats ?? undefined) : 0;

  if (statsDiff.every((r) => r.igual)) {
    lines.push(
      "**Síntese:** as contagens públicas (\`last_analysis_stats\`) são **idênticas** entre o snapshot VT usado pelo FluxTrace e o JSON importado.",
    );
  } else {
    lines.push(
      "**Síntese:** há **diferenças** nas contagens — comum entre instantâmetros ou se o JSON não for o mesmo relatório de ficheiro.",
    );
  }
  lines.push(`- Total agregado (soma dos buckets): FluxTrace **${inTotal}** · exportado **${extTotal}**.`);
  lines.push("");

  return lines.join("\n");
}

function setDiff(a: string[], b: string[]): { onlyA: string[]; onlyB: string[]; both: string[] } {
  const sa = new Set(a);
  const sb = new Set(b);
  const both = [...sa].filter((x) => sb.has(x)).sort((x, y) => x.localeCompare(y));
  const onlyA = [...sa].filter((x) => !sb.has(x)).sort((x, y) => x.localeCompare(y));
  const onlyB = [...sb].filter((x) => !sa.has(x)).sort((x, y) => x.localeCompare(y));
  return { onlyA, onlyB, both };
}

function buildSummaryMarkdownMitreTa0005(params: {
  batchSha: string | null;
  matchedExportHash: string | null;
  availableHashes: string[];
  sandboxes: string[];
  externalTa0005Ids: string[];
  fluxTa0005Ids: string[];
  internalVt: VirusTotalBatchLookupResult;
}): string {
  const { batchSha, matchedExportHash, availableHashes, sandboxes, externalTa0005Ids, fluxTa0005Ids, internalVt } =
    params;
  const { onlyA: onlyFlux, onlyB: onlyExport, both } = setDiff(fluxTa0005Ids, externalTa0005Ids);

  const lines: string[] = [];
  lines.push("## Comparação MITRE ATT&CK **TA0005** (Defence Evasion)");
  lines.push("");
  lines.push(
    "O ficheiro segue o padrão **mapa SHA-256 → `behaviour_mitre_trees`** (sandboxes VirusTotal). " +
      "A comparação usa apenas técnicas listadas sob a tática **TA0005**, como no painel FluxTrace (evasão).",
  );
  lines.push("");
  lines.push(`- **SHA-256 do lote FluxTrace:** ${batchSha ? `\`${batchSha}\`` : "*(sem hash no lote)*"}`);
  lines.push(
    `- **Entrada no JSON usada:** ${
      matchedExportHash ? `\`${matchedExportHash}\`` : "*(nenhuma chave igual ao hash do lote)*"
    }`,
  );
  if (availableHashes.length) {
    lines.push(`- **Hashes presentes no ficheiro:** ${availableHashes.length} (ex.: \`${availableHashes[0]?.slice(0, 16)}…\`)`);
  }
  lines.push(`- **Sandboxes nesta entrada:** ${sandboxes.length ? sandboxes.join(", ") : "— (\`data\` vazio ou sem chaves)"}`);
  lines.push("");

  lines.push("### Técnicas TA0005");
  lines.push(`- **No FluxTrace (heurística / logs):** ${fluxTa0005Ids.length ? fluxTa0005Ids.map((x) => `\`${x}\``).join(", ") : "—"}`);
  lines.push(`- **No export (sandboxes VT, tática TA0005):** ${externalTa0005Ids.length ? externalTa0005Ids.map((x) => `\`${x}\``).join(", ") : "—"}`);
  lines.push("");
  lines.push(`- **Em ambos:** ${both.length ? both.map((x) => `\`${x}\``).join(", ") : "—"}`);
  lines.push(`- **Só no FluxTrace:** ${onlyFlux.length ? onlyFlux.map((x) => `\`${x}\``).join(", ") : "—"}`);
  lines.push(`- **Só no export VT:** ${onlyExport.length ? onlyExport.map((x) => `\`${x}\``).join(", ") : "—"}`);
  lines.push("");

  if (both.length && !onlyFlux.length && !onlyExport.length) {
    lines.push(
      "**Síntese:** o conjunto de técnicas **TA0005** coincide entre o resumo FluxTrace e o export das sandboxes.",
    );
  } else if (both.length || onlyFlux.length || onlyExport.length) {
    lines.push(
      "**Síntese:** há **sobreposição parcial** ou **fontes diferentes** — os logs reduzidos não reproduzem as sandboxes VT, e o export pode incluir técnicas não observadas nos eventos (ou o contrário).",
    );
  } else if (!fluxTa0005Ids.length && !externalTa0005Ids.length) {
    lines.push("**Síntese:** **nenhuma** técnica TA0005 encontrada de lado nenhum (ou `data` vazio para este hash).");
  } else {
    lines.push("**Síntese:** compare as listas acima para priorizar investigação nas técnicas exclusivas.");
  }
  lines.push("");

  lines.push("### Contexto: motores antivírus (API VT no servidor)");
  if (internalVt.ok === false) {
    lines.push(`- Estado: **falha** (${internalVt.code}) — ${internalVt.message}`);
  } else {
    const inTotal = statsTotalEngines(internalVt.stats ?? undefined);
    lines.push(
      `- Nome (VT): ${internalVt.meaningfulName ?? "—"} · Tipo: ${internalVt.typeDescription ?? "—"} · Soma \`last_analysis_stats\`: **${inTotal}**`,
    );
  }
  lines.push("");

  return lines.join("\n");
}

async function resolveInternalVt(
  batchSha: string | null,
  apiKey: string,
): Promise<VirusTotalBatchLookupResult> {
  if (!batchSha) {
    return {
      ok: false,
      code: "no_hash",
      message: "Este lote não tem SHA-256 da amostra.",
    };
  }
  if (!apiKey.trim().length) {
    return { ok: false, code: "unconfigured", message: "VIRUSTOTAL_API_KEY em falta no servidor." };
  }
  return virusTotalLookupFile({ sha256Lowercase: batchSha, apiKey: apiKey.trim() });
}

export async function compareVtJsonWithBatch(params: {
  batchId: string;
  externalJsonText: string;
  apiKey: string;
}): Promise<CompareVtJsonResult> {
  const { batchId, externalJsonText, apiKey } = params;

  let parsed: unknown;
  try {
    parsed = JSON.parse(externalJsonText) as unknown;
  } catch {
    return { ok: false, code: "parse_error", message: "O ficheiro não é JSON válido." };
  }

  const batchRow = await getAnalysisBatchByBatchId(batchId);
  if (!batchRow) {
    return { ok: false, code: "bad_request", message: "Lote não encontrado." };
  }

  const batchSha = normalizeOptionalSampleSha256(batchRow.sampleSha256 ?? "");
  const internalVt = await resolveInternalVt(batchSha, apiKey);

  /** Padrão `respostas_virustotal.json`: vários hashes com árvores MITRE por sandbox. */
  if (isBehaviourMitreTreesByHashExport(parsed)) {
    const pick = pickMitreTreeEntryForBatch(parsed, batchSha);
    const extIds = pick.entry != null ? collectTa0005TechniqueIdsFromMitreEntry(pick.entry) : [];
    const sandboxes = pick.entry != null ? listSandboxNamesFromMitreEntry(pick.entry) : [];

    const detail = await getAnalysisBatchDetail(batchId, { includeServerProcess: false });
    const fluxIds = detail?.mitreDefenseEvasion?.techniques.map((t) => t.id) ?? [];
    const fluxSorted = [...new Set(fluxIds)].sort((a, b) => a.localeCompare(b));

    const hashMatch = Boolean(batchSha && pick.matchedKey && batchSha === pick.matchedKey);

    const externalFingerprint: VtExportFingerprint = {
      sha256: pick.matchedKey,
      stats: null,
      meaningfulName: null,
      typeDescription: "behaviour_mitre_trees (export agregado)",
      lastAnalysisDate: null,
      parseNotes: [
        "Formato: mapa de hashes SHA-256 → resposta tipo **behaviour_mitre_trees** (MITRE por sandbox).",
        pick.matchedKey
          ? `Entrada seleccionada pela chave igual ao hash do lote (\`${pick.matchedKey.slice(0, 12)}…\`).`
          : batchSha
            ? `Nenhuma chave no JSON igual ao hash do lote. Hashes no ficheiro: ${pick.availableHashes.length}.`
            : "Lote sem SHA-256 — não foi possível escolher entrada por hash.",
        sandboxes.length > 0 ? `Sandboxes: ${sandboxes.join(", ")}.` : "Sem dados de sandbox (\`data\` vazio nesta chave).",
        `Técnicas TA0005 extraídas do export: ${extIds.length}.`,
      ],
    };

    const summaryMarkdown = buildSummaryMarkdownMitreTa0005({
      batchSha,
      matchedExportHash: pick.matchedKey,
      availableHashes: pick.availableHashes,
      sandboxes,
      externalTa0005Ids: extIds,
      fluxTa0005Ids: fluxSorted,
      internalVt,
    });

    return {
      ok: true,
      comparisonKind: "mitre_ta0005_behaviour_trees",
      batchId,
      batchSha256: batchSha,
      internalVt,
      externalFingerprint,
      hashMatch,
      statsDiff: diffVtStats(
        internalVt.ok === true ? internalVt.stats : null,
        null,
      ),
      summaryMarkdown,
    };
  }

  const ext = extractVtExportFingerprint(parsed);

  let hashMatch: boolean | null = null;
  if (batchSha && ext.sha256) {
    hashMatch = batchSha === ext.sha256;
  }

  const statsDiff =
    internalVt.ok === true && ext.stats
      ? diffVtStats(internalVt.stats ?? null, ext.stats)
      : internalVt.ok === true
        ? diffVtStats(internalVt.stats ?? null, null)
        : diffVtStats(null, ext.stats ?? null);

  const summaryMarkdown = buildSummaryMarkdownStats({
    batchSha,
    ext,
    internalVt,
    hashMatch,
    statsDiff,
  });

  return {
    ok: true,
    comparisonKind: "last_analysis_stats",
    batchId,
    batchSha256: batchSha,
    internalVt,
    externalFingerprint: ext,
    hashMatch,
    statsDiff,
    summaryMarkdown,
  };
}
