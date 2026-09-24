import { createRequire } from "node:module";
import ExcelJS from "exceljs";

const require = createRequire("/workspace/package.json");
const { toJSONAsync } = require("seroval");
const origin = "http://127.0.0.1:8080";

function fnId(file: string, name: string) {
  return Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${name}_createServerFn_handler` }), "utf8").toString("base64url");
}

const ids = {
  create: fnId("/src/lib/budget/ledger.ts", "createLedgerTransaction"),
  goal: fnId("/src/lib/budget/ledger.ts", "saveLedgerGoal"),
  profile: fnId("/src/lib/budget/ledger.ts", "saveLedgerProfile"),
  exp: fnId("/src/lib/budget/export-ledger.ts", "exportLedger"),
};

async function payload(data: unknown) {
  return JSON.stringify(await toJSONAsync(data));
}

function cookies(res: Response) {
  return (res.headers.getSetCookie?.() ?? []).map((line) => line.split(";")[0]).join("; ");
}

async function auth(email: string, name: string) {
  const res = await fetch(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email, password: "password123", name }),
  });
  const text = await res.text();
  if (res.status !== 200) throw new Error(`signup ${res.status} ${text.slice(0, 200)}`);
  return cookies(res);
}

async function call(id: string, cookie: string | undefined, data?: unknown) {
  const headers: Record<string, string> = { origin, "x-tsr-serverFn": "true", accept: "application/json", "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${origin}/_serverFn/${id}`, {
    method: "POST",
    headers,
    body: await payload(data === undefined ? {} : { data }),
  });
  const text = await res.text();
  return { status: res.status, text };
}

