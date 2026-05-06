import { LocalAuthBrand } from "@/components/auth/LocalAuthBrand";
import { ThemeLanguageToolbar } from "@/components/shell/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/api/trpc";
import { checkPasswordCriteria } from "@shared/auth/authLocalValidation";
import { Lock, Mail, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n/config";
import { toast } from "sonner";

const isLocalAuth = () =>
  String(import.meta.env.VITE_AUTH_MODE ?? "")
    .trim()
    .toLowerCase() === "local" ||
  String(import.meta.env.VITE_AUTH_MODE ?? "")
    .trim()
    .toLowerCase() === "password";

const blockClipboard = (e: React.ClipboardEvent) => {
  e.preventDefault();
  toast.info(i18n.t("auth.clipboardDisabled"));
};

export default function Register() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const register = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success(t("auth.accountCreated"));
      window.location.href = "/login";
    },
    onError: err => {
      toast.error(err.message);
    },
  });

  const criteria = useMemo(() => checkPasswordCriteria(password), [password]);
  const criteriaOk = useMemo(
    () => Object.values(criteria).every(Boolean),
    [criteria],
  );

  if (!isLocalAuth()) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="absolute right-4 top-4 z-10">
          <ThemeLanguageToolbar />
        </div>
        <p className="text-muted-foreground text-sm text-center max-w-md">{t("auth.registerRequiredBuild")}</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-background to-[var(--auth-brand-muted)]/25">
      <div className="absolute right-4 top-4 z-10">
        <ThemeLanguageToolbar />
      </div>
      <div className="w-full max-w-md space-y-8">
        <LocalAuthBrand subtitle={t("brand.brandLine")} />

        <Card className="border-border/50 shadow-xl shadow-black/20 bg-card/95 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-2 text-center sm:text-left">
            <CardTitle className="text-xl font-semibold">{t("auth.registerTitle")}</CardTitle>
            <CardDescription className="text-sm">{t("auth.registerDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                if (!criteriaOk) {
                  toast.error(t("auth.passwordCriteriaFail"));
                  return;
                }
                register.mutate({ name, email, password });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="name" className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {t("auth.name")}
                </Label>
                <div className="relative">
                  <UserRound
                    className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                    aria-hidden
                  />
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="pl-10 h-11 bg-input/80 border-border/60"
                    minLength={2}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {t("auth.email")}
                </Label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                    aria-hidden
                  />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-input/80 border-border/60"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {t("auth.password")}
                </Label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                    aria-hidden
                  />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onPaste={blockClipboard}
                    onCopy={blockClipboard}
                    onCut={blockClipboard}
                    className="pl-10 h-11 bg-input/80 border-border/60"
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Lock className="size-3 shrink-0 opacity-70" aria-hidden />
                  {t("auth.passwordHint")}
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 pt-1">
                  <li className={criteria.minLength && criteria.maxLength ? "text-emerald-500" : ""}>
                    {t("auth.passwordLength")}
                  </li>
                  <li className={criteria.lowercase && criteria.uppercase ? "text-emerald-500" : ""}>
                    {t("auth.passwordCase")}
                  </li>
                  <li className={criteria.digit && criteria.special ? "text-emerald-500" : ""}>
                    {t("auth.passwordDigitSpecial")}
                  </li>
                </ul>
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold text-white shadow-md border-0 bg-[var(--auth-brand)] hover:bg-[var(--auth-brand-hover)]"
                disabled={register.isPending || !criteriaOk}
              >
                {register.isPending ? t("auth.creating") : t("auth.registerSubmit")}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t("auth.hasAccount")}{" "}
                <Link href="/login" className="text-[var(--auth-brand)] font-medium hover:underline">
                  {t("auth.signIn")}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
