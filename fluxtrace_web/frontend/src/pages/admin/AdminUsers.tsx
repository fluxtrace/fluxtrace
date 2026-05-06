import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  AlertDialog,
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
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDateTimeShort } from "@/lib/core/format";
import { trpc } from "@/lib/api/trpc";
import type { AppRouter } from "@backend/controllers/routers";
import type { inferRouterOutputs } from "@trpc/server";
import { KeyRound, Pencil, Shield, Trash2, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";

type UserRow = inferRouterOutputs<AppRouter>["admin"]["listUsers"][number];

export default function AdminUsers() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const list = trpc.admin.listUsers.useQuery(undefined, { enabled: user?.role === "admin" });

  const updateUser = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      toast.success(t("adminUsers.updated"));
      void utils.admin.listUsers.invalidate();
      void utils.auth.me.invalidate();
      setEditOpen(false);
      setEditRow(null);
    },
    onError: e => toast.error(e.message),
  });

  const setDefaultPw = trpc.admin.setPasswordToDefault.useMutation({
    onSuccess: () => {
      toast.success(t("adminUsers.defaultPwSuccess"));
      void utils.admin.listUsers.invalidate();
      setDefaultOpen(false);
      setDefaultTarget(null);
    },
    onError: e => toast.error(e.message),
  });

  const deleteUserM = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success(t("adminUsers.removed"));
      void utils.admin.listUsers.invalidate();
      setDeleteOpen(false);
      setDeleteTarget(null);
    },
    onError: e => toast.error(e.message),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");

  const [defaultOpen, setDefaultOpen] = useState(false);
  const [defaultTarget, setDefaultTarget] = useState<UserRow | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  useEffect(() => {
    if (editRow) {
      setEditName(editRow.name ?? "");
      setEditEmail(editRow.email ?? "");
      setEditRole(editRow.role);
    }
  }, [editRow]);

  if (!loading && user && user.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {t("adminUsers.noAccess")}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full min-w-0 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--auth-brand)]">{t("adminUsers.kicker")}</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2">
              <UserCog className="size-7 text-[var(--auth-brand)]" />
              {t("adminUsers.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              <Trans i18nKey="adminUsers.subtitle" components={{ strong: <strong /> }} />
            </p>
          </div>
        </div>

        <Card className="border-border/60 bg-card/80 shadow-lg dark:border-white/10 dark:bg-slate-950/60">
          <CardHeader>
            <CardTitle className="text-lg">{t("adminUsers.cardTitle")}</CardTitle>
            <CardDescription>{t("adminUsers.cardDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminUsers.colUser")}</TableHead>
                  <TableHead>{t("adminUsers.colEmail")}</TableHead>
                  <TableHead>{t("adminUsers.colRole")}</TableHead>
                  <TableHead>{t("adminUsers.colMethod")}</TableHead>
                  <TableHead>{t("adminUsers.colLastAccess")}</TableHead>
                  <TableHead className="text-right w-[200px]">{t("adminUsers.colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data ?? []).map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        {u.role === "admin" ? (
                          <Shield className="size-4 text-amber-500 shrink-0" aria-hidden />
                        ) : null}
                        <span className="font-medium">{u.name ?? "—"}</span>
                        {u.mustChangePassword ? (
                          <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                            {t("adminUsers.badgeMustChange")}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs max-w-[200px] truncate">
                      {u.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          u.role === "admin"
                            ? "border-amber-500/50 text-amber-500"
                            : "border-border text-muted-foreground"
                        }
                      >
                        {u.role === "admin" ? t("adminUsers.roleAdmin") : t("adminUsers.roleUser")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.hasLocalPassword ? "local" : u.loginMethod ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatDateTimeShort(u.lastSignedIn)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={t("adminUsers.editTitleBtn")}
                          onClick={() => {
                            setEditRow(u);
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[var(--auth-brand)]"
                          title={t("adminUsers.resetPwTitleBtn")}
                          disabled={u.id === user?.id}
                          onClick={() => {
                            setDefaultTarget(u);
                            setDefaultOpen(true);
                          }}
                        >
                          <KeyRound className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          title={t("adminUsers.deleteTitleBtn")}
                          disabled={u.id === user?.id}
                          onClick={() => {
                            setDeleteTarget(u);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {list.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {t("adminUsers.emptyUsers")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog
          open={editOpen}
          onOpenChange={o => {
            setEditOpen(o);
            if (!o) setEditRow(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("adminUsers.editDlgTitle")}</DialogTitle>
              <DialogDescription>{t("adminUsers.editDlgDesc")}</DialogDescription>
            </DialogHeader>
            {editRow ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="en">{t("adminUsers.lblName")}</Label>
                  <Input id="en" value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ee">{t("adminUsers.lblEmail")}</Label>
                  <Input id="ee" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("adminUsers.lblRoleSelect")}</Label>
                  <Select value={editRole} onValueChange={v => setEditRole(v as "user" | "admin")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">{t("adminUsers.selectRoleUser")}</SelectItem>
                      <SelectItem value="admin">{t("adminUsers.selectRoleAdmin")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  if (!editRow) return;
                  updateUser.mutate({
                    userId: editRow.id,
                    name: editName.trim(),
                    email: editEmail.trim().toLowerCase(),
                    role: editRole,
                  });
                }}
                disabled={updateUser.isPending}
              >
                {updateUser.isPending ? t("adminUsers.savePending") : t("adminUsers.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={defaultOpen}
          onOpenChange={o => {
            setDefaultOpen(o);
            if (!o) setDefaultTarget(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("adminUsers.defaultDlgTitle")}</DialogTitle>
              <DialogDescription asChild>
                <div>
                  <Trans
                    i18nKey="adminUsers.defaultDlgDesc"
                    values={{ email: defaultTarget?.email ?? "" }}
                    components={{ strong: <strong /> }}
                  />
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDefaultOpen(false);
                  setDefaultTarget(null);
                }}
              >
                {t("adminUsers.cancel")}
              </Button>
              <Button
                type="button"
                className="bg-[var(--auth-brand)] hover:bg-[var(--auth-brand-hover)]"
                onClick={() => {
                  if (!defaultTarget) return;
                  setDefaultPw.mutate({ userId: defaultTarget.id });
                }}
                disabled={setDefaultPw.isPending}
              >
                {setDefaultPw.isPending ? t("adminUsers.confirmPending") : t("adminUsers.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={deleteOpen}
          onOpenChange={o => {
            setDeleteOpen(o);
            if (!o) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("adminUsers.deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <Trans
                    i18nKey="adminUsers.deleteDesc"
                    values={{ email: deleteTarget?.email ?? "" }}
                    components={{ strong: <strong /> }}
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("adminUsers.cancel")}</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteUserM.isPending}
                onClick={() => {
                  if (deleteTarget) {
                    deleteUserM.mutate({ userId: deleteTarget.id });
                  }
                }}
              >
                {deleteUserM.isPending ? t("adminUsers.deletePending") : t("adminUsers.delete")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
