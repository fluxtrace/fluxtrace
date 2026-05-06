import DashboardLayout from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/widgets/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { batchStatusBadgeClass } from "@/lib/analysis/analysisUi";
import { formatBytes, formatDateTimeShort, formatDurationMs, formatPercentRounded } from "@/lib/core/format";
import { trpc } from "@/lib/api/trpc";
import { Activity, AlertCircle, FileSearch, Link as LinkIcon, ShieldCheck, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import type { TooltipProps } from "recharts";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type StatusFilter = "all" | "queued" | "running" | "completed" | "failed" | "cancelled";

const STATUS_PIE_COLORS: Record<string, string> = {
  queued: "#94a3b8",
  running: "#22d3ee",
  completed: "#34d399",
  failed: "#f87171",
  cancelled: "#a78bfa",
};

const CHART_TOOLTIP_STYLE = { backgroundColor: "oklch(0.2 0.02 255 / 0.95)", border: "1px solid oklch(0.35 0.02 255 / 0.5)" };

function PieStatusTooltipContent({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.[0]) return null;
  const it = payload[0];
  const name = String(it.name ?? "");
  const raw: unknown = it.value;
  const n =
    typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
  const display = Number.isFinite(n) ? Math.round(n) : "—";
  return (
    <div style={CHART_TOOLTIP_STYLE} className="min-w-[7rem] rounded-md px-3 py-2 text-left shadow-lg">
      <p className="text-[11px] font-semibold capitalize leading-tight tracking-wide text-slate-100">{name}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-white">{display}</p>
    </div>
  );
}

function WallTimesTooltipContent({ active, payload }: TooltipProps<number, string>) {
  const { t } = useTranslation();
  if (!active || !payload?.[0]) {
    return null;
  }
  const row = payload[0].payload as {
    batchId: string;
    sampleName: string;
    wallMs: number;
    endedAtIso: string;
    wallMsSource?: string;
    totalOriginalBytes?: number;
  };
  const isEstimated = row.wallMsSource && row.wallMsSource !== "measured";
  const totalBytes = typeof row.totalOriginalBytes === "number" && Number.isFinite(row.totalOriginalBytes) ? row.totalOriginalBytes : 0;
  return (
    <div className="max-w-[min(100vw-2rem,22rem)] space-y-1 rounded-md px-2 py-1.5 text-xs" style={CHART_TOOLTIP_STYLE}>
      <p className="font-medium leading-snug text-foreground">{row.sampleName}</p>
      <p className="font-mono text-[11px] text-muted-foreground">{row.batchId}</p>
      <p className="text-[11px] text-muted-foreground">{formatDateTimeShort(row.endedAtIso)}</p>
      {isEstimated ? (
        <p className="text-[10px] text-amber-200/85">{t("dashboardHome.chartWallTooltipEstimatedHint")}</p>
      ) : null}
      {totalBytes > 0 ? (
        <div className="border-t border-white/10 pt-1.5">
          <p className="text-[11px] text-muted-foreground">{t("dashboardHome.chartWallTooltipTotalLogsSize")}</p>
          <p className="text-base font-semibold tabular-nums text-foreground">{formatBytes(totalBytes)}</p>
        </div>
      ) : null}
      <div className="border-t border-white/10 pt-1.5">
        <p className="text-[11px] text-muted-foreground">{t("reduceLogs.lotTotalTimeTitle")}</p>
        <p className="text-base font-semibold tabular-nums text-foreground">{formatDurationMs(row.wallMs)}</p>
      </div>
    </div>
  );
}

function formatShortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export default function HomeDashboard() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sampleFilter, setSampleFilter] = useState("");

  const statsQuery = trpc.analysis.dashboardStats.useQuery(undefined, {
    /** Alinhado à lista de incidentes para totais/gráficos acompanharem “quase tempo real”. */
    refetchInterval: 5000,
  });

  const batchesQuery = trpc.analysis.list.useQuery(
    {
      sampleName: sampleFilter.trim() || undefined,
      status: statusFilter === "all" ? undefined : [statusFilter],
      limit: 50,
    },
    {
      refetchInterval: 5000,
    },
  );

  const s = statsQuery.data;
  const by = s?.byStatus;

  const pieData = useMemo(() => {
    if (!by) return [];
    return (Object.keys(by) as Array<keyof typeof by>)
      .map(name => ({ name, value: by[name] }))
      .filter(d => d.value > 0);
  }, [by]);

  const lineData = useMemo(
    () =>
      (s?.createdLast7Days ?? []).map(d => ({
        ...d,
        label: formatShortDate(d.date),
      })),
    [s?.createdLast7Days],
  );

  const wallSeries = useMemo(() => {
    const rows = [...(s?.completedWallTimes ?? [])];
    rows.sort((a, b) => new Date(a.endedAtIso).getTime() - new Date(b.endedAtIso).getTime());
    return rows.map((r, i) => ({
      ...r,
      tickShort: `#${i + 1}`,
    }));
  }, [s?.completedWallTimes]);

  return (
    <DashboardLayout>
      <div className="w-full min-w-0 space-y-6 text-foreground">
        <section className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("dashboardHome.title")}</h1>
        </section>

        {statsQuery.isError ? (
          <section
            role="alert"
            className="rounded-lg border border-destructive/45 bg-destructive/10 px-4 py-3 text-sm text-destructive dark:bg-red-950/35 dark:text-red-100"
          >
            <p className="font-semibold">{t("dashboardHome.loadErrorTitle")}</p>
            <p className="mt-1 break-words font-mono text-xs opacity-90">{statsQuery.error.message}</p>
            <p className="mt-2 text-xs opacity-90">{t("dashboardHome.loadErrorHint")}</p>
          </section>
        ) : null}

        <section>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={FileSearch}
              label={t("dashboardHome.metricTotalJobs")}
              value={s != null ? String(s.totalBatches) : "—"}
              helper={t("dashboardHome.metricTotalJobsHelp")}
            />
            <MetricCard
              icon={ShieldCheck}
              label={t("dashboardHome.metricCompleted")}
              value={by != null ? String(by.completed) : "—"}
              helper={t("dashboardHome.metricCompletedHelp")}
            />
            <MetricCard
              icon={Activity}
              label={t("dashboardHome.metricRunningQueue")}
              value={by != null ? String((by.running ?? 0) + (by.queued ?? 0)) : "—"}
              helper={t("dashboardHome.metricRunningQueueHelp")}
            />
            <MetricCard
              icon={by != null && by.failed > 0 ? AlertCircle : TrendingUp}
              label={t("dashboardHome.metricFailed")}
              value={by != null ? String(by.failed) : "—"}
              helper={t("dashboardHome.metricFailedHelp")}
            />
          </div>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-3">
          <Card className="min-w-0 overflow-visible border-border/60 bg-card/90 shadow-lg dark:border-white/10 dark:bg-slate-950/60 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t("dashboardHome.chart7dTitle")}</CardTitle>
              <CardDescription>{t("dashboardHome.chart7dDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="relative h-[280px] min-w-0 overflow-visible pl-0">
              {lineData.length && lineData.some(d => d.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={lineData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLotes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      animationDuration={200}
                      cursor={{ stroke: "oklch(0.72 0.14 190 / 0.65)", strokeWidth: 1, strokeDasharray: "4 4" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name={t("dashboardHome.seriesBatches")}
                      stroke="#22d3ee"
                      strokeWidth={2}
                      fill="url(#colorLotes)"
                      isAnimationActive
                      animationDuration={600}
                      activeDot={{
                        r: 6,
                        stroke: "#22d3ee",
                        strokeWidth: 2,
                        fill: "oklch(0.2 0.02 255)",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {t("dashboardHome.chart7dEmpty")}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="min-w-0 overflow-visible border-border/60 bg-card/90 shadow-lg dark:border-white/10 dark:bg-slate-950/60">
            <CardHeader>
              <CardTitle className="text-base">{t("dashboardHome.byStatusTitle")}</CardTitle>
              <CardDescription>{t("dashboardHome.byStatusDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="relative h-[280px] min-w-0 overflow-visible">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={80}
                      paddingAngle={2}
                      isAnimationActive
                      animationDuration={500}
                      animationEasing="ease-out"
                      cursor="pointer"
                    >
                      {pieData.map((e, i) => (
                        <Cell key={e.name} fill={STATUS_PIE_COLORS[e.name] ?? `hsl(${(i * 50) % 360} 60% 55%)`} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<PieStatusTooltipContent />}
                      wrapperStyle={{ zIndex: 60, outline: "none" }}
                      animationDuration={150}
                    />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      formatter={value => <span className="text-xs capitalize text-foreground/90">{String(value)}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("dashboardHome.noData")}</div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="min-w-0">
          <Card className="min-w-0 overflow-visible border-border/60 bg-card/90 shadow-lg dark:border-white/10 dark:bg-slate-950/60">
            <CardHeader>
              <CardTitle className="text-base">{t("dashboardHome.chartWallTitle")}</CardTitle>
              <CardDescription>{t("dashboardHome.chartWallDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="relative h-[280px] min-w-0 overflow-visible pl-0">
              {wallSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={wallSeries} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis
                      dataKey="tickShort"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      width={44}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={ms => {
                        const v = ms ?? 0;
                        const min = v / 60000;
                        if (min < 1) return `${Math.max(1, Math.round(v / 1000))}s`;
                        return `${Math.round(min)}m`;
                      }}
                    />
                    <Tooltip
                      content={<WallTimesTooltipContent />}
                      animationDuration={200}
                      cursor={{ fill: "oklch(0.55 0.12 180 / 0.18)" }}
                    />
                    <Bar
                      dataKey="wallMs"
                      fill="#34d399"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={56}
                      isAnimationActive
                      animationDuration={500}
                      activeBar={{ fill: "#22d3ee", stroke: "#0891b2", strokeWidth: 1 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {statsQuery.isLoading ? "…" : t("dashboardHome.chartWallEmpty")}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="min-w-0 border-border bg-card text-card-foreground shadow-md dark:border-white/10 dark:bg-slate-950/80 dark:shadow-xl dark:shadow-slate-950/30">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>{t("dashboardHome.incidentsTitle")}</CardTitle>
                  <CardDescription className="mt-1">{t("dashboardHome.incidentsDesc")}</CardDescription>
                </div>
                <Badge className={batchStatusBadgeClass(statusFilter === "all" ? undefined : statusFilter)}>
                  {statusFilter === "all" ? t("dashboardHome.filterAll") : statusFilter}
                </Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr,180px]">
                <Input
                  placeholder={t("dashboardHome.filterPlaceholder")}
                  value={sampleFilter}
                  onChange={event => setSampleFilter(event.target.value)}
                  className="border-border bg-background dark:bg-slate-950/80"
                />
                <Select value={statusFilter} onValueChange={value => setStatusFilter(value as StatusFilter)}>
                  <SelectTrigger className="border-border bg-background dark:bg-slate-950/80">
                    <SelectValue placeholder={t("dashboardHome.statusPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("dashboardHome.filterAll")}</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScrollArea className="h-[520px] pr-4">
                <div className="space-y-3">
                  {(batchesQuery.data ?? []).map((batchRow) => {
                    return (
                      <div
                        key={batchRow.batchId}
                        className="w-full rounded-2xl border border-border bg-muted/40 p-4 transition duration-200 dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-semibold text-foreground">{batchRow.sampleName}</p>
                            <p className="text-xs text-muted-foreground">{batchRow.batchId}</p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            <Badge className={batchStatusBadgeClass(batchRow.status)}>{batchRow.status}</Badge>
                            <Link
                              href={`/interpretacao-consolidada?batch=${encodeURIComponent(batchRow.batchId)}`}
                              title={t("dashboardHome.interpretationTitle", { id: batchRow.batchId })}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-900 transition hover:bg-cyan-500/20 dark:border-cyan-400/35 dark:text-cyan-100"
                            >
                              <LinkIcon className="h-3.5 w-3.5" aria-hidden />
                              {t("dashboardHome.interpretation")}
                            </Link>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{batchRow.stage}</span>
                            <span>{formatPercentRounded(batchRow.progress)}</span>
                          </div>
                          <Progress value={batchRow.progress} className="h-1.5" />
                          <p className="text-sm text-muted-foreground">{batchRow.message ?? t("dashboardHome.noMessage")}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("dashboardHome.updatedAt", { time: formatDateTimeShort(batchRow.updatedAt) })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {batchesQuery.data?.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
                      {t("dashboardHome.emptyList")}
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
