import {
  addDays,
  categoryById,
  comparePeriodWindows,
  inRange,
  type PeriodWindows,
  type SpendSlice,
  type Transaction,
} from "@/lib/budget/model";

export type PeriodCompare = PeriodWindows;

export function comparePeriods(transactions: Transaction[], month: string, startsOn: number, today?: string): PeriodCompare {
  return comparePeriodWindows(transactions, month, startsOn, today);
}

export type CategoryDelta = {
  categoryId: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  percent: number | null;
};

export function categoryDeltas(compare: PeriodCompare): CategoryDelta[] {
  const ids = new Set<string>([
    ...compare.current.spentByCategory.map((slice) => slice.categoryId),
    ...compare.previous.spentByCategory.map((slice) => slice.categoryId),
  ]);
  const currentMap = new Map(compare.current.spentByCategory.map((slice) => [slice.categoryId, slice.cents]));
  const previousMap = new Map(compare.previous.spentByCategory.map((slice) => [slice.categoryId, slice.cents]));
  return [...ids]
    .map((categoryId) => {
      const current = currentMap.get(categoryId) ?? 0;
      const previous = previousMap.get(categoryId) ?? 0;
      return {
        categoryId,
        label: categoryById(categoryId)?.label ?? "Other",
        current,
        previous,
        delta: current - previous,
        percent: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.label.localeCompare(b.label));
}

export type RecurringSuggestion = {
  id: string;
  label: string;
  categoryId: string;
  amountCents: number;
  dayOfMonth: number;
  count: number;
};

export function suggestRecurring(transactions: Transaction[], confirmedIds: string[]): RecurringSuggestion[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.kind !== "expense" || tx.amountCents <= 0) continue;
    const label = (tx.merchant || tx.note || "").trim().toLowerCase();
    if (label.length < 3) continue;
    const bucket = Math.round(tx.amountCents / 1000) * 1000;
    const id = `${tx.categoryId}|${label}|${bucket}`;
    const list = groups.get(id) ?? [];
    list.push(tx);
    groups.set(id, list);
  }
  const suggestions: RecurringSuggestion[] = [];
  for (const [id, list] of groups) {
    if (confirmedIds.includes(id)) continue;
    const months = new Set(list.map((tx) => tx.date.slice(0, 7)));
    if (list.length < 2 || months.size < 2) continue;
    const latest = [...list].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    suggestions.push({
      id,
      label: latest.merchant || latest.note,
      categoryId: latest.categoryId,
      amountCents: latest.amountCents,
      dayOfMonth: Number(latest.date.slice(8, 10)),
      count: list.length,
    });
  }
  return suggestions.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function groupSmallSlices(slices: SpendSlice[], max = 5): { shown: SpendSlice[]; hidden: SpendSlice[] } {
  if (slices.length <= max + 1) return { shown: slices, hidden: [] };
  const shown = slices.slice(0, max);
  const hidden = slices.slice(max);
  const cents = hidden.reduce((sum, slice) => sum + slice.cents, 0);
  return { shown: [...shown, { categoryId: "other", label: "Other", cents }], hidden };
}

export type ReviewFact =
  | { id: "totals"; income: number; expense: number; remaining: number }
  | { id: "top"; label: string; cents: number; pct: number }
  | { id: "savings"; cents: number }
  | {
      id: "compare";
      delta: number;
      percent: number | null;
      enough: boolean;
      confirmedZero: boolean;
      previousRecords: number;
      previousExpense: number;
      currentExpense: number;
    };

export function monthInReview(compare: PeriodCompare, savedThisPeriod: number): ReviewFact[] {
  const { current, previous } = compare;
  const top = current.spentByCategory[0];
  const facts: ReviewFact[] = [
    { id: "totals", income: current.income, expense: current.expense, remaining: current.remaining },
  ];
  if (top && current.expense > 0) {
    facts.push({
      id: "top",
      label: top.label,
      cents: top.cents,
      pct: Math.round((top.cents / current.expense) * 100),
    });
  } else {
    facts.push({ id: "top", label: "", cents: 0, pct: 0 });
  }
  facts.push({ id: "savings", cents: savedThisPeriod });
  const confirmedZero = compare.previousRecords > 0 && previous.expense <= 0;
  const enough = compare.previousRecords > 0 && previous.expense > 0;
  facts.push({
    id: "compare",
    delta: enough ? current.expense - previous.expense : 0,
    percent: enough ? Math.round(((current.expense - previous.expense) / previous.expense) * 100) : null,
    enough,
    confirmedZero,
    previousRecords: compare.previousRecords,
    previousExpense: previous.expense,
    currentExpense: current.expense,
  });
  return facts;
}

export function unusualNote(deltas: CategoryDelta[]): string | null {
  const hit = deltas.find((row) => row.previous > 0 && row.delta > 0 && row.percent != null && row.percent >= 50 && row.delta >= 50_000);
  if (!hit || hit.percent == null) return null;
  return `${hit.label} is ${hit.percent}% above the same dates last period. That is based only on recorded expenses.`;
}

export function upcomingInPeriod(
  recurring: { id: string; label: string; amountCents: number; dayOfMonth: number; categoryId: string }[],
  transactions: Transaction[],
  start: string,
  end: string,
): { id: string; label: string; amountCents: number; date: string; categoryId: string }[] {
  const items = [];
  for (const item of recurring) {
    let cursor = start;
    while (cursor <= end) {
      const day = Number(cursor.slice(8, 10));
      if (day === Math.min(item.dayOfMonth, 28)) {
        const matched = transactions.some(
          (tx) =>
            tx.kind === "expense" &&
            tx.date === cursor &&
            tx.categoryId === item.categoryId &&
            Math.abs(tx.amountCents - item.amountCents) <= 1000,
        );
        if (!matched) {
          items.push({
            id: `${item.id}:${cursor}`,
            label: item.label,
            amountCents: item.amountCents,
            date: cursor,
            categoryId: item.categoryId,
          });
        }
      }
      cursor = addDays(cursor, 1);
    }
  }
  return items;
}

export function txInRange(transactions: Transaction[], start: string, end: string): Transaction[] {
  return transactions.filter((tx) => inRange(tx.date, start, end));
}
