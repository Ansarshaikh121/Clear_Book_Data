import {
  categoryById,
  comparisonNoteForRange,
  currentMonthKey,
  inRange,
  monthLabel,
  periodBounds,
  shiftMonth,
  type CurrencyCode,
  type Goal,
  type Kind,
  type Transaction,
} from "./model.ts";

type BudgetLimit = { categoryId: string; limitCents: number };
type RecurringPayment = { id: string; label: string; categoryId: string; amountCents: number; dayOfMonth: number };

export const EXPORT_SECTIONS = [
  "transactions",
  "goals",
  "budgets",
  "scheduled",
  "collections",
  "refunds",
  "summary",
] as const;

export type ExportSection = (typeof EXPORT_SECTIONS)[number];

export type ExportRangeType = "current" | "custom" | "all";

export type SplitAllocation = { categoryId: string; amountCents: number };

export type SpendingClass = "fixed" | "everyday";

export type CollectionKind = "collection" | "trip" | "project";

export type ExportSourceTx = {
  id: string;
  kind: Kind;
  amountCents: number;
  categoryId: string;
  note: string;
  date: string;
  merchant?: string;
  goalId?: string;
  splits?: SplitAllocation[];
  refundOf?: string;
  spendingClass?: SpendingClass;
  collectionName?: string;
  collectionKind?: CollectionKind;
  createdAt?: string;
};

export type ResolvedRange = {
  type: ExportRangeType;
  start: string | null;
  end: string | null;
  label: string;
  filename: string;
};

export type ExportRequest = {
  range: ExportRangeType;
  start?: string;
  end?: string;
  viewMonth?: string;
  sections: ExportSection[];
};

const SECTION_SET = new Set<string>(EXPORT_SECTIONS);

export function isRefund(tx: { kind: Kind; categoryId: string; amountCents: number }): boolean {
  return tx.kind === "income" && tx.categoryId === "refund" && tx.amountCents > 0;
}

export function currentFinancialPeriod(monthStartsOn: number, now = new Date()): { start: string; end: string } {
  const day = Math.min(28, Math.max(1, Math.round(monthStartsOn) || 1));
  const key = currentMonthKey(now);
  const month = now.getDate() >= day ? key : shiftMonth(key, -1);
  return periodBounds(month, day);
}

export function resolveRange(
  request: Pick<ExportRequest, "range" | "start" | "end" | "viewMonth">,
  monthStartsOn: number,
  now = new Date(),
): ResolvedRange {
  if (request.range === "all") {
    return { type: "all", start: null, end: null, label: "All time", filename: "Clearbook_All-time.xlsx" };
  }
  if (request.range === "current") {
    const anchor = request.viewMonth && /^\d{4}-\d{2}$/.test(request.viewMonth) ? request.viewMonth : null;
    const period = anchor ? periodBounds(anchor, Math.min(28, Math.max(1, Math.round(monthStartsOn) || 1))) : currentFinancialPeriod(monthStartsOn, now);
    const calendarMonth = period.start.endsWith("-01") && period.end.slice(0, 7) === period.start.slice(0, 7);
    const filename = calendarMonth
      ? `Clearbook_${monthLabel(period.start.slice(0, 7)).replace(" ", "-")}.xlsx`
      : `Clearbook_${period.start}_to_${period.end}.xlsx`;
    const label = calendarMonth ? monthLabel(period.start.slice(0, 7)) : `${period.start} to ${period.end}`;
    return { type: "current", start: period.start, end: period.end, label, filename };
  }
  const start = request.start ?? "";
  const end = request.end ?? "";
  return {
    type: "custom",
    start,
    end,
    label: `${start} to ${end}`,
    filename: `Clearbook_${start}_to_${end}.xlsx`,
  };
}

export function dateInExport(date: string, range: Pick<ResolvedRange, "start" | "end">): boolean {
  if (!range.start || !range.end) return true;
  return inRange(date, range.start, range.end);
}

function categoryLabel(categoryId: string): string {
  return categoryById(categoryId)?.label ?? "Other";
}

