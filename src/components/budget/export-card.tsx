import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { exportLedger } from "@/lib/budget/export-ledger";
import {
  buildExportReport,
  resolveRange,
  type ExportRangeType,
  type ExportSection,
} from "@/lib/budget/export-model";
import { useBudget } from "@/lib/budget/store";

const CHOICES: { id: ExportSection; label: string }[] = [
  { id: "transactions", label: "Transactions" },
  { id: "summary", label: "Monthly summary" },
  { id: "goals", label: "Savings goals and contributions" },
  { id: "budgets", label: "Category budgets" },
  { id: "scheduled", label: "Scheduled payments" },
  { id: "collections", label: "Collections, trips, and projects" },
  { id: "refunds", label: "Refund records" },
];

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (!message || message === "Failed to fetch" || message.includes("Server function")) return "Could not prepare your workbook. Try again.";
  return message;
}

export function ExportCard() {
  const transactions = useBudget((state) => state.transactions);
  const goals = useBudget((state) => state.goals);
  const settings = useBudget((state) => state.settings);
  const currency = useBudget((state) => state.currency);
  const viewMonth = useBudget((state) => state.viewMonth);
  const displayRange = useBudget((state) => state.displayRange);
  const user = useCurrentUser();
  const [range, setRange] = useState<ExportRangeType>(displayRange.custom ? "custom" : "current");
  const [start, setStart] = useState(displayRange.custom ? displayRange.start : "");
  const [end, setEnd] = useState(displayRange.custom ? displayRange.end : "");
  const [followDisplay, setFollowDisplay] = useState(true);
  const [sections, setSections] = useState<ExportSection[]>(["transactions", "summary"]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!followDisplay) return;
    if (displayRange.custom) {
      setRange("custom");
      setStart(displayRange.start);
      setEnd(displayRange.end);
    } else {
      setRange("current");
      setStart("");
      setEnd("");
    }
  }, [displayRange, followDisplay]);

  const customInvalid = range === "custom" && (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end);
  const resolved = useMemo(() => {
    if (sections.length === 0 || customInvalid) return null;
    return resolveRange({ range, start, end, viewMonth }, settings.monthStartsOn);
  }, [range, start, end, sections.length, customInvalid, settings.monthStartsOn, viewMonth]);

  const preview = useMemo(() => {
    if (!resolved) return null;
    return buildExportReport({
      transactions,
      goals,
      budgets: settings.budgets,
      recurring: settings.recurring,
      currency,
      range: resolved,
      sections,
      preparedFor: user?.displayName || "Your account",
      monthStartsOn: settings.monthStartsOn,
    });
  }, [resolved, transactions, goals, settings.budgets, settings.recurring, currency, sections, user?.displayName]);

  function toggle(id: ExportSection) {
    setSections((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    setError("");
  }

  async function download() {
    if (!resolved || !preview?.hasData) return;
    setPending(true);
    setError("");
    try {
      const file = await exportLedger({ data: { range, start, end, viewMonth, sections } });
      const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  const count = preview?.summary.transactionCount ?? 0;

  return (
    <section className="panel p-4 sm:p-5" id="data-backup" aria-labelledby="export-heading">
      <p className="text-sm text-muted-foreground">Data & Backup</p>
      <h3 id="export-heading" className="font-display mt-1 text-2xl font-medium tracking-tight">Export My Data</h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Download an Excel workbook of this account only. Clearbook builds it on the server from your ledger. It does not include anyone else’s records, passwords, or sign-in tokens.
      </p>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Date range</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {([
            ["current", "Current month"],
            ["custom", "Custom range"],
            ["all", "All-time"],
          ] as const).map(([id, label]) => (
            <label key={id} className={range === id ? "press inline-flex h-11 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" : "press inline-flex h-11 items-center gap-2 rounded-md bg-muted px-3 text-sm"}>
              <input className="sr-only" type="radio" name="export-range" checked={range === id} onChange={() => { setFollowDisplay(false); setRange(id); setError(""); }} />
              {label}
            </label>
          ))}
        </div>
        {range === "custom" ? (
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="grid gap-1 text-sm">
              Start
              <input className="field" type="date" value={start} onChange={(event) => { setFollowDisplay(false); setStart(event.target.value); setError(""); }} />
            </label>
            <label className="grid gap-1 text-sm">
              End
              <input className="field" type="date" value={end} onChange={(event) => { setFollowDisplay(false); setEnd(event.target.value); setError(""); }} />
            </label>
          </div>
        ) : null}
        {resolved ? <p className="mt-2 text-sm text-muted-foreground">{resolved.label}</p> : null}
        {customInvalid ? <p className="mt-2 text-sm text-negative">Choose a start date and an end date.</p> : null}
      </fieldset>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Include</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CHOICES.map((choice) => (
            <label key={choice.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[#203541]"
                checked={sections.includes(choice.id)}
                onChange={() => toggle(choice.id)}
              />
              {choice.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-4 text-sm">
        {sections.length === 0
          ? "Choose at least one section."
          : preview?.hasData
            ? `${count} transaction${count === 1 ? "" : "s"} in this range.`
            : "Nothing to export for this selection. Add a transaction, or choose a range that has records."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Refunds stay out of income and reduce net expenses. A split is exported once, under each of its categories.
      </p>
      {pending ? (
        <div className="mt-3" role="progressbar" aria-valuetext="Preparing your workbook">
          <p className="text-sm">Preparing your workbook…</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full animate-pulse bg-primary" />
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-negative" role="alert">{error}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => void download()} disabled={pending || !preview?.hasData}>
          {pending ? "Preparing your workbook…" : "Download Excel"}
        </Button>
        {error ? (
          <Button variant="secondary" onClick={() => void download()} disabled={pending}>Retry</Button>
        ) : null}
      </div>
    </section>
  );
}
