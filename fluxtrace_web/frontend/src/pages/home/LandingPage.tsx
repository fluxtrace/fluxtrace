import { ThemeLanguageToolbar } from "@/components/shell/LanguageToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLoginUrl } from "@/config/auth";
import { APP_NAME } from "@/lib/core/brand";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  FileArchive,
  FileDown,
  LucideIcon,
  UserCog,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Trans, useTranslation } from "react-i18next";

function isLocalAuthMode() {
  const m = String(import.meta.env.VITE_AUTH_MODE ?? "")
    .trim()
    .toLowerCase();
  return m === "local" || m === "password";
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "cyan" | "emerald" | "amber" | "violet";
}) {
  const accentRing =
    accent === "cyan"
      ? "border-cyan-200/90 bg-cyan-50/80 dark:border-cyan-500/25 dark:bg-cyan-500/5"
      : accent === "emerald"
        ? "border-emerald-200/90 bg-emerald-50/80 dark:border-emerald-500/25 dark:bg-emerald-500/5"
        : accent === "amber"
          ? "border-amber-200/90 bg-amber-50/80 dark:border-amber-500/25 dark:bg-amber-500/5"
          : "border-violet-200/90 bg-violet-50/80 dark:border-violet-500/25 dark:bg-violet-500/5";
  return (
    <div className={cn("rounded-2xl border p-4 backdrop-blur-sm", accentRing)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{hint}</p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  badge,
  badgeClass,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  badge: string;
  badgeClass: string;
}) {
  return (
    <Card className="border-border/60 bg-card/80 shadow-md backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/50">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="rounded-xl border border-[var(--auth-brand)]/30 bg-[var(--auth-brand)]/10 p-2.5">
            <Icon className="size-5 text-[var(--auth-brand)]" strokeWidth={1.75} />
          </div>
          <Badge variant="outline" className={cn("text-[10px] font-normal", badgeClass)}>
            {badge}
          </Badge>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{desc}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Alinha cabeçalho/conteúdo/rodapé e aproveita melhor ecrãs largos (antes max-w-6xl ≈ 72rem). */
const landingShell =
  "mx-auto w-full max-w-[min(100rem,calc(100vw-1.25rem))] px-3 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-12";

/** Cabeçalho display principal e título «O que o FluxTrace oferece» — mesmo tamanho por viewport (sem depender da largura da coluna herói). */
const landingDisplayHeadlineClass =
  "text-balance text-[clamp(0.875rem,0.58rem+1.175vw,1.55rem)] font-bold leading-[1.2] tracking-tight text-foreground";

export default function LandingPage() {
  const local = isLocalAuthMode();
  const loginHref = getLoginUrl();
  const { t, i18n } = useTranslation();

  const analysisTypes = useMemo(
    () => [
      { name: t("landing.at_defense"), dot: "bg-cyan-400", status: t("landing.analysis_active") },
      { name: t("landing.at_zip"), dot: "bg-emerald-400", status: t("landing.analysis_active") },
      { name: t("landing.at_corr"), dot: "bg-amber-400", status: t("landing.analysis_active") },
      { name: t("landing.at_reduce"), dot: "bg-violet-400", status: t("landing.analysis_active") },
      { name: t("landing.at_exports"), dot: "bg-rose-400", status: t("landing.analysis_active") },
    ],
    [t],
  );

  const securityItems = useMemo(
    () => [
      t("landing.sec_1"),
      t("landing.sec_2"),
      t("landing.sec_3"),
      t("landing.sec_4"),
      t("landing.sec_5"),
    ],
    [t],
  );

  useEffect(() => {
    document.title = `${t("landing.pageTitle")} | ${APP_NAME}`;
  }, [t, i18n.language]);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.14),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_80%_60%,rgba(59,130,246,0.04),transparent_45%)] dark:bg-[radial-gradient(circle_at_80%_60%,rgba(59,130,246,0.06),transparent_45%)]"
        aria-hidden
      />

      <header className="relative z-10 border-b border-border/60 bg-card/60 backdrop-blur-md dark:border-white/5 dark:bg-black/20">
        <div className={cn("flex items-center justify-between gap-4 py-4", landingShell)}>
          <div className="flex items-center gap-3 min-w-0">
            <img src="/icons/favicon.svg" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight sm:text-base">{APP_NAME}</p>
              <p className="text-balance text-[11px] leading-snug text-muted-foreground sm:text-xs">{t("brand.taglineHeader")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40 dark:bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              </span>
              {t("landing.live")}
            </span>
            <ThemeLanguageToolbar />
          </div>
        </div>
      </header>

      <main className={cn("relative z-10 py-12 sm:py-16", landingShell)}>
        <section className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12 xl:gap-14 2xl:gap-16">
          <div className="min-w-0 space-y-6">
            <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-300">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              {t("landing.badgeTop")}
            </Badge>
            <h1 className={landingDisplayHeadlineClass}>{t("landing.heroTitle")}</h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              <Trans
                i18nKey="landing.heroLead"
                components={{ hl: <span className="text-foreground/90" /> }}
              />
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--auth-brand)] px-6 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 hover:bg-[var(--auth-brand-hover)] dark:shadow-cyan-950/40"
              >
                <a href={loginHref}>
                  {t("landing.ctaAccess")}
                  <ArrowRight className="ml-2 size-4" />
                </a>
              </Button>
              {local ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-border bg-background/80 hover:bg-muted dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <Link href="/register">{t("landing.ctaRegister")}</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatTile
              label={t("landing.stats.pipeline")}
              value={t("landing.stats.pipelineVal")}
              hint={t("landing.stats.pipelineHint")}
              accent="cyan"
            />
            <StatTile
              label={t("landing.stats.states")}
              value={t("landing.stats.statesVal")}
              hint={t("landing.stats.statesHint")}
              accent="emerald"
            />
            <StatTile
              label={t("landing.stats.reduction")}
              value={t("landing.stats.reductionVal")}
              hint={t("landing.stats.reductionHint")}
              accent="amber"
            />
            <StatTile
              label={t("landing.stats.access")}
              value={t("landing.stats.accessVal")}
              hint={t("landing.stats.accessHint")}
              accent="violet"
            />
          </div>
        </section>

        <section className="mt-20 space-y-6">
          <div className="text-center space-y-2 sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--auth-brand)]">{t("landing.featuresSectionKicker")}</p>
            <h2 className={landingDisplayHeadlineClass}>{t("landing.featuresTitle")}</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">{t("landing.featuresSubtitle")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5 2xl:gap-6">
            <FeatureCard
              icon={FileArchive}
              title={t("landing.f_reduce_title")}
              desc={t("landing.f_reduce_desc")}
              badge={t("landing.f_reduce_badge")}
              badgeClass="border-cyan-500/40 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300"
            />
            <FeatureCard
              icon={BrainCircuit}
              title={t("landing.f_interp_title")}
              desc={t("landing.f_interp_desc")}
              badge={t("landing.f_interp_badge")}
              badgeClass="border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300"
            />
            <FeatureCard
              icon={Zap}
              title={t("landing.f_focus_title")}
              desc={t("landing.f_focus_desc")}
              badge={t("landing.f_focus_badge")}
              badgeClass="border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-300"
            />
            <FeatureCard
              icon={FileDown}
              title={t("landing.f_artifacts_title")}
              desc={t("landing.f_artifacts_desc")}
              badge={t("landing.f_artifacts_badge")}
              badgeClass="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            />
            <FeatureCard
              icon={Users}
              title={t("landing.f_acl_title")}
              desc={t("landing.f_acl_desc")}
              badge={t("landing.f_acl_badge")}
              badgeClass="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            />
            <FeatureCard
              icon={UserCog}
              title={t("landing.f_admin_title")}
              desc={t("landing.f_admin_desc")}
              badge={t("landing.f_admin_badge")}
              badgeClass="border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200"
            />
          </div>
        </section>

        <section className="mt-20 grid gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm dark:border-white/10 dark:bg-card/30">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/80 dark:text-slate-300">
                {t("landing.analysisTypesHeading")}
              </h3>
              <ul className="space-y-3">
                {analysisTypes.map(item => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 dark:border-white/5 dark:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={cn("size-2 rounded-full shrink-0", item.dot)} />
                      <span className="text-sm text-foreground truncate dark:text-slate-200">{item.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {item.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm dark:border-white/10 dark:bg-card/30">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/80 dark:text-slate-300">
                {t("landing.analysis_securityHeading")}
              </h3>
              <ul className="space-y-2.5">
                {securityItems.map(text => (
                  <li key={text} className="flex items-start gap-2.5 text-sm text-foreground/90 dark:text-slate-300">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    {text}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12 rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-50/90 via-background to-muted/30 p-6 sm:p-8 dark:from-cyan-950/40 dark:via-slate-950/60 dark:to-slate-950/80">
          <h3 className="text-sm font-semibold text-cyan-800 dark:text-cyan-200/90">{t("landing.archTitle")}</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-3xl">{t("landing.archDesc")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className="border-cyan-500/40 bg-cyan-500/15 text-cyan-900 dark:text-cyan-100">{t("landing.badgeAnalysis")}</Badge>
            <Badge className="border-slate-500/40 bg-slate-500/10 text-slate-800 dark:text-slate-200">
              {t("landing.badgeChunks")}
            </Badge>
            <Badge className="border-violet-500/40 bg-violet-500/10 text-violet-900 dark:text-violet-200">
              {t("landing.badgeStates")}
            </Badge>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border bg-muted/30 py-6 dark:border-white/5 dark:bg-black/30">
        <div
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-[11px] text-muted-foreground",
            landingShell
          )}
        >
          <p className="font-mono text-[10px] sm:text-xs leading-relaxed text-muted-foreground">{t("landing.stackFooter")}</p>
          <p className="text-muted-foreground">{t("brand.operationalFooter")}</p>
        </div>
      </footer>
    </div>
  );
}
