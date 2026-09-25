import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, LayoutDashboard, List, Target, SlidersHorizontal, ChartNoAxesCombined, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntryDialog, draftFromTransaction, type Draft } from "@/components/budget/entry-dialog";
import {
  CURRENCIES,
  currentMonthKey,
  defaultDateForMonth,
  periodLabel,
  shiftMonth,
  type CurrencyCode,
  type Transaction,
} from "@/lib/budget/model";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadLedger } from "@/lib/budget/ledger";
import { ledgerRequestSignal, useBudget } from "@/lib/budget/store";
import { isMarketingPath } from "@/lib/seo";
import { ImportBanner } from "@/components/budget/import-banner";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, active: (path: string) => path === "/dashboard" },
  { to: "/transactions", label: "Ledger", icon: List, active: (path: string) => path.startsWith("/transactions") },
  { to: "/budgets", label: "Budgets", icon: Wallet, active: (path: string) => path.startsWith("/budgets") },
  { to: "/reports", label: "Insights", icon: ChartNoAxesCombined, active: (path: string) => path.startsWith("/reports") || path.startsWith("/insights") },
  { to: "/goals", label: "Goals", icon: Target, active: (path: string) => path.startsWith("/goals") },
  { to: "/settings", label: "Settings", icon: SlidersHorizontal, active: (path: string) => path.startsWith("/settings") },
] as const;

function isResetPath(pathname: string) {
  return pathname === "/reset-password" || pathname.startsWith("/reset-password/");
}

function isCredentialPath(pathname: string) {
  return pathname === "/login" || pathname === "/forgot-password";
}

function isPublicPath(pathname: string) {
  return isCredentialPath(pathname) || isResetPath(pathname);
}

type EditorApi = {
  openCreate: () => void;
  openEdit: (tx: Transaction) => void;
};

const EditorContext = createContext<EditorApi>({
  openCreate: () => {},
  openEdit: () => {},
});

export function useEditor() {
  return useContext(EditorContext);
}

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#203541" />
      <path d="M7 10.6c3.4-1.5 6.2-1.5 8.2.2v12.2c-2 1.5-4.8 1.5-8.2.1V10.6z" fill="#F6F4EF" />
      <path d="M25 10.6c-3.4-1.5-6.2-1.5-8.2.2v12.2c2 1.5 4.8 1.5 8.2.1V10.6z" fill="#E7EEF1" />
      <rect x="15.35" y="9.7" width="1.3" height="13.6" rx="0.45" fill="#1F6B4A" />
      <path d="M20.4 10.4h2.7v5.6l-1.35-1.05-1.35 1.05v-5.6z" fill="#BF6255" />
    </svg>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10">
      <div className="flex items-center gap-3">
        <Mark className="size-11 shrink-0" />
        <p className="wordmark text-foreground">Clearbook</p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </main>
  );
}

export function Frame({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const notFound = useRouterState({
    select: (state) => state.matches.some((match) => match.status === "notFound"),
  });
  const { user, isPending } = useCurrentUserState();
  const status = useBudget((state) => state.status);
  const beginSession = useBudget((state) => state.beginSession);
  const applyRemote = useBudget((state) => state.applyRemote);
  const clearSession = useBudget((state) => state.clearSession);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || isPending) return;
    if (!user) {
      clearSession();
      return;
    }
    if (isMarketingPath(pathname) || notFound || isPublicPath(pathname)) return;
    const epoch = beginSession(user.id);
    const signal = ledgerRequestSignal();
    let live = true;
    void loadLedger({ signal })
      .then((snapshot) => {
        if (!live) return;
        applyRemote(epoch, snapshot);
      })
      .catch(() => {
        if (!live || useBudget.getState().epoch !== epoch) return;
        useBudget.setState({
          status: "ready",
          notice: { text: "Could not load your ledger.", undo: null },
        });
      });
    return () => {
      live = false;
    };
  }, [mounted, isPending, user?.id, pathname, notFound, beginSession, applyRemote, clearSession]);

  // Public pages and the 404 page must be in the first HTML response.
  // A signed-in visit to "/" or the login screens goes to the ledger once the session is known.
  if (isMarketingPath(pathname) || notFound || isPublicPath(pathname)) {
    if ((pathname === "/" || isCredentialPath(pathname)) && mounted && !isPending && user) {
      return <Navigate to="/dashboard" />;
    }
    return <>{children}</>;
  }

  if (!mounted || isPending) {
    return <LoadingScreen label="Loading your account…" />;
  }
  if (!user) {
    if (isPublicPath(pathname)) return <>{children}</>;
    return <RedirectToSignIn />;
  }
  if (isCredentialPath(pathname)) return <Navigate to="/dashboard" />;
  if (isResetPath(pathname)) return <>{children}</>;
  if (status !== "ready") return <LoadingScreen label="Loading your ledger…" />;
  return <FrameInner userId={user.id}>{children}</FrameInner>;
}

