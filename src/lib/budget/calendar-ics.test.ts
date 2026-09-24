import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCalendarIcs } from "./calendar-ics.ts";
import type { Transaction } from "./model.ts";

const options = {
  mode: "daily" as const,
  startDate: "2026-09-01",
  includeAmount: false,
  includeMerchant: false,
  includeCategory: false,
  includeNotes: false,
  includeReminders: true,
  reminderTime: "09:00",
  reminderOffsetDays: 1 as const,
  reminderFrequency: "monthly" as const,
  timeZone: "Asia/Kolkata",
  currency: "INR" as const,
  origin: "https://clearbook.example",
  now: new Date("2026-09-23T12:00:00Z"),
};

const rows: Transaction[] = [
  { id: "rent", kind: "expense", amountCents: 2_800_000, categoryId: "housing", note: "Rent", date: "2026-09-02" },
  { id: "market", kind: "expense", amountCents: 186_000, categoryId: "groceries", note: "Market", date: "2026-09-04" },
  { id: "again", kind: "expense", amountCents: 50_000, categoryId: "groceries", note: "Market", date: "2026-09-04" },
  { id: "refund", kind: "income", amountCents: 20_000, categoryId: "refund", note: "Refund", date: "2026-09-04" },
  { id: "save", kind: "savings", amountCents: 800_000, categoryId: "savings", note: "Emergency fund", date: "2026-09-05" },
];

describe("clearbook calendar export", () => {
  it("builds one daily event per date and counts each expense once", () => {
    const { events, ics } = buildCalendarIcs(rows, [], { ...options, includeAmount: true, includeCategory: true });
    const daily = events.filter((event) => event.kind === "daily");
    assert.equal(daily.length, 2);
    assert.equal(ics.split("BEGIN:VEVENT").length - 1, daily.length);
    const sep4 = daily.find((event) => event.date === "2026-09-04");
    assert.ok(sep4);
    assert.match(sep4.description, /Recorded expenses: 2/);
    assert.match(sep4.description, /Refunds recorded/);
    assert.equal(sep4.description.includes("Emergency"), false);
    assert.match(ics, /TRANSP:TRANSPARENT/);
    assert.equal(ics.includes("ATTENDEE"), false);
    assert.match(ics, /UID:clearbook-daily-2026-09-04@clearbook/);
  });

  it("hides amounts, merchants, and notes unless enabled", () => {
    const { events } = buildCalendarIcs(
      [{ id: "shop", kind: "expense", amountCents: 85_000, categoryId: "groceries", note: "secret note", merchant: "Market", date: "2026-09-04" }],
      [],
      { ...options, mode: "individual" },
    );
    assert.equal(events[0]?.title, "Expense");
    assert.equal(events[0]?.description.includes("secret"), false);
    assert.equal(events[0]?.description.includes("Market"), false);
    assert.equal(events[0]?.description.includes("₹"), false);
  });

  it("skips a paid reminder date instead of adding another expense", () => {
    const { ics, events } = buildCalendarIcs(rows, [
      { id: "rent-bill", label: "Rent", categoryId: "housing", amountCents: 2_800_000, dayOfMonth: 2 },
    ], options);
    assert.equal(events.filter((event) => event.kind === "reminder").length, 1);
    assert.match(ics, /RRULE:FREQ=MONTHLY;BYMONTHDAY=2/);
    assert.match(ics, /EXDATE:/);
    assert.match(ics, /TRIGGER:-P1D/);
    assert.equal(events.filter((event) => event.uid.includes("rent-bill") && event.kind === "expense").length, 0);
  });

  it("drops a deleted transaction from the next file", () => {
    const first = buildCalendarIcs(rows, [], { ...options, mode: "individual" });
    const second = buildCalendarIcs(rows.filter((tx) => tx.id !== "market"), [], { ...options, mode: "individual" });
    assert.match(first.ics, /clearbook-tx-market@clearbook/);
    assert.equal(second.ics.includes("clearbook-tx-market@clearbook"), false);
  });
});
