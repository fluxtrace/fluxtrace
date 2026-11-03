import { MermaidBlock } from "@/components/widgets/MermaidBlock";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/api/trpc";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const MODULES = [
  "FunctionInterceptor",
  "TraceFcnCall.M1",
  "TraceFcnCall.M2",
  "TraceInstructions",
  "TraceMemory",
  "TraceDisassembly",
] as const;

const MODULE_SHORT: Record<(typeof MODULES)[number], string> = {
  FunctionInterceptor: "FI",
  "TraceFcnCall.M1": "M1",
  "TraceFcnCall.M2": "M2",
  TraceInstructions: "TI",
  TraceMemory: "TM",
  TraceDisassembly: "TD",
};

type Props = {
  batchId: string | null;
  api: string | null;
  onApiChange?: (api: string) => void;
  onBatchChange?: (batchId: string) => void;
  showBatchSelect?: boolean;
};

export function PivotCoveragePanel({
  batchId,
  api,
  onApiChange,
  onBatchChange,
  showBatchSelect = false,
}: Props) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const batches = trpc.analysis.list.useQuery({ limit: 200 }, { enabled: showBatchSelect });
  const coverage = trpc.analysis.pivotCoverage.useQuery(
    { batchId: batchId ?? "" },
    { enabled: Boolean(batchId) },
  );
  const explanation = trpc.analysis.explainSample.useQuery(
    { batchId: batchId ?? "", api: api ?? undefined },
    { enabled: Boolean(batchId) },
  );

  const present = coverage.data?.flows ?? [];
  const lastBatchRef = useRef<string | null>(null);
  const syncedBatchRef = useRef<string | null>(null);

  useEffect(() => {
    if (!batchId || !present.length) return;
    const batchChanged = lastBatchRef.current !== batchId;
    lastBatchRef.current = batchId;
    const stillValid = Boolean(api && present.some((flow) => flow.api === api));
    if (!batchChanged && stillValid) return;
    onApiChange?.(present[0]!.api);
  }, [api, batchId, onApiChange, present]);

  const syncCatalog = trpc.analysis.syncMappedCatalog.useMutation({
    onSuccess: async (data) => {
      if (data.added.length) {
        toast.success(t("funcoes.syncFromLogToast", { added: data.added.length, already: data.already.length }));
      }
      await utils.legacyArtifacts.catalog.invalidate();
      await utils.analysis.pivotCoverage.invalidate();
    },
    onError: (err) => {
      syncedBatchRef.current = null;
      toast.error(err.message);
    },
  });

  useEffect(() => {
    if (!batchId || syncedBatchRef.current === batchId) return;
    syncedBatchRef.current = batchId;
    syncCatalog.mutate({ batchId });
    // mutate is stable enough per batch; ref blocks repeats
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const flow = present.find((item) => item.api === api) ?? coverage.data?.flow ?? null;

  const byModule = useMemo(() => {
    const map = new Map((flow?.modules ?? []).map((row) => [row.module, row]));
    return MODULES.map((mod) => map.get(mod) ?? { module: mod, fileName: "", occurrences: 0, firstLine: 0, addresses: [] });
  }, [flow]);

  return (
    <Card className="border-border/80 dark:border-white/10">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{t("funcoes.pivotTitle")}</CardTitle>
        </div>
        <div className="flex flex-wrap gap-2">
          {showBatchSelect ? (
            <Select value={batchId ?? ""} onValueChange={(value) => onBatchChange?.(value)}>
              <SelectTrigger className="h-8 w-[min(100%,280px)] text-xs">
                <SelectValue placeholder={t("funcoes.pickBatch")} />
              </SelectTrigger>
              <SelectContent>
                {(batches.data ?? []).map((row) => (
                  <SelectItem key={row.batchId} value={row.batchId} className="font-mono text-xs">
                    {row.sampleName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {present.length ? (
            <Badge variant="outline" className="h-8 px-2 font-mono text-[10px]">
              {t("funcoes.apiCount", { count: present.length })}
            </Badge>
          ) : null}
          <Select
            value={present.some((item) => item.api === api) ? api ?? "" : ""}
            onValueChange={(value) => onApiChange?.(value)}
            disabled={!present.length}
          >
            <SelectTrigger className="h-8 w-[min(100%,240px)] text-xs">
              <SelectValue placeholder={t("funcoes.pickApi")} />
            </SelectTrigger>
            <SelectContent>
              {present.map((item) => (
                <SelectItem key={item.api} value={item.api} className="font-mono text-xs">
                  {item.api}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!batchId ? (
          <p className="text-xs text-muted-foreground">{t("funcoes.pivotNeedBatch")}</p>
        ) : coverage.isLoading ? (
          <p className="text-xs text-muted-foreground">{t("funcoes.pivotLoading")}</p>
        ) : !present.length ? (
          <p className="text-xs text-muted-foreground">{t("funcoes.presentEmpty")}</p>
        ) : (
          <>
            {present.length > 1 ? (
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {present.map((item) => (
                  <button
                    key={item.api}
                    type="button"
                    onClick={() => onApiChange?.(item.api)}
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                      item.api === api
                        ? "border-[var(--auth-brand)] bg-[var(--auth-brand)]/15"
                        : "border-border/70 hover:bg-muted/60 dark:border-white/15"
                    }`}
                  >
                    {item.api}
                  </button>
                ))}
              </div>
            ) : null}
            {explanation.data?.markdown ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{explanation.data.markdown}</p>
            ) : null}
            {flow ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {flow.api}
                </Badge>
                <Badge variant={flow.likeIsDebuggerPresent ? "secondary" : "outline"} className="text-[10px]">
                  {t(`funcoes.chain.${flow.chainLevel}`)}
                </Badge>
                {byModule.map((row) => (
                  <Badge
                    key={row.module}
                    variant={row.occurrences > 0 ? "secondary" : "outline"}
                    className="font-mono text-[10px]"
                    title={row.fileName || row.module}
                  >
                    {MODULE_SHORT[row.module]}
                    {row.occurrences > 0 ? ` ×${row.occurrences}` : ""}
                  </Badge>
                ))}
              </div>
            ) : null}
            {present.length > 1 && coverage.data?.sampleMermaid ? (
              <MermaidBlock
                chart={coverage.data.sampleMermaid}
                className="mermaid-svg-wrap overflow-auto rounded-xl border border-border/70 bg-muted/20 p-3 dark:border-white/10 dark:bg-black/35 [&_svg]:h-auto [&_svg]:max-w-full"
              />
            ) : null}
            {flow?.mermaid ? (
              <MermaidBlock
                chart={flow.mermaid}
                className="mermaid-svg-wrap overflow-auto rounded-xl border border-border/70 bg-muted/20 p-3 dark:border-white/10 dark:bg-black/35 [&_svg]:h-auto [&_svg]:max-w-full"
              />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
