import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react";
import { useEditor } from "@/components/budget/frame";
import type { ChartSlice } from "@/components/budget/spend-chart";
import {
  allocationOf,
  categoryColor,
  dailyExpensesInRange,
  formatDay,
  formatMoney,
  periodBounds,
  periodLabel,
  spendingComparisonCopy,
  summarizeRange,
  totalSavings,
  type CurrencyCode,
  type DaySpend,
  type Goal,
  type Transaction,
} from "@/lib/budget/model";
import { categoryDeltas, comparePeriods, monthInReview, upcomingInPeriod, type ReviewFact } from "@/lib/budget/insights";
import { useBudget, type OverviewCardId } from "@/lib/budget/store";

function useCharts() {
  const [charts, setCharts] = useState<{
    SpendChart: ComponentType<{ slices: ChartSlice[]; total: number; currency: CurrencyCode; onSelect?: (id: string) => void }>;
    DailySpendChart: ComponentType<{ points: DaySpend[]; currency: CurrencyCode; onSelect?: (date: string) => void }>;
  } | null>(null);
  useEffect(() => {
    let live = true;
    void import("@/components/budget/spend-chart").then((mod) => {
      if (live) setCharts({ SpendChart: mod.SpendChart, DailySpendChart: mod.DailySpendChart });
    });
    return () => {
      live = false;
    };
  }, []);
  return charts;
}