/** Allocations for an expense. A split replaces the parent amount so totals are not added twice. */
export function expenseAllocations(tx: ExportSourceTx): SplitAllocation[] {
  if (tx.kind !== "expense") return [];
  if (tx.splits && tx.splits.length >= 2) return tx.splits.map((part) => ({ ...part }));
  return [{ categoryId: tx.categoryId, amountCents: tx.amountCents }];
}

export function expenseTotal(tx: ExportSourceTx): number {
  return expenseAllocations(tx).reduce((sum, part) => sum + part.amountCents, 0);
}

function titleOf(tx: ExportSourceTx): string {
  return tx.note.trim() || tx.merchant?.trim() || categoryLabel(tx.categoryId);
}

function distribute(total: number, weights: number[]): number[] {
  const base = weights.reduce((sum, weight) => sum + weight, 0);
  if (base <= 0 || total <= 0) return weights.map(() => 0);
  const shares = weights.map((weight) => Math.floor((total * weight) / base));
  let used = shares.reduce((sum, share) => sum + share, 0);
  let index = 0;
  while (used < total && shares.length > 0) {
    shares[index % shares.length] += 1;
    used += 1;
    index += 1;
  }
  return shares;
}

export type SummaryFigures = {
  incomeCents: number;
  grossExpenseCents: number;
  refundCents: number;
  netExpenseCents: number;
  savedCents: number;
  remainingCents: number;
  transactionCount: number;
  categories: { categoryId: string; label: string; cents: number }[];
  unassignedRefundCents: number;
  usedSplits: boolean;
  comparisonNote: string;
};

export type TransactionRow = {
  date: string;
  type: "Income" | "Expense" | "Savings" | "Refund";
  title: string;
  merchant: string;
  category: string;
  amountCents: number;
  notes: string;
  collection: string;
  goal: string;
  spendingClass: string;
  refundStatus: string;
  createdAt: string;
};

export type GoalRow = {
  name: string;
  targetCents: number;
  savedCents: number;
  remainingCents: number;
  progress: number;
  contributionCents: number;
  status: string;
};

export type BudgetRow = {
  category: string;
  budgetCents: number;
  actualCents: number;
  remainingCents: number;
  usage: number;
  status: string;
};

export type ScheduledRow = {
  name: string;
  category: string;
  amountCents: number;
  dueDate: string;
  frequency: string;
  status: string;
  linked: string;
};

export type CollectionRow = {
  name: string;
  kind: string;
  spentCents: number;
  count: number;
};

export type RefundRow = {
  original: string;
  originalCents: number | null;
  refundCents: number;
  date: string;
  netCents: number | null;
  status: string;
};

export type ExportReport = {
  filename: string;
  rangeLabel: string;
  rangeType: ExportRangeType;
  rangeStart: string | null;
  rangeEnd: string | null;
  currency: CurrencyCode;
  preparedFor: string;
  sections: ExportSection[];
  summary: SummaryFigures;
  transactions: TransactionRow[];
  goals: GoalRow[];
  budgets: BudgetRow[];
  scheduled: ScheduledRow[];
  collections: CollectionRow[];
  refunds: RefundRow[];
  /** True when at least one selected section has something to put in the file. */
  hasData: boolean;
};

function goalName(goals: Goal[], goalId: string | undefined): string {
  if (!goalId) return "";
  return goals.find((goal) => goal.id === goalId)?.name ?? "";
}

function refundStatusForExpense(tx: ExportSourceTx, refunds: ExportSourceTx[]): string {
  const linked = refunds.filter((refund) => refund.refundOf === tx.id);
  if (linked.length === 0) return "";
  const total = linked.reduce((sum, refund) => sum + refund.amountCents, 0);
  if (total >= expenseTotal(tx)) return "Refunded";
  return "Partly refunded";
}

