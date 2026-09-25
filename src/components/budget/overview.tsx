import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react";
import { useEditor } from "@/components/budget/frame";
import type { ChartSlice } from "@/components/budget/spend-chart";
import {
  allocationOf,
  categoryById,
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
        .slice(0, 10),
    [transactions, bounds.start, bounds.end],
  );
  const sliceColors = ["#F43F5E", "#FB7185", "#FDA4AF", "#E11D48", "#BE123C", "#9F1239"];
  const slices: ChartSlice[] = summary.spentByCategory.slice(0, 6).map((slice, index) => ({
    ...slice,
    fill: sliceColors[index],
  }));
  const trends = useMemo(() => dailyTrends(transactions, bounds.start, bounds.end), [transactions, bounds.start, bounds.end]);
  const featured = goals[0];
  const saved = featured ? totalSavings(transactions, featured.id) : 0;
  const label = periodLabel(viewMonth, settings.monthStartsOn);
  const deltas = categoryDeltas(compare);
  const insight = deltas.find((row) => row.percent != null && row.previous > 0);

  const cards: Record<OverviewCardId, ReactNode> = {
    snapshot: (
      <Stat label="Remaining" valueCents={summary.remaining} comparableCents={compare.current.remaining}
        previousCents={compare.previous.remaining} previousRecords={compare.previousRecords}
        currency={currency} tone={summary.remaining < 0 ? "text-negative" : "text-positive"} icon={Landmark} series={trends.remaining}
        className="dashboard-remaining lg:col-span-3" />
    ),
    stats: (
      <section className="dashboard-stat-grid grid gap-3 sm:grid-cols-3 lg:col-span-9" aria-label="Income, expenses, and savings">
        <Stat label="Income" valueCents={summary.income} comparableCents={compare.current.income} previousCents={compare.previous.income}
          previousRecords={compare.previousRecords} currency={currency} tone="text-positive" icon={ArrowDownLeft} series={trends.income} />
        <Stat label="Expenses" valueCents={summary.expense} comparableCents={compare.current.expense} previousCents={compare.previous.expense}
          previousRecords={compare.previousRecords} currency={currency} tone="text-negative" icon={ArrowUpRight} series={trends.expense} />
        <Stat label="Savings" valueCents={summary.savings} comparableCents={compare.current.savings} previousCents={compare.previous.savings}
          previousRecords={compare.previousRecords} currency={currency} tone="text-savings" icon={Landmark} series={trends.savings} />
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
        <FlowBar allocation={allocation} summary={summary} currency={currency} label={label} />
        <Link to="/reports" className="mt-2 inline-flex text-sm font-medium text-primary underline-offset-2 hover:underline">
          Open Insights
        </Link>
      </section>
    ),
    breakdown: (
      <div className="dashboard-charts lg:col-span-12">
        <section className="panel p-4" aria-labelledby="breakdown-heading">
          <h2 id="breakdown-heading" className="text-lg font-medium">Expenses by category</h2>
          {slices.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Your spending breakdown will appear here.</p>
          ) : (
            <div className="dashboard-donut-content">
              <div aria-hidden="true">{charts ? <charts.SpendChart slices={slices} total={summary.expense} currency={currency} /> : <div className="h-44" />}</div>
              <ul>
                {slices.map((slice, index) => (
                  <li key={slice.categoryId} className="dashboard-legend-row">
                    <span className={`dashboard-legend-dot dashboard-legend-dot-${index + 1}`} aria-hidden="true" />
                    <span className="truncate">{slice.label}</span>
                    <span className="tabular-nums">{Math.round((slice.cents / summary.expense) * 100)}% · {formatMoney(slice.cents, currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        <section className="panel p-4" aria-labelledby="budget-progress-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="budget-progress-heading" className="text-lg font-medium">Budgets</h2>
            <Link to="/budgets" className="text-sm font-medium text-primary">Manage</Link>
          </div>
          {settings.budgets.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Set a category budget to see progress here.</p>
          ) : (
            <ul className="mt-4 space-y-5">
              {settings.budgets.slice(0, 5).map((budget) => {
                const spent = summary.spentByCategory.find((part) => part.categoryId === budget.categoryId)?.cents ?? 0;
                const pct = budget.limitCents > 0 ? Math.min(100, Math.round(spent / budget.limitCents * 100)) : 0;
                return <li key={budget.categoryId}>
                  <div className="flex justify-between gap-2 text-sm"><span>{categoryById(budget.categoryId)?.label ?? "Category"}</span>
                    <span className="tabular-nums text-muted-foreground">{formatMoney(spent, currency)} / {formatMoney(budget.limitCents, currency)}</span></div>
                  <BudgetProgress pct={pct} label={`${categoryById(budget.categoryId)?.label ?? "Category"} budget`} />
                </li>;
              })}
            </ul>
          )}
        </section>
      </div>
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
          <>
            <div className="dashboard-table-wrap hidden sm:block">
              <table className="dashboard-recent-table w-full text-left text-sm">
                <thead><tr><th scope="col">Date</th><th scope="col">Transaction</th><th scope="col">Category</th><th scope="col" className="text-right">Amount</th></tr></thead>
                <tbody>{recent.map((tx) => (
                  <tr key={tx.id}>
                    <td className="whitespace-nowrap text-muted-foreground">{formatDay(tx.date)}</td>
                    <td className="max-w-48 truncate"><button type="button" onClick={() => openEdit(tx)} className="text-left font-medium hover:underline focus-visible:underline">{tx.merchant || tx.note || tx.categoryId}</button></td>
                    <td className="text-muted-foreground">{categoryById(tx.categoryId)?.label ?? tx.categoryId}</td>
                    <td className={`text-right font-medium tabular-nums ${tx.kind === "income" ? "text-positive" : tx.kind === "expense" ? "text-negative" : "text-savings"}`}>
                      {tx.kind === "income" ? "+" : tx.kind === "expense" ? "−" : ""}{formatMoney(tx.amountCents, currency)}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <ul className="dashboard-recent-mobile sm:hidden">
              {recent.map((tx) => (
                <li key={tx.id}><button type="button" onClick={() => openEdit(tx)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 py-3 text-left">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{tx.merchant || tx.note || tx.categoryId}</span>
                    <span className="text-xs text-muted-foreground">{formatDay(tx.date)} · {categoryById(tx.categoryId)?.label ?? tx.categoryId}</span></span>
                  <span className={`font-medium tabular-nums ${tx.kind === "income" ? "text-positive" : tx.kind === "expense" ? "text-negative" : "text-savings"}`}>
                    {tx.kind === "income" ? "+" : tx.kind === "expense" ? "−" : ""}{formatMoney(tx.amountCents, currency)}
                  </span>
                </button></li>
              ))}
            </ul>
          </>
        )}
      </section>
    ),
  };

  return (
    <div className="dashboard-redesign">
      <div className="mb-4">
        <h2 className="font-display text-3xl font-medium tracking-tight text-foreground">Your month at a glance</h2>
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

function dailyTrends(transactions: Transaction[], start: string, end: string) {
  const series = { income: Array(7).fill(0) as number[], expense: Array(7).fill(0) as number[], savings: Array(7).fill(0) as number[], remaining: Array(7).fill(0) as number[] };
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const days = Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - startMs) / 86400000) + 1);
  for (const tx of transactions) {
    if (tx.date < start || tx.date > end) continue;
    const day = Math.round((Date.parse(`${tx.date}T00:00:00Z`) - startMs) / 86400000);
    const index = Math.min(6, Math.floor(day / days * 7));
    series[tx.kind][index] += tx.amountCents;
  }
  let running = 0;
  for (let index = 0; index < 7; index++) {
    running += series.income[index] - series.expense[index] - series.savings[index];
    series.remaining[index] = running;
  }
  return series;
}

function useIntroCount(cents: number) {
  const [shown, setShown] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      started.current = true;
      setShown(cents);
      return;
    }
    started.current = true;
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - began) / 400);
      setShown(Math.round(cents * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cents]);
  return shown;
}

function BudgetProgress({ pct, label }: { pct: number; label: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(pct); return; }
    const frame = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(frame);
  }, [pct]);
  return <progress className="dashboard-budget-progress mt-2" value={shown} max={100} aria-label={label}>{pct}%</progress>;
}

function Stat({
  label, valueCents, comparableCents, previousCents, previousRecords, currency, tone, icon: Icon, series, className = "",
}: {
  label: string; valueCents: number; comparableCents: number; previousCents: number; previousRecords: number;
  currency: CurrencyCode; tone: string; icon: typeof ArrowDownLeft; series: number[]; className?: string;
}) {
  const value = useIntroCount(valueCents);
  const delta = previousCents ? Math.round((comparableCents - previousCents) / Math.abs(previousCents) * 100) : null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const points = series.map((num, index) => `${index * 14},${max === min ? 12 : Math.round(22 - (num - min) / (max - min) * 20)}`).join(" ");
  return (
    <article className={`panel dashboard-stat px-4 py-3 ${className}`}>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />{label}
      </p>
      <p className={`mt-3 dashboard-stat-value font-semibold tabular-nums ${tone}`}>{formatMoney(value, currency)}</p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-xs text-muted-foreground">{previousRecords === 0 ? "No prior period data" : delta === null ? "New vs last month" : `${delta >= 0 ? "+" : ""}${delta}% vs last month`}</span>
        <svg className={`dashboard-sparkline ${tone}`} viewBox="0 0 84 24" role="img" aria-label={`${label} trend across this month`}>
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
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
