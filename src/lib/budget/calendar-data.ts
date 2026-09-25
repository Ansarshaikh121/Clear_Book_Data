export type CalendarCell = { date: string; number: number; count: number; level: number };

/** One calendar month; every recorded transaction counts, regardless of kind. */
export function calendarDays(month: string, transactions: readonly { date: string }[]): (CalendarCell | null)[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const padding = new Date(year, monthNumber - 1, 1).getDay();
  const counts = new Map<string, number>();
  for (const tx of transactions) if (tx.date.startsWith(month + "-")) counts.set(tx.date, (counts.get(tx.date) ?? 0) + 1);
  const max = Math.max(0, ...counts.values());
  const cells: (CalendarCell | null)[] = Array.from({ length: padding }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const count = counts.get(date) ?? 0;
    cells.push({ date, number: day, count, level: count ? Math.max(1, Math.ceil(count / max * 4)) : 0 });
  }
  return cells;
}
