import assert from "node:assert/strict";
import test from "node:test";
import { buildExportReport, exportActivity, isRefund, resolveRange, type ExportSourceTx } from "./export-model.ts";
import type { Goal } from "./model.ts";

const goal: Goal = { id: "goal-home", name: "House fund", targetCents: 100_000, icon: "home" };

function tx(partial: ExportSourceTx): ExportSourceTx {
  return partial;
}

test("refunds are not income and splits are not double-counted", () => {
  const transactions: ExportSourceTx[] = [
    tx({ id: "pay-1", kind: "income", amountCents: 50_000, categoryId: "pay", note: "Pay", date: "2026-09-01" }),
    tx({
      id: "shop-1",
      kind: "expense",
      amountCents: 10_000,
      categoryId: "shopping",
      note: "Market",
      merchant: "A Market",
      date: "2026-09-02",
      spendingClass: "everyday",
      splits: [
        { categoryId: "groceries", amountCents: 6_000 },
        { categoryId: "dining", amountCents: 4_000 },
      ],
    }),
    tx({
      id: "rent-1",
      kind: "expense",
      amountCents: 20_000,
      categoryId: "housing",
      note: "Rent",
      date: "2026-09-03",
      spendingClass: "fixed",
      collectionName: "September house",
      collectionKind: "project",
    }),
    tx({
      id: "ref-1",
      kind: "income",
      amountCents: 1_500,
      categoryId: "refund",
      note: "Returned rice",
      date: "2026-09-04",
      refundOf: "shop-1",
    }),
    tx({ id: "save-1", kind: "savings", amountCents: 5_000, categoryId: "savings", note: "House", date: "2026-09-05", goalId: "goal-home" }),
    tx({ id: "old-1", kind: "expense", amountCents: 9_999, categoryId: "dining", note: "Brother secret lunch", date: "2026-01-02" }),
  ];
  const range = resolveRange({ range: "custom", start: "2026-09-01", end: "2026-09-30" }, 1);
  const report = buildExportReport({
    transactions,
    goals: [goal],
    budgets: [{ categoryId: "housing", limitCents: 25_000 }],
    recurring: [{ id: "rent-bill", label: "Rent", categoryId: "housing", amountCents: 20_000, dayOfMonth: 3 }],
    currency: "INR",
    range,
    sections: ["summary", "transactions", "goals", "budgets", "scheduled", "collections", "refunds"],
    preparedFor: "Ansar",
  });

  assert.equal(report.summary.incomeCents, 50_000);
  assert.equal(report.summary.grossExpenseCents, 30_000);
  assert.equal(report.summary.refundCents, 1_500);
  assert.equal(report.summary.netExpenseCents, 28_500);
  assert.equal(report.summary.savedCents, 5_000);
  assert.equal(report.summary.remainingCents, 50_000 - 28_500 - 5_000);
  assert.equal(report.summary.transactionCount, 5);
  assert.equal(report.transactions.some((row) => row.notes === "Brother secret lunch"), false);
  const splitRows = report.transactions.filter((row) => row.title === "Market");
  assert.equal(splitRows.length, 2);
  assert.equal(splitRows.reduce((sum, row) => sum + row.amountCents, 0), -10_000);
  assert.equal(report.summary.categories.find((row) => row.categoryId === "groceries")?.cents, 6_000 - 900);
  assert.equal(report.summary.categories.find((row) => row.categoryId === "dining")?.cents, 4_000 - 600);
  assert.equal(report.refunds[0]?.status, "Partial refund");
  assert.equal(report.refunds[0]?.netCents, 10_000 - 1_500);
  assert.equal(isRefund(transactions[3]), true);
  assert.equal(report.goals[0]?.contributionCents, 5_000);
  assert.equal(report.budgets[0]?.status, "Within budget");
  assert.equal(report.scheduled[0]?.status, "Paid");
  assert.equal(report.scheduled[0]?.linked.includes("shop-1"), false);
  assert.equal(report.collections[0]?.name, "September house");
  assert.equal(report.collections[0]?.spentCents, 20_000);
  const activity = exportActivity(report);
  assert.deepEqual(Object.keys(activity).sort(), ["rangeEnd", "rangeStart", "rangeType", "sections"]);
  assert.equal(JSON.stringify(activity).includes("Returned rice"), false);
  assert.equal(JSON.stringify(activity).includes("Brother"), false);
});

test("current month filename and empty selection", () => {
  const range = resolveRange({ range: "current" }, 1, new Date(2026, 8, 24));
  assert.equal(range.filename, "Clearbook_September-2026.xlsx");
  assert.equal(range.start, "2026-09-01");
  assert.equal(range.end, "2026-09-30");
  const report = buildExportReport({
    transactions: [],
    goals: [],
    budgets: [],
    recurring: [],
    currency: "INR",
    range,
    sections: ["transactions", "summary"],
    preparedFor: "New",
  });
  assert.equal(report.hasData, false);
  assert.equal(report.summary.categories.length, 0);
});
