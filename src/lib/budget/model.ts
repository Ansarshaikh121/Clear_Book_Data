export type Kind = "income" | "expense" | "savings";

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP";

export type Transaction = {
  id: string;
  kind: Kind;
  amountCents: number;
  categoryId: string;
  note: string;
  date: string;
  merchant?: string;
  goalId?: string;
};

export type GoalIcon = "shield" | "home" | "plane" | "gift";

export type Goal = {
  id: string;
  name: string;
  targetCents: number;
  icon: GoalIcon;
};

export type Category = {
  id: string;
  label: string;
  kind: Kind;
};

export const CATEGORIES: Category[] = [
  { id: "pay", label: "Pay", kind: "income" },
  { id: "side", label: "Side work", kind: "income" },
  { id: "refund", label: "Refund", kind: "income" },
  { id: "other-in", label: "Other income", kind: "income" },
  { id: "housing", label: "Housing", kind: "expense" },
  { id: "groceries", label: "Groceries", kind: "expense" },
  { id: "dining", label: "Dining", kind: "expense" },
  { id: "transport", label: "Transport", kind: "expense" },
  { id: "utilities", label: "Utilities", kind: "expense" },
  { id: "health", label: "Health", kind: "expense" },
  { id: "shopping", label: "Shopping", kind: "expense" },
  { id: "personal", label: "Personal", kind: "expense" },
  { id: "savings", label: "Savings", kind: "savings" },
];

export const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: "INR", label: "INR ₹" },
  { code: "USD", label: "USD $" },
  { code: "EUR", label: "EUR €" },
  { code: "GBP", label: "GBP £" },
];

export const CATEGORY_COLOR: Record<string, string> = {
  housing: "var(--color-cat-housing)",
  groceries: "var(--color-cat-groceries)",
  dining: "var(--color-cat-dining)",
  transport: "var(--color-cat-transport)",
  utilities: "var(--color-cat-utilities)",
  health: "var(--color-cat-health)",
  shopping: "var(--color-cat-shopping)",
  personal: "var(--color-cat-personal)",
};

export function categoryColor(categoryId: string): string {
  return CATEGORY_COLOR[categoryId] ?? "var(--color-chart-3)";
}

export const DEFAULT_GOAL: Goal = {
  id: "goal-default",
  name: "Emergency fund",
  targetCents: 10_000_000,
  icon: "shield",
};

export function categoriesFor(kind: Kind): Category[] {
  return CATEGORIES.filter((category) => category.kind === kind);
}

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

export function isCategoryForKind(categoryId: string, kind: Kind): boolean {
  return categoryById(categoryId)?.kind === kind;
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const next = new Date(year, monthIndex - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
    new Date(year, monthIndex - 1, 1),
  );
}

export function formatDay(iso: string): string {
  const [year, monthIndex, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(year, monthIndex - 1, day));
}

export function defaultDateForMonth(month: string, now = new Date()): string {
  const current = currentMonthKey(now);
  if (month === current) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  return `${month}-01`;
}

const CURRENCY_LOCALE: Record<CurrencyCode, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

export function formatMoney(cents: number, currency: CurrencyCode): string {
  const value = cents / 100;
  const fmt = new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  if (Number.isInteger(value)) {
    return fmt
      .formatToParts(value)
      .filter((part) => part.type !== "decimal" && part.type !== "fraction")
      .map((part) => part.value)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }
  return fmt.format(value);
}

export const AMOUNT_MESSAGE = "Enter an amount greater than zero.";

/** Integer cents only. Rejects negatives, zero, blanks, and non-numeric text. Never takes an absolute value. */
export function isPositiveCents(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isInteger(amount) && Number.isFinite(amount) && amount > 0 && amount <= 2_147_483_647;
}

export function parseMajorAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/,/g, "");
  if (cleaned.includes("-") || cleaned.includes("+") || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!isPositiveCents(cents)) return null;
  return cents;
}

