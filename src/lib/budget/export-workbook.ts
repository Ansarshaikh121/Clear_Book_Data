import ExcelJS from "exceljs";
import { injectCategoryChart, type ChartPoint } from "@/lib/budget/export-chart";
import type { CurrencyCode } from "@/lib/budget/model";
import type { ExportReport, ExportSection } from "@/lib/budget/export-model";

const NAVY = "FF203541";
const INK = "FF192B35";
const MUTED = "FF5E6A72";
const WHITE = "FFFFFFFF";
const EMERALD = "FF14624C";
const CORAL = "FF8E4036";
const BLUE = "FF5D70B5";

const CATEGORY_COLOR: Record<string, string> = {
  housing: "1B3A4B",
  groceries: "1F6B4A",
  dining: "A85B52",
  transport: "2F6294",
  utilities: "3D7A86",
  health: "5F6B4E",
  shopping: "7A604F",
  personal: "4E6278",
};

function moneyFormat(currency: CurrencyCode): string {
  if (currency === "INR") return '[$₹-4009]#,##,##0.00;[$₹-4009]-#,##,##0.00';
  if (currency === "USD") return '"$"#,##0.00;"$"\\-#,##0.00';
  if (currency === "EUR") return '[$€-407]#,##0.00;[$€-407]-#,##0.00';
  return '"£"#,##0.00;"£"\\-#,##0.00';
}

function excelDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function text(value: string): string {
  if (!value) return "";
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function major(cents: number): number {
  return Math.round(cents) / 100;
}

function selected(report: ExportReport, section: ExportSection): boolean {
  return report.sections.includes(section);
}

function paintHeader(row: ExcelJS.Row) {
  row.font = { name: "Calibri", bold: true, color: { argb: WHITE }, size: 11 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  row.alignment = { vertical: "middle" };
  row.height = 22;
}

function addDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  tab: string,
  headers: string[],
  rows: (string | number | Date | null)[][],
  widths: number[],
  formats: (string | null)[],
  intro?: string,
) {
  const headerAt = intro ? 3 : 1;
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: headerAt, showGridLines: false }],
    properties: { tabColor: { argb: tab } },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  if (intro) {
    sheet.mergeCells(1, 1, 1, Math.max(headers.length, 1));
    const note = sheet.getCell(1, 1);
    note.value = intro;
    note.font = { name: "Calibri", italic: true, size: 10, color: { argb: MUTED } };
    note.alignment = { wrapText: true, vertical: "middle" };
    sheet.getRow(1).height = 32;
  }
  if (rows.length === 0) {
    const header = sheet.getRow(headerAt);
    headers.forEach((headerText, index) => {
      header.getCell(index + 1).value = headerText;
    });
    paintHeader(header);
    const empty = sheet.getRow(headerAt + 1);
    empty.getCell(1).value = "No records in this export.";
    empty.font = { name: "Calibri", italic: true, color: { argb: MUTED } };
    widths.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
    return;
  }
  sheet.addTable({
    name: `${name.replace(/[^A-Za-z]/g, "")}Table`,
    ref: `A${headerAt}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: headers.map((header) => ({ name: header, filterButton: true })),
    rows: rows.map((row) => row.map((value) => (value == null ? "" : value))),
  });
  paintHeader(sheet.getRow(headerAt));
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    rows[rowIndex].forEach((value, columnIndex) => {
      const cell = sheet.getCell(headerAt + 1 + rowIndex, columnIndex + 1);
      const format = formats[columnIndex];
      if (value instanceof Date) {
        cell.value = value;
        cell.numFmt = format || "dd mmm yyyy";
      } else if (typeof value === "number" && format) {
        cell.value = value;
        cell.numFmt = format;
      } else if (typeof value === "string") {
        cell.value = text(value);
      }
      cell.alignment = { vertical: "middle" };
    });
  }
}

function addSummary(workbook: ExcelJS.Workbook, report: ExportReport): { startRow: number; endRow: number; points: ChartPoint[] } | null {
  const sheet = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: NAVY } },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 },
  });
  sheet.getColumn(1).width = 32;
  sheet.getColumn(2).width = 22;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 3;

  const title = sheet.getCell("A1");
  title.value = "Clearbook";
  title.font = { name: "Georgia", size: 24, bold: true, color: { argb: NAVY } };
  const subtitle = sheet.getCell("A2");
  subtitle.value = "Your ledger";
  subtitle.font = { name: "Georgia", size: 14, color: { argb: MUTED } };

  const facts: [string, string | number | null, "text" | "money" | "count"][] = [
    ["Prepared for", report.preparedFor || "Your account", "text"],
    ["Date range", report.rangeLabel, "text"],
    ["Currency", `${report.currency}. Amounts are not converted.`, "text"],
    ["Total income", major(report.summary.incomeCents), "money"],
    ["Total expenses", major(report.summary.grossExpenseCents), "money"],
    ["Refunds", major(report.summary.refundCents), "money"],
    ["Net expenses", major(report.summary.netExpenseCents), "money"],
    ["Total saved", major(report.summary.savedCents), "money"],
    ["Remaining", major(report.summary.remainingCents), "money"],
    ["Savings contribution total", major(report.summary.savedCents), "money"],
    ["Transaction count", report.summary.transactionCount, "count"],
    ["Previous period", report.summary.comparisonNote, "text"],
  ];
  const format = moneyFormat(report.currency);
  facts.forEach((fact, index) => {
    const row = index + 4;
    const label = sheet.getCell(row, 1);
    label.value = fact[0];
    label.font = { name: "Calibri", color: { argb: INK } };
    const value = sheet.getCell(row, 2);
    value.value = fact[1];
    value.font = { name: "Calibri", bold: true, color: { argb: INK } };
    if (fact[2] === "money") {
      value.numFmt = format;
      if (fact[0] === "Total income" || fact[0] === "Total saved") value.font = { name: "Calibri", bold: true, color: { argb: EMERALD } };
      if (fact[0] === "Total expenses" || fact[0] === "Net expenses") value.font = { name: "Calibri", bold: true, color: { argb: CORAL } };
      if (fact[0] === "Remaining" && report.summary.remainingCents < 0) value.font = { name: "Calibri", bold: true, color: { argb: CORAL } };
      if (fact[0] === "Savings contribution total") value.font = { name: "Calibri", bold: true, color: { argb: BLUE } };
    }
  });

  const noteRow = 4 + facts.length + 1;
  const notes: string[] = [];
  notes.push(report.summary.comparisonNote);
  notes.push("Income does not include refunds. Refunds reduce net expenses.");
  notes.push("Savings contributions are kept separate from expenses.");
  if (report.summary.usedSplits) notes.push("Split expenses are counted once, as the sum of their allocations.");
  if (report.summary.unassignedRefundCents > 0) {
    notes.push("Some refunds are not tied to an expense, so they reduce net expenses without a category.");
  }
  if (report.sections.includes("goals")) {
    notes.push("On Savings Goals, saved amount is everything set aside. Monthly contribution counts only this date range.");
  }
  if (report.summary.categories.length === 0) notes.push("No spending in this range.");
  sheet.getCell(noteRow, 1).value = notes.join(" ");
  sheet.getCell(noteRow, 1).font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
  sheet.getCell(noteRow, 1).alignment = { wrapText: true, vertical: "top" };
  sheet.mergeCells(noteRow, 1, noteRow, 3);

  if (report.summary.categories.length === 0) return null;

  const headerRow = noteRow + 2;
  const total = report.summary.categories.reduce((sum, row) => sum + row.cents, 0);
  const points: ChartPoint[] = report.summary.categories.map((category) => ({
    label: category.label,
    value: major(category.cents),
    color: CATEGORY_COLOR[category.categoryId] ?? "5D70B5",
  }));
  sheet.addTable({
    name: "SpendingTable",
    ref: `A${headerRow}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: [
      { name: "Category", filterButton: true },
      { name: "Amount", filterButton: true },
      { name: "Share", filterButton: true },
    ],
    rows: report.summary.categories.map((category) => [
      category.label,
      major(category.cents),
      total !== 0 ? category.cents / total : 0,
    ]),
  });
  paintHeader(sheet.getRow(headerRow));
  const startRow = headerRow + 1;
  for (let index = 0; index < report.summary.categories.length; index += 1) {
    sheet.getCell(startRow + index, 2).numFmt = format;
    sheet.getCell(startRow + index, 3).numFmt = "0.0%";
  }
  return { startRow, endRow: headerRow + report.summary.categories.length, points };
}

