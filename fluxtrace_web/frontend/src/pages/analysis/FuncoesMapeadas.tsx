import DashboardLayout from "@/components/layout/DashboardLayout";
import { MermaidBlock } from "@/components/widgets/MermaidBlock";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/api/trpc";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PivotCoveragePanel } from "@/components/analysis/PivotCoveragePanel";
import { useTranslation } from "react-i18next";

function FuncoesMapeadasContent() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [coverageBatchId, setCoverageBatchId] = useState<string | null>(null);

  const catalog = trpc.legacyArtifacts.catalog.useQuery();
  const inCatalog = Boolean(selectedSlug && catalog.data?.items.some((item) => item.slug === selectedSlug && item.hasFolderOnDisk));
  const detail = trpc.legacyArtifacts.detail.useQuery(
    { slug: selectedSlug! },
    { enabled: Boolean(selectedSlug) && inCatalog },
  );
  const liveCoverage = trpc.analysis.pivotCoverage.useQuery(
    { batchId: coverageBatchId ?? "" },
    { enabled: Boolean(coverageBatchId) },
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const raw = (catalog.data?.items ?? []).filter((item) => item.hasFolderOnDisk);
    if (!q.length) return raw;
    return raw.filter((item) => item.slug.toLowerCase().includes(q));
  }, [catalog.data?.items, search]);

  const liveMermaid =
    liveCoverage.data?.flows.find((flow) => flow.api === selectedSlug)?.mermaid
    ?? (liveCoverage.data?.flow?.api === selectedSlug ? liveCoverage.data.flow.mermaid : undefined);
  const diagramCharts =
    detail.data?.mermaidCharts?.length ? detail.data.mermaidCharts : liveMermaid ? [liveMermaid] : [];

  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{t("funcoes.title")}</h1>

      <PivotCoveragePanel
        batchId={coverageBatchId}
        api={selectedSlug}
        showBatchSelect
        onBatchChange={setCoverageBatchId}
        onApiChange={setSelectedSlug}
      />

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,280px)_1fr] lg:gap-6 lg:min-h-[min(58vh,600px)]">
        <Card className="flex h-full min-h-0 flex-col border-border/80 dark:border-white/10">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("funcoes.foldersTitle")}</CardTitle>
            <CardDescription className="text-xs">{t("funcoes.foldersDesc")}</CardDescription>
            <div className="relative pt-2">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder={t("funcoes.filterPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0 pb-4">
            {catalog.isLoading ? (
              <p className="px-6 text-xs text-muted-foreground">{t("funcoes.loadingCatalog")}</p>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]">
                <ul className="space-y-0.5 px-3">
                  {filteredItems.map((it) => (
                    <li key={it.slug}>
                      <button
                        type="button"
                        onClick={() => setSelectedSlug(it.slug)}
                        className={`flex w-full flex-nowrap items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium leading-snug transition-colors sm:text-xs ${
                          selectedSlug === it.slug
                            ? "bg-[var(--auth-brand)]/15 text-foreground"
                            : "hover:bg-muted/60 dark:hover:bg-white/5"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate font-mono tracking-tight" title={it.slug}>
                          {it.slug}
                        </span>
                        <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                          {t("funcoes.badgeDisk")}
                        </Badge>
                      </button>
                    </li>
                  ))}
                  {filteredItems.length === 0 ? (
                    <li className="px-3 py-4 text-xs text-muted-foreground">{t("funcoes.filterNoMatch")}</li>
                  ) : null}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-0 w-full flex-col border-border/80 dark:border-white/10">
          {!selectedSlug ? (
            <CardHeader>
              <CardTitle className="text-sm">{t("funcoes.selectFunction")}</CardTitle>
            </CardHeader>
          ) : (
            <>
              <CardHeader className="shrink-0 space-y-1 border-b border-border/60 pb-4 dark:border-white/10">
                <CardTitle className="text-lg font-semibold">{selectedSlug}</CardTitle>
                <CardDescription className="text-xs">
                  {detail.data?.markdownRelative
                    ?? (liveMermaid ? t("funcoes.liveTraceFlow") : t("funcoes.noFlowFile"))}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col p-4">
                {detail.isFetching ? (
                  <p className="text-xs text-muted-foreground">{t("funcoes.loadingContent")}</p>
                ) : (
                  <Tabs defaultValue="diagram" className="flex min-h-0 w-full flex-1 flex-col gap-2">
                    <TabsList className="mb-0 h-9 w-fit shrink-0">
                      <TabsTrigger value="diagram" className="text-xs">
                        {t("funcoes.tabDiagram", { count: diagramCharts.length })}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="diagram" className="min-h-[200px] flex-1 space-y-3 overflow-auto">
                      {diagramCharts.length ? (
                        diagramCharts.map((src, idx) => (
                          <div
                            key={`${selectedSlug}-${idx}`}
                            className="rounded-xl border border-border/70 bg-muted/20 p-3 dark:border-white/10 dark:bg-black/35"
                          >
                            <MermaidBlock chart={src} className="mermaid-svg-wrap overflow-auto [&_svg]:h-auto [&_svg]:max-w-full" />
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">{t("funcoes.noMermaid")}</p>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function FuncoesMapeadas() {
  return (
    <DashboardLayout>
      <FuncoesMapeadasContent />
    </DashboardLayout>
  );
}
