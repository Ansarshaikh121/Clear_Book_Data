import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CategoryBudgets } from "@/components/budget/category-budgets";
import { TransactionCalendar } from "@/components/budget/transaction-calendar";
import {
  categoryColor,
  formatDay,
  formatMoney,
  parseMajorAmount,
  periodBounds,
  spendingComparisonCopy,
  type CurrencyCode,
} from "@/lib/budget/model";
import {
  categoryDeltas,
  comparePeriods,
  groupSmallSlices,
  monthInReview,
  suggestRecurring,
  upcomingInPeriod,
  unusualNote,
} from "@/lib/budget/insights";
import { useBudget } from "@/lib/budget/store";

export function InsightsPage() {
  const transactions = useBudget((state) => state.transactions);
  const currency = useBudget((state) => state.currency);
  const settings = useBudget((state) => state.settings);
  const viewMonth = useBudget((state) => state.viewMonth);
  const confirmRecurring = useBudget((state) => state.confirmRecurring);
  const addTransaction = useBudget((state) => state.addTransaction);
  const navigate = useNavigate();
  const bounds = periodBounds(viewMonth, settings.monthStartsOn);
  const compare = useMemo(() => comparePeriods(transactions, viewMonth, settings.monthStartsOn), [transactions, viewMonth, settings.monthStartsOn]);
  const deltas = categoryDeltas(compare);
  const review = monthInReview(compare, compare.current.savings);
  const suggestions = suggestRecurring(transactions, settings.recurring.map((item) => item.id));
  const upcoming = upcomingInPeriod(settings.recurring, transactions, bounds.start, bounds.end);
  const unusual = unusualNote(deltas);
  const grouped = groupSmallSlices(compare.current.spentByCategory);
  const [showOther, setShowOther] = useState(false);
  const [purchase, setPurchase] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(bounds.start);

  const parsedPurchase = parseMajorAmount(purchase);
  const upcomingTotal = upcoming.reduce((sum, item) => sum + item.amountCents, 0);
  const before = compare.current.remaining;
  const after = parsedPurchase == null ? null : before - upcomingTotal - parsedPurchase;


  return (
    <div className="grid gap-4">
      <header>
        <h2 className="font-display text-3xl font-medium tracking-tight">Insights</h2>
        <p className="mt-1 text-sm text-muted-foreground">Recorded activity only. Nothing here is a forecast unless it says estimate.</p>
      </header>

      <section className="panel p-4" aria-labelledby="flow-heading">
        <h3 id="flow-heading" className="text-lg font-medium">Money Flow</h3>
        <p className="mt-1 text-sm text-muted-foreground">Income splits into expenses, saved, and what remains.</p>
        {compare.current.income <= 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Income is zero, so there is no split to draw.</p>
        ) : compare.current.remaining < 0 ? (
          <p className="mt-3 text-sm text-negative">Shortfall of {formatMoney(Math.abs(compare.current.remaining), currency)}. Expenses and savings exceed income, so percentages are not shown.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="rounded-md bg-positive/10 p-4">
              <p className="text-xs text-muted-foreground">Income</p>
              <p className="text-xl font-medium tabular-nums text-positive">{formatMoney(compare.current.income, currency)}</p>
            </div>
            <p className="text-center text-muted-foreground" aria-hidden="true">→</p>
            <ul className="grid gap-2">
              <FlowLink label="Expenses" cents={compare.current.expense} currency={currency} onClick={() => navigate({ to: "/transactions", search: { kind: "expense" } })} />
              <FlowLink label="Saved" cents={compare.current.savings} currency={currency} onClick={() => navigate({ to: "/transactions", search: { kind: "savings" } })} />
              <li className="flex justify-between rounded-md bg-muted px-3 py-2 text-sm">
                <span>Remaining</span>
                <span className="tabular-nums">{formatMoney(compare.current.remaining, currency)}</span>
              </li>
            </ul>
          </div>
        )}
      </section>

      <TransactionCalendar transactions={transactions} currency={currency} viewMonth={viewMonth} />

      <section className="panel p-4" aria-labelledby="compare-heading">
        <h3 id="compare-heading" className="text-lg font-medium">Monthly Comparison</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDay(compare.currentStart)} – {formatDay(compare.currentEnd)} versus {formatDay(compare.previousStart)} – {formatDay(compare.previousEnd)}
          {compare.partial ? ". This month is still open, so both sides use the same number of days." : "."}
        </p>
        {compare.previousRecords === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Not enough data to compare</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {deltas.map((row) => {
              const max = Math.max(row.current, row.previous, 1);
              const showChange = row.previous > 0;
              return (
                <li key={row.categoryId}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{row.label}</span>
                    {showChange ? (
                      <span className="tabular-nums text-muted-foreground">
                        {row.delta > 0 ? "+" : row.delta < 0 ? "−" : ""}
                        {formatMoney(Math.abs(row.delta), currency)}{" "}
                        {row.percent == null ? "" : `(${row.percent >= 0 ? "+" : ""}${row.percent}%)`}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Confirmed zero earlier</span>
                    )}
                  </div>
                  <div className="mt-1 grid gap-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-expense" style={{ width: `${(row.current / max) * 100}%` }} /></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary/40" style={{ width: `${(row.previous / max) * 100}%` }} /></div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Now {formatMoney(row.current, currency)} · Then {formatMoney(row.previous, currency)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel p-4" aria-labelledby="review-heading">
        <h3 id="review-heading" className="text-lg font-medium">Month in Review</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {review.map((fact) => (
            <article key={fact.id} className="rounded-md bg-muted p-3 text-sm">
              <ReviewCopy fact={fact} currency={currency} />
            </article>
          ))}
        </div>
        {compare.previousRecords === 0 ? null : unusual ? <p className="mt-3 text-sm">{unusual}</p> : <p className="mt-3 text-sm text-muted-foreground">No category stands out against the previous period yet.</p>}
      </section>

      <CategoryBudgets />

      <section className="panel p-4" aria-labelledby="repeat-heading">
        <h3 id="repeat-heading" className="text-lg font-medium">Possible recurring payments</h3>
        <p className="mt-1 text-sm text-muted-foreground">These repeat in your records. Confirming one schedules it. It is not added as a transaction.</p>
        {suggestions.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Not enough repeated history yet. A suggestion needs the same expense in at least two months.</p> : null}
        <ul className="mt-3 space-y-2">
          {suggestions.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <span>{item.label} · {formatMoney(item.amountCents, currency)} · seen {item.count} times</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  confirmRecurring({
                    id: item.id,
                    label: item.label,
                    categoryId: item.categoryId,
                    amountCents: item.amountCents,
                    dayOfMonth: item.dayOfMonth,
                  })
                }
              >
                Confirm schedule
              </Button>
            </li>
          ))}
        </ul>
        {grouped.hidden.length > 0 ? (
          <button type="button" className="mt-3 text-sm underline" onClick={() => setShowOther((value) => !value)}>
            {showOther ? "Hide smaller categories" : `Show ${grouped.hidden.length} smaller categories grouped as Other`}
          </button>
        ) : null}
        {showOther ? (
          <ul className="mt-2 text-sm">
            {grouped.hidden.map((slice) => (
              <li key={slice.categoryId} className="flex justify-between gap-3 py-1">
                <span className="flex items-center gap-2"><span className="size-2 rounded-sm" style={{ background: categoryColor(slice.categoryId) }} />{slice.label}</span>
                <span className="tabular-nums">{formatMoney(slice.cents, currency)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="panel p-4" aria-labelledby="plan-heading">
        <h3 id="plan-heading" className="text-lg font-medium">Plan a Purchase</h3>
        <p className="mt-1 text-sm text-muted-foreground">Estimate only. This does not check a bank account and does not save anything until you add the transaction.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Amount
            <input className="field" inputMode="decimal" value={purchase} onChange={(event) => setPurchase(event.target.value)} placeholder="0" />
          </label>
          <label className="grid gap-1 text-sm">
            Date
            <input className="field" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Assumes the purchase is an expense on that date, and subtracts confirmed upcoming payments that are not already recorded ({formatMoney(upcomingTotal, currency)}).</p>
        {parsedPurchase != null && after != null ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Before</p>
              <p className="text-lg font-medium tabular-nums">{formatMoney(before, currency)}</p>
              <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: "100%" }} /></div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">After, estimated</p>
              <p className={`text-lg font-medium tabular-nums ${after < 0 ? "text-negative" : ""}`}>{formatMoney(after, currency)}</p>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-expense" style={{ width: `${Math.max(8, Math.min(100, before <= 0 ? 100 : (after / before) * 100))}%` }} />
              </div>
            </div>
          </div>
        ) : purchase.trim() !== "" && parsedPurchase == null ? (
          <p className="mt-3 text-sm text-negative" role="alert">Enter an amount greater than zero.</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Enter an amount to preview the change.</p>
        )}
        <Button
          className="mt-4"
          disabled={parsedPurchase == null || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)}
          onClick={() => {
            if (parsedPurchase == null) return;
            addTransaction({
              id: crypto.randomUUID(),
              kind: "expense",
              amountCents: parsedPurchase,
              categoryId: "shopping",
              note: "Planned purchase",
              date: purchaseDate,
            });
            setPurchase("");
          }}
        >
          Add this transaction
        </Button>
      </section>
    </div>
  );
}

function FlowLink({ label, cents, currency, onClick }: { label: string; cents: number; currency: CurrencyCode; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full justify-between rounded-md bg-muted px-3 py-2 text-left text-sm hover:bg-secondary">
        <span>{label}</span>
        <span className="tabular-nums">{formatMoney(cents, currency)}</span>
      </button>
    </li>
  );
}

function ReviewCopy({ fact, currency }: { fact: ReturnType<typeof monthInReview>[number]; currency: CurrencyCode }) {
  if (fact.id === "totals") {
    if (fact.income === 0 && fact.expense === 0) return <p>No income or expenses are recorded in this period yet.</p>;
    return <p>Income {formatMoney(fact.income, currency)}. Expenses {formatMoney(fact.expense, currency)}. Remaining This Month {formatMoney(fact.remaining, currency)}.</p>;
  }
  if (fact.id === "top") {
    if (!fact.label) return <p>No expenses are recorded, so there is no largest category.</p>;
    return <p>{fact.label} is the largest expense category at {formatMoney(fact.cents, currency)}, {fact.pct}% of expenses.</p>;
  }
  if (fact.id === "savings") {
    return <p>{fact.cents > 0 ? `${formatMoney(fact.cents, currency)} was saved this period.` : "No savings were recorded this period."} This is separate from each goal’s all-time total.</p>;
  }
  if (!fact.enough && !fact.confirmedZero) return <p>Not enough data to compare</p>;
  return (
    <p>
      {spendingComparisonCopy({
        previousRecords: fact.previousRecords,
        previousExpense: fact.previousExpense,
        currentExpense: fact.currentExpense,
        currency,
      })}
    </p>
  );
}

