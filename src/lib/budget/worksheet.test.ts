import assert from "node:assert/strict";
import test from "node:test";
import { formatRupees, monthlyRemaining, parseWorksheetRupees } from "./worksheet.ts";

test("the worksheet uses income minus expenses minus savings and allows zero", () => {
  assert.equal(monthlyRemaining(80000, 45000, 10000), 25000);
  assert.equal(monthlyRemaining(0, 0, 0), 0);
  assert.equal(monthlyRemaining(1000, 1500, 0), -500);
  assert.equal(monthlyRemaining(0.3, 0.1, 0.2), 0);
  assert.equal(monthlyRemaining(0.3, 0.2, 0.2), -0.1);
  assert.equal(parseWorksheetRupees("0"), 0);
  assert.equal(parseWorksheetRupees("1,250.50"), 1250.5);
  assert.equal(parseWorksheetRupees("-20"), null);
  assert.equal(parseWorksheetRupees(""), null);
  assert.equal(parseWorksheetRupees("1.234"), null);
  assert.match(formatRupees(25000), /25,000/);
});
