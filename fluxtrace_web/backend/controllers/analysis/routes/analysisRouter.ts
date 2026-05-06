import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { uploadedLogSchema } from "../../../shared/analysis";
import { removeLocalBatchWorkspace } from "../../../models/storage";
import {
  getAnalysisBatchDetail,
  getReductionBaselineMetrics,
  startAnalysisBatch,
  syncActiveAnalysisBatches,
  syncAnalysisBatch,
} from "../../../services/analysis/analysisService";
import {
  deleteAnalysisBatchAndRelatedData,
  getAnalysisDashboardStats,
  getAnalysisBatchByBatchId,
  listAnalysisBatches,
} from "../../../models/db";
import { normalizeOptionalSampleSha256 } from "../../../shared/virusTotal";
import type {
  VirusTotalDomainLookupResult,
  VirusTotalIpLookupResult,
  VirusTotalBatchLookupResult,
  VirusTotalUrlLookupResult,
} from "../../../shared/virusTotal/virusTotalReport";
import {
  virusTotalLookupDomain,
  virusTotalLookupFile,
  virusTotalLookupIp,
  virusTotalLookupPublicUrl,
} from "../../../services/virusTotal/virusTotalLookup";
import { protectedProcedure, router } from "../../../_core/trpc";

const listBatchesInputSchema = z.object({
  sampleName: z.string().trim().optional(),
  focusFunction: z.string().trim().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  status: z.array(z.enum(["queued", "running", "completed", "failed", "cancelled"]))
    .optional(),
  limit: z.number().int().min(1).max(100).default(50),
}).optional();

const submitBatchInputSchema = z.object({
  analysisName: z.string().min(1),
  logFiles: z.array(uploadedLogSchema).min(1).max(20),
  focusTerms: z.array(z.string().min(1)).default([]),
  focusRegexes: z.array(z.string().min(1)).default([]),
  origin: z.string().url().optional(),
  sampleSha256: z.string().trim().max(64).optional(),
});

const batchIdInputSchema = z.object({
  batchId: z.string().min(1),
});

/**
 * Só o perfil `admin` vê a lista e o detalhe de todas as análises do sistema; os restantes
 * Usuários autenticados vêem apenas o que submeteram (`createdByUserId` = sessão).
 */
function isGlobalAnalysisScope(user: { role: string }): boolean {
  return user.role === "admin";
}

function canAccessBatch(user: { id: number; role: string }, batchRow: { createdByUserId: number | null }): boolean {
  if (isGlobalAnalysisScope(user)) {
    return true;
  }
  return batchRow.createdByUserId != null && batchRow.createdByUserId === user.id;
}