export function Overview() {
  const transactions = useBudget((state) => state.transactions);
  const goals = useBudget((state) => state.goals);
  const currency = useBudget((state) => state.currency);
  const settings = useBudget((state) => state.settings);
  const viewMonth = useBudget((state) => state.viewMonth);
  const charts = useCharts();
  const { openEdit } = useEditor();
  const bounds = periodBounds(viewMonth, settings.monthStartsOn);
  const summary = useMemo(() => summarizeRange(transactions, bounds.start, bounds.end), [transactions, bounds.start, bounds.end]);
  const points = useMemo(() => dailyExpensesInRange(transactions, bounds.start, bounds.end), [transactions, bounds.start, bounds.end]);
  const allocation = allocationOf(summary);
  const compare = useMemo(
    () => comparePeriods(transactions, viewMonth, settings.monthStartsOn),
    [transactions, viewMonth, settings.monthStartsOn],
  );
  const review = monthInReview(compare, summary.savings);
  const upcoming = upcomingInPeriod(settings.recurring, transactions, bounds.start, bounds.end);
  const recent = useMemo(
    () =>
      transactions
        .filter((tx) => tx.date >= bounds.start && tx.date <= bounds.end)
        .sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1))
        .slice(0, 5),
    [transactions, bounds.start, bounds.end],
  );
  const slices: ChartSlice[] = summary.spentByCategory.slice(0, 6).map((slice) => ({
    ...slice,
    fill: categoryColor(slice.categoryId),
  }));
  const featured = goals[0];
  const saved = featured ? totalSavings(transactions, featured.id) : 0;
  const label = periodLabel(viewMonth, settings.monthStartsOn);
  const deltas = categoryDeltas(compare);
  const insight = deltas.find((row) => row.percent != null && row.previous > 0);

  const cards: Record<OverviewCardId, ReactNode> = {
    snapshot: (
      <section className="hero p-4 sm:p-5 lg:col-span-12" aria-labelledby="remaining-label">
        <p className="text-xs font-medium uppercase tracking-wide text-hero-muted">Monthly Snapshot</p>
        <h2 id="remaining-label" className="mt-2 text-sm text-hero-muted">
          Remaining This Month · {label}
        </h2>
        <p className={summary.remaining < 0 ? "figure-balance mt-1 text-hero-negative" : "figure-balance mt-1 text-hero-foreground"}>
          {formatMoney(summary.remaining, currency)}
        </p>
        <p className="mt-1 max-w-xl text-sm text-hero-muted">A clearer picture of where your money goes. This is what remains after income, expenses, and savings — not a bank balance.</p>
        <FlowBar allocation={allocation} summary={summary} currency={currency} label={label} />
      </section>
    ),
    stats: (
      <section className="grid gap-3 sm:grid-cols-3 lg:col-span-12" aria-label="Income, expenses, and savings">
        <Stat label="Income" value={formatMoney(summary.income, currency)} tone="text-positive" icon={ArrowDownLeft} />
        <Stat label="Expenses" value={formatMoney(summary.expense, currency)} tone="text-negative" icon={ArrowUpRight} />
        <Stat label="Saved This Month" value={formatMoney(summary.savings, currency)} tone="text-savings" icon={Landmark} />
      </section>
    ),
    rhythm: (
      <section className="panel min-w-0 p-4 lg:col-span-7" aria-labelledby="rhythm-heading">
        <h2 id="rhythm-heading" className="text-lg font-medium">Spending Rhythm</h2>
        <p className="mt-1 text-sm text-muted-foreground">Daily expenses in this period. A flat day means no expense was recorded, not that spending was confirmed as zero.</p>
        {summary.expense === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {transactions.length === 0 ? "Welcome to Clearbook. Add your first transaction to get started." : "No expenses in this period yet."}
          </p>
        ) : charts ? (
          <div className="mt-3">
            <charts.DailySpendChart points={points} currency={currency} onSelect={() => {}} />
          </div>
        ) : (
          <div className="mt-3 h-48" />
        )}
        <Link to="/reports" className="mt-2 inline-flex text-sm font-medium text-primary underline-offset-2 hover:underline">
          Open Insights
        </Link>
      </section>
    ),
    breakdown: (
      <section className="panel p-4 lg:col-span-5" aria-labelledby="breakdown-heading">
        <h2 id="breakdown-heading" className="text-lg font-medium">Spending Breakdown</h2>
        {slices.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Your spending breakdown will appear here.</p>
        ) : (
          <>
            <div className="mt-2" aria-hidden="true">
              {charts ? <charts.SpendChart slices={slices} total={summary.expense} currency={currency} /> : <div className="h-44" />}
            </div>
            <ul>
              {slices.map((slice) => {
                const pct = summary.expense > 0 ? Math.round((slice.cents / summary.expense) * 100) : 0;
                return (
                  <li key={slice.categoryId} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t border-border py-2 text-sm">
                    <span className="size-2.5 rounded-sm" style={{ background: slice.fill }} aria-hidden="true" />
                    <span className="truncate">{slice.label}</span>
                    <span className="tabular-nums">{pct}% · {formatMoney(slice.cents, currency)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    ),
    goals: featured ? (
      <GoalCard goal={featured} saved={saved} monthSaved={summary.savings} currency={currency} />
    ) : (
      <section className="panel p-4 lg:col-span-7">
        <h2 className="text-lg font-medium">Create your first savings goal.</h2>
        <Link to="/goals" className="mt-3 inline-flex h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline">
          Create goal
        </Link>
      </section>
    ),
    notes: (
      <section className="grid gap-3 lg:col-span-5" aria-label="Monthly insights">
        <article className="panel p-4">
          <h2 className="text-sm text-muted-foreground">Month in Review</h2>
          <ReviewLine fact={review[3]} currency={currency} compareLabel={`${formatDay(compare.currentStart)} – ${formatDay(compare.currentEnd)}`} />
        </article>
        <article className="panel p-4">
          <h2 className="text-sm text-muted-foreground">Upcoming Payments</h2>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No confirmed scheduled payments in this period. Confirm a repeat from Insights if you see one.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {upcoming.slice(0, 3).map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span className="truncate">{item.label} · {formatDay(item.date)}</span>
                  <span className="tabular-nums">{formatMoney(item.amountCents, currency)}</span>
                </li>
              ))}
            </ul>
          )}
          {insight ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {insight.label} is {insight.percent}% {insight.delta >= 0 ? "higher" : "lower"} than the same dates last period.
            </p>
          ) : null}
        </article>
      </section>
    ),
    recent: (
      <section className="panel p-4 lg:col-span-12" aria-labelledby="recent-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-lg font-medium">Transactions</h2>
          <Link to="/transactions" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
            View All Transactions
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No transactions in this period. Add your first transaction.</p>
        ) : (
          <ul className="mt-2">
            {recent.map((tx) => (
              <li key={tx.id}>
                <button type="button" onClick={() => openEdit(tx)} className="press grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-muted">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{tx.merchant || tx.note || tx.categoryId}</span>
                    <span className="block text-xs text-muted-foreground">{formatDay(tx.date)}</span>
                  </span>
                  <span className={`text-sm font-medium tabular-nums ${tx.kind === "income" ? "text-positive" : tx.kind === "expense" ? "text-negative" : "text-savings"}`}>
                    {tx.kind === "income" ? "+" : tx.kind === "expense" ? "−" : ""}
                    {formatMoney(tx.amountCents, currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    ),
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-3xl font-medium tracking-tight text-foreground">Your Money Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">A clearer picture of where your money goes.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        {settings.cardOrder.map((id) => (
          <div key={id} className="contents">
            {cards[id]}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewLine({ fact, currency, compareLabel }: { fact: ReviewFact | undefined; currency: CurrencyCode; compareLabel: string }) {
  if (!fact || fact.id !== "compare") return null;
  return (
    <p className="mt-2 text-sm">
      {spendingComparisonCopy({
        previousRecords: fact.previousRecords,
        previousExpense: fact.previousExpense,
        currentExpense: fact.currentExpense,
        currency,
        windowLabel: compareLabel,
      })}
    </p>
  );
}

function GoalCard({ goal, saved, monthSaved, currency }: { goal: Goal; saved: number; monthSaved: number; currency: CurrencyCode }) {
  const ratio = goal.targetCents > 0 ? saved / goal.targetCents : 0;
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  const left = Math.max(0, goal.targetCents - saved);
  return (
    <section className="panel p-4 lg:col-span-7" aria-labelledby="goal-heading">
      <h2 id="goal-heading" className="text-sm text-muted-foreground">Savings Goals</h2>
      <p className="mt-1 text-lg font-medium">{goal.name}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">{formatMoney(saved, currency)}</span> of {formatMoney(goal.targetCents, currency)} · {pct}%
        {pct >= 100 ? " · Goal reached" : ` · ${formatMoney(left, currency)} remaining`}
      </p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${goal.name} progress`}>
        <div className="meter-fill h-full bg-savings" style={{ transform: `scaleX(${Math.max(0, Math.min(1, ratio))})` }} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Saved This Month is {formatMoney(monthSaved, currency)}. The bar is every contribution to this goal, including other months.</p>
      <Link to="/goals" className="mt-3 inline-flex h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline">
        Manage Goal
      </Link>
    </section>
  );
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value: string; tone: string; icon: typeof ArrowDownLeft }) {
  return (
    <article className="panel px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        {label}
      </p>
      <p className={`mt-1 text-lg font-medium tabular-nums ${tone}`}>{value}</p>
    </article>
  );
}

function FlowBar({
  allocation,
  summary,
  currency,
  label,
}: {
  allocation: ReturnType<typeof allocationOf>;
  summary: ReturnType<typeof summarizeRange>;
  currency: CurrencyCode;
  label: string;
}) {
  if (!allocation) {
    return <p className="mt-4 text-sm text-hero-muted">Add income in {label} before Money Flow can split it. No percentage is shown when income is zero.</p>;
  }
  if (allocation.over) {
    return (
      <p className="mt-4 text-sm text-hero-negative">
        Shortfall: expenses and savings are more than income. Remaining This Month is {formatMoney(summary.remaining, currency)}. The chart is hidden so it doesn’t show a misleading split.
      </p>
    );
  }
  const parts = [
    { key: "expenses", label: "Expenses", pct: allocation.expensePct, cents: summary.expense, color: "var(--hero-negative)", to: "/transactions" as const, search: { kind: "expense" as const } },
    { key: "saved", label: "Saved", pct: allocation.savingsPct, cents: summary.savings, color: "var(--hero-savings)", to: "/transactions" as const, search: { kind: "savings" as const } },
    { key: "left", label: "Remaining", pct: allocation.remainingPct, cents: Math.max(0, summary.remaining), color: "var(--hero-positive)", to: "/reports" as const },
  ];
  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-hero-muted">Money Flow</p>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-hero-track" role="img" aria-label={parts.map((part) => `${part.label} ${part.pct} percent`).join(", ")}>
        {parts.map((part) => (part.pct > 0 ? <div key={part.key} className="alloc-seg" style={{ width: `${part.pct}%`, background: part.color }} /> : null))}
      </div>
      <ul className="mt-2 grid gap-2 sm:grid-cols-3">
        {parts.map((part) => (
          <li key={part.key}>
            <Link to={part.to} search={"search" in part ? part.search : undefined} className="block rounded-md px-1 py-1 hover:bg-white/10">
              <span className="block text-xs text-hero-muted">{part.label}</span>
              <span className="block text-sm font-medium tabular-nums text-hero-foreground">{part.pct}% · {formatMoney(part.cents, currency)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