function message(text: string) {
  return text.match(/"message":\{"t":1,"s":"([^"]+)"/)?.[1] ?? text.match(/"s":"([^"]{0,180})"/)?.[1] ?? "";
}

async function workbookFrom(text: string) {
  const filename = text.match(/Clearbook_[A-Za-z0-9._-]+\.xlsx/)?.[0] ?? "";
  const b64 = text.match(/UEs[A-Za-z0-9+/=]+/)?.[0] ?? "";
  if (!b64) throw new Error(`no workbook: ${message(text)} ${text.slice(0, 300)}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(b64, "base64"));
  return { filename, wb, xml: Buffer.from(b64, "base64").toString("latin1") };
}

function cellByLabel(sheet: ExcelJS.Worksheet, label: string) {
  for (let row = 1; row <= 30; row += 1) {
    if (sheet.getCell(row, 1).value === label) return sheet.getCell(row, 2).value;
  }
  return undefined;
}

const stamp = Date.now();
const cookieA = await auth(`export-a-${stamp}@example.com`, "Export A");
const cookieB = await auth(`export-b-${stamp}@example.com`, "Export B");
const cookieC = await auth(`export-c-${stamp}@example.com`, "Export C");

const created = await call(ids.create, cookieA, {
  id: "tx-a-split-0001",
  kind: "expense",
  amountCents: 10000,
  categoryId: "shopping",
  note: "A Market basket",
  merchant: "A Market",
  date: "2026-09-02",
  spendingClass: "everyday",
  splits: [
    { categoryId: "groceries", amountCents: 6000 },
    { categoryId: "dining", amountCents: 4000 },
  ],
  userId: "someone-else",
});
if (!created.text.includes("A Market basket") && created.text.includes("Invalid")) {
  throw new Error(`create split failed ${created.text.slice(0, 400)}`);
}

await call(ids.create, cookieA, {
  id: "tx-a-rent-00001",
  kind: "expense",
  amountCents: 20000,
  categoryId: "housing",
  note: "A rent",
  date: "2026-09-03",
  spendingClass: "fixed",
  collectionName: "September house",
  collectionKind: "project",
});
await call(ids.create, cookieA, {
  id: "tx-a-pay-000001",
  kind: "income",
  amountCents: 80000,
  categoryId: "pay",
  note: "A salary",
  date: "2026-09-01",
});
await call(ids.create, cookieA, {
  id: "tx-a-refund-001",
  kind: "income",
  amountCents: 1500,
  categoryId: "refund",
  note: "A returned rice",
  date: "2026-09-04",
  refundOf: "tx-a-split-0001",
});
await call(ids.goal, cookieA, { id: "goal-a-house-01", name: "A house fund", targetCents: 100000, icon: "home" });
await call(ids.create, cookieA, {
  id: "tx-a-save-00001",
  kind: "savings",
  amountCents: 5000,
  categoryId: "savings",
  note: "A house contribution",
  date: "2026-09-05",
  goalId: "goal-a-house-01",
});
await call(ids.create, cookieA, {
  id: "tx-a-jan-000001",
  kind: "expense",
  amountCents: 9999,
  categoryId: "dining",
  note: "A January marker",
  date: "2026-01-15",
});
await call(ids.profile, cookieA, {
  currency: "INR",
  viewMonth: "2026-09",
  settings: {
    budgets: [{ categoryId: "housing", limitCents: 25000 }],
    recurring: [{ id: "rent-a", label: "A rent", categoryId: "housing", amountCents: 20000, dayOfMonth: 3 }],
  },
  userId: "someone-else",
});
await call(ids.create, cookieB, {
  id: "tx-b-cafe-00001",
  kind: "expense",
  amountCents: 1234,
  categoryId: "dining",
  note: "B cafe marker",
  merchant: "B Cafe",
  date: "2026-09-21",
});

const empty = await call(ids.exp, cookieC, { range: "current", sections: ["transactions", "summary"] });
const anon = await call(ids.exp, undefined, { range: "all", sections: ["transactions", "summary"] });
const current = await call(ids.exp, cookieA, {
  range: "current",
  sections: ["transactions", "summary", "goals", "budgets", "scheduled", "collections", "refunds"],
  userId: "export-b-user",
});
const january = await call(ids.exp, cookieA, { range: "custom", start: "2026-01-01", end: "2026-01-31", sections: ["transactions", "summary"] });
const all = await call(ids.exp, cookieA, { range: "all", sections: ["transactions", "summary"] });
const other = await call(ids.exp, cookieB, { range: "all", sections: ["transactions", "summary", "goals", "refunds"] });

const currentBook = await workbookFrom(current.text);
const januaryBook = await workbookFrom(january.text);
const allBook = await workbookFrom(all.text);
const otherBook = await workbookFrom(other.text);

const summary = currentBook.wb.getWorksheet("Summary");
const income = Number(cellByLabel(summary, "Total income"));
const gross = Number(cellByLabel(summary, "Total expenses"));
const refunds = Number(cellByLabel(summary, "Refunds"));
const net = Number(cellByLabel(summary, "Net expenses"));
const saved = Number(cellByLabel(summary, "Total saved"));
const remaining = Number(cellByLabel(summary, "Remaining"));
const txSheet = currentBook.wb.getWorksheet("Transactions");
const titles: string[] = [];
txSheet.eachRow((row) => {
  const value = row.getCell(3).value;
  if (typeof value === "string") titles.push(value);
});

const report = {
  empty: message(empty.text),
  anon: message(anon.text),
  currentName: currentBook.filename,
  januaryName: januaryBook.filename,
  allName: allBook.filename,
  income,
  gross,
  refunds,
  net,
  saved,
  remaining,
  titles,
  currentHasJanuary: currentBook.xml.includes("A January marker"),
  currentHasB: currentBook.xml.includes("B cafe marker"),
  currentHasId: currentBook.xml.includes("tx-a-split"),
  januaryHasSalary: januaryBook.xml.includes("A salary"),
  januaryHasMarker: januaryBook.xml.includes("A January marker"),
  allHasBoth: allBook.xml.includes("A salary") && allBook.xml.includes("A January marker"),
  otherHasA: otherBook.xml.includes("A Market") || otherBook.xml.includes("A salary") || otherBook.xml.includes("A house fund"),
  otherHasB: otherBook.xml.includes("B cafe marker"),
  chart: currentBook.xml.includes("pieChart"),
  table: currentBook.xml.includes("TransactionsTable") || currentBook.xml.includes("autoFilter"),
  sheets: currentBook.wb.worksheets.map((sheet) => sheet.name),
};
console.log(JSON.stringify(report, null, 2));
const problems = [];
if (report.empty !== "Nothing to export for this selection.") problems.push("empty");
if (!report.anon.includes("Unauthorized")) problems.push("anon");
if (report.currentName !== "Clearbook_September-2026.xlsx") problems.push("current name " + report.currentName);
if (report.januaryName !== "Clearbook_2026-01-01_to_2026-01-31.xlsx") problems.push("jan name");
if (report.allName !== "Clearbook_All-time.xlsx") problems.push("all name");
if (income !== 800 || gross !== 300 || refunds !== 15 || net !== 285 || saved !== 50 || remaining !== 465) problems.push("totals");
if (!titles.includes("A Market basket") || titles.filter((title) => title === "A Market basket").length !== 2) problems.push("split rows");
if (report.currentHasJanuary || report.currentHasB || report.currentHasId) problems.push("current leak");
if (report.januaryHasSalary || !report.januaryHasMarker) problems.push("january filter");
if (!report.allHasBoth) problems.push("all-time");
if (report.otherHasA || !report.otherHasB) problems.push("isolation");
if (!report.chart || !report.table) problems.push("chart/table");
if (problems.length) {
  console.error("FAIL", problems);
  process.exit(1);
}
console.log("PASS");