export function centsToInput(cents: number): string {
  const value = cents / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export type SpendSlice = {
  categoryId: string;
  label: string;
  cents: number;
};

export type MonthSummary = {
  income: number;
  expense: number;
  savings: number;
  remaining: number;
  spentByCategory: SpendSlice[];
};

export function summarizeMonth(transactions: Transaction[], month: string): MonthSummary {
  let income = 0;
  let expense = 0;
  let savings = 0;
  const byCategory = new Map<string, number>();

  for (const tx of transactions) {
    if (!tx.date.startsWith(month)) continue;
    if (!Number.isFinite(tx.amountCents) || tx.amountCents <= 0) continue;
    if (tx.kind === "income") income += tx.amountCents;
    else if (tx.kind === "expense") {
      expense += tx.amountCents;
      byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0) + tx.amountCents);
    } else if (tx.kind === "savings") savings += tx.amountCents;
  }

  const spentByCategory = [...byCategory.entries()]
    .map(([categoryId, cents]) => ({
      categoryId,
      label: categoryById(categoryId)?.label ?? "Other",
      cents,
    }))
    .sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));

  return {
    income,
    expense,
    savings,
    remaining: income - expense - savings,
    spentByCategory,
  };
}

export function daysInMonth(month: string): number {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex, 0).getDate();
}

export type Allocation = {
  expensePct: number;
  savingsPct: number;
  remainingPct: number;
  over: boolean;
};

/** How this month's income is split. Null when there is no income to split. */
export function allocationOf(summary: MonthSummary): Allocation | null {
  if (summary.income <= 0) return null;
  const over = summary.remaining < 0;
  const base = over ? summary.expense + summary.savings : summary.income;
  if (base <= 0) return null;
  let expensePct = Math.round((summary.expense / base) * 100);
  let savingsPct = Math.round((summary.savings / base) * 100);
  if (expensePct + savingsPct > 100) {
    const extra = expensePct + savingsPct - 100;
    if (expensePct >= savingsPct) expensePct -= extra;
    else savingsPct -= extra;
  }
  const remainingPct = over ? 0 : Math.max(0, 100 - expensePct - savingsPct);
  return { expensePct, savingsPct, remainingPct, over };
}

export function formatCompactMoney(cents: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

export function totalSavings(transactions: Transaction[], goalId?: string): number {
  return transactions.reduce((sum, tx) => {
    if (tx.kind !== "savings" || !Number.isFinite(tx.amountCents) || tx.amountCents <= 0) return sum;
    if (goalId && (tx.goalId ?? "goal-default") !== goalId) return sum;
    return sum + tx.amountCents;
  }, 0);
}

export function parseIso(iso: string): Date {
  const [year, monthIndex, day] = iso.split("-").map(Number);
  return new Date(year, monthIndex - 1, day);
}

export function formatIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return formatIso(date);
}

export function daySpan(start: string, end: string): number {
  return Math.round((parseIso(end).getTime() - parseIso(start).getTime()) / 86_400_000) + 1;
}

/** Financial period anchored on `month`, starting on `startsOn` (1–28). */
export function periodBounds(month: string, startsOn = 1): { start: string; end: string } {
  const day = Math.min(28, Math.max(1, Math.round(startsOn) || 1));
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(year, monthIndex - 1, day);
  const end = new Date(year, monthIndex, day - 1);
  return { start: formatIso(start), end: formatIso(end) };
}

export function periodLabel(month: string, startsOn = 1): string {
  if (startsOn <= 1) return monthLabel(month);
  const { start, end } = periodBounds(month, startsOn);
  const a = parseIso(start);
  const b = parseIso(end);
  const fmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });
  const year = b.getFullYear();
  return `${fmt.format(a)} – ${fmt.format(b)} ${year}`;
}

export function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function summarizeRange(transactions: Transaction[], start: string, end: string): MonthSummary {
  let income = 0;
  let expense = 0;
  let savings = 0;
  const byCategory = new Map<string, number>();

  for (const tx of transactions) {
    if (!inRange(tx.date, start, end)) continue;
    if (!Number.isFinite(tx.amountCents) || tx.amountCents <= 0) continue;
    if (tx.kind === "income") income += tx.amountCents;
    else if (tx.kind === "expense") {
      expense += tx.amountCents;
      byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0) + tx.amountCents);
    } else if (tx.kind === "savings") savings += tx.amountCents;
  }

  const spentByCategory = [...byCategory.entries()]
    .map(([categoryId, cents]) => ({
      categoryId,
      label: categoryById(categoryId)?.label ?? "Other",
      cents,
    }))
    .sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));

  return { income, expense, savings, remaining: income - expense - savings, spentByCategory };
}

