import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeLanguageToolbar } from "@/components/shell/LanguageToggle";
import { APP_NAME } from "@/lib/core/brand";
import { getLoginUrl } from "@/config/auth";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Bell,
  BrainCircuit,
  FileArchive,
  LayoutDashboard,
  LogOut,
  User,
  Users,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createContext, CSSProperties, useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "@/components/ui/button";

const mainNavDefs = [
  { icon: LayoutDashboard, labelKey: "nav.dashboard" as const, path: "/" },
  { icon: BrainCircuit, labelKey: "nav.consolidated" as const, path: "/interpretacao-consolidada" },
  { icon: FileArchive, labelKey: "nav.reduceLogs" as const, path: "/reduce-logs" },
  { icon: Workflow, labelKey: "nav.mappedFunctions" as const, path: "/funcoes-mapeadas" },
];

const accountNavDef = {
  icon: User,
  labelKey: "nav.profile" as const,
  path: "/perfil" as const,
};
const adminNavDef = {
  icon: Users,
  labelKey: "nav.users" as const,
  path: "/admin/usuarios" as const,
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

type DashboardShellValue = {
  /** Menu lateral em modo recolhido (offcanvas): mais largura útil para gráficos e tabelas. */
  sidebarCollapsed: boolean;
};

const DashboardShellContext = createContext<DashboardShellValue>({ sidebarCollapsed: false });

/** Só fiável em componentes renderizados *como filhos* de `<DashboardLayout>` (não no mesmo ficheiro que o envolve por fora). */
export function useDashboardShell() {
  return useContext(DashboardShellContext);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-background via-background to-[var(--auth-brand-muted)]/20 p-6">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_25%,rgba(34,211,238,0.11),transparent_58%)]"
          aria-hidden
        />
        <div className="absolute right-4 top-4 z-20 flex items-center gap-1">
          <ThemeLanguageToolbar />
        </div>
        <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("authGate.title")}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground max-w-sm">
              {t("authGate.body")}
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full max-w-sm rounded-full bg-[var(--auth-brand)] text-base font-semibold text-white shadow-lg shadow-cyan-950/30 hover:bg-[var(--auth-brand-hover)]"
          >
            {t("authGate.enter")}
          </Button>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-[var(--auth-brand)]"
          >
            {t("authGate.backHome")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const allNavItems = [
    ...mainNavDefs,
    ...(user?.role === "admin" ? [accountNavDef] : []),
    ...(user?.role === "admin" ? [adminNavDef] : []),
  ];
  /** Utilizadores normais acedem a /perfil só pelo menu do rodapé; `allNavItems` não inclui essa rota para eles. */
  const activeMenuItem =
    allNavItems.find(item => item.path === location) ??
    (location === "/perfil" ? accountNavDef : undefined);
  const isMobile = useIsMobile();
  const activeLabel = activeMenuItem != null ? t(activeMenuItem.labelKey) : t("nav.home");

  useEffect(() => {
    document.title =
      activeMenuItem != null
        ? `${t(activeMenuItem.labelKey)} | ${APP_NAME}`
        : `${APP_NAME} ${t("brand.titleSuffix")}`;
  }, [activeMenuItem?.labelKey, activeMenuItem?.path, t, i18n.language]);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <DashboardShellContext.Provider value={{ sidebarCollapsed: isCollapsed }}>
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="offcanvas"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex w-full items-center gap-3 px-2 transition-all">
              <SidebarTrigger
                className="h-8 w-8 shrink-0"
                title={t("layout.sidebarCollapseTitle")}
              />
              {!isCollapsed ? (
                <div className="flex min-w-0 items-center gap-2.5">
                  <img
                    src="/icons/favicon.svg"
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 shrink-0 rounded-lg"
                  />
                  <span className="truncate font-semibold tracking-tight">
                    {APP_NAME}
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-2">
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/80">
                {t("sidebar.main")}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="px-0 py-0">
                  {mainNavDefs.map(item => {
                    const isActive = location === item.path;
                    const label = t(item.labelKey);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={label}
                          className="h-10 transition-all font-normal"
                        >
                          <item.icon
                            className={`h-4 w-4 ${isActive ? "text-[var(--auth-brand)]" : ""}`}
                          />
                          <span>{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {user?.role === "admin" ? (
              <SidebarGroup>
                <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/80">
                  {t("sidebar.account")}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="px-0 py-0">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={location === accountNavDef.path}
                        onClick={() => setLocation(accountNavDef.path)}
                        tooltip={t(accountNavDef.labelKey)}
                        className="h-10 transition-all font-normal"
                      >
                        <accountNavDef.icon
                          className={`h-4 w-4 ${
                            location === accountNavDef.path ? "text-[var(--auth-brand)]" : ""
                          }`}
                        />
                        <span>{t(accountNavDef.labelKey)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}

            {user?.role === "admin" ? (
              <SidebarGroup>
                <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-amber-500/80">
                  {t("sidebar.admin")}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="px-0 py-0">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={location === adminNavDef.path}
                        onClick={() => setLocation(adminNavDef.path)}
                        tooltip={t(adminNavDef.labelKey)}
                        className="h-10 transition-all font-normal"
                      >
                        <adminNavDef.icon
                          className={`h-4 w-4 ${
                            location === adminNavDef.path ? "text-[var(--auth-brand)]" : ""
                          }`}
                        />
                        <span>{t(adminNavDef.labelKey)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-semibold truncate leading-none text-foreground">
                      {user?.name || "—"}
                    </p>
                    <p className="text-xs font-medium truncate mt-1.5 text-[var(--auth-brand)]">
                      {user?.role === "admin" ? t("sidebar.roleAdmin") : t("sidebar.roleUser")}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-border/80 bg-popover/95">
                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setLocation("/perfil")}>
                  <User className="h-4 w-4" />
                  <span>{t("profileMenu.myProfile")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t("profileMenu.logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="min-h-svh min-w-0 overflow-x-hidden">
        <header
          className={cn(
            "sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur",
            isCollapsed ? "px-2 sm:px-3" : "px-3 md:px-4",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SidebarTrigger
              className="h-9 w-9 shrink-0"
              title={isMobile ? t("layout.sidebarMobileOpen") : t("layout.sidebarExpand")}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/90">
                {APP_NAME} / {activeLabel}
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {activeMenuItem != null ? activeLabel : APP_NAME}
              </p>
              {!isMobile ? (
                <p className="truncate text-xs text-muted-foreground">
                  {isCollapsed ? t("layout.breadcrumbHintCollapsed") : t("layout.breadcrumbHintExpanded")}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              disabled
              title={t("layout.notificationsSoon")}
            >
              <Bell className="h-4 w-4" />
            </Button>
            <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-xs font-semibold text-[var(--auth-brand)]">
              {(user?.name ?? user?.email ?? "?")
                .split(/\s+/)
                .map(s => s[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <ThemeLanguageToolbar />
          </div>
        </header>
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-auto transition-[padding] duration-200",
            /* Menu recolhido: sem padding horizontal — aproveita toda a largura (gráficos, tabelas). */
            isCollapsed ? "px-0 py-2 md:py-3" : "p-4",
          )}
        >
          <div
            className={cn(
              "w-full min-w-0",
              isCollapsed ? "max-w-none" : "mx-auto max-w-[1680px]",
            )}
          >
            {children}
          </div>
        </div>
      </SidebarInset>
    </>
    </DashboardShellContext.Provider>
  );
}
