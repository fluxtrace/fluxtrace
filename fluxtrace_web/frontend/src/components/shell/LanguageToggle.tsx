import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { cn } from "@/lib/utils";
import { useId, type SVGProps } from "react";
import { useTranslation } from "react-i18next";

const LNG_PT_BR = "pt-BR";
const LNG_EN = "en";

function FlagBrazil({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 14"
      className={cn("block shrink-0 overflow-visible", className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
      {...props}
    >
      <rect width="20" height="14" fill="#009C3B" rx="1" />
      <path fill="#FFDF00" d="M10 2.35 17.05 7 10 11.65 2.95 7z" />
      <circle cx="10" cy="7" r="2.82" fill="#002776" />
      <circle cx="10" cy="6.9" r="0.52" fill="#F8F9FA" />
    </svg>
  );
}

function FlagUsa({ className, ...props }: SVGProps<SVGSVGElement>) {
  const rawId = useId();
  const clipId = `us-flag-${rawId.replace(/\W+/g, "")}`;
  const sh = 14 / 13;
  const cantonW = 8;
  const cantonH = 7 * sh;

  return (
    <svg
      viewBox="0 0 20 14"
      className={cn("block shrink-0 overflow-visible rounded-[2px]", className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width="20" height="14" rx="1" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {Array.from({ length: 13 }, (_, i) => (
          <rect key={i} x={0} y={i * sh} width={20} height={sh + 0.02} fill={i % 2 === 0 ? "#BF0A30" : "#FFFFFF"} />
        ))}
        <rect x={0} y={0} width={cantonW} height={cantonH} fill="#002868" />
      </g>
    </svg>
  );
}

/** Alterna PT-BR / EN; persistência pela configuração i18next (localStorage). */
export function LanguageToggle({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const lng = i18n.resolvedLanguage?.toLowerCase().startsWith(LNG_EN) ? LNG_EN : LNG_PT_BR;

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center rounded-md border border-border bg-background/80 p-0.5 shadow-sm",
        className,
      )}
      role="group"
      aria-label={t("language.groupLabel")}
    >
      <Button
        type="button"
        variant={lng === LNG_PT_BR ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-10 overflow-visible rounded-sm px-0 [&_svg]:size-auto"
        onClick={() => void i18n.changeLanguage(LNG_PT_BR)}
        aria-label={t("language.ptBr")}
        aria-pressed={lng === LNG_PT_BR}
        title={t("language.ptBr")}
      >
        <FlagBrazil className="h-[1.125rem] w-[1.575rem]" />
      </Button>
      <Button
        type="button"
        variant={lng === LNG_EN ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-10 overflow-visible rounded-sm px-0 [&_svg]:size-auto"
        onClick={() => void i18n.changeLanguage(LNG_EN)}
        aria-label={t("language.en")}
        aria-pressed={lng === LNG_EN}
        title={t("language.en")}
      >
        <FlagUsa className="h-[1.125rem] w-[1.575rem]" />
      </Button>
    </div>
  );
}

export function ThemeLanguageToolbar({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <LanguageToggle />
      <ThemeToggle />
    </div>
  );
}
