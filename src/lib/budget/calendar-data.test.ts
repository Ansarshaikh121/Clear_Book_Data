import assert from "node:assert/strict";
import test from "node:test";
import { calendarDays } from "./calendar-data.ts";

test("calendar counts every entry, isolates the displayed month, and shades by frequency", () => {
  const transactions = [
    ...Array.from({ length: 1 }, () => ({ date: "2026-09-01" })),
    ...Array.from({ length: 3 }, () => ({ date: "2026-09-02" })),
    ...Array.from({ length: 5 }, () => ({ date: "2026-09-03" })),
    ...Array.from({ length: 8 }, () => ({ date: "2026-09-04" })),
    ...Array.from({ length: 10 }, () => ({ date: "2026-08-31" })),
  ];
  const cells = calendarDays("2026-09", transactions);
  assert.equal(cells.filter(Boolean).length, 30);
  assert.equal(cells[0], null);
  assert.equal(cells[1], null);
  assert.deepEqual(cells.slice(2, 7).map((cell) => [cell?.count, cell?.level]), [
    [1, 1], [3, 2], [5, 3], [8, 4], [0, 0],
  ]);
});

test("empty month stays neutral and leap-day is present", () => {
  const cells = calendarDays("2028-02", []);
  assert.equal(cells.filter(Boolean).length, 29);
  assert.equal(cells.find((cell) => cell?.date === "2028-02-29")?.level, 0);
});
