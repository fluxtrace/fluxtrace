import { ENV } from "../../_core/config/env";
import { invokeLLM } from "../../_core/integrations/llm";
import { isBehaviourMitreTreesByHashExport, listExportRootShaKeys } from "../../shared/virusTotal/vtBehaviourMitreExport";
import type { BuildFluxtraceUnifiedMitreExportResult, FluxtraceUnifiedMitreVtMap } from "./fluxtraceUnifiedMitreExport";
import { buildFluxtraceUnifiedMitreVtExport } from "./fluxtraceUnifiedMitreExport";
import {
  buildUnifiedMitreCompareViewModel,
  unifiedMitreCompareMarkdownFromViewModel,
  type UnifiedMitreCompareViewModel,
} from "../../shared/virusTotal/unifiedMitreCompareViewModel";

export type CompareUnifiedMitreResult =
  | { ok: false; code: string; message: string }
  | {
      ok: true;
      /** Relatório completo (determinístico + opcional LLM) — útil para cópia/export. */
      summaryMarkdown: string;
      /** Dados para UI (cards por hash, cores). */
      comparisonView: Extract<UnifiedMitreCompareViewModel, { kind: "ta0005_map" }>;
      llmInterpretation: string | null;
      llmModel: string | null;
      stats: {
        batchIdsProcessed: number;
        internalHashes: number;
        externalHashes: number;
        inBoth: number;
        onlyInExternal: number;
        onlyInFluxtrace: number;
      };
      buildMeta: BuildFluxtraceUnifiedMitreExportResult["meta"];
    };

/** @deprecated Prefer `buildUnifiedMitreCompareViewModel` + `unifiedMitreCompareMarkdownFromViewModel` no shared. */
export function buildUnifiedMitreComparisonMarkdown(params: {
  externalRoot: unknown;
  internalBySha: FluxtraceUnifiedMitreVtMap;
}): string {
  const vm = buildUnifiedMitreCompareViewModel(params);
  if (vm.kind === "unsupported") {
    return (
      "## Comparação unificada MITRE (TA0005)\n\n" +
      "*O JSON externo não corresponde ao padrão esperado (mapa **SHA-256 →** entradas com `data` tipo behaviour_mitre_trees).* " +
      "Este modo de comparação unificada requer esse formato agregado (ex.: `respostas_virustotal.json`).\n"
    );
  }
  return unifiedMitreCompareMarkdownFromViewModel(vm);
}

function messageContentToString(
  content: string | Array<{ type?: string; text?: string } | unknown>,
): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const c of content) {
    if (c && typeof c === "object" && (c as { type?: string }).type === "text") {
      const t = (c as { text?: string }).text;
      if (typeof t === "string") parts.push(t);
    }
  }
  return parts.join("");
}

async function maybeLlmInterpretation(
  deterministicMarkdown: string,
  wanted: boolean,
): Promise<{ text: string | null; model: string | null }> {
  if (!wanted || ENV.skipInsightLlm || !ENV.llmApiKey.trim()) {
    return { text: null, model: null };
  }
  try {
    const r = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "És analista de malware. Responde em português. Sê sucinto (parágrafos curtos). " +
            "Não inventes contagens nem IDs que não apareçam no relatório base. " +
            "Se o relatório indicar falhas de API ou dados em falta, menciona-o.",
        },
        {
          role: "user",
          content:
            "Segue um relatório **determinístico** (comparação TA0005 entre JSON agregado externo e vários lotes FluxTrace). " +
            "Resume o que importa para um analista: concordâncias, divergências frequentes, e hashes só de um lado.\n\n" +
            deterministicMarkdown.slice(0, 120_000),
        },
      ],
      maxTokens: 1500,
    });
    const raw = r.choices?.[0]?.message?.content;
    const text = messageContentToString(raw ?? "").trim();
    return { text: text.length ? text : null, model: r.model ?? null };
  } catch {
    return { text: null, model: null };
  }
}

export async function compareUnifiedVtMitreExports(params: {
  externalJsonText: string;
  apiKey: string;
  batchIds: string[];
  includeLlmInterpretation: boolean;
}): Promise<CompareUnifiedMitreResult> {
  let externalRoot: unknown;
  try {
    externalRoot = JSON.parse(params.externalJsonText) as unknown;
  } catch {
    return { ok: false, code: "invalid_json", message: "O texto importado não é JSON válido." };
  }

  if (!isBehaviourMitreTreesByHashExport(externalRoot)) {
    return {
      ok: false,
      code: "unsupported_external",
      message:
        "Comparação unificada: o JSON externo deve ser um mapa SHA-256 → entradas `behaviour_mitre_trees` (como o ficheiro agregado por hash). " +
        "Para outros formatos, use o modo *por lote* nesta página.",
    };
  }

  const built = await buildFluxtraceUnifiedMitreVtExport({
    apiKey: params.apiKey,
    batchIds: params.batchIds,
  });

  const internalBySha = built.bySha;
  const extKeys = listExportRootShaKeys(externalRoot);
  const intKeys = Object.keys(internalBySha);

  const extSet = new Set(extKeys);
  const intSet = new Set(intKeys);
  const inBoth = [...extSet].filter((k) => intSet.has(k)).length;

  const comparisonView = buildUnifiedMitreCompareViewModel({
    externalRoot,
    internalBySha,
  });

  if (comparisonView.kind !== "ta0005_map") {
    return {
      ok: false,
      code: "internal",
      message: "Erro interno ao construir a vista de comparação.",
    };
  }

  const summaryMarkdownBase = unifiedMitreCompareMarkdownFromViewModel(comparisonView);

  const llm = await maybeLlmInterpretation(summaryMarkdownBase, params.includeLlmInterpretation);

  let combined = summaryMarkdownBase;
  if (llm.text) {
    combined +=
      "\n\n---\n\n## Interpretação assistida (LLM)\n\n" +
      "*Nota: texto opcional gerado por modelo — usar junto com a secção determinística acima.*\n\n" +
      llm.text +
      "\n";
  } else if (params.includeLlmInterpretation) {
    combined +=
      "\n\n---\n\n*Interpretação LLM não disponível* (servidor sem chave, `CONTRADEF_SKIP_LLM`, ou chamada falhou).\n";
  }

  return {
    ok: true,
    summaryMarkdown: combined,
    comparisonView: comparisonView,
    llmInterpretation: llm.text,
    llmModel: llm.model,
    stats: {
      batchIdsProcessed: params.batchIds.length,
      internalHashes: intKeys.length,
      externalHashes: extKeys.length,
      inBoth,
      onlyInExternal: extKeys.filter((k) => !intSet.has(k)).length,
      onlyInFluxtrace: intKeys.filter((k) => !extSet.has(k)).length,
    },
    buildMeta: built.meta,
  };
}
