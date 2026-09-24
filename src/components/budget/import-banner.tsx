import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney, type CurrencyCode, type Goal, type Transaction } from "@/lib/budget/model";
import { importOwnedLedger } from "@/lib/budget/ledger";
import { ledgerRequestSignal, useBudget } from "@/lib/budget/store";

const STORAGE_KEY = "clearbook-v1";

type Orphan = { transactions: Transaction[]; goals: Goal[] };

function readOrphan(): Orphan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { transactions?: unknown; goals?: unknown } };
    const state = parsed.state ?? {};
    const transactions = Array.isArray(state.transactions) ? (state.transactions as Transaction[]) : [];
    const goals = Array.isArray(state.goals) ? (state.goals as Goal[]) : [];
    if (transactions.length === 0 && goals.length === 0) return null;
    return { transactions, goals };
  } catch {
    return null;
  }
}

export function ImportBanner({ userId, currency }: { userId: string; currency: CurrencyCode }) {
  const applyRemote = useBudget((state) => state.applyRemote);
  const epoch = useBudget((state) => state.epoch);
  const [orphan, setOrphan] = useState<Orphan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (localStorage.getItem(`clearbook-import-dismissed:${userId}`) === "1") return;
    setOrphan(readOrphan());
  }, [userId]);

  if (!orphan) return null;
  const preview = orphan.transactions.slice(0, 3);

  return (
    <section className="mb-4 rounded-card border border-border bg-card p-4" aria-labelledby="import-heading">
      <h2 id="import-heading" className="text-lg font-medium">Older records still in this browser</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        These were saved in this browser before accounts. They are not part of your account until you confirm they are yours. A new account does not receive them automatically.
      </p>
      <ul className="mt-3 text-sm">
        {preview.map((tx) => (
          <li key={tx.id} className="flex justify-between gap-3 py-1">
            <span className="truncate">{tx.merchant || tx.note || tx.categoryId}</span>
            <span className="tabular-nums">{formatMoney(tx.amountCents, currency)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted-foreground">
        {orphan.transactions.length} transaction{orphan.transactions.length === 1 ? "" : "s"}, {orphan.goals.length} savings goal{orphan.goals.length === 1 ? "" : "s"}.
      </p>
      {error ? <p className="mt-2 text-sm text-negative">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            void importOwnedLedger({
              data: { confirm: true, transactions: orphan.transactions, goals: orphan.goals },
              signal: ledgerRequestSignal(),
            })
              .then((snapshot) => {
                applyRemote(epoch, snapshot);
                localStorage.removeItem(STORAGE_KEY);
                setOrphan(null);
              })
              .catch(() => setError("Could not import those records into this account."));
          }}
        >
          Import into my account
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            localStorage.setItem(`clearbook-import-dismissed:${userId}`, "1");
            setOrphan(null);
          }}
        >
          Leave them in this browser
        </Button>
      </div>
    </section>
  );
}
