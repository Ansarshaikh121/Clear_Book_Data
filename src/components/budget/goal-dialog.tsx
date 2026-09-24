import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  centsToInput,
  formatMoney,
  parseMajorAmount,
  AMOUNT_MESSAGE,
  type CurrencyCode,
  type Goal,
} from "@/lib/budget/model";

type GoalDialogProps = {
  goal: Goal;
  currency: CurrencyCode;
  onClose: () => void;
  onSave: (goal: Goal) => void;
};

export function GoalDialog({ goal, currency, onClose, onSave }: GoalDialogProps) {
  const [name, setName] = useState(goal.name);
  const [amount, setAmount] = useState(centsToInput(goal.targetCents));
  const [error, setError] = useState("");
  const parsed = parseMajorAmount(amount);

  function submit(event: FormEvent) {
    event.preventDefault();
    const targetCents = parseMajorAmount(amount);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name the goal.");
      return;
    }
    if (targetCents == null) {
      setError(AMOUNT_MESSAGE);
      return;
    }
    onSave({ ...goal, name: trimmed.slice(0, 40), targetCents });
  }

  return (
    <Modal
      title="Savings goal"
      description="Progress is the total of every set-aside entry, across all months."
      onClose={onClose}
    >
      <form className="mt-5 grid gap-4" onSubmit={submit}>
        <label className="grid gap-1.5 text-sm font-medium">
          Name
          <input
            className="field w-full"
            maxLength={40}
            value={name}
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          <span className="flex items-baseline justify-between gap-3">
            Target
            {parsed != null ? (
              <span className="font-normal text-muted-foreground tabular-nums">
                {formatMoney(parsed, currency)}
              </span>
            ) : null}
          </span>
          <input
            className="field w-full"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError("");
            }}
          />
        </label>
        {amount.trim() !== "" && parsed == null ? (
          <p role="alert" className="text-sm text-negative">{AMOUNT_MESSAGE}</p>
        ) : error ? (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end pt-1">
          <Button type="submit">Save goal</Button>
        </div>
      </form>
    </Modal>
  );
}
