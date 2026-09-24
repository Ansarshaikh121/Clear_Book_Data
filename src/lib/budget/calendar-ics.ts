import { categoryById, formatMoney, type CurrencyCode, type Transaction } from "./model.ts";

export type CalendarReminder = {
  id: string;
  label: string;
  categoryId: string;
  amountCents: number;
  dayOfMonth: number;
};

export type ExpenseSyncMode = "daily" | "individual";

export type CalendarExportOptions = {
  mode: ExpenseSyncMode;
  startDate: string;
  includeAmount: boolean;
  includeMerchant: boolean;
  includeCategory: boolean;
  includeNotes: boolean;
  includeReminders: boolean;
  reminderTime: string;
  reminderOffsetDays: 0 | 1 | 2;
  reminderFrequency: "monthly" | "weekly" | "yearly";
  timeZone: string;
  currency: CurrencyCode;
  origin: string;
  now?: Date;
};

export type CalendarDraft = {
  uid: string;
  title: string;
  description: string;
  date: string;
  allDay: boolean;
  kind: "daily" | "expense" | "reminder";
};

const PRODID = "-//Clearbook//Clearbook Calendar//EN";

export function defaultCalendarPrefs(now = new Date()): CalendarExportOptions {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return {
    mode: "daily",
    startDate,
    includeAmount: false,
    includeMerchant: false,
    includeCategory: false,
    includeNotes: false,
    includeReminders: true,
    reminderTime: "09:00",
    reminderOffsetDays: 1,
    reminderFrequency: "monthly",
    timeZone,
    currency: "INR",
    origin: "",
  };
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\n|\r/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function fold(line: string): string {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = "";
  let currentLen = 0;
  const firstLimit = 75;
  for (const ch of line) {
    const len = encoder.encode(ch).length;
    const limit = chunks.length === 0 ? firstLimit : 74;
    if (current && currentLen + len > limit) {
      chunks.push(current);
      current = ch;
      currentLen = len;
    } else {
      current += ch;
      currentLen += len;
    }
  }
  if (current) chunks.push(current);
  return chunks.map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`)).join("\r\n");
}

function stamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function dateStamp(iso: string): string {
  return iso.replace(/-/g, "");
}

function nextDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function zonedLocalToUtc(isoDate: string, hhmm: string, timeZone: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(utc));
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour") % 24, read("minute"), read("second"));
    utc = Date.UTC(year, month - 1, day, hour, minute, 0) - (asUtc - utc);
  }
  return new Date(utc);
}

function money(cents: number, currency: CurrencyCode, enabled: boolean): string | null {
  if (!enabled) return null;
  return formatMoney(cents, currency);
}

function isExpense(tx: Transaction): boolean {
  return tx.kind === "expense" && Number.isFinite(tx.amountCents) && tx.amountCents > 0;
}

function isRefund(tx: Transaction): boolean {
  return tx.kind === "income" && tx.categoryId === "refund" && tx.amountCents > 0;
}

function linkFor(origin: string, path: string): string | null {
  if (!origin) return null;
  try {
    return new URL(path, origin).toString();
  } catch {
    return null;
  }
}

export function buildCalendarDrafts(
  transactions: Transaction[],
  recurring: CalendarReminder[],
  options: CalendarExportOptions,
): CalendarDraft[] {
  const expenses = transactions.filter((tx) => isExpense(tx) && tx.date >= options.startDate);
  const drafts: CalendarDraft[] = [];

  if (options.mode === "daily") {
    const byDate = new Map<string, Transaction[]>();
    for (const tx of expenses) {
      const list = byDate.get(tx.date) ?? [];
      list.push(tx);
      byDate.set(tx.date, list);
    }
    for (const date of [...byDate.keys()].sort()) {
      const rows = byDate.get(date) ?? [];
      const total = rows.reduce((sum, tx) => sum + tx.amountCents, 0);
      const amount = money(total, options.currency, options.includeAmount);
      const categories = new Map<string, number>();
      for (const tx of rows) categories.set(tx.categoryId, (categories.get(tx.categoryId) ?? 0) + tx.amountCents);
      const lines = [
        `Recorded expenses: ${rows.length}`,
        amount ? `Total: ${amount}` : "Amounts are hidden.",
      ];
      if (options.includeCategory) {
        for (const [categoryId, cents] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
          const label = categoryById(categoryId)?.label ?? "Other";
          const value = money(cents, options.currency, options.includeAmount);
          lines.push(value ? `${label}: ${value}` : label);
        }
      }
      const refunds = transactions.filter((tx) => isRefund(tx) && tx.date === date);
      if (refunds.length > 0) {
        const refundTotal = refunds.reduce((sum, tx) => sum + tx.amountCents, 0);
        const value = money(refundTotal, options.currency, options.includeAmount);
        lines.push(value ? `Refunds recorded, not counted as expenses: ${value}` : `Refunds recorded, not counted as expenses: ${refunds.length}`);
      }
      const href = linkFor(options.origin, `/transactions?day=${date}`);
      if (href) lines.push(`Open in Clearbook: ${href}`);
      lines.push("Clearbook is the source of truth. Editing this event in Google Calendar does not change the ledger.");
      drafts.push({
        uid: `clearbook-daily-${date}@clearbook`,
        title: amount ? `Daily Spending · ${amount}` : "Daily Spending",
        description: lines.join("\n"),
        date,
        allDay: true,
        kind: "daily",
      });
    }
  } else {
    for (const tx of expenses) {
      const category = categoryById(tx.categoryId)?.label ?? "Expense";
      const label = options.includeMerchant && tx.merchant?.trim() ? tx.merchant.trim() : options.includeCategory ? category : "Expense";
      const amount = money(tx.amountCents, options.currency, options.includeAmount);
      const lines = ["Recorded expense. Counted once."];
      if (options.includeCategory) lines.push(`Category: ${category}`);
      if (options.includeMerchant && tx.merchant?.trim()) lines.push(`Merchant: ${tx.merchant.trim()}`);
      if (options.includeNotes && tx.note.trim()) lines.push(`Note: ${tx.note.trim()}`);
      const href = linkFor(options.origin, `/transactions?q=${encodeURIComponent(tx.id)}`);
      if (href) lines.push(`Open in Clearbook: ${href}`);
      drafts.push({
        uid: `clearbook-tx-${tx.id}@clearbook`,
        title: amount ? `${label} · ${amount}` : label,
        description: lines.join("\n"),
        date: tx.date,
        allDay: true,
        kind: "expense",
      });
    }
  }

  if (options.includeReminders) {
    for (const item of recurring) {
      const day = Math.min(28, Math.max(1, item.dayOfMonth));
      const amount = money(item.amountCents, options.currency, options.includeAmount);
      const category = options.includeCategory ? categoryById(item.categoryId)?.label : null;
      const titleBase = options.includeMerchant || options.includeCategory ? item.label : "Scheduled payment";
      const lines = [
        "Scheduled payment. This is not a recorded expense.",
        "Confirm the payment in Clearbook before it is added to the ledger.",
        "Edits in Google Calendar do not update Clearbook and may be overwritten if you export again.",
      ];
      if (category) lines.push(`Category: ${category}`);
      if (amount) lines.push(`Expected amount: ${amount}`);
      drafts.push({
        uid: `clearbook-reminder-${item.id}@clearbook`,
        title: amount ? `${titleBase} · ${amount}` : titleBase,
        description: lines.join("\n"),
        date: reminderAnchor(options.startDate, day),
        allDay: false,
        kind: "reminder",
      });
    }
  }

  return drafts;
}

function reminderAnchor(startDate: string, day: number): string {
  const [year, month] = startDate.split("-").map(Number);
  const startDay = Number(startDate.slice(8, 10));
  const monthIndex = startDay > day ? month : month - 1;
  const date = new Date(year, monthIndex, day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ruleFor(item: CalendarReminder, anchor: string, frequency: CalendarExportOptions["reminderFrequency"]): string {
  const day = Math.min(28, Math.max(1, item.dayOfMonth));
  if (frequency === "weekly") {
    const weekday = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][new Date(anchor + "T00:00:00").getDay()];
    return `RRULE:FREQ=WEEKLY;BYDAY=${weekday}`;
  }
  if (frequency === "yearly") {
    const month = Number(anchor.slice(5, 7));
    return `RRULE:FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${day}`;
  }
  return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${day}`;
}

function paidDates(item: CalendarReminder, transactions: Transaction[], from: string): string[] {
  const day = Math.min(28, Math.max(1, item.dayOfMonth));
  const label = item.label.trim().toLowerCase();
  return transactions
    .filter((tx) => {
      if (!isExpense(tx) || tx.date < from || Number(tx.date.slice(8, 10)) !== day) return false;
      if (tx.categoryId !== item.categoryId) return false;
      if (Math.abs(tx.amountCents - item.amountCents) > 1000) return false;
      const text = `${tx.merchant ?? ""} ${tx.note}`.trim().toLowerCase();
      if (!label || !text) return false;
      return text.includes(label) || label.includes(text);
    })
    .map((tx) => tx.date);
}

export function buildCalendarIcs(
  transactions: Transaction[],
  recurring: CalendarReminder[],
  options: CalendarExportOptions,
): { events: CalendarDraft[]; ics: string } {
  const events = buildCalendarDrafts(transactions, recurring, options);
  const now = stamp(options.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape("Clearbook")}`,
    `X-WR-TIMEZONE:${icsEscape(options.timeZone)}`,
    "X-WR-CALDESC:Export only. This file does not stay synced.",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`SUMMARY:${icsEscape(event.title)}`);
    lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
    lines.push("TRANSP:TRANSPARENT");
    lines.push("CLASS:PRIVATE");
    lines.push("STATUS:CONFIRMED");
    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(event.date)}`);
      lines.push(`DTEND;VALUE=DATE:${dateStamp(nextDate(event.date))}`);
    } else {
      const start = zonedLocalToUtc(event.date, options.reminderTime, options.timeZone);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      lines.push(`DTSTART:${stamp(start)}`);
      lines.push(`DTEND:${stamp(end)}`);
      const item = recurring.find((row) => event.uid === `clearbook-reminder-${row.id}@clearbook`);
      if (item) {
        lines.push(ruleFor(item, event.date, options.reminderFrequency));
        if (options.reminderFrequency === "monthly") {
          for (const paid of paidDates(item, transactions, options.startDate)) {
            const when = zonedLocalToUtc(paid, options.reminderTime, options.timeZone);
            lines.push(`EXDATE:${stamp(when)}`);
          }
        }
      }
      lines.push("BEGIN:VALARM");
      lines.push(options.reminderOffsetDays === 0 ? "TRIGGER:PT0S" : `TRIGGER:-P${options.reminderOffsetDays}D`);
      lines.push("ACTION:DISPLAY");
      lines.push("DESCRIPTION:Scheduled payment. Confirm it in Clearbook. This is not a recorded expense.");
      lines.push("END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const ics = lines.map(fold).join("\r\n") + "\r\n";
  return { events, ics };
}
