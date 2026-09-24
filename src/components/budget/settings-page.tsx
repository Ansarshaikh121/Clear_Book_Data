import { Button } from "@/components/ui/button";
import { CalendarCard } from "@/components/budget/calendar-card";
import { ExportCard } from "@/components/budget/export-card";
import { CURRENCIES, type CurrencyCode } from "@/lib/budget/model";
import { DEFAULT_CARD_ORDER, useBudget, type OverviewCardId } from "@/lib/budget/store";

const LABELS: Record<OverviewCardId, string> = {
  snapshot: "Monthly Snapshot",
  stats: "Income, Expenses, Saved This Month",
  rhythm: "Spending Rhythm",
  breakdown: "Spending Breakdown",
  goals: "Savings Goals",
  notes: "Month in Review and Upcoming Payments",
  recent: "Transactions",
};

export function SettingsPage() {
  const settings = useBudget((state) => state.settings);
  const patchSettings = useBudget((state) => state.patchSettings);
  const moveCard = useBudget((state) => state.moveCard);
  const currency = useBudget((state) => state.currency);
  const setCurrency = useBudget((state) => state.setCurrency);
  const removeRecurring = useBudget((state) => state.removeRecurring);

  return (
    <div className="grid gap-4">
      <header>
        <h2 className="font-display text-3xl font-medium tracking-tight">Settings</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Your ledger is saved with this account. Sign in on another device and the same transactions, goals, and budgets are there. They are not stored only in this browser. Google Calendar is not synced, and Clearbook does not use end-to-end encryption.
        </p>
      </header>
      <ExportCard />
      <CalendarCard />
      <section className="panel p-4">
        <h3 className="text-lg font-medium">Appearance</h3>
        <div className="mt-3 flex gap-2">
          {(["light", "dark"] as const).map((theme) => (
            <Button key={theme} variant={settings.theme === theme ? "primary" : "secondary"} onClick={() => patchSettings({ theme })}>
              {theme === "light" ? "Light" : "Dark"}
            </Button>
          ))}
        </div>
      </section>
      <section className="panel p-4">
        <h3 className="text-lg font-medium">Currency</h3>
        <p className="mt-1 text-sm text-muted-foreground">This only changes how amounts are written. Clearbook does not convert between currencies.</p>
        <label className="mt-3 grid gap-1 text-sm">
          Display currency
          <select className="field max-w-xs" value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)}>
            {CURRENCIES.map((item) => (
              <option key={item.code} value={item.code}>{item.label}</option>
            ))}
          </select>
        </label>
      </section>
      <section className="panel p-4">
        <h3 className="text-lg font-medium">Financial month</h3>
        <p className="mt-1 text-sm text-muted-foreground">Choose the day a month starts. 1 uses the calendar month. Later days run into the next calendar month.</p>
        <label className="mt-3 grid max-w-xs gap-1 text-sm">
          Starts on day
          <input
            className="field"
            type="number"
            min={1}
            max={28}
            value={settings.monthStartsOn}
            onChange={(event) => patchSettings({ monthStartsOn: Math.min(28, Math.max(1, Number(event.target.value) || 1)) })}
          />
        </label>
      </section>
      <section className="panel p-4">
        <h3 className="text-lg font-medium">Overview order</h3>
        <p className="mt-1 text-sm text-muted-foreground">Move cards with the keyboard. This does not change the numbers.</p>
        <ol className="mt-3 space-y-2">
          {settings.cardOrder.map((id, index) => (
            <li key={id} className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2">
              <span className="text-sm">{LABELS[id]}</span>
              <span className="flex gap-1">
                <Button variant="ghost" size="sm" aria-label={`Move ${LABELS[id]} up`} disabled={index === 0} onClick={() => moveCard(id, -1)}>Up</Button>
                <Button variant="ghost" size="sm" aria-label={`Move ${LABELS[id]} down`} disabled={index === settings.cardOrder.length - 1} onClick={() => moveCard(id, 1)}>Down</Button>
              </span>
            </li>
          ))}
        </ol>
        <Button className="mt-3" variant="secondary" onClick={() => patchSettings({ cardOrder: [...DEFAULT_CARD_ORDER] })}>Reset order</Button>
      </section>
      <section className="panel p-4">
        <h3 className="text-lg font-medium">Scheduled payments</h3>
        {settings.recurring.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">None confirmed. Suggestions appear on Insights when the same expense shows up in two months.</p> : null}
        <ul className="mt-2 space-y-2">
          {settings.recurring.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span>{item.label} · day {item.dayOfMonth}</span>
              <Button variant="ghost" size="sm" onClick={() => removeRecurring(item.id)}>Remove</Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