export async function buildLedgerWorkbook(report: ExportReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Clearbook";
  workbook.lastModifiedBy = "Clearbook";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = report.filename.replace(/\.xlsx$/, "");
  workbook.subject = "Clearbook ledger export";

  const format = moneyFormat(report.currency);
  let chart: { startRow: number; endRow: number; points: ChartPoint[] } | null = null;
  if (selected(report, "summary")) chart = addSummary(workbook, report);

  if (selected(report, "transactions")) {
    addDataSheet(
      workbook,
      "Transactions",
      CORAL,
      [
        "Date",
        "Transaction type",
        "Title",
        "Merchant",
        "Category",
        "Amount",
        "Currency",
        "Notes",
        "Collection or project",
        "Savings goal",
        "Fixed or everyday spending classification",
        "Refund status",
        "Created date",
      ],
      report.transactions.map((row) => [
        excelDate(row.date),
        row.type,
        row.title,
        row.merchant,
        row.category,
        major(row.amountCents),
        report.currency,
        row.notes,
        row.collection,
        row.goal,
        row.spendingClass,
        row.refundStatus,
        excelDate(row.createdAt),
      ]),
      [16, 18, 28, 22, 16, 16, 12, 28, 24, 20, 28, 18, 16],
      ["dd mmm yyyy", null, null, null, null, format, null, null, null, null, null, null, "dd mmm yyyy"],
    );
  }

  if (selected(report, "goals")) {
    addDataSheet(
      workbook,
      "Savings Goals",
      BLUE,
      ["Goal name", "Target amount", "Saved amount", "Remaining amount", "Progress percentage", "Monthly contribution", "Status"],
      report.goals.map((row) => [
        row.name,
        major(row.targetCents),
        major(row.savedCents),
        major(row.remainingCents),
        row.progress,
        major(row.contributionCents),
        row.status,
      ]),
      [28, 18, 18, 20, 22, 24, 16],
      [null, format, format, format, "0.0%", format, null],
      "Saved amount is every contribution on this account. Monthly contribution counts only the selected dates.",
    );
  }

  if (selected(report, "budgets")) {
    addDataSheet(
      workbook,
      "Budgets",
      EMERALD,
      ["Category", "Budget amount", "Actual spending", "Remaining budget", "Usage percentage", "Budget status"],
      report.budgets.map((row) => [
        row.category,
        major(row.budgetCents),
        major(row.actualCents),
        major(row.remainingCents),
        row.usage,
        row.status,
      ]),
      [20, 18, 18, 20, 20, 18],
      [null, format, format, format, "0.0%", null],
    );
  }

  if (selected(report, "scheduled")) {
    addDataSheet(
      workbook,
      "Scheduled Payments",
      "FF3D7A86",
      ["Payment name", "Category", "Amount", "Due date", "Frequency", "Status", "Linked transaction"],
      report.scheduled.map((row) => [
        row.name,
        row.category,
        major(row.amountCents),
        excelDate(row.dueDate),
        row.frequency,
        row.status,
        row.linked,
      ]),
      [28, 18, 16, 16, 14, 20, 36],
      [null, null, format, "dd mmm yyyy", null, null, null],
    );
  }

  if (selected(report, "collections")) {
    addDataSheet(
      workbook,
      "Collections",
      "FF7A604F",
      ["Name", "Kind", "Spent", "Transactions"],
      report.collections.map((row) => [row.name, row.kind, major(row.spentCents), row.count]),
      [28, 16, 16, 16],
      [null, null, format, "0"],
    );
  }

  if (selected(report, "refunds")) {
    addDataSheet(
      workbook,
      "Refunds",
      CORAL,
      ["Original expense", "Original amount", "Refund amount", "Refund date", "Net expense", "Refund status"],
      report.refunds.map((row) => [
        row.original,
        row.originalCents == null ? null : major(row.originalCents),
        major(row.refundCents),
        excelDate(row.date),
        row.netCents == null ? null : major(row.netCents),
        row.status,
      ]),
      [28, 18, 18, 16, 18, 18],
      [null, format, format, "dd mmm yyyy", format, null],
    );
  }

  const raw = Buffer.from(await workbook.xlsx.writeBuffer());
  if (!chart || chart.points.length === 0) return raw;
  return injectCategoryChart(raw, chart.points, chart.startRow, chart.endRow);
}
