import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  categoriesFor,
  centsToInput,
  formatMoney,
  parseMajorAmount,
  AMOUNT_MESSAGE,
  type CurrencyCode,
  type Goal,
  type Kind,
  type Transaction,
} from "@/lib/budget/model";

const KINDS: { id: Kind; label: string }[] = [
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "savings", label: "Savings" },
];

export type Draft = {
  kind: Kind;
  amount: string;
  categoryId: string;
  note: string;
  merchant: string;
  date: string;
  goalId: string;
};

export function draftFromTransaction(tx: Transaction): Draft {
  return {
    kind: tx.kind,
    amount: centsToInput(tx.amountCents),
    categoryId: tx.categoryId,
    note: tx.note,
    merchant: tx.merchant ?? "",
    date: tx.date,
    goalId: tx.goalId ?? "",
  };
}

type EntryDialogProps = {
  title: string;
  initial: Draft;
  currency: CurrencyCode;
  goals: Goal[];
  onClose: () => void;
  onSubmit: (value: Omit<Transaction, "id">) => void;
  onDelete?: () => void;
};

export function EntryDialog({
  title,
  initial,
  currency,
  goals,
  onClose,
  onSubmit,
  onDelete,
}: EntryDialogProps) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const parsed = parseMajorAmount(draft.amount);
  const categories = categoriesFor(draft.kind);

  function setKind(kind: Kind) {
    const nextCategories = categoriesFor(kind);
    setDraft((current) => ({
      ...current,
      kind,
      categoryId: nextCategories.some((category) => category.id === current.categoryId)
        ? current.categoryId
        : nextCategories[0].id,
    }));
    setError("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const amountCents = parseMajorAmount(draft.amount);
    if (amountCents == null) {
      setError(AMOUNT_MESSAGE);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
      setError("Choose a date.");
      return;
    }
    const categoryId =
      draft.kind === "savings"
        ? "savings"
        : categories.some((category) => category.id === draft.categoryId)
          ? draft.categoryId
          : categories[0]?.id;
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    onSubmit({
      kind: draft.kind,
      amountCents,
      categoryId,
      note: draft.note.trim().slice(0, 80),
      merchant: draft.merchant.trim().slice(0, 60) || undefined,
      date: draft.date,
      goalId: draft.kind === "savings" ? draft.goalId || goals[0]?.id : undefined,
    });
  }

  return (
    <Modal
      title={title}
      placement="sheet"
      description="Income increases Remaining This Month. Expenses and savings reduce it. This is not a bank balance."
      onClose={onClose}
    >
      <form className="mt-5 grid gap-4" onSubmit={submit}>
        <div role="radiogroup" aria-label="Transaction type" className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
          {KINDS.map((kind) => {
            const selected = draft.kind === kind.id;
            return (
              <button
                key={kind.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setKind(kind.id)}
                className={
                  selected
                    ? "press h-11 rounded-sm bg-card text-sm font-medium text-foreground shadow-card"
                    : "press h-11 rounded-sm text-sm text-muted-foreground hover:text-foreground"
                }
              >
                {kind.label}
              </button>
            );
          })}
        </div>

        <label className="grid gap-1.5 text-sm font-medium">
          <span className="flex items-baseline justify-between gap-3">
            Amount
            {parsed != null ? (
              <span className="font-normal text-muted-foreground tabular-nums">
                {formatMoney(parsed, currency)}
              </span>
            ) : null}
          </span>
          <input
            className="field w-full"
            inputMode="decimal"
            autoFocus
            autoComplete="off"
            placeholder="0"
            value={draft.amount}
            onChange={(event) => {
              setDraft((current) => ({ ...current, amount: event.target.value }));
              setError("");
            }}
          />
        </label>

        {draft.kind !== "savings" ? (
          <label className="grid gap-1.5 text-sm font-medium">
            Category
            <select
              className="field w-full"
              value={draft.categoryId}
              onChange={(event) =>
                setDraft((current) => ({ ...current, categoryId: event.target.value }))
              }
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        ) : goals.length > 0 ? (
          <label className="grid gap-1.5 text-sm font-medium">
            Assign to goal
            <select
              className="field w-full"
              value={draft.goalId || goals[0]?.id}
              onChange={(event) => setDraft((current) => ({ ...current, goalId: event.target.value }))}
            >
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="grid gap-1.5 text-sm font-medium">
          Merchant
          <input
            className="field w-full"
            maxLength={60}
            placeholder="Optional"
            value={draft.merchant}
            onChange={(event) => setDraft((current) => ({ ...current, merchant: event.target.value }))}
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Date
          <input
            className="field w-full"
            type="date"
            value={draft.date}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
            required
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Note
          <input
            className="field w-full"
            maxLength={80}
            placeholder="Optional"
            value={draft.note}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
          />
        </label>

        {draft.amount.trim() !== "" && parsed == null ? (
          <p role="alert" className="text-sm text-negative">{AMOUNT_MESSAGE}</p>
        ) : error ? (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        ) : null}

        {confirmDelete && onDelete ? (
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm">Delete this transaction? You can undo it from the notice that follows.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
              <Button variant="danger" onClick={onDelete}>
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 pt-1">
            {onDelete ? (
              <Button variant="ghost" className="text-negative" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit">Save transaction</Button>
          </div>
        )}
      </form>
    </Modal>
  );
}