export const analysisRouter = router({
  dashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user!;
    const listOwnOnly = !isGlobalAnalysisScope(user);
    return getAnalysisDashboardStats(listOwnOnly ? { createdByUserId: user.id } : {});
  }),

  list: protectedProcedure.input(listBatchesInputSchema).query(async ({ ctx, input }) => {
    const user = ctx.user!;
    const listOwnOnly = !isGlobalAnalysisScope(user);
    return listAnalysisBatches({
      sampleName: input?.sampleName,
      focusFunction: input?.focusFunction,
      createdFrom: input?.createdFrom,
      createdTo: input?.createdTo,
      status: input?.status,
      limit: input?.limit ?? 50,
      ...(listOwnOnly ? { createdByUserId: user.id } : {}),
    });
  }),

  /**
   * Relatório agregado VirusTotal (`/api/v3/files/{sha256}`) para o hash registado no lote.
   * Requer `VIRUSTOTAL_API_KEY` no servidor — a chave nunca é enviada ao cliente.
   */
  virusTotalBatchReport: protectedProcedure.input(batchIdInputSchema).query(async ({ ctx, input }): Promise<VirusTotalBatchLookupResult> => {
    const user = ctx.user!;
    const batchRow = await getAnalysisBatchByBatchId(input.batchId);
    if (!batchRow) {
      return { ok: false, code: "bad_request", message: "Lote não encontrado." };
    }
    if (!canAccessBatch(user, batchRow)) {
      return { ok: false, code: "bad_request", message: "Sem permissão para consultar VirusTotal neste lote." };
    }

    const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
    if (!apiKey) {
      return {
        ok: false,
        code: "unconfigured",
        message:
          "VIRUSTOTAL_API_KEY não configurada no servidor. Defina a variável ambiente para activar relatórios automáticos (API VT v3).",
      };
    }

    const sha256 = normalizeOptionalSampleSha256(batchRow.sampleSha256);
    if (!sha256) {
      return {
        ok: false,
        code: "no_hash",
        message:
          "Este lote não inclui SHA-256 válido (64 caracteres hex) da amostra; não há consulta directa VirusTotal pela API.",
      };
    }

    return virusTotalLookupFile({ sha256Lowercase: sha256, apiKey });
  }),

  /**
   * Relatório VT para um URL (`GET /urls/{url_id}`) — independente do lote; entrada manual típica
   * (domínios/URLs vistos em logs antes de corrê-los pela amostra completa na VT).
   * Usa `VIRUSTOTAL_API_KEY` apenas no servidor.
   */
  virusTotalUrlReport: protectedProcedure
    .input(z.object({ url: z.string().trim().url().max(4096, "URL demasiado longo.") }))
    .query(async ({ input }): Promise<VirusTotalUrlLookupResult> => {
      const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
      if (!apiKey) {
        return {
          ok: false,
          code: "unconfigured",
          message:
            "VIRUSTOTAL_API_KEY não configurada no servidor. Defina a variável ambiente para activar relatórios automáticos (API VT v3).",
        };
      }

      return virusTotalLookupPublicUrl({ canonicalUrl: input.url.trim(), apiKey });
    }),

  /**
   * GET `/domains/{domain}` ([docs VT](https://developers.virustotal.com/reference/domain-info)) —
   * hostname apenas ou URL completa (servidor extrai hostname). Consulta manual, mesma API key só no servidor.
   */
  virusTotalDomainReport: protectedProcedure
    .input(z.object({ domain: z.string().trim().min(2).max(2048) }))
    .query(async ({ input }): Promise<VirusTotalDomainLookupResult> => {
      const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
      if (!apiKey) {
        return {
          ok: false,
          code: "unconfigured",
          message:
            "VIRUSTOTAL_API_KEY não configurada no servidor. Defina a variável ambiente para activar relatórios automáticos (API VT v3).",
        };
      }

      return virusTotalLookupDomain({ rawInput: input.domain, apiKey });
    }),

  /**
   * GET `/ip_addresses/{ip}` ([docs VT](https://developers.virustotal.com/reference/ip-info)) — IPv4/IPv6. Consulta manual.
   */
  virusTotalIpReport: protectedProcedure
    .input(z.object({ ip: z.string().trim().min(3).max(128) }))
    .query(async ({ input }): Promise<VirusTotalIpLookupResult> => {
      const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
      if (!apiKey) {
        return {
          ok: false,
          code: "unconfigured",
          message:
            "VIRUSTOTAL_API_KEY não configurada no servidor. Defina a variável ambiente para activar relatórios automáticos (API VT v3).",
        };
      }

      return virusTotalLookupIp({ rawInput: input.ip, apiKey });
    }),

  detail: protectedProcedure.input(batchIdInputSchema).query(async ({ ctx, input }) => {
    const user = ctx.user!;
    const batchRow = await getAnalysisBatchByBatchId(input.batchId);
    if (!batchRow) {
      return null;
    }
    if (!canAccessBatch(user, batchRow)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Só pode ver o detalhe dos lotes que submeteu.",
      });
    }
    const allowServerProcess = process.env.CONTRADEF_SERVER_DEBUG === "1";
    const raw = ctx.req.get?.("x-contradef-client-debug")?.trim().toLowerCase() ?? "";
    const includeServerProcess = allowServerProcess && (raw === "1" || raw === "true" || raw === "yes");
    return getAnalysisBatchDetail(input.batchId, { includeServerProcess });
  }),

  /**
   * Remove o lote do Postgres (e tabelas derivadas) e a pasta de artefatos local do processo, se existir.
   * Só o usuário que submeteu o lote (`createdByUserId`) — não há apagar lotes alheios (nem via admin, nesta rota).
   */
  deleteBatch: protectedProcedure.input(batchIdInputSchema).mutation(async ({ ctx, input }) => {
    const user = ctx.user!;
    const batchRow = await getAnalysisBatchByBatchId(input.batchId);
    if (!batchRow) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado." });
    }
    if (batchRow.createdByUserId == null || batchRow.createdByUserId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Só pode apagar lotes que submeteu.",
      });
    }
    const removed = await deleteAnalysisBatchAndRelatedData(input.batchId);
    if (!removed) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado após verificação." });
    }
    try {
      await removeLocalBatchWorkspace(input.batchId);
    } catch (error) {
      console.warn("[analysis.deleteBatch] pastas locais (opcional):", error);
    }
    return { ok: true as const };
  }),

  reductionBaseline: protectedProcedure.query(async () => {
    return getReductionBaselineMetrics();
  }),

  submit: protectedProcedure.input(submitBatchInputSchema).mutation(async ({ ctx, input }) => {
    const user = ctx.user!;
    return startAnalysisBatch({
      analysisName: input.analysisName,
      logFiles: input.logFiles,
      focusTerms: input.focusTerms,
      focusRegexes: input.focusRegexes,
      origin: input.origin,
      createdByUserId: user.id,
      sampleSha256: input.sampleSha256 || null,
    });
  }),

  sync: protectedProcedure.input(batchIdInputSchema).mutation(async ({ ctx, input }) => {
    const user = ctx.user!;
    const batchRow = await getAnalysisBatchByBatchId(input.batchId);
    if (!batchRow) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado." });
    }
    if (!canAccessBatch(user, batchRow)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Só pode sincronizar lotes que submeteu.",
      });
    }
    return syncAnalysisBatch(input.batchId);
  }),

  resumeActiveSync: protectedProcedure.mutation(async ({ ctx }) => {
    const user = ctx.user!;
    try {
      const resumedBatches = await syncActiveAnalysisBatches(
        isGlobalAnalysisScope(user) ? undefined : { createdByUserId: user.id },
      );
      return { resumedBatches };
    } catch (error) {
      // Best-effort: a falha em listar lotes ativos não deve derrubar a página Reduzir logs
      // (a sessão local continua a rastrear lotes; ver reduceLogsSession v3 no cliente).
      const message = error instanceof Error ? error.message : String(error);
      console.error("[analysis.resumeActiveSync] listagem de lotes ativos falhou:", message);
      return { resumedBatches: [] as string[] };
    }
  }),
});
