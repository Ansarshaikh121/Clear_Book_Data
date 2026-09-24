import { useState } from "react";
import { Gift, Home, Plane, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalDialog } from "@/components/budget/goal-dialog";
import { centsToInput, formatMoney, parseMajorAmount, AMOUNT_MESSAGE, periodBounds, totalSavings, type Goal, type GoalIcon } from "@/lib/budget/model";
import { useBudget } from "@/lib/budget/store";

const ICONS: Record<GoalIcon, typeof Shield> = { shield: Shield, home: Home, plane: Plane, gift: Gift };

export function GoalsPage() {
  const goals = useBudget((state) => state.goals);
  const transactions = useBudget((state) => state.transactions);
  const currency = useBudget((state) => state.currency);
  const viewMonth = useBudget((state) => state.viewMonth);
  const startsOn = useBudget((state) => state.settings.monthStartsOn);
  const addGoal = useBudget((state) => state.addGoal);
  const updateGoal = useBudget((state) => state.updateGoal);
  const deleteGoal = useBudget((state) => state.deleteGoal);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [icon, setIcon] = useState<GoalIcon>("shield");
  const [error, setError] = useState("");
  const bounds = periodBounds(viewMonth, startsOn);

  return (
    <section aria-labelledby="goals-heading">
      <h2 id="goals-heading" className="font-display text-3xl font-medium tracking-tight">Savings Goals</h2>
      <p className="mt-1 text-sm text-muted-foreground">Each contribution is counted once, on the goal you assign it to.</p>
      {goals.length === 0 ? (
        <div className="panel mt-4 px-4 py-8 text-center">
          <p className="text-sm font-medium">Create your first savings goal.</p>
          <p className="mt-1 text-sm text-muted-foreground">Nothing is saved yet. This goal starts at zero.</p>
        </div>
      ) : null}
      <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {goals.map((goal) => {
          const saved = totalSavings(transactions, goal.id);
          const monthSaved = transactions
            .filter((tx) => tx.kind === "savings" && (tx.goalId ?? goals[0]?.id) === goal.id && tx.date >= bounds.start && tx.date <= bounds.end)
            .reduce((sum, tx) => sum + tx.amountCents, 0);
          const ratio = goal.targetCents > 0 ? saved / goal.targetCents : 0;
          const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
          const left = Math.max(0, goal.targetCents - saved);
          const estimate = monthSaved > 0 && left > 0 ? Math.ceil(left / monthSaved) : null;
          const Icon = ICONS[goal.icon] ?? Shield;
          return (
            <li key={goal.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-md bg-savings/15 text-savings">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="text-lg font-medium">{goal.name}</h3>
                    <p className="text-sm text-muted-foreground">{pct}% · {formatMoney(left, currency)} still to save</p>
                  </div>
                </div>
                {pct >= 100 ? <p className="text-sm text-positive">Goal reached</p> : null}
              </div>
              <p className="mt-3 text-2xl font-medium tabular-nums">{formatMoney(saved, currency)}</p>
              <p className="text-sm text-muted-foreground">of {formatMoney(goal.targetCents, currency)}</p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${goal.name} ${pct} percent`}>
                <div className="meter-fill h-full bg-savings" style={{ transform: `scaleX(${Math.max(0, Math.min(1, ratio))})` }} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Saved This Month toward this goal: {formatMoney(monthSaved, currency)}. The total above includes every month.
                {estimate == null ? " A completion estimate needs a savings contribution in this period." : ` At this period’s pace, about ${estimate} period${estimate === 1 ? "" : "s"} remain. That is only an estimate.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setEditing(goal)}>Manage Goal</Button>
                {goals.length > 1 ? (
                  <Button variant="ghost" className="text-negative" onClick={() => deleteGoal(goal.id)}>
                    Remove goal
                  </Button>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Add a contribution with Add Transaction, choose Savings, and assign this goal.</p>
            </li>
          );
        })}
      </ul>
      <form
        className="panel mt-4 grid gap-3 p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const targetCents = parseMajorAmount(target);
          if (!name.trim()) {
            setError("Name the goal.");
            return;
          }
          if (targetCents == null) {
            setError(AMOUNT_MESSAGE);
            return;
          }
          addGoal({ id: crypto.randomUUID(), name: name.trim().slice(0, 40), targetCents, icon });
          setName("");
          setTarget("");
          setError("");
        }}
      >
        <h3 className="text-lg font-medium sm:col-span-2">New goal</h3>
        <label className="grid gap-1 text-sm">
          Name
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Target
          <input className="field" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} placeholder={centsToInput(10000000)} />
        </label>
        <label className="grid gap-1 text-sm">
          Icon
          <select className="field" value={icon} onChange={(event) => setIcon(event.target.value as GoalIcon)}>
            <option value="shield">Shield</option>
            <option value="home">Home</option>
            <option value="plane">Travel</option>
            <option value="gift">Gift</option>
          </select>
        </label>
        {target.trim() !== "" && parseMajorAmount(target) == null ? (
          <p role="alert" className="text-sm text-negative sm:col-span-2">{AMOUNT_MESSAGE}</p>
        ) : error ? <p role="alert" className="text-sm text-negative sm:col-span-2">{error}</p> : null}
        <Button type="submit">Save goal</Button>
      </form>
      {editing ? (
        <GoalDialog
          goal={editing}
          currency={currency}
          onClose={() => setEditing(null)}
          onSave={(goal) => {
            updateGoal(goal);
            setEditing(null);
          }}
        />
      ) : null}
    </section>
  );
}