function dueDateInRange(dayOfMonth: number, range: Pick<ResolvedRange, "start" | "end">, now: Date): string {
  const day = String(dayOfMonth).padStart(2, "0");
  if (range.start && range.end) {
    let cursor = range.start;
    while (cursor <= range.end) {
      if (cursor.slice(8, 10) === day) return cursor;
      const [year, month, date] = cursor.split("-").map(Number);
      const next = new Date(year, month - 1, date + 1);
      cursor = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    }
    return "";
  }
  const year = now.getFullYear();
  const month = now.getMonth();
  const thisMonth = `${year}-${String(month + 1).padStart(2, "0")}-${day}`;
  if (now.getDate() <= dayOfMonth) return thisMonth;
  const next = new Date(year, month + 1, dayOfMonth);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

function linkedPayment(item: RecurringPayment, txs: ExportSourceTx[]): ExportSourceTx | undefined {
  const day = String(item.dayOfMonth).padStart(2, "0");
  const matches = txs.filter(
    (tx) => tx.kind === "expense" && tx.categoryId === item.categoryId && expenseTotal(tx) === item.amountCents && tx.date.slice(8, 10) === day,
  );
  const label = item.label.toLowerCase();
  return (
    matches.find((tx) => tx.note.toLowerCase().includes(label) || (tx.merchant ?? "").toLowerCase().includes(label)) ??
    matches[matches.length - 1]
  );
}

export function buildExportReport(input: {
  transactions: ExportSourceTx[];
  goals: Goal[];
  budgets: BudgetLimit[];
  recurring: RecurringPayment[];
  currency: CurrencyCode;
  range: ResolvedRange;
  sections: ExportSection[];
  preparedFor: string;
  monthStartsOn?: number;
  now?: Date;
}): ExportReport {
  const now = input.now ?? new Date();
  const ranged = input.transactions.filter((tx) => dateInExport(tx.date, input.range));
  const refunds = ranged.filter((tx) => isRefund(tx));
  const byId = new Map(input.transactions.map((tx) => [tx.id, tx]));

  let incomeCents = 0;
  let grossExpenseCents = 0;
  let savedCents = 0;
  let usedSplits = false;
  const grossByCategory = new Map<string, number>();

  for (const tx of ranged) {
    if (isRefund(tx)) continue;
    if (tx.kind === "income") incomeCents += tx.amountCents;
    else if (tx.kind === "savings") savedCents += tx.amountCents;
    else if (tx.kind === "expense") {
      const parts = expenseAllocations(tx);
      if (tx.splits && tx.splits.length >= 2) usedSplits = true;
      grossExpenseCents += parts.reduce((sum, part) => sum + part.amountCents, 0);
      for (const part of parts) grossByCategory.set(part.categoryId, (grossByCategory.get(part.categoryId) ?? 0) + part.amountCents);
    }
  }

  const refundShare = new Map<string, number>();
  let unassignedRefundCents = 0;
  for (const refund of refunds) {
    const original = refund.refundOf ? byId.get(refund.refundOf) : undefined;
    if (!original || original.kind !== "expense") {
      unassignedRefundCents += refund.amountCents;
      continue;
    }
    const parts = expenseAllocations(original);
    const weights = parts.map((part) => part.amountCents);
    const shares = distribute(refund.amountCents, weights);
    parts.forEach((part, index) => {
      refundShare.set(part.categoryId, (refundShare.get(part.categoryId) ?? 0) + shares[index]);
    });
  }

  const categories = [...grossByCategory.entries()]
    .map(([categoryId, gross]) => ({
      categoryId,
      label: categoryLabel(categoryId),
      cents: gross - (refundShare.get(categoryId) ?? 0),
    }))
    .filter((row) => row.cents !== 0)
    .sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));

  const refundCents = refunds.reduce((sum, tx) => sum + tx.amountCents, 0);
  const summary: SummaryFigures = {
    incomeCents,
    grossExpenseCents,
    refundCents,
    netExpenseCents: grossExpenseCents - refundCents,
    savedCents,
    remainingCents: incomeCents - (grossExpenseCents - refundCents) - savedCents,
    transactionCount: ranged.length,
    categories,
    unassignedRefundCents,
    usedSplits,
    comparisonNote: comparisonNoteForRange(
      input.transactions as Transaction[],
      input.range,
      input.monthStartsOn ?? 1,
      input.currency,
      input.now ? `${input.now.getFullYear()}-${String(input.now.getMonth() + 1).padStart(2, "0")}-${String(input.now.getDate()).padStart(2, "0")}` : undefined,
    ),
  };

  const goalRows: GoalRow[] = input.goals
    .map((goal) => {
      const savedAll = input.transactions
        .filter((tx) => tx.kind === "savings" && tx.goalId === goal.id)
        .reduce((sum, tx) => sum + tx.amountCents, 0);
      const contributionCents = ranged
        .filter((tx) => tx.kind === "savings" && tx.goalId === goal.id)
        .reduce((sum, tx) => sum + tx.amountCents, 0);
      const progress = goal.targetCents > 0 ? savedAll / goal.targetCents : 0;
      const status = savedAll <= 0 ? "Not started" : savedAll >= goal.targetCents ? "Goal reached" : "In progress";
      return {
        name: goal.name,
        targetCents: goal.targetCents,
        savedCents: savedAll,
        remainingCents: goal.targetCents - savedAll,
        progress,
        contributionCents,
        status,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const budgetRows: BudgetRow[] = input.budgets
    .map((budget) => {
      const actualCents = categories.find((row) => row.categoryId === budget.categoryId)?.cents ?? 0;
      const remainingCents = budget.limitCents - actualCents;
      const usage = budget.limitCents > 0 ? actualCents / budget.limitCents : 0;
      const status = actualCents === 0 ? "No spending" : actualCents > budget.limitCents ? "Over budget" : "Within budget";
      return {
        category: categoryLabel(budget.categoryId),
        budgetCents: budget.limitCents,
        actualCents,
        remainingCents,
        usage,
        status,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category));

  const scheduledRows: ScheduledRow[] = input.recurring.map((item) => {
    const due = dueDateInRange(item.dayOfMonth, input.range, now);
    const paid = linkedPayment(
      item,
      ranged.filter((tx) => tx.kind === "expense"),
    );
    const status = !due && input.range.start ? "Outside this range" : paid ? "Paid" : "Not recorded";
    return {
      name: item.label,
      category: categoryLabel(item.categoryId),
      amountCents: item.amountCents,
      dueDate: due,
      frequency: "Monthly",
      status,
      linked: paid ? `${paid.date} · ${titleOf(paid)}` : "",
    };
  });

  const collectionMap = new Map<string, CollectionRow>();
  for (const tx of ranged) {
    if (!tx.collectionName || tx.kind !== "expense") continue;
    const key = `${tx.collectionKind ?? ""}:${tx.collectionName}`;
    const current = collectionMap.get(key) ?? {
      name: tx.collectionName,
      kind: tx.collectionKind === "trip" ? "Trip" : tx.collectionKind === "project" ? "Project" : tx.collectionKind === "collection" ? "Collection" : "",
      spentCents: 0,
      count: 0,
    };
    current.spentCents += expenseTotal(tx);
    current.count += 1;
    collectionMap.set(key, current);
  }
  const collections = [...collectionMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const refundRows: RefundRow[] = refunds
    .map((refund) => {
      const original = refund.refundOf ? byId.get(refund.refundOf) : undefined;
      const originalCents = original && original.kind === "expense" ? expenseTotal(original) : null;
      const siblings = original
        ? refunds.filter((item) => item.refundOf === original.id).reduce((sum, item) => sum + item.amountCents, 0)
        : 0;
      const netCents = originalCents == null ? null : originalCents - siblings;
      const status =
        originalCents == null ? "Recorded" : siblings >= originalCents ? "Full refund" : "Partial refund";
      return {
        original: original && original.kind === "expense" ? titleOf(original) : "",
        originalCents,
        refundCents: refund.amountCents,
        date: refund.date,
        netCents,
        status,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.original.localeCompare(b.original));

  const transactions: TransactionRow[] = [];
  for (const tx of [...ranged].sort((a, b) => a.date.localeCompare(b.date) || titleOf(a).localeCompare(titleOf(b)))) {
    const collection = tx.collectionName ?? "";
    const goal = goalName(input.goals, tx.goalId);
    const spendingClass = tx.spendingClass === "fixed" ? "Fixed" : tx.spendingClass === "everyday" ? "Everyday" : "";
    const createdAt = tx.createdAt ?? "";
    if (isRefund(tx)) {
      transactions.push({
        date: tx.date,
        type: "Refund",
        title: titleOf(tx),
        merchant: tx.merchant ?? "",
        category: "Refund",
        amountCents: tx.amountCents,
        notes: tx.note,
        collection,
        goal,
        spendingClass: "",
        refundStatus: "Refund",
        createdAt,
      });
      continue;
    }
    if (tx.kind === "expense") {
      const status = refundStatusForExpense(tx, refunds);
      for (const part of expenseAllocations(tx)) {
        transactions.push({
          date: tx.date,
          type: "Expense",
          title: titleOf(tx),
          merchant: tx.merchant ?? "",
          category: categoryLabel(part.categoryId),
          amountCents: -part.amountCents,
          notes: tx.note,
          collection,
          goal,
          spendingClass,
          refundStatus: status,
          createdAt,
        });
      }
      continue;
    }
    transactions.push({
      date: tx.date,
      type: tx.kind === "savings" ? "Savings" : "Income",
      title: titleOf(tx),
      merchant: tx.merchant ?? "",
      category: categoryLabel(tx.categoryId),
      amountCents: tx.amountCents,
      notes: tx.note,
      collection,
      goal,
      spendingClass: "",
      refundStatus: "",
      createdAt,
    });
  }

  const selected = new Set(input.sections);
  const hasData =
    ((selected.has("summary") || selected.has("transactions")) && ranged.length > 0) ||
    (selected.has("goals") && goalRows.length > 0) ||
    (selected.has("budgets") && budgetRows.length > 0) ||
    (selected.has("scheduled") && scheduledRows.length > 0) ||
    (selected.has("collections") && collections.length > 0) ||
    (selected.has("refunds") && refundRows.length > 0);

  return {
    filename: input.range.filename,
    rangeLabel: input.range.label,
    rangeType: input.range.type,
    rangeStart: input.range.start,
    rangeEnd: input.range.end,
    currency: input.currency,
    preparedFor: input.preparedFor,
    sections: input.sections,
    summary,
    transactions,
    goals: goalRows,
    budgets: budgetRows,
    scheduled: scheduledRows,
    collections,
    refunds: refundRows,
    hasData,
  };
}

export function parseExportRequest(input: unknown): ExportRequest {
  const row = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
  if (!row) throw new Error("Choose what to export.");
  const range = row.range;
  if (range !== "current" && range !== "custom" && range !== "all") throw new Error("Choose a date range.");
  const sections = Array.isArray(row.sections)
    ? [...new Set(row.sections.filter((item): item is ExportSection => typeof item === "string" && SECTION_SET.has(item)))]
    : [];
  if (sections.length === 0) throw new Error("Choose at least one section.");
  const viewMonth = typeof row.viewMonth === "string" && /^\d{4}-\d{2}$/.test(row.viewMonth) ? row.viewMonth : undefined;
  if (range === "custom") {
    const start = typeof row.start === "string" ? row.start : "";
    const end = typeof row.end === "string" ? row.end : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
      throw new Error("Choose a start date and an end date.");
    }
    const span = (Date.parse(end) - Date.parse(start)) / 86_400_000;
    if (span > 366 * 20) throw new Error("Choose a shorter date range.");
    return { range, start, end, sections, viewMonth };
  }
  return { range, sections, viewMonth };
}

/** Safe export-log fields. Transaction notes, merchants, and amounts are not included. */
export function exportActivity(report: ExportReport): {
  rangeType: ExportRangeType;
  rangeStart: string | null;
  rangeEnd: string | null;
  sections: string;
} {
  return {
    rangeType: report.rangeType,
    rangeStart: report.rangeStart,
    rangeEnd: report.rangeEnd,
    sections: [...report.sections].sort().join(","),
  };
}
