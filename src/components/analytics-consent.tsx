import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { analyticsAvailable, stopAnalytics, trackPublicPage } from "@/lib/analytics";

const CONSENT_KEY = "clearbook.analytics.v1";
type Choice = "granted" | "denied" | null;

function savedChoice(): Choice {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch { return null; }
}

export function AnalyticsConsent() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [choice, setChoice] = useState<Choice | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => { setChoice(savedChoice()); }, []);
  useEffect(() => {
    if (choice === "granted") {
      if (analyticsAvailable(path)) trackPublicPage(path);
      else stopAnalytics();
    }
  }, [choice, path]);

  if (choice === undefined || !analyticsAvailable(path)) return null;

  function choose(next: Exclude<Choice, null>) {
    try { window.localStorage.setItem(CONSENT_KEY, next); } catch { /* next page asks again */ }
    setChoice(next);
    setEditing(false);
    if (next === "denied") stopAnalytics();
  }

  if (choice !== null && !editing) {
    return (
      <button type="button" className="fixed bottom-3 left-3 z-40 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground shadow-card" onClick={() => setEditing(true)}>
        Analytics settings
      </button>
    );
  }

  return (
    <aside className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-card border border-border bg-card p-4 shadow-card" aria-label="Analytics preference">
      <p className="text-sm font-medium">Help us understand site visits?</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        With your permission, Google Analytics counts visits to public information pages. We do not load it on login, your ledger, bank statement import, or the worksheet. No account details, transaction amounts, or statement contents are sent. You can change this choice here later.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="press h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" onClick={() => choose("granted")}>Allow analytics</button>
        <button type="button" className="press h-11 rounded-md border border-border px-4 text-sm font-medium" onClick={() => choose("denied")}>No thanks</button>
      </div>
    </aside>
  );
}
