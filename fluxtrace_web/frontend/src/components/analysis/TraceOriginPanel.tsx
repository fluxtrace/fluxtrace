import { MetricCard } from "@/components/widgets/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ObservedApiOriginRow, TraceOriginDto, TraceOriginKind } from "@shared/analysis";
import { Cpu, HelpCircle, Search, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const ORIGIN_COLORS: Record<TraceOriginKind, string> = {
  "pin-runtime": "#94a3b8",
  target: "#34d399",
  unknown: "#f59e0b",
};

function originBadgeClass(origin: TraceOriginKind) {
  if (origin === "target") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  if (origin === "pin-runtime") {
    return "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-200";
  }
  return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
}

export function TraceOriginPanel({
  origin,
  onOpenEvidence,
}: {
  origin: TraceOriginDto | null | undefined;
  onOpenEvidence?: (row: ObservedApiOriginRow) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<"all" | TraceOriginKind>("all");

  const counts = origin?.originCounts ?? { "pin-runtime": 0, target: 0, unknown: 0 };
  const rows = origin?.observedApis ?? [];
  const chartData = useMemo(
    () =>
      [
        { key: "pin-runtime" as const, name: t("interpretacao.originPin"), value: counts["pin-runtime"] },
        { key: "target" as const, name: t("interpretacao.originTarget"), value: counts.target },
        { key: "unknown" as const, name: t("interpretacao.originUnknown"), value: counts.unknown },
      ].filter((slice) => slice.value > 0),
    [counts, t],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (originFilter !== "all" && row.origin !== originFilter) return false;
      if (!q) return true;
      return (
        row.api.toLowerCase().includes(q) ||
        row.fileName.toLowerCase().includes(q) ||
        row.mapped.some((name) => name.toLowerCase().includes(q))
      );
    });
  }, [originFilter, query, rows]);

  const totalHits = counts["pin-runtime"] + counts.target + counts.unknown;

  return (
    <Card className="border-border bg-card text-card-foreground shadow-sm dark:border-white/10 dark:bg-white/5">
      <CardHeader>
        <CardTitle className="text-lg">{t("interpretacao.originPanelTitle")}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("interpretacao.originPanelHint")}
          {origin?.engine ? (
            <span className="ml-1 font-mono">
              {origin.engine}
              {origin.indexSha256 ? ` · ${origin.indexSha256.slice(0, 12)}…` : ""}
            </span>
          ) : null}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard
            icon={Cpu}
            label={t("interpretacao.originPin")}
            value={String(counts["pin-runtime"])}
            helper={t("interpretacao.originPinHelper")}
          />
          <MetricCard
            icon={Shield}
            label={t("interpretacao.originTarget")}
            value={String(counts.target)}
            helper={t("interpretacao.originTargetHelper", { n: origin?.observedTargetApis.length ?? 0 })}
          />
          <MetricCard
            icon={HelpCircle}
            label={t("interpretacao.originUnknown")}
            value={String(counts.unknown)}
            helper={t("interpretacao.originUnknownHelper")}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,280px),1fr]">
          <div className="h-56 rounded-2xl border border-border bg-muted/40 p-2 dark:border-white/10 dark:bg-slate-950/60">
            {totalHits === 0 ? (
              <p className="flex h-full items-center justify-center px-3 text-center text-sm text-muted-foreground">
                {t("interpretacao.originChartEmpty")}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} paddingAngle={2}>
                    {chartData.map((slice) => (
                      <Cell key={slice.key} fill={ORIGIN_COLORS[slice.key]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("interpretacao.originFilterPlaceholder")}
                  className="pl-8"
                />
              </div>
              <Select value={originFilter} onValueChange={(value) => setOriginFilter(value as typeof originFilter)}>
                <SelectTrigger className="w-[min(100%,220px)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("interpretacao.originFilterAll")}</SelectItem>
                  <SelectItem value="target">{t("interpretacao.originTarget")}</SelectItem>
                  <SelectItem value="pin-runtime">{t("interpretacao.originPin")}</SelectItem>
                  <SelectItem value="unknown">{t("interpretacao.originUnknown")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[22rem] overflow-auto rounded-xl border border-border dark:border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent dark:border-white/10">
                    <TableHead>{t("interpretacao.originColApi")}</TableHead>
                    <TableHead>{t("interpretacao.originColCount")}</TableHead>
                    <TableHead>{t("interpretacao.originColOrigin")}</TableHead>
                    <TableHead>{t("interpretacao.originColLoc")}</TableHead>
                    <TableHead>{t("interpretacao.originColMapped")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length ? (
                    filtered.map((row) => (
                      <TableRow key={`${row.api}-${row.fileName}-${row.lineNumber}`} className="border-border dark:border-white/10">
                        <TableCell className="font-mono text-xs">
                          {onOpenEvidence ? (
                            <button
                              type="button"
                              className="text-left underline decoration-cyan-500/30 underline-offset-2 hover:text-cyan-800 dark:hover:text-cyan-200"
                              onClick={() => onOpenEvidence(row)}
                            >
                              {row.api}
                            </button>
                          ) : (
                            row.api
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.occurrences}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={originBadgeClass(row.origin)}>
                            {t(`interpretacao.originKind.${row.origin}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {row.fileName}:{row.lineNumber}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.mapped.length ? row.mapped.join(", ") : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        {t("interpretacao.originTableEmpty")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