export type PeriodWindows = {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
  partial: boolean;
  current: MonthSummary;
  previous: MonthSummary;
  currentRecords: number;
  previousRecords: number;
};

function countedRecords(transactions: Transaction[], start: string, end: string): number {
  return transactions.filter((tx) => inRange(tx.date, start, end) && isPositiveCents(tx.amountCents)).length;
}

/** Financial month versus the previous one. An open month uses the same number of elapsed days on both sides. */
export function comparePeriodWindows(transactions: Transaction[], month: string, startsOn: number, today = formatIso(new Date())): PeriodWindows {
  const current = periodBounds(month, startsOn);
  const previous = periodBounds(shiftMonth(month, -1), startsOn);
  const partial = today >= current.start && today < current.end;
  const currentEnd = partial ? today : current.end;
  const length = daySpan(current.start, currentEnd);
  let previousEnd = addDays(previous.start, length - 1);
  if (previousEnd > previous.end) previousEnd = previous.end;
  return {
    currentStart: current.start,
    currentEnd,
    previousStart: previous.start,
    previousEnd,
    partial,
    current: summarizeRange(transactions, current.start, currentEnd),
    previous: summarizeRange(transactions, previous.start, previousEnd),
    currentRecords: countedRecords(transactions, current.start, currentEnd),
    previousRecords: countedRecords(transactions, previous.start, previousEnd),
  };
}

export function spendingComparisonCopy(input: {
  previousRecords: number;
  previousExpense: number;
  currentExpense: number;
  currency: CurrencyCode;
  windowLabel?: string;
}): string {
  if (input.previousRecords <= 0) return "Not enough data to compare";
  if (input.previousExpense <= 0) {
    return "The earlier period has records and confirmed zero spending. No percentage is shown.";
  }
  const delta = input.currentExpense - input.previousExpense;
  const percent = Math.round((delta / input.previousExpense) * 100);
  const direction = delta >= 0 ? "higher" : "lower";
  const where = input.windowLabel ? ` for ${input.windowLabel}` : "";
  return `Expenses${where} are ${formatMoney(Math.abs(delta), input.currency)} ${direction} (${percent >= 0 ? "+" : ""}${percent}%).`;
}

export function comparisonNoteForRange(
  transactions: Transaction[],
  range: { start: string | null; end: string | null },
  monthStartsOn: number,
  currency: CurrencyCode,
  today = formatIso(new Date()),
): string {
  if (!range.start || !range.end) return "All-time totals are not compared with a previous period.";
  const month = range.start.slice(0, 7);
  const bounds = periodBounds(month, monthStartsOn);
  if (range.start === bounds.start && range.end === bounds.end) {
    const compare = comparePeriodWindows(transactions, month, monthStartsOn, today);
    return spendingComparisonCopy({
      previousRecords: compare.previousRecords,
      previousExpense: compare.previous.expense,
      currentExpense: compare.current.expense,
      currency,
    });
  }
  if (range.start === bounds.start && range.end < bounds.end && range.end >= bounds.start) {
    const compare = comparePeriodWindows(transactions, month, monthStartsOn, range.end);
    return spendingComparisonCopy({
      previousRecords: compare.previousRecords,
      previousExpense: compare.previous.expense,
      currentExpense: compare.current.expense,
      currency,
    });
  }
  const length = daySpan(range.start, range.end);
  const previousEnd = addDays(range.start, -1);
  const previousStart = addDays(previousEnd, 1 - length);
  const previousRecords = countedRecords(transactions, previousStart, previousEnd);
  return spendingComparisonCopy({
    previousRecords,
    previousExpense: summarizeRange(transactions, previousStart, previousEnd).expense,
    currentExpense: summarizeRange(transactions, range.start, range.end).expense,
    currency,
  });
}

export type TransactionWindow = { from: string; to: string; custom: boolean };

/** The list follows the financial month. A hand-edited pair is a custom range until the month changes. */
export function transactionWindow(month: string, startsOn: number, from: string, to: string): TransactionWindow {
  const bounds = periodBounds(month, startsOn);
  return { from, to, custom: from !== bounds.start || to !== bounds.end };
}

