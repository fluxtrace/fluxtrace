import { LocalAuthBrand } from "@/components/auth/LocalAuthBrand";
import { ThemeLanguageToolbar } from "@/components/shell/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/api/trpc";
import { checkPasswordCriteria } from "@shared/auth/authLocalValidation";
import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function ForceChangePassword() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const me = trpc.auth.me.useQuery();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: async () => {
      toast.success(t("auth.passwordChanged"));
      await utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: e => toast.error(e.message),
  });

  const crit = useMemo(() => checkPasswordCriteria(newPw), [newPw]);
  const newPwOk = useMemo(() => Object.values(crit).every(Boolean), [crit]);
  const canChange = Boolean(me.data?.canChangePassword);

  return (
    <div className="relative min-h-svh flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-background to-[var(--auth-brand-muted)]/25">
      <div className="absolute right-4 top-4 z-10">
        <ThemeLanguageToolbar />
      </div>
      <div className="w-full max-w-md space-y-8">
        <LocalAuthBrand subtitle={t("brand.brandLine")} />
        <Card className="border-border/50 shadow-xl bg-card/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>{t("auth.forceChangeTitle")}</CardTitle>
            <CardDescription>{t("auth.forceChangeDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canChange ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="f-cur">{t("auth.currentPassword")}</Label>
                  <Input
                    id="f-cur"
                    type="password"
                    autoComplete="current-password"
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="f-n1">{t("auth.newPassword")}</Label>
                  <Input
                    id="f-n1"
                    type="password"
                    autoComplete="new-password"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                  />
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li className={crit.minLength && crit.maxLength ? "text-emerald-500" : ""}>{t("auth.criteriaShort1")}</li>
                  <li className={crit.lowercase && crit.uppercase ? "text-emerald-500" : ""}>{t("auth.criteriaShort2")}</li>
                  <li className={crit.digit && crit.special ? "text-emerald-500" : ""}>{t("auth.criteriaShort3")}</li>
                </ul>
                <div className="space-y-2">
                  <Label htmlFor="f-n2">{t("auth.confirmNew")}</Label>
                  <Input
                    id="f-n2"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => void logout()}>
                    {t("auth.logoutAction")}
                  </Button>
                  <Button
                    type="button"
                    className="bg-[var(--auth-brand)] hover:bg-[var(--auth-brand-hover)]"
                    onClick={() => {
                      if (newPw !== confirmPw) {
                        toast.error(t("auth.confirmMismatch"));
                        return;
                      }
                      if (!newPwOk) {
                        toast.error(t("auth.newPasswordInvalid"));
                        return;
                      }
                      changePassword.mutate({ currentPassword: currentPw, newPassword: newPw });
                    }}
                    disabled={changePassword.isPending}
                  >
                    {changePassword.isPending ? t("auth.updating") : t("auth.setNewPassword")}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("auth.noLocalPassword")}</p>
            )}
            {!canChange ? (
              <Button type="button" variant="secondary" onClick={() => void logout()}>
                {t("auth.logoutAction")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
