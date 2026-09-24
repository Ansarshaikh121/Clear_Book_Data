/** In-tab worksheet amounts. Zero is allowed. Negatives are not. Nothing is stored. */

const AMOUNT = /^\d+(\.\d{1,2})?$/;

export function parseWorksheetRupees(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, "");
  if (!cleaned || cleaned.includes("-") || cleaned.includes("+") || !AMOUNT.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value > 1_000_000_000) return null;
  return value;
}

/** Same relationship the ledger uses: income − expenses − savings. */
export function monthlyRemaining(income: number, expenses: number, savings: number): number {
  return (Math.round(income * 100) - Math.round(expenses * 100) - Math.round(savings * 100)) / 100;
}

export function formatRupees(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}