function FrameInner({ children, userId }: { children: ReactNode; userId: string }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currency = useBudget((state) => state.currency);
  const setCurrency = useBudget((state) => state.setCurrency);
  const viewMonth = useBudget((state) => state.viewMonth);
  const setViewMonth = useBudget((state) => state.setViewMonth);
  const settings = useBudget((state) => state.settings);
  const goals = useBudget((state) => state.goals);
  const notice = useBudget((state) => state.notice);
  const undoDelete = useBudget((state) => state.undoDelete);
  const dismissNotice = useBudget((state) => state.dismissNotice);
  const addTransaction = useBudget((state) => state.addTransaction);
  const updateTransaction = useBudget((state) => state.updateTransaction);
  const deleteTransaction = useBudget((state) => state.deleteTransaction);
  const [editor, setEditor] = useState<null | { mode: "create"; nonce: number } | { mode: "edit"; tx: Transaction }>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const label = periodLabel(viewMonth, settings.monthStartsOn);
  const api: EditorApi = {
    openCreate: () => setEditor({ mode: "create", nonce: Date.now() }),
    openEdit: (tx) => setEditor({ mode: "edit", tx }),
  };

  const createDraft: Draft = {
    kind: "expense",
    amount: "",
    categoryId: "groceries",
    note: "",
    merchant: "",
    date: defaultDateForMonth(viewMonth),
    goalId: goals[0]?.id ?? "",
  };

  return (
    <EditorContext.Provider value={api}>
      <div className="app-redesign mx-auto min-h-screen w-full" data-appearance={settings.theme}>
        <aside className="app-sidebar" aria-label="Main navigation">
          <Link to="/dashboard" className="app-sidebar-brand" aria-label="Clearbook dashboard">
            <Mark className="size-10 shrink-0" />
            <span className="wordmark">Clearbook</span>
          </Link>
          <nav aria-label="Sections" className="app-sidebar-links">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} aria-current={item.active(pathname) ? "page" : undefined}
                className={item.active(pathname) ? "app-nav-link app-nav-active" : "app-nav-link"}>
                <item.icon className="size-5 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="app-sidebar-user"><UserButton /></div>
        </aside>
        <div className="app-main">
          <header className="app-topbar">
            <Link to="/dashboard" className="app-mobile-brand" aria-label="Clearbook dashboard">
              <Mark className="size-9 shrink-0" /><span className="wordmark">Clearbook</span>
            </Link>
            <div className="app-topbar-controls">
              <label className="sr-only" htmlFor="currency">Currency</label>
              <select id="currency" className="field w-24" value={currency} title="Changes display only. Amounts are not converted."
                onChange={(event) => setCurrency(event.target.value as CurrencyCode)}>
                {CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
              <div className="app-month-switch">
                <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}><ChevronLeft className="size-4" /></Button>
                <p className="app-month-label">{label}</p>
                <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setViewMonth(shiftMonth(viewMonth, 1))}><ChevronRight className="size-4" /></Button>
              </div>
              <Button className="app-add-button" onClick={api.openCreate}><Plus className="size-4" /> <span className="app-add-label">Add transaction</span></Button>
              <div className="app-mobile-user"><UserButton /></div>
            </div>
          </header>
          <ImportBanner userId={userId} currency={currency} />
          {notice ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3 text-sm" role="status">
              <p>{notice.text}</p>
              <div className="flex gap-2">
                {notice.undo ? <Button size="sm" variant="secondary" onClick={undoDelete}>Undo</Button> : null}
                <Button size="sm" variant="ghost" onClick={dismissNotice}>Dismiss</Button>
              </div>
            </div>
          ) : null}
          {children}
        </div>
      </div>
      <nav className="app-bottom-nav" aria-label="Sections">
        {NAV.map((item) => (
          <Link key={item.to} to={item.to} aria-current={item.active(pathname) ? "page" : undefined}
            className={item.active(pathname) ? "app-bottom-link app-bottom-active" : "app-bottom-link"}>
            <item.icon className="size-5" aria-hidden="true" /><span>{item.label}</span>
          </Link>
        ))}
      </nav>
      {editor?.mode === "create" ? (
        <EntryDialog
          key={editor.nonce}
          title="Add Transaction"
          initial={createDraft}
          currency={currency}
          goals={goals}
          onClose={() => setEditor(null)}
          onSubmit={(value) => {
            addTransaction({ id: crypto.randomUUID(), ...value });
            setViewMonth(value.date.slice(0, 7));
            setEditor(null);
          }}
        />
      ) : null}
      {editor?.mode === "edit" ? (
        <EntryDialog
          key={editor.tx.id}
          title="Edit transaction"
          initial={draftFromTransaction(editor.tx)}
          currency={currency}
          goals={goals}
          onClose={() => setEditor(null)}
          onSubmit={(value) => {
            updateTransaction(editor.tx.id, value);
            setViewMonth(value.date.slice(0, 7));
            setEditor(null);
          }}
          onDelete={() => {
            deleteTransaction(editor.tx.id);
            setEditor(null);
          }}
        />
      ) : null}
      <span className="sr-only">Viewing {label}. Currency display is {currency}. Today’s month key is {currentMonthKey()}.</span>
    </EditorContext.Provider>
  );
}
