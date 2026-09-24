import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORIES, categoryById, formatMoney, parseMajorAmount, AMOUNT_MESSAGE } from "@/lib/budget/model";
import { comparePeriods } from "@/lib/budget/insights";
import { useBudget } from "@/lib/budget/store";

export function CategoryBudgets() {
  const transactions = useBudget((state) => state.transactions);
  const currency = useBudget((state) => state.currency);
  const settings = useBudget((state) => state.settings);
  const viewMonth = useBudget((state) => state.viewMonth);
  const setBudget = useBudget((state) => state.setBudget);
  const removeBudget = useBudget((state) => state.removeBudget);
  const compare = useMemo(
    () => comparePeriods(transactions, viewMonth, settings.monthStartsOn),
    [transactions, viewMonth, settings.monthStartsOn],
  );
  const [budgetCategory, setBudgetCategory] = useState("groceries");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetError, setBudgetError] = useState("");
  const parsedLimit = parseMajorAmount(budgetAmount);

  return (
    <section className="panel p-4" aria-labelledby="budget-heading">
      <h3 id="budget-heading" className="text-lg font-medium">Category budgets</h3>
      <p className="mt-1 text-sm text-muted-foreground">A limit is a plan. Spending still comes only from the transactions you record.</p>
      <form
        className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const limitCents = parseMajorAmount(budgetAmount);
          if (limitCents == null) {
            setBudgetError(AMOUNT_MESSAGE);
            return;
          }
          setBudget({ categoryId: budgetCategory, limitCents });
          setBudgetAmount("");
          setBudgetError("");
        }}
      >
        <select className="field" value={budgetCategory} onChange={(event) => setBudgetCategory(event.target.value)} aria-label="Category">
          {CATEGORIES.filter((item) => item.kind === "expense").map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <input className="field" inputMode="decimal" placeholder="Limit" aria-label="Budget limit" value={budgetAmount} onChange={(event) => { setBudgetAmount(event.target.value); setBudgetError(""); }} />
        <Button type="submit">Save budget</Button>
        {budgetAmount.trim() !== "" && parsedLimit == null ? (
          <p role="alert" className="text-sm text-negative sm:col-span-3">{AMOUNT_MESSAGE}</p>
        ) : budgetError ? (
          <p role="alert" className="text-sm text-negative sm:col-span-3">{budgetError}</p>
        ) : null}
      </form>
      <ul className="mt-3 space-y-3">
        {settings.budgets.length === 0 ? <li className="text-sm text-muted-foreground">No category budgets yet.</li> : null}
        {settings.budgets.map((budget) => {
          const spent = compare.current.spentByCategory.find((slice) => slice.categoryId === budget.categoryId)?.cents ?? 0;
          const ratio = budget.limitCents > 0 ? spent / budget.limitCents : 0;
          return (
            <li key={budget.categoryId}>
              <div className="flex justify-between text-sm">
                <span>{categoryById(budget.categoryId)?.label}</span>
                <span className="tabular-nums">{formatMoney(spent, currency)} / {formatMoney(budget.limitCents, currency)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.min(100, Math.round(ratio * 100))} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-expense" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
              </div>
              <button type="button" className="mt-1 text-xs text-muted-foreground underline" onClick={() => removeBudget(budget.categoryId)}>Remove</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
