import type { VirusTotalAnalysisStats } from "@shared/virusTotal/virusTotalReport";

/** Soma dos valores numéricos em `last_analysis_stats` (engines nos vários buckets). */
export function virusTotalAnalysisStatsTotal(stats: VirusTotalAnalysisStats): number {
  return Object.values(stats).reduce<number>((acc, v) => {
    return typeof v === "number" && Number.isFinite(v) ? acc + v : acc;
  }, 0);
}

function engineSharePct(part: number, total: number): string | null {
  if (total <= 0 || part <= 0) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(part / total);
}

function statLine(
  label: string,
  value: number | undefined,
  tone: "muted" | "risk" | "ok",
  opts?: { engineTotal?: number },
) {
  const n = typeof value === "number" ? value : 0;
  const toneCls =
    tone === "risk" ? "text-rose-200" : tone === "ok" ? "text-emerald-200/95" : "text-muted-foreground";
  const share =
    typeof opts?.engineTotal === "number" && opts.engineTotal > 0 ? engineSharePct(n, opts.engineTotal) : null;

  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
        <span className={`font-medium ${toneCls}`}>{n}</span>
        {share !== null ? <span className="text-[11px] font-normal text-muted-foreground">{share}</span> : null}
      </span>
    </div>
  );
}

type Props = { stats: VirusTotalAnalysisStats | null };

/** Contagens `last_analysis_stats` VirusTotal — usado pelo painel completo e pelo resumo ao lado do veredito. */
export function VirusTotalEngineStatsBlock({ stats }: Props) {
  if (!stats) {
    return <p className="text-sm text-muted-foreground">Não há contagens das engines nesta resposta VT.</p>;
  }
  const engineTotal = virusTotalAnalysisStatsTotal(stats);
  const timeoutFailures = (stats.timeout ?? 0) + (stats.failure ?? 0) + (stats.confirmed_timeout ?? 0);

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3 dark:border-white/10 dark:bg-slate-950/60">
      <div className="divide-y divide-border/60 dark:divide-white/10">
        {statLine("Maliciosas", stats.malicious, "risk", { engineTotal })}
        {statLine("Suspeitas", stats.suspicious, "risk", { engineTotal })}
        {statLine("Harmless", stats.harmless, "ok", { engineTotal })}
        {statLine("Não detectado", stats.undetected, "muted", { engineTotal })}
        {statLine("Timeout / falhas", timeoutFailures, "muted", { engineTotal })}
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border/70 py-1.5 text-sm font-semibold dark:border-white/15">
        <span className="text-foreground">
          Total de engines (<code className="rounded px-1 text-xs font-normal">last_analysis_stats</code>)
        </span>
        <span className="tabular-nums text-foreground">{engineTotal}</span>
      </div>
    </div>
  );
}
