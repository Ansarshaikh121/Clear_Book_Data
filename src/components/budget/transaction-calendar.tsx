import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { categoryById, currentMonthKey, formatDay, formatMoney, monthLabel, shiftMonth, type CurrencyCode, type Transaction } from "@/lib/budget/model";
import { loadLedger, resetLedgerData } from "@/lib/budget/ledger";
import { calendarDays } from "@/lib/budget/calendar-data";
import { ledgerRequestSignal, useBudget } from "@/lib/budget/store";

export function TransactionCalendar({ transactions, currency, viewMonth }: {
  transactions: Transaction[]; currency: CurrencyCode; viewMonth: string;
}) {
  const [month, setMonth] = useState(viewMonth);
  const [direction, setDirection] = useState<"next" | "previous">("next");
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetText, setResetText] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [error, setError] = useState("");
  const cells = useMemo(() => calendarDays(month, transactions), [month, transactions]);
  const selectedRows = useMemo(() => transactions.filter((tx) => tx.date === selected)
    .sort((a, b) => a.id.localeCompare(b.id)), [transactions, selected]);
  const total = selectedRows.reduce((sum, tx) => sum + tx.amountCents, 0);
  const net = selectedRows.reduce((sum, tx) => sum + (tx.kind === "income" ? tx.amountCents : -tx.amountCents), 0);
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  useEffect(() => { setMonth(viewMonth); }, [viewMonth]);

  function changeMonth(delta: number) {
    setDirection(delta > 0 ? "next" : "previous");
    setMonth((current) => shiftMonth(current, delta));
    setSelected(null);
  }

  async function resetAll() {
    if (resetText !== "RESET" || resetPending) return;
    setResetPending(true);
    setError("");
    const { epoch, ownerId } = useBudget.getState();
    const signal = ledgerRequestSignal();
    try {
      const snapshot = await resetLedgerData({ data: { confirm: "RESET" }, signal });
      if (signal.aborted || useBudget.getState().ownerId !== ownerId) return;
      useBudget.getState().applyRemote(epoch, snapshot);
      useBudget.setState({ notice: null });
      setMonth(currentMonthKey());
      setSelected(null);
      setConfirmReset(false);
      setResetText("");
    } catch {
      if (!signal.aborted) {
        // A lost response can follow a successful reset; reconcile before retry.
        try {
          const snapshot = await loadLedger({ signal });
          if (!signal.aborted && useBudget.getState().ownerId === ownerId) {
            useBudget.getState().applyRemote(epoch, snapshot);
            useBudget.setState({ notice: null });
          }
        } catch { /* The existing ledger stays visible until the connection returns. */ }
        setError("Connection interrupted. Check your ledger before trying again.");
      }
    } finally {
      setResetPending(false);
    }
  }

  return (
    <section className="panel txcal p-4" aria-labelledby="calendar-heading">
      <div className="txcal-heading">
        <div>
          <h3 id="calendar-heading" className="text-lg font-medium">Transaction Calendar</h3>
          <p className="mt-1 text-sm text-muted-foreground">Darker dates have more transactions. Income, expenses and savings all count.</p>
        </div>
        <Button variant="secondary" className="txcal-reset" onClick={() => { setError(""); setResetText(""); setConfirmReset(true); }}>
          <RotateCcw className="size-4" aria-hidden="true" /> Reset All Data
        </Button>
      </div>
      <div className="txcal-month">
        <Button variant="ghost" size="icon" aria-label="Previous calendar month" onClick={() => changeMonth(-1)}><ChevronLeft className="size-4" /></Button>
        <h4 aria-live="polite">{monthLabel(month)}</h4>
        <Button variant="ghost" size="icon" aria-label="Next calendar month" onClick={() => changeMonth(1)}><ChevronRight className="size-4" /></Button>
      </div>
      <div className="txcal-legend" aria-label="Transaction frequency from none to most">
        <span>Fewer</span>{[0, 1, 2, 3, 4].map((level) => <span key={level} className={`txcal-legend-swatch txcal-level-${level}`} aria-hidden="true" />)}<span>More</span>
      </div>
      <div className="txcal-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
      <div key={month} className={`txcal-grid txcal-enter-${direction}`}>
        {cells.map((cell, index) => cell ? (
          <button key={cell.date} type="button" className={`txcal-day txcal-level-${cell.level}`}
            aria-label={`${formatDay(cell.date)}, ${cell.count} transaction${cell.count === 1 ? "" : "s"}`}
            aria-current={cell.date === todayIso ? "date" : undefined}
            onClick={() => setSelected(cell.date)}>
            <span>{cell.number}</span>{cell.count > 0 && <small aria-hidden="true">{cell.count}</small>}
          </button>
        ) : <span key={`pad-${index}`} className="txcal-pad" aria-hidden="true" />)}
      </div>
      {selected && (
        <Modal title={formatDay(selected)} description={`${selectedRows.length} transaction${selectedRows.length === 1 ? "" : "s"} recorded on this date.`} onClose={() => setSelected(null)} placement="sheet" className="txcal-dialog">
          <dl className="txcal-totals">
            <div><dt>Transactions</dt><dd>{selectedRows.length}</dd></div>
            <div><dt>Total activity</dt><dd>{formatMoney(total, currency)}</dd></div>
            <div><dt>Net change</dt><dd>{formatMoney(net, currency)}</dd></div>
          </dl>
          {selectedRows.length ? <ul className="txcal-transactions">
            {selectedRows.map((tx) => <li key={tx.id}>
              <div className="min-w-0">
                <p className="font-medium">{tx.merchant || tx.note || categoryById(tx.categoryId)?.label || "Transaction"}</p>
                <p className="text-xs text-muted-foreground">{categoryById(tx.categoryId)?.label ?? tx.kind} · {tx.kind}</p>
                {tx.note && tx.merchant && <p className="txcal-note text-xs text-muted-foreground">{tx.note}</p>}
              </div>
              <span className={`txcal-amount ${tx.kind === "income" ? "text-positive" : tx.kind === "expense" ? "text-negative" : "text-savings"}`}>
                {tx.kind === "income" ? "+" : "−"}{formatMoney(tx.amountCents, currency)}
              </span>
            </li>)}
          </ul> : <p className="mt-5 text-sm text-muted-foreground">No transactions recorded for this date.</p>}
        </Modal>
      )}
      {confirmReset && (
        <Modal title="Reset All Data" description="Permanently delete this account's transactions, savings goals, budgets, recurring schedules and export history. Your account and sign-in remain." onClose={() => { if (!resetPending) setConfirmReset(false); }} className="txcal-dialog">
          <label className="mt-5 grid gap-2 text-sm font-medium">
            Type RESET to confirm
            <input className="field" value={resetText} onChange={(event) => setResetText(event.target.value)} autoComplete="off" aria-describedby="reset-warning" />
          </label>
          <p id="reset-warning" className="mt-2 text-sm text-muted-foreground">This cannot be undone. The calendar and ledger will become empty.</p>
          {error && <p className="mt-3 text-sm text-negative" role="alert">{error}</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={resetPending} onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button className="txcal-danger" disabled={resetText !== "RESET" || resetPending} onClick={resetAll}>{resetPending ? "Resetting…" : "Delete all data"}</Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
