import { CategoryBudgets } from "@/components/budget/category-budgets";

export function BudgetsPage() {
  return (
    <div className="grid gap-4">
      <header>
        <h2 className="font-display text-3xl font-medium tracking-tight">Budgets</h2>
        <p className="mt-1 text-sm text-muted-foreground">Set a limit for each expense category. Nothing here is estimated from other people’s spending.</p>
      </header>
      <CategoryBudgets />
    </div>
  );
}
