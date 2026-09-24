import assert from "node:assert/strict";
import test from "node:test";
import {
  AMOUNT_MESSAGE,
  comparePeriodWindows,
  comparisonNoteForRange,
  isPositiveCents,
  parseMajorAmount,
  periodBounds,
  spendingComparisonCopy,
  summarizeRange,
  transactionWindow,
  windowForMonth,
  type Transaction,
} from "./model.ts";

function tx(partial: Pick<Transaction, "id" | "kind" | "amountCents" | "date"> & Partial<Transaction>): Transaction {
  return {
    categoryId: partial.kind === "income" ? "pay" : partial.kind === "savings" ? "savings" : "groceries",
    note: "",
    ...partial,
  };
}

test("negative, zero, empty, and non-numeric amounts are rejected without becoming positive", () => {
  for (const raw of ["", " ", "0", "0.00", "-1", "-1.50", "-0", "abc", "Infinity", "-Infinity", "NaN", "1e2", "+10", "1.235", "₹1"]) {
    assert.equal(parseMajorAmount(raw), null, raw);
  }
  assert.equal(parseMajorAmount("-1"), null);
  assert.equal(isPositiveCents(-100), false);
  assert.equal(isPositiveCents(0), false);
  assert.equal(isPositiveCents(1.5), false);
  assert.equal(isPositiveCents(Number.NaN), false);
  assert.equal(isPositiveCents(Number.POSITIVE_INFINITY), false);
  assert.equal(parseMajorAmount("1250.50"), 125_050);
  assert.equal(parseMajorAmount("1,250.50"), 125_050);
  assert.equal(parseMajorAmount("10,000"), 1_000_000);
  assert.equal(parseMajorAmount("1.15"), 115);
  assert.equal(parseMajorAmount("0.01"), 1);
  assert.equal(AMOUNT_MESSAGE, "Enter an amount greater than zero.");
});

test("a refund stays a positive income record and is not a negative expense", () => {
  const refund = tx({ id: "ref-1", kind: "income", amountCents: 100, categoryId: "refund", date: "2026-09-04" });
  assert.equal(isPositiveCents(refund.amountCents), true);
  assert.equal(refund.kind, "income");
  assert.equal(refund.categoryId, "refund");
  assert.equal(parseMajorAmount("-1"), null);
});

test("the transaction window follows the financial month and labels a custom range", () => {
  const september = windowForMonth("2026-09", 1);
  assert.deepEqual(september, { from: "2026-09-01", to: "2026-09-30", custom: false });
  const afterSwitch = windowForMonth("2026-08", 1);
  assert.deepEqual(afterSwitch, { from: "2026-08-01", to: "2026-08-31", custom: false });
  assert.equal(transactionWindow("2026-08", 1, "2026-09-01", "2026-09-30").custom, true);
  assert.equal(transactionWindow("2026-08", 1, afterSwitch.from, afterSwitch.to).custom, false);
  assert.deepEqual(periodBounds("2026-09", 5), { start: "2026-09-05", end: "2026-10-04" });
  assert.deepEqual(windowForMonth("2026-08", 5), { from: "2026-08-05", to: "2026-09-04", custom: false });
});

test("totals use the displayed date range", () => {
  const rows = [
    tx({ id: "in", kind: "income", amountCents: 1_000_000, date: "2026-09-02" }),
    tx({ id: "aug", kind: "expense", amountCents: 50_000, date: "2026-08-15" }),
    tx({ id: "sep", kind: "expense", amountCents: 150_050, date: "2026-09-10" }),
    tx({ id: "save", kind: "savings", amountCents: 100_000, date: "2026-09-12" }),
  ];
  const month = windowForMonth("2026-09", 1);
  const summary = summarizeRange(rows, month.from, month.to);
  assert.equal(summary.income, 1_000_000);
  assert.equal(summary.expense, 150_050);
  assert.equal(summary.savings, 100_000);
  assert.equal(summary.remaining, 749_950);
  const custom = summarizeRange(rows, "2026-08-01", "2026-08-31");
  assert.equal(custom.expense, 50_000);
  assert.equal(custom.income, 0);
});

test("missing previous records are not compared as zero, and confirmed zero is not a percentage", () => {
  const currentOnly = [
    tx({ id: "groc", kind: "expense", amountCents: 150_050, date: "2026-09-10", categoryId: "groceries" }),
  ];
  const missing = comparePeriodWindows(currentOnly, "2026-09", 1, "2026-09-24");
  assert.equal(missing.previousRecords, 0);
  assert.equal(missing.currentEnd, "2026-09-24");
  assert.equal(missing.previousEnd, "2026-08-24");
  assert.equal(
    spendingComparisonCopy({
      previousRecords: missing.previousRecords,
      previousExpense: missing.previous.expense,
      currentExpense: missing.current.expense,
      currency: "INR",
    }),
    "Not enough data to compare",
  );
  assert.equal(
    comparisonNoteForRange(currentOnly, { start: "2026-09-01", end: "2026-09-30" }, 1, "INR", "2026-09-24"),
    "Not enough data to compare",
  );

  const confirmed = [
    tx({ id: "pay", kind: "income", amountCents: 1_000_000, date: "2026-08-03" }),
    tx({ id: "now", kind: "expense", amountCents: 150_050, date: "2026-09-10", categoryId: "groceries" }),
  ];
  const zeroSpend = comparePeriodWindows(confirmed, "2026-09", 1, "2026-09-30");
  assert.equal(zeroSpend.partial, false);
  assert.ok(zeroSpend.previousRecords > 0);
  assert.equal(zeroSpend.previous.expense, 0);
  assert.match(
    spendingComparisonCopy({
      previousRecords: zeroSpend.previousRecords,
      previousExpense: zeroSpend.previous.expense,
      currentExpense: zeroSpend.current.expense,
      currency: "INR",
    }),
    /confirmed zero spending/,
  );

  const both = [
    tx({ id: "old", kind: "expense", amountCents: 100_000, date: "2026-08-04", categoryId: "groceries" }),
    tx({ id: "new", kind: "expense", amountCents: 150_050, date: "2026-09-10", categoryId: "groceries" }),
  ];
  const compared = comparePeriodWindows(both, "2026-09", 1, "2026-09-24");
  assert.equal(compared.previous.expense, 100_000);
  assert.match(
    spendingComparisonCopy({
      previousRecords: compared.previousRecords,
      previousExpense: compared.previous.expense,
      currentExpense: compared.current.expense,
      currency: "INR",
    }),
    /\+50%/,
  );

  const latePrevious = [
    tx({ id: "late", kind: "expense", amountCents: 80_000, date: "2026-08-28", categoryId: "groceries" }),
    tx({ id: "early", kind: "expense", amountCents: 20_000, date: "2026-08-02", categoryId: "dining" }),
    tx({ id: "now", kind: "expense", amountCents: 20_000, date: "2026-09-02", categoryId: "dining" }),
  ];
  const elapsed = comparePeriodWindows(latePrevious, "2026-09", 1, "2026-09-10");
  assert.equal(elapsed.previous.expense, 20_000);
  assert.equal(elapsed.current.expense, 20_000);
});

test("account A sample math: remaining, goal progress, and a groceries overage", () => {
  const income = 1_000_000;
  const expense = 150_050;
  const saved = 100_000;
  const target = 500_000;
  const budget = 100_000;
  assert.equal(income - expense - saved, 749_950);
  assert.equal(Math.round((saved / target) * 100), 20);
  assert.equal(expense - budget, 50_050);
});
