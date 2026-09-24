import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStatementCsv, parseStatementDate, parseStatementRows, statementKey } from "./bank-statement.ts";

test("quoted descriptions, debit and credit amounts import into correct lists", () => {
  const csv = 'Date,Narration,Debit,Credit,Balance\n24/09/2026,"Cafe, Pune","1,250.50",,10000\n25/09/2026,Salary,,50000,60000';
  const parsed = parseStatementRows(parseStatementCsv(csv));
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows.map(({ date, kind, amountCents }) => ({ date, kind, amountCents })), [
    { date: "2026-09-24", kind: "expense", amountCents: 125050 },
    { date: "2026-09-25", kind: "income", amountCents: 5000000 },
  ]);
  assert.equal(parsed.rows[0].note, "Cafe, Pune");
  assert.equal(parsed.rows[1].categoryId, "pay");
});

test("invalid dates and ambiguous debit plus credit rows are skipped", () => {
  const result = parseStatementRows([
    ["header"], ["Txn Date", "Description", "Withdrawal", "Deposit"],
    ["31/02/2026", "Invalid", "100", ""],
    ["01/03/2026", "Ambiguous", "100", "100"],
    ["02/03/2026", "Own account transfer", "500", ""],
  ]);
  assert.equal(result.skipped, 2);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].review, true);
});

test("signed amounts need a direction and nonzero amount", () => {
  const result = parseStatementRows([
    ["Date", "Description", "Amount", "Type"],
    ["2026-09-24", "Restaurant", "-120.00", ""],
    ["2026-09-25", "Payment", "120.00", ""],
    ["2026-09-26", "Refund", "120.00", "CR"],
  ]);
  assert.equal(result.skipped, 1);
  assert.equal(result.rows[0].kind, "expense");
  assert.equal(result.rows[1].kind, "income");
  assert.equal(parseStatementDate("31/02/2026"), null);
  assert.equal(parseStatementDate("24-Sep-2026"), "2026-09-24");
  assert.equal(statementKey(result.rows[0]), "2026-09-24|expense|12000|restaurant");
});

test("CSV parser rejects broken quotes", () => {
  assert.throws(() => parseStatementCsv('Date,Description\n2026-09-24,"broken'), /unclosed/);
});
