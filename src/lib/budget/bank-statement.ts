import { isPositiveCents, type Kind, type Transaction } from "./model.ts";

export type StatementRow = Omit<Transaction, "id"> & {
  sourceRow: number;
  review: boolean;
  reason?: string;
};
export type StatementParse = { rows: StatementRow[]; skipped: number; headers: string[] };

const aliases = {
  date: ["date", "transaction date", "txn date", "value date", "posting date"],
  description: ["description", "narration", "particulars", "details", "transaction details", "remarks"],
  debit: ["debit", "withdrawal", "withdrawals", "withdrawal amt", "debit amount", "dr"],
  credit: ["credit", "deposit", "deposits", "deposit amt", "credit amount", "cr"],
  amount: ["amount", "transaction amount", "txn amount"],
  type: ["type", "transaction type", "dr cr", "dr/cr"],
} as const;

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function column(headers: string[], names: readonly string[]) {
  return headers.findIndex((header) => names.includes(normalize(header)));
}

export function parseStatementCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = first.includes("\t") ? "\t" : first.includes(";") && !first.includes(",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((char === "\r" || char === "\n") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function parseStatementDate(raw: string): string | null {
  const value = raw.trim();
  const named = value.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{2,4})$/);
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const normalized = named && months.includes(named[2].toLowerCase())
    ? [named[1], months.indexOf(named[2].toLowerCase()) + 1, named[3]].join("/") : value;
  const match = normalized.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (!match) return null;
  const yearFirst = match[1].length === 4;
  let year = Number(yearFirst ? match[1] : match[3]);
  const month = Number(match[2]);
  const day = Number(yearFirst ? match[3] : match[1]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function money(raw: string): number | null {
  const cleaned = raw.trim().replace(/[₹$€£,\s]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "0" || cleaned === "0.00") return null;
  const negative = cleaned.startsWith("-") || /^\(.*\)$/.test(cleaned);
  const value = cleaned.replace(/[()]/g, "").replace(/^-/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [major, minor = ""] = value.split(".");
  const cents = Number(major) * 100 + Number((minor + "00").slice(0, 2));
  return isPositiveCents(cents) ? (negative ? -cents : cents) : null;
}

function classify(description: string, kind: Kind): string {
  if (kind === "income") return /refund|reversal|cashback/i.test(description) ? "refund" : /salary|payroll/i.test(description) ? "pay" : "other-in";
  if (/rent|housing/i.test(description)) return "housing";
  if (/grocery|supermarket|market/i.test(description)) return "groceries";
  if (/restaurant|cafe|food|swiggy|zomato/i.test(description)) return "dining";
  if (/uber|ola|fuel|petrol|metro|transport/i.test(description)) return "transport";
  if (/electric|mobile bill|internet|utility/i.test(description)) return "utilities";
  if (/hospital|doctor|pharma|medical/i.test(description)) return "health";
  if (/amazon|flipkart|shopping/i.test(description)) return "shopping";
  return "personal";
}

export function parseStatementRows(table: string[][]): StatementParse {
  const headerIndex = table.slice(0, 20).findIndex((row) => {
    const date = column(row, aliases.date);
    const desc = column(row, aliases.description);
    return date >= 0 && desc >= 0 && ((column(row, aliases.debit) >= 0 && column(row, aliases.credit) >= 0) || column(row, aliases.amount) >= 0);
  });
  if (headerIndex < 0) throw new Error("Could not find Date, Description, and Debit/Credit or Amount columns.");
  const headers = table[headerIndex];
  const dateCol = column(headers, aliases.date);
  const descCol = column(headers, aliases.description);
  const debitCol = column(headers, aliases.debit);
  const creditCol = column(headers, aliases.credit);
  const amountCol = column(headers, aliases.amount);
  const typeCol = column(headers, aliases.type);
  const rows: StatementRow[] = [];
  let skipped = 0;
  for (let index = headerIndex + 1; index < table.length; index++) {
    const cells = table[index];
    if (!cells.some((cell) => cell?.trim())) continue;
    const date = parseStatementDate(cells[dateCol] ?? "");
    const description = (cells[descCol] ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    let kind: Kind;
    let cents: number | null;
    if (debitCol >= 0 && creditCol >= 0) {
      const debit = money(cells[debitCol] ?? "");
      const credit = money(cells[creditCol] ?? "");
      if (debit && credit) { skipped++; continue; }
      if (debit) { kind = "expense"; cents = Math.abs(debit); }
      else if (credit) { kind = "income"; cents = Math.abs(credit); }
      else { skipped++; continue; }
    } else {
      const signed = money(cells[amountCol] ?? "");
      const type = normalize(cells[typeCol] ?? "");
      if (!signed || (!type && signed > 0)) { skipped++; continue; }
      kind = /^(dr|debit|withdrawal|expense)$/.test(type) || signed < 0 ? "expense" : "income";
      cents = Math.abs(signed);
    }
    if (!date || !description || !isPositiveCents(cents)) { skipped++; continue; }
    const review = /self transfer|own account|fund transfer|credit card payment|loan payment|transfer to self/i.test(description);
    rows.push({ sourceRow: index + 1, date, note: description, kind, amountCents: cents, categoryId: classify(description, kind), review, reason: review ? "Possible transfer or repayment" : undefined });
    if (rows.length > 500) throw new Error("Statement is too large. Please upload up to 500 transactions.");
  }
  if (!rows.length) throw new Error("No valid transactions found. Check the statement columns and dates.");
  return { rows, skipped, headers };
}

export function statementKey(tx: Pick<Transaction, "date" | "kind" | "amountCents" | "note">): string {
  return [tx.date, tx.kind, tx.amountCents, normalize(tx.note)].join("|");
}