export function windowForMonth(month: string, startsOn: number): TransactionWindow {
  const bounds = periodBounds(month, startsOn);
  return { from: bounds.start, to: bounds.end, custom: false };
}

export type DaySpend = {
  date: string;
  day: number;
  cents: number;
  count: number;
};

export function dailyExpensesInRange(transactions: Transaction[], start: string, end: string): DaySpend[] {
  const totals = new Map<string, { cents: number; count: number }>();
  for (const tx of transactions) {
    if (tx.kind !== "expense" || !inRange(tx.date, start, end)) continue;
    if (!Number.isFinite(tx.amountCents) || tx.amountCents <= 0) continue;
    const current = totals.get(tx.date) ?? { cents: 0, count: 0 };
    totals.set(tx.date, { cents: current.cents + tx.amountCents, count: current.count + 1 });
  }
  const points: DaySpend[] = [];
  const count = daySpan(start, end);
  for (let index = 0; index < count; index += 1) {
    const date = addDays(start, index);
    const row = totals.get(date);
    points.push({ date, day: parseIso(date).getDate(), cents: row?.cents ?? 0, count: row?.count ?? 0 });
  }
  return points;
}

export function dailyExpenses(transactions: Transaction[], month: string): DaySpend[] {
  const { start, end } = periodBounds(month, 1);
  return dailyExpensesInRange(transactions, start, end);
}

function isoFrom(year: number, monthIndex: number, day: number): string {
  const date = new Date(year, monthIndex, day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function rupees(major: number): number {
  return Math.round(major * 100);
}

export function buildSeed(now = new Date()): Transaction[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const on = (offset: number, day: number) => isoFrom(year, month + offset, day);

  return [
    { id: "seed-pay", kind: "income", amountCents: rupees(82000), categoryId: "pay", note: "Monthly pay", date: on(0, 1) },
    { id: "seed-side", kind: "income", amountCents: rupees(6400), categoryId: "side", note: "Design invoice", date: on(0, 12) },
    { id: "seed-rent", kind: "expense", amountCents: rupees(28000), categoryId: "housing", note: "Rent", date: on(0, 2) },
    { id: "seed-market", kind: "expense", amountCents: rupees(1860), categoryId: "groceries", note: "Market run", date: on(0, 4) },
    { id: "seed-groceries", kind: "expense", amountCents: rupees(2340), categoryId: "groceries", note: "Groceries", date: on(0, 16) },
    { id: "seed-metro", kind: "expense", amountCents: rupees(640), categoryId: "transport", note: "Metro pass", date: on(0, 7) },
    { id: "seed-rides", kind: "expense", amountCents: rupees(420), categoryId: "transport", note: "Rides", date: on(0, 22) },
    { id: "seed-dinner", kind: "expense", amountCents: rupees(1240), categoryId: "dining", note: "Dinner out", date: on(0, 9) },
    { id: "seed-lunch", kind: "expense", amountCents: rupees(760), categoryId: "dining", note: "Lunch", date: on(0, 20) },
    { id: "seed-power", kind: "expense", amountCents: rupees(2180), categoryId: "utilities", note: "Electricity", date: on(0, 11) },
    { id: "seed-pharmacy", kind: "expense", amountCents: rupees(890), categoryId: "health", note: "Pharmacy", date: on(0, 14) },
    { id: "seed-house", kind: "expense", amountCents: rupees(3200), categoryId: "shopping", note: "Household", date: on(0, 18) },
    { id: "seed-save-0", kind: "savings", amountCents: rupees(8000), categoryId: "savings", note: "Emergency fund", date: on(0, 5), goalId: "goal-default" },
    { id: "seed-save-1", kind: "savings", amountCents: rupees(8000), categoryId: "savings", note: "Emergency fund", date: on(-1, 3), goalId: "goal-default" },
    { id: "seed-save-2", kind: "savings", amountCents: rupees(8000), categoryId: "savings", note: "Emergency fund", date: on(-2, 3), goalId: "goal-default" },
    { id: "seed-save-3", kind: "savings", amountCents: rupees(8000), categoryId: "savings", note: "Emergency fund", date: on(-3, 3), goalId: "goal-default" },
  ];
}
