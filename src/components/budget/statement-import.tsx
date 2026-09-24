import { useState, type ChangeEvent } from "react";
import { FileUp } from "lucide-react";
import { currentMonthKey, monthLabel, type Transaction } from "@/lib/budget/model";
import { importStatementTransactions, loadLedger } from "@/lib/budget/ledger";
import { ledgerRequestSignal, useBudget } from "@/lib/budget/store";
import { extractIdfcStatement, type StatementRow } from "@/lib/budget/statement-parser";

async function asTransaction(row: StatementRow): Promise<Transaction> {
  const fingerprint = `${row.date}|${row.kind}|${row.amountCents}|${row.balanceCents}|${row.description}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
  const id = "stmt-idfc-" + [...new Uint8Array(digest)].slice(0, 16).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const parts = row.description.split("/");
  const merchant = (parts[0].toUpperCase() === "UPI" ? parts[3] : parts[2])?.trim().slice(0, 60) || row.description.slice(0, 60);
  return {
    id,
    date: row.date,
    kind: row.kind,
    amountCents: row.amountCents,
    categoryId: row.kind === "income" ? "other-in" : "personal",
    note: `IDFC FIRST ${row.reference} ${row.description}`.trim().slice(0, 80),
    merchant,
  };
}

export function StatementImport() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const currency = useBudget((state) => state.currency);
  const month = currentMonthKey();

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || busy) return;
    if (currency !== "INR") {
      setMessage("Set your currency to INR before importing this bank statement.");
      return;
    }
    setBusy(true);
    setMessage("Reading and checking your statement…");
    const { epoch, ownerId } = useBudget.getState();
    const signal = ledgerRequestSignal();
    try {
      const rows = (await extractIdfcStatement(file)).filter((row) => row.date.slice(0, 7) === month);
      if (!rows.length) throw new Error(`No transactions dated ${monthLabel(month)} were found.`);
      if (rows.length > 300) throw new Error("This month has more than 300 transactions; use a shorter statement.");
      if (signal.aborted) return;
      const transactions = await Promise.all(rows.map(asTransaction));
      const response = await importStatementTransactions({ data: { month, transactions }, signal });
      if (signal.aborted || useBudget.getState().ownerId !== ownerId) return;
      useBudget.getState().applyRemote(epoch, response.snapshot);
      useBudget.getState().setViewMonth(month);
      setMessage(`Added ${response.added} transaction${response.added === 1 ? "" : "s"} for ${monthLabel(month)}. ${response.skipped} already present.`);
    } catch (error) {
      if (signal.aborted) return;
      // A network failure during a batch may occur after some rows were saved.
      try {
        const snapshot = await loadLedger({ signal });
        if (!signal.aborted) useBudget.getState().applyRemote(epoch, snapshot);
      } catch { /* Keep the visible ledger if the connection remains unavailable. */ }
      setMessage(error instanceof Error ? error.message : "Could not import this PDF. No unverified rows were added.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel mt-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Upload current month statement</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            IDFC FIRST Bank PDF · {monthLabel(month)} only · duplicates skipped. PDF stays on this device.
          </p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition-colors duration-200 hover:border-emerald-400 hover:bg-emerald-500/20 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-400">
          <FileUp className="size-4" aria-hidden="true" />
          {busy ? "Importing…" : "Choose PDF"}
          <input className="sr-only" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={onUpload} aria-label="Upload current month bank statement PDF" />
        </label>
      </div>
      {message && <p className="mt-3 text-sm" role="status" aria-live="polite">{message}</p>}
    </div>
  );
}
