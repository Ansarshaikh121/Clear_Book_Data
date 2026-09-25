import { useEffect, useMemo, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useEditor } from "@/components/budget/frame";
import { StatementImport } from "@/components/budget/statement-import";
import { CATEGORIES, categoryById, categoryColor, formatDay, formatMoney, periodBounds, periodLabel, summarizeRange, transactionWindow, type CurrencyCode, type Kind, type Transaction } from "@/lib/budget/model";
import { useBudget } from "@/lib/budget/store";

const routeApi = getRouteApi("/transactions");

type KindFilter = "all" | Kind;

export function TransactionsPage() {
  const search = routeApi.useSearch();
  const transactions = useBudget((state) => state.transactions);
  const currency = useBudget((state) => state.currency);
  const viewMonth = useBudget((state) => state.viewMonth);
  const settings = useBudget((state) => state.settings);
  const deleteTransaction = useBudget((state) => state.deleteTransaction);
  const duplicateTransaction = useBudget((state) => state.duplicateTransaction);
  const setDisplayRange = useBudget((state) => state.setDisplayRange);
  const { openEdit, openCreate } = useEditor();
  const bounds = periodBounds(viewMonth, settings.monthStartsOn);
  const periodKey = `${viewMonth}:${settings.monthStartsOn}`;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState(search.q ?? "");
  const [kind, setKind] = useState<KindFilter>(search.kind ?? "all");
  const [category, setCategory] = useState(search.category ?? "all");
  const [from, setFrom] = useState(search.day ?? search.from ?? bounds.start);
  const [to, setTo] = useState(search.day ?? search.to ?? bounds.end);
  const [appliedPeriod, setAppliedPeriod] = useState(periodKey);
  const [min, setMin] = useState(search.min ?? "");
  const [max, setMax] = useState(search.max ?? "");
  const [sort, setSort] = useState<"date" | "amount">(search.sort ?? "date");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (appliedPeriod !== periodKey) {
    setAppliedPeriod(periodKey);
    setFrom(bounds.start);
    setTo(bounds.end);
  }

  const activeWindow = transactionWindow(viewMonth, settings.monthStartsOn, from, to);
  const rangeSummary = useMemo(() => summarizeRange(transactions, from, to), [transactions, from, to]);

  useEffect(() => {
    setDisplayRange({ start: from, end: to, custom: activeWindow.custom });
  }, [from, to, activeWindow.custom, setDisplayRange]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const minCents = min.trim() === "" ? null : Math.round(Number(min.replace(/,/g, "")) * 100);
    const maxCents = max.trim() === "" ? null : Math.round(Number(max.replace(/,/g, "")) * 100);
    const filtered = transactions.filter((tx) => {
      if (kind !== "all" && tx.kind !== kind) return false;
      if (category !== "all" && tx.categoryId !== category) return false;
      if (from && tx.date < from) return false;
      if (to && tx.date > to) return false;
      if (minCents != null && Number.isFinite(minCents) && tx.amountCents < minCents) return false;
      if (maxCents != null && Number.isFinite(maxCents) && tx.amountCents > maxCents) return false;
      if (!needle) return true;
      const categoryLabel = categoryById(tx.categoryId)?.label ?? "";
      const amount = formatMoney(tx.amountCents, currency).toLowerCase();
      return `${tx.note} ${tx.merchant ?? ""} ${categoryLabel} ${amount} ${tx.amountCents / 100}`.toLowerCase().includes(needle);
    });
    return filtered.sort((a, b) => {
      if (sort === "amount") return b.amountCents - a.amountCents || (a.date < b.date ? 1 : -1);
      return a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1;
    });
  }, [transactions, query, kind, category, from, to, min, max, sort, currency]);

  const filters = (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">
        Type
        <select className="field" value={kind} onChange={(event) => setKind(event.target.value as KindFilter)}>
          <option value="all">All</option>
          <option value="income">Income</option>
          <option value="expense">Expenses</option>
          <option value="savings">Savings</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Category
        <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        From
        <input className="field" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        To
        <input className="field" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        Minimum amount
        <input className="field" inputMode="decimal" value={min} onChange={(event) => setMin(event.target.value)} placeholder="Any" />
      </label>
      <label className="grid gap-1 text-sm">
        Maximum amount
        <input className="field" inputMode="decimal" value={max} onChange={(event) => setMax(event.target.value)} placeholder="Any" />
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2">
        Sort
        <select className="field" value={sort} onChange={(event) => setSort(event.target.value as "date" | "amount")}>
          <option value="date">Date</option>
          <option value="amount">Amount</option>
        </select>
      </label>
    </div>
  );

  return (
    <section aria-labelledby="tx-heading">
      <h2 id="tx-heading" className="font-display text-3xl font-medium tracking-tight">Transactions</h2>
      <p className="mt-1 text-sm font-medium">{activeWindow.custom ? "Custom range" : periodLabel(viewMonth, settings.monthStartsOn)}</p>
      <p className="text-sm text-muted-foreground">{from && to ? `${formatDay(from)} – ${formatDay(to)}` : "Choose a start and end date."} Search notes, merchants, categories, and amounts.</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Total label="Income" value={formatMoney(rangeSummary.income, currency)} />
        <Total label="Expenses" value={formatMoney(rangeSummary.expense, currency)} />
        <Total label="Saved" value={formatMoney(rangeSummary.savings, currency)} />
        <Total label="Remaining" value={formatMoney(rangeSummary.remaining, currency)} />
      </dl>
      <StatementImport />
      <label className="mt-4 grid gap-1 text-sm">
        <span className="sr-only">Search transactions</span>
        <input className="field" type="search" value={query} placeholder="Search transactions" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="mt-3 hidden md:block">{filters}</div>
      <Button className="mt-3 md:hidden" variant="secondary" onClick={() => setFiltersOpen(true)}>
        Filters
      </Button>
      {filtersOpen ? (
        <Modal title="Filters" description="Narrow this list. Nothing here changes your records." onClose={() => setFiltersOpen(false)}>
          {filters}
          <Button className="mt-4 w-full" onClick={() => setFiltersOpen(false)}>Show transactions</Button>
        </Modal>
      ) : null}
      {rows.length === 0 ? (
        <div className="panel mt-4 px-4 py-8 text-center">
          <p className="text-sm font-medium">
            {transactions.length === 0
              ? "Welcome to Clearbook. Add your first transaction to get started."
              : "No transactions match these filters."}
          </p>
          <div className="mt-4 flex justify-center">
            <Button onClick={openCreate}>Add Transaction</Button>
          </div>
        </div>
      ) : (
        <ul className="panel mt-4 divide-y divide-border px-2">
          {rows.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              currency={currency}
              confirming={confirmId === tx.id}
              onEdit={() => openEdit(tx)}
              onDuplicate={() => duplicateTransaction(tx.id)}
              onAskDelete={() => setConfirmId(tx.id)}
              onDelete={() => {
                deleteTransaction(tx.id);
                setConfirmId(null);
              }}
            />
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{rows.length} transaction{rows.length === 1 ? "" : "s"}</p>
    </section>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function TransactionRow({
  tx,
  currency,
  confirming,
  onEdit,
  onDuplicate,
  onAskDelete,
  onDelete,
}: {
  tx: Transaction;
  currency: CurrencyCode;
  confirming: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onAskDelete: () => void;
  onDelete: () => void;
}) {
  const category = categoryById(tx.categoryId)?.label ?? "Transaction";
  const title = tx.merchant || tx.note || category;
  const tone = tx.kind === "income" ? "text-positive" : tx.kind === "expense" ? "text-negative" : "text-savings";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-2 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          {tx.kind === "expense" ? <span className="size-2 rounded-sm" style={{ background: categoryColor(tx.categoryId) }} aria-hidden="true" /> : null}
          {category} · {formatDay(tx.date)}
          {tx.note && tx.merchant ? ` · ${tx.note}` : ""}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium tabular-nums ${tone}`}>
          {tx.kind === "income" ? "+" : tx.kind === "expense" ? "−" : ""}
          {formatMoney(tx.amountCents, currency)}
        </p>
        <div className="mt-1 flex justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-11 px-2" aria-label={`Edit ${title}`} onClick={onEdit}><Pencil className="size-3.5" /></Button>
          <Button variant="ghost" size="sm" className="h-11 px-2" aria-label={`Duplicate ${title}`} onClick={onDuplicate}><Copy className="size-3.5" /></Button>
          <Button variant="ghost" size="sm" className="h-11 px-2 text-negative" aria-label={confirming ? `Confirm delete ${title}` : `Delete ${title}`} onClick={confirming ? onDelete : onAskDelete}>
            <Trash2 className="size-3.5" />
            {confirming ? "Confirm" : ""}
          </Button>
        </div>
      </div>
    </li>
  );
}
