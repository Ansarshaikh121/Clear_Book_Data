import { buildExportReport, resolveRange } from "/workspace/src/lib/budget/export-model.ts";
import { buildLedgerWorkbook } from "/workspace/src/lib/budget/export-workbook.ts";
import ExcelJS from "exceljs";
import JSZip from "jszip";

const range = resolveRange({ range: "custom", start: "2026-09-01", end: "2026-09-30" }, 1);
const report = buildExportReport({
  transactions: [
    { id: "id-secret-aaaa", kind: "income", amountCents: 50000, categoryId: "pay", note: "Pay", date: "2026-09-01", createdAt: "2026-09-01" },
    { id: "id-secret-bbbb", kind: "expense", amountCents: 10000, categoryId: "shopping", note: "Market", merchant: "A Market", date: "2026-09-02", spendingClass: "everyday", splits: [{ categoryId: "groceries", amountCents: 6000 }, { categoryId: "dining", amountCents: 4000 }] },
    { id: "id-secret-cccc", kind: "expense", amountCents: 20000, categoryId: "housing", note: "Rent", date: "2026-09-03", spendingClass: "fixed" },
    { id: "id-secret-dddd", kind: "income", amountCents: 1500, categoryId: "refund", note: "Returned rice", date: "2026-09-04", refundOf: "id-secret-bbbb" },
    { id: "id-secret-eeee", kind: "savings", amountCents: 5000, categoryId: "savings", note: "House", date: "2026-09-05", goalId: "goal-home" },
  ],
  goals: [{ id: "goal-home", name: "House fund", targetCents: 100000, icon: "home" }],
  budgets: [{ categoryId: "housing", limitCents: 25000 }],
  recurring: [{ id: "rent-bill", label: "Rent", categoryId: "housing", amountCents: 20000, dayOfMonth: 3 }],
  currency: "INR",
  range,
  sections: ["summary", "transactions", "goals", "budgets", "scheduled", "collections", "refunds"],
  preparedFor: "Ansar",
});
const buf = await buildLedgerWorkbook(report);
const zip = await JSZip.loadAsync(buf);
const names = Object.keys(zip.files);
const chart = await zip.file("xl/charts/chart1.xml")?.async("string");
const sharedName = names.find((name) => name.includes("sharedStrings"));
const shared = sharedName ? await zip.file(sharedName).async("string") : "";
const allXml = [];
for (const name of names) {
  if (name.endsWith(".xml")) allXml.push(await zip.file(name).async("string"));
}
const blob = allXml.join("\n");
console.log(JSON.stringify({
  bytes: buf.length,
  chart: Boolean(chart?.includes("pieChart")),
  drawing: names.some((name) => name.includes("drawing")),
  leaksId: blob.includes("id-secret"),
  leaksUser: blob.includes("user_id"),
  hasMarket: blob.includes("A Market"),
  sheets: names.filter((name) => name.includes("worksheets/sheet")),
}, null, 2));
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);
console.log("sheets", wb.worksheets.map((sheet) => sheet.name).join(", "));
const tx = wb.getWorksheet("Transactions");
console.log("header", tx.getCell("A3").value, tx.getCell("B3").value);
console.log("row", tx.getCell("A4").value, tx.getCell("F4").value, tx.getCell("F4").numFmt);
const summary = wb.getWorksheet("Summary");
console.log("A1", summary.getCell("A1").value, "A8", summary.getCell("A8").value, "B8", summary.getCell("B8").value);
