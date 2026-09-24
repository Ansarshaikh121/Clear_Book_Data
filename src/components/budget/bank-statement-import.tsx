import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { categoriesFor, formatMoney, type Transaction } from "@/lib/budget/model";
import { parseStatementCsv, parseStatementRows, statementKey, type StatementRow } from "@/lib/budget/bank-statement";
import { importBankTransactions } from "@/lib/budget/ledger";
import { ledgerRequestSignal, useBudget } from "@/lib/budget/store";

type PreviewRow = StatementRow & { id: string };

async function readTable(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) return parseStatementCsv(await file.text());
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Choose a .csv or .xlsx statement.");
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  for (const sheet of workbook.worksheets) {
    const table: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      for (let i = 1; i <= row.cellCount; i++) {
        const cell = row.getCell(i);
        const value = cell.value;
        if (value instanceof Date) {
          cells.push(value.toISOString().slice(0, 10));
        } else if (typeof value === "number" && /[dy]/i.test(cell.numFmt) ) {
          const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
          cells.push(date.toISOString().slice(0, 10));
        } else if (value && typeof value === "object" && "result" in value) {
          cells.push(String(value.result ?? ""));
        } else {
          cells.push(cell.text ?? "");
        }
      }
      table.push(cells);
    });
    try { parseStatementRows(table); return table; } catch { /* next sheet */ }
  }
  throw new Error("No worksheet with Date, Description, and Debit/Credit columns was found.");
}

export function BankStatementImport() {
  const transactions = useBudget((state) => state.transactions);
  const currency = useBudget((state) => state.currency);
  const ownerId = useBudget((state) => state.ownerId);
  const applyRemote = useBudget((state) => state.applyRemote);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filename, setFilename] = useState("");
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [working, setWorking] = useState(false);
  const [currencyConfirmed, setCurrencyConfirmed] = useState(false);

  const existing = new Set(transactions.map(statementKey));
  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setRows([]);
    setSelected(new Set());
    setFilename("");
    setResult("");
    setError("");
    setCurrencyConfirmed(false);
    if (!file) return;
    if (file.size > 2_000_000) { setError("Choose a statement smaller than 2 MB."); return; }
    setWorking(true);
    try {
      const table = await readTable(file);
      const parsed = parseStatementRows(table);
      if (parsed.rows.length > 500) throw new Error("Choose a statement with at most 500 transactions.");
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())))
        .map((part) => part.toString(16).padStart(2, "0")).join("").slice(0, 32);
      const used = new Set(existing);
      const preview = parsed.rows.map((row) => {
        const id = `bank-${digest}-${row.sourceRow}`;
        const key = statementKey(row);
        const duplicate = used.has(key);
        used.add(key);
        return { ...row, id, review: row.review || duplicate, reason: duplicate ? "Already in ledger or repeated in statement" : row.reason };
      });
      setRows(preview);
      setSelected(new Set(preview.filter((row) => !row.review).map((row) => row.id)));
      setSkipped(parsed.skipped);
      setFilename(file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this statement.");
    } finally { setWorking(false); }
  }

  function updateRow(id: string, categoryId: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, categoryId } : row));
  }

  async function confirm() {
    if (!ownerId || !currencyConfirmed || selected.size === 0 || working) return;
    setWorking(true);
    setError("");
    setResult("");
    const epoch = useBudget.getState().epoch;
    try {
      const data: Transaction[] = rows.filter((row) => selected.has(row.id)).map(({ id, kind, amountCents, categoryId, note, date }) => ({
        id, kind, amountCents, categoryId, note, date,
      }));
      const response = await importBankTransactions({ data: { confirm: true, transactions: data }, signal: ledgerRequestSignal() });
      if (useBudget.getState().epoch !== epoch || useBudget.getState().ownerId !== ownerId) return;
      applyRemote(epoch, response.snapshot);
      setResult(`${response.added} transactions imported; ${response.duplicates} duplicates skipped.`);
      setRows([]);
      setSelected(new Set());
      setFilename("");
      setCurrencyConfirmed(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed. No rows were confirmed.");
    } finally { setWorking(false); }
  }

  return (
    <section className="panel mt-5 p-4" aria-labelledby="bank-import-heading">
      <h3 id="bank-import-heading" className="text-lg font-medium">Import bank statement</h3>
      <p className="mt-1 text-sm text-muted-foreground">Upload a CSV or Excel (.xlsx) statement. Debit becomes an expense; credit becomes income. Review every row before saving. Your original file is read in this browser and is not uploaded.</p>
      <label className="mt-3 grid gap-1 text-sm font-medium">Choose statement
        <input className="field" type="file" accept=".csv,.xlsx" onChange={(event) => void chooseFile(event)} disabled={working} />
      </label>
      {error ? <p className="mt-2 text-sm text-negative" role="alert">{error}</p> : null}
      {result ? <p className="mt-2 text-sm text-positive" role="status">{result}</p> : null}
      {working ? <p className="mt-2 text-sm" role="status">Processing…</p> : null}
      {rows.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium">{filename}: {rows.length} valid rows, {skipped} skipped, {selected.size} selected.</p>
          <p className="mt-1 text-xs text-muted-foreground">Possible transfers and duplicates are unchecked. Check descriptions and categories carefully. The selected rows will use your ledger currency ({currency}); no conversion is applied.</p>
          <div className="mt-3 max-h-96 overflow-auto rounded-md border border-border">
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id} className="grid gap-2 p-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                  <input type="checkbox" aria-label={`Import row ${row.sourceRow}`} checked={selected.has(row.id)} onChange={() => setSelected((current) => {
                    const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next;
                  })} />
                  <div className="min-w-0">
                    <p className="break-words">{row.note}</p>
                    <p className="text-xs text-muted-foreground">{row.date} · {row.kind === "expense" ? "Expense" : "Income"}{row.reason ? ` · ${row.reason}` : ""}</p>
                    <select className="field mt-1 max-w-full text-xs" aria-label={`Category for row ${row.sourceRow}`} value={row.categoryId} onChange={(event) => updateRow(row.id, event.target.value)}>
                      {categoriesFor(row.kind).map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                    </select>
                  </div>
                  <strong className="tabular-nums">{row.kind === "expense" ? "−" : "+"}{formatMoney(row.amountCents, currency)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={currencyConfirmed} onChange={(event) => setCurrencyConfirmed(event.target.checked)} />
            <span>I checked the transactions and confirm that the statement amounts are in {currency}.</span>
          </label>
          <Button className="mt-3" disabled={working || !currencyConfirmed || selected.size === 0} onClick={() => void confirm()}>Import {selected.size} selected transactions</Button>
        </div>
      ) : null}
    </section>
  );
}
