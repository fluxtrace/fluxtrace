import DashboardLayout from "@/components/layout/DashboardLayout";
import { MermaidBlock } from "@/components/widgets/MermaidBlock";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/api/trpc";
import { ExternalLink, FolderGit2, FolderSync, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";

const GITHUB_LEGACY_TREE =
  "https://github.com/margefson/AI_correlacion_contradef/tree/main/legacy_artifacts";

function FuncoesMapeadasContent() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [planilhaDialogOpen, setPlanilhaDialogOpen] = useState(false);
  const [editingFuncao, setEditingFuncao] = useState<string | null>(null);
  const [formFuncao, setFormFuncao] = useState("");
  const [formFluxoUrl, setFormFluxoUrl] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const catalog = trpc.legacyArtifacts.catalog.useQuery();
  const detail = trpc.legacyArtifacts.detail.useQuery(
    { slug: selectedSlug! },
    { enabled: Boolean(selectedSlug) },
  );
  const planilha = trpc.legacyArtifacts.fluxosSpreadsheet.list.useQuery();

  const utils = trpc.useUtils();

  const upsertRow = trpc.legacyArtifacts.fluxosSpreadsheet.upsertRow.useMutation({
    onSuccess: async () => {
      toast.success(t("funcoes.sheetUpdated"));
      await utils.legacyArtifacts.catalog.invalidate();
      await utils.legacyArtifacts.fluxosSpreadsheet.list.invalidate();
      if (selectedSlug) await utils.legacyArtifacts.detail.invalidate({ slug: selectedSlug });
      setPlanilhaDialogOpen(false);
      setEditingFuncao(null);
    },
    onError: err => toast.error(err.message),
  });

  const deleteRow = trpc.legacyArtifacts.fluxosSpreadsheet.deleteRow.useMutation({
    onSuccess: async () => {
      toast.success(t("funcoes.rowRemoved"));
      await utils.legacyArtifacts.catalog.invalidate();
      await utils.legacyArtifacts.fluxosSpreadsheet.list.invalidate();
      if (selectedSlug) await utils.legacyArtifacts.detail.invalidate({ slug: selectedSlug });
      setDeleteTarget(null);
    },
    onError: err => toast.error(err.message),
  });

  const syncBacklog = trpc.legacyArtifacts.fluxosSpreadsheet.syncBacklog.useMutation({
    onSuccess: async data => {
      toast.success(t("funcoes.syncBacklogToast", { count: data.count }));
      await utils.legacyArtifacts.catalog.invalidate();
      await utils.legacyArtifacts.fluxosSpreadsheet.list.invalidate();
      if (selectedSlug) await utils.legacyArtifacts.detail.invalidate({ slug: selectedSlug });
    },
    onError: err => toast.error(err.message),
  });

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const raw = catalog.data?.items ?? [];
    if (!q.length) return raw;
    return raw.filter(i => i.slug.toLowerCase().includes(q));
  }, [catalog.data?.items, search]);

  useEffect(() => {
    if (selectedSlug) return;
    const first = filteredItems[0]?.slug;
    if (first) setSelectedSlug(first);
  }, [filteredItems, selectedSlug]);

  useEffect(() => {
    if (!selectedSlug || !detail.isSuccess) return;
    void utils.legacyArtifacts.catalog.invalidate();
    void utils.legacyArtifacts.fluxosSpreadsheet.list.invalidate();
  }, [detail.dataUpdatedAt, detail.isSuccess, selectedSlug, utils]);

  const openNewRow = () => {
    setEditingFuncao(null);
    setFormFuncao("");
    setFormFluxoUrl("");
    setPlanilhaDialogOpen(true);
  };

  const openEditRow = (funcao: string, url: string | null) => {
    setEditingFuncao(funcao);
    setFormFuncao(funcao);
    setFormFluxoUrl(url ?? "");
    setPlanilhaDialogOpen(true);
  };

  const submitPlanilhaForm = () => {
    upsertRow.mutate({
      funcao: formFuncao.trim(),
      fluxoUrl: formFluxoUrl.trim() ? formFluxoUrl.trim() : "",
    });
  };

  const selectedGithub =
    filteredItems.find(i => i.slug === selectedSlug)?.suggestedGithubUrl ??
    `${GITHUB_LEGACY_TREE}/${encodeURIComponent(selectedSlug ?? "")}`;

  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{t("funcoes.title")}</h1>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,280px)_1fr] lg:gap-6 lg:min-h-[min(70vh,720px)]">
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
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0 pb-4">
            {catalog.isLoading ? (
              <p className="px-6 text-xs text-muted-foreground">{t("funcoes.loadingCatalog")}</p>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]">
                <ul className="space-y-0.5 px-3">
                  {filteredItems.map(it => (
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
                        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                          {it.hasFolderOnDisk ? (
                            <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                              {t("funcoes.badgeDisk")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500/40 px-1 py-0 text-[9px] text-amber-700 dark:text-amber-300">
                              {t("funcoes.badgeSheetOnly")}
                            </Badge>
                          )}
                        </span>
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-semibold">{selectedSlug}</CardTitle>
                    <CardDescription className="text-xs">
                      {detail.data?.markdownRelative ?? t("funcoes.noFlowFile")}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
                      <a href={selectedGithub} target="_blank" rel="noopener noreferrer">
                        <FolderGit2 className="h-3.5 w-3.5" /> {t("funcoes.githubFolderBtn")}
                        <ExternalLink className="h-3 w-3 opacity-70" />
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
                      <a href={GITHUB_LEGACY_TREE} target="_blank" rel="noopener noreferrer">
                        {t("funcoes.treeLink")} <ExternalLink className="h-3 w-3 opacity-70" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col p-4">
                {detail.isFetching ? (
                  <p className="text-xs text-muted-foreground">{t("funcoes.loadingContent")}</p>
                ) : (
                  <Tabs defaultValue="diagram" className="flex min-h-0 w-full flex-1 flex-col gap-2">
                    <TabsList className="mb-0 h-9 w-fit shrink-0">
                      <TabsTrigger value="diagram" className="text-xs">
                        {t("funcoes.tabDiagram", { count: detail.data?.mermaidCharts?.length ?? 0 })}
                      </TabsTrigger>
                      <TabsTrigger value="markdown" className="text-xs">
                        {t("funcoes.tabMarkdown")}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="diagram" className="min-h-[200px] flex-1 space-y-3 overflow-auto">
                      {detail.data?.mermaidCharts?.length ? (
                        detail.data.mermaidCharts.map((src, idx) => (
                          <div
                            key={`${selectedSlug}-${idx}`}
                            className="rounded-xl border border-border/70 bg-muted/20 p-3 dark:border-white/10 dark:bg-black/35"
                          >
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("funcoes.blockPrefix")} {idx + 1}
                            </p>
                            <MermaidBlock chart={src} className="mermaid-svg-wrap overflow-auto [&_svg]:max-w-full [&_svg]:h-auto" />
                          </div>
                        ))
                      ) : (
                        <p className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-xs text-muted-foreground">
                          {t("funcoes.noMermaid")}
                        </p>
                      )}
                    </TabsContent>
                    <TabsContent value="markdown" className="min-h-[200px] flex-1 overflow-hidden">
                      <pre className="max-h-full min-h-0 overflow-auto rounded-xl border border-border/70 bg-black/35 p-3 text-[11px] leading-relaxed text-muted-foreground dark:border-white/10">
                        {detail.data?.markdown?.trim() ?? t("funcoes.markdownEmptyComment")}
                      </pre>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <Card className="border-border/80 dark:border-white/10">
        <CardHeader className="flex flex-col gap-2 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <div>
            <CardTitle className="text-base">{t("funcoes.sheetCardTitle")}</CardTitle>
          </div>
          {isAdmin ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1"
                disabled={syncBacklog.isPending}
                onClick={() => syncBacklog.mutate()}
              >
                <FolderSync className="h-4 w-4" /> {t("funcoes.syncBacklog")}
              </Button>
              <Button size="sm" className="h-9 gap-1" onClick={openNewRow}>
                <Plus className="h-4 w-4" /> {t("funcoes.newRow")}
              </Button>
            </div>
          ) : (
            <Badge variant="outline" className="w-fit text-[10px]">
              {t("funcoes.adminBadge")}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {planilha.isLoading ? (
            <p className="text-xs text-muted-foreground">{t("funcoes.readingSheet")}</p>
          ) : (
            <div className="rounded-lg border border-border/60 overflow-hidden dark:border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[220px]">{t("funcoes.colFuncao")}</TableHead>
                    <TableHead>{t("funcoes.colFluxo")}</TableHead>
                    {isAdmin ? <TableHead className="text-right">{t("funcoes.colActions")}</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(planilha.data?.rows ?? []).map(row => (
                    <TableRow key={row.funcao}>
                      <TableCell className="align-top font-mono text-xs font-medium">{row.funcao}</TableCell>
                      <TableCell className="max-w-xl align-top">
                        <a
                          href={row.effectiveFluxoUrl}
                          className="break-all text-xs text-[var(--auth-brand)] hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {row.effectiveFluxoUrl}
                        </a>
                      </TableCell>
                      {isAdmin ? (
                        <TableCell className="text-right align-top">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title={t("funcoes.editRowTitle")}
                              onClick={() => openEditRow(row.funcao, row.fluxoUrl ?? row.effectiveFluxoUrl)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title={t("funcoes.deleteRowTitle")}
                              onClick={() => setDeleteTarget(row.funcao)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={planilhaDialogOpen} onOpenChange={setPlanilhaDialogOpen}>
        <DialogContent className="max-w-md border-border bg-background dark:border-white/10">
          <DialogHeader>
            <DialogTitle>{editingFuncao ? t("funcoes.dlgEditTitle") : t("funcoes.dlgNewTitle")}</DialogTitle>
            <DialogDescription>
              <Trans i18nKey="funcoes.dlgDesc" components={{ code: <code /> }} />
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="funcao-plane">{t("funcoes.dlgNameApi")}</Label>
              <Input
                id="funcao-plane"
                disabled={Boolean(editingFuncao)}
                value={formFuncao}
                onChange={e => setFormFuncao(e.target.value)}
                placeholder={t("funcoes.dlgNamePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fluxo-url">{t("funcoes.dlgUrlLabel")}</Label>
              <Textarea
                id="fluxo-url"
                className="min-h-[72px] text-xs font-mono"
                value={formFluxoUrl}
                onChange={e => setFormFluxoUrl(e.target.value)}
                placeholder={`${GITHUB_LEGACY_TREE}/`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanilhaDialogOpen(false)}>
              {t("adminUsers.cancel")}
            </Button>
            <Button disabled={upsertRow.isPending || !formFuncao.trim()} onClick={submitPlanilhaForm}>
              {t("funcoes.saveSheet")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("funcoes.deleteConfirmTitle", { name: deleteTarget ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("funcoes.deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("adminUsers.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRow.isPending}
              onClick={() => deleteTarget && deleteRow.mutate({ funcao: deleteTarget })}
            >
              {t("funcoes.deleteRowSubmit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
