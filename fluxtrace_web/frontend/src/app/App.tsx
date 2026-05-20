import { TooltipProvider } from "@/components/ui/tooltip";
import { trpc } from "@/lib/api/trpc";
import NotFound from "@/pages/errors/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import ErrorBoundary from "@/components/shell/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AdminUsers from "@/pages/admin/AdminUsers";
import ComponentsShowcase from "@/pages/dev/ComponentShowcase";
import ForceChangePassword from "@/pages/auth/ForceChangePassword";
import Home from "@/pages/home/Home";
import InterpretacaoConsolidada from "@/pages/analysis/InterpretacaoConsolidada";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Profile from "@/pages/account/Profile";
import ReduceLogs from "@/pages/reduce-logs/ReduceLogs";
import FuncoesMapeadas from "@/pages/analysis/FuncoesMapeadas";
import FluxoMalware from "@/pages/analysis/FluxoMalware";

const FORCE_PASSWORD_PATH = "/trocar-senha-obrigatorio";

function FullScreenLoad() {
  const { t } = useTranslation();
  return (
    <div className="min-h-svh flex items-center justify-center bg-background text-muted-foreground text-sm">{t("app.loading")}</div>
  );
}

function AppRouter() {
  const [path, setPath] = useLocation();
  const { data, isLoading } = trpc.auth.me.useQuery();

  useLayoutEffect(() => {
    if (isLoading) return;
    if (data?.mustChangePassword && path !== FORCE_PASSWORD_PATH) {
      setPath(FORCE_PASSWORD_PATH, { replace: true });
    } else if (data && !data.mustChangePassword && path === FORCE_PASSWORD_PATH) {
      setPath("/", { replace: true });
    } else if (!data && path === FORCE_PASSWORD_PATH) {
      setPath("/login", { replace: true });
    }
  }, [isLoading, data, path, setPath]);

  if (isLoading) {
    return <FullScreenLoad />;
  }

  const block =
    (data?.mustChangePassword && path !== FORCE_PASSWORD_PATH) ||
    (Boolean(data) && !data?.mustChangePassword && path === FORCE_PASSWORD_PATH) ||
    (!data && path === FORCE_PASSWORD_PATH);

  if (block) {
    return <FullScreenLoad />;
  }

  return (
    <Switch>
      <Route path={FORCE_PASSWORD_PATH} component={ForceChangePassword} />
      <Route path="/" component={Home} />
      <Route path="/perfil" component={Profile} />
      <Route path="/admin/usuarios" component={AdminUsers} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/interpretacao-consolidada" component={InterpretacaoConsolidada} />
      <Route path="/reduce-logs" component={ReduceLogs} />
      <Route path="/funcoes-mapeadas/fluxo-malware" component={FluxoMalware} />
      <Route path="/funcoes-mapeadas" component={FuncoesMapeadas} />
      <Route path="/component-showcase" component={ComponentsShowcase} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
