import { chromium } from "playwright";
import ExcelJS from "exceljs";

const base = process.env.QA_BASE || "http://127.0.0.1:8080";
const stamp = Date.now();
const emailA = `qa-a-${stamp}@example.com`;
const emailB = `qa-b-${stamp}@example.com`;
const password = `Qa-${stamp}-Pass1`;
const report = { checks: [] };

function check(name, ok, detail = "") {
  report.checks.push({ name, ok, detail });
  console.log(ok ? "OK" : "FAIL", name, ok ? "" : detail);
}

async function workbookText(base64) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(base64, "base64"));
  const parts = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        parts.push(cell.text || String(cell.value ?? ""));
      });
    });
  });
  return parts.join("\n");
}

async function signup(page, email, name) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Name").waitFor({ timeout: 20000 });
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("heading", { name: "Your Money Overview" }).waitFor({ timeout: 20000 });
}

async function login(page, email) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Log in" }).first().click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("heading", { name: "Your Money Overview" }).waitFor({ timeout: 20000 });
}

async function addTx(page, { kind, amount, note, date }) {
  await page.getByRole("button", { name: "Add Transaction" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: kind }).click();
  await dialog.getByRole("textbox", { name: /Amount/ }).fill(amount);
  if (date) await dialog.getByLabel("Date").fill(date);
  if (note) await dialog.getByLabel("Note").fill(note);
  await dialog.getByRole("button", { name: "Save transaction" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 10000 });
}

async function ledgerCall(page, exportName, data) {
  return page.evaluate(async ({ exportName, data }) => {
    const mod = await import("/src/lib/budget/ledger.ts");
    try {
      const result = await mod[exportName](data === undefined ? undefined : { data });
      return { ok: true, result };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }, { exportName, data });
}

async function signOut(page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login**");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(15000);

try {
  await signup(page, emailA, "Account A");
  check("A starts signed in", true);

  const negative = await ledgerCall(page, "createLedgerTransaction", {
    id: "neg-should-fail",
    kind: "expense",
    amountCents: -100,
    categoryId: "groceries",
    note: "bad negative",
    date: "2026-09-03",
  });
  check("backend rejects a negative amount", negative.ok === false && String(negative.message).includes("Enter an amount greater than zero."), JSON.stringify(negative));

  await addTx(page, { kind: "Income", amount: "10000", note: "QA-A-income", date: "2026-09-02" });
  await addTx(page, { kind: "Expense", amount: "1250.50", note: "QA-A-expense", date: "2026-09-10" });
  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  await page.getByRole("button", { name: "Edit QA-A-expense" }).click();
  const edit = page.getByRole("dialog");
  await edit.getByRole("textbox", { name: /Amount/ }).fill("1500.50");
  await edit.getByRole("button", { name: "Save transaction" }).click();
  await edit.waitFor({ state: "hidden" });
  await page.getByText("₹1,500.50").first().waitFor();

  await page.getByRole("link", { name: "Savings Goals", exact: true }).click();
  await page.getByLabel("Name").fill("QA fund");
  await page.getByLabel("Target").fill("5000");
  await page.getByRole("button", { name: "Save goal" }).click();
  await page.getByText("QA fund").waitFor();

  await page.getByRole("button", { name: "Add Transaction" }).first().click();
  const saveDialog = page.getByRole("dialog");
  await saveDialog.getByRole("radio", { name: "Savings" }).click();
  await saveDialog.getByRole("textbox", { name: /Amount/ }).fill("1000");
  await saveDialog.getByLabel("Date").fill("2026-09-12");
  await saveDialog.getByLabel("Note").fill("QA-A-save");
  await saveDialog.getByRole("button", { name: "Save transaction" }).click();
  await saveDialog.waitFor({ state: "hidden" });
  await page.getByText("20%").waitFor({ timeout: 10000 });

  await page.getByRole("link", { name: "Budgets", exact: true }).click();
  await page.getByLabel("Budget limit").fill("-1");
  await page.getByText("Enter an amount greater than zero.").waitFor();
  check("budget form rejects -1", true);
  await page.getByLabel("Budget limit").fill("1000");
  await page.getByRole("button", { name: "Save budget" }).click();
  await page.getByText("₹1,500.50 / ₹1,000").waitFor();

  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByText("₹7,499.50").first().waitFor();
  check("A remaining is ₹7,499.50", (await page.getByText("₹7,499.50").count()) > 0);

  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  await page.getByText("September 2026").first().waitFor();
  check("September list shows the expense", (await page.getByText("QA-A-expense").count()) > 0);
  const before = await page.locator("body").innerText();
  check("September is not labeled custom yet", before.includes("September 2026") && !before.includes("Custom range"));
  await page.getByLabel("Previous month").click();
  await page.getByText("August 2026").first().waitFor();
  await page.waitForTimeout(300);
  const august = await page.locator("body").innerText();
  check("August follows the month switch", august.includes("August 2026") && !august.includes("QA-A-expense"));
  check("August is not a custom range", !august.includes("Custom range"));
  await page.getByLabel("From").first().fill("2026-08-10");
  await page.getByText("Custom range").first().waitFor();
  check("edited dates are labeled Custom range", true);
  await page.getByLabel("Next month").click();
  await page.getByText("September 2026").first().waitFor();
  await page.getByText("QA-A-expense").waitFor();
  const back = await page.locator("body").innerText();
  check("returning to September drops the custom range", back.includes("September 2026") && !back.includes("Custom range"));

  await page.getByRole("button", { name: "Add Transaction" }).first().click();
  const bad = page.getByRole("dialog");
  await bad.getByRole("radio", { name: "Expense" }).click();
  await bad.getByRole("textbox", { name: /Amount/ }).fill("-1");
  await bad.getByText("Enter an amount greater than zero.").waitFor();
  await bad.getByRole("button", { name: "Save transaction" }).click();
  check("dialog stays open for -1", await bad.isVisible());
  await page.getByRole("button", { name: "Close" }).click();

  const snapA = await ledgerCall(page, "loadLedger");
  const expense = snapA.result?.transactions?.find((tx) => tx.note === "QA-A-expense");
  check("A ledger stored the edited expense", expense?.amountCents === 150050, JSON.stringify(expense));
  const expenseId = expense?.id;

  await page.getByRole("link", { name: "Insights", exact: true }).click();
  await page.getByText("Not enough data to compare").first().waitFor();
  const insights = await page.locator("body").innerText();
  check("insights does not invent a previous-period increase", insights.includes("Not enough data to compare") && !insights.includes("Then ₹0"));

  await signOut(page);
  await signup(page, emailB, "Account B");
  const snapB = await ledgerCall(page, "loadLedger");
  const textB = JSON.stringify(snapB.result ?? {});
  check("B starts with no transactions", (snapB.result?.transactions?.length ?? 0) === 0, textB.slice(0, 300));
  check("B cannot see A's notes", !textB.includes("QA-A-income") && !textB.includes("QA-A-expense"));
  const stolen = await ledgerCall(page, "updateLedgerTransaction", {
    id: expenseId,
    kind: "expense",
    amountCents: 100,
    categoryId: "groceries",
    note: "stolen",
    date: "2026-09-10",
  });
  check("B cannot update A's transaction", stolen.ok === false, JSON.stringify(stolen));
  await addTx(page, { kind: "Expense", amount: "42", note: "QA-B-only", date: "2026-09-11" });
  await page.getByText("QA-B-only").waitFor();

  const exportB = await page.evaluate(async () => {
    const mod = await import("/src/lib/budget/export-ledger.ts");
    const file = await mod.exportLedger({ data: { range: "all", sections: ["transactions", "summary"] } });
    return { filename: file.filename, base64: file.base64, count: file.transactionCount };
  });
  const textBExport = await workbookText(exportB.base64);
  check(
    "B export includes only B",
    exportB.count === 1 && textBExport.includes("QA-B-only") && !textBExport.includes("QA-A-expense") && !textBExport.includes("QA-A-income"),
    exportB.filename,
  );

  await signOut(page);
  await login(page, emailA);
  const snapA2 = await ledgerCall(page, "loadLedger");
  const again = snapA2.result?.transactions?.find((tx) => tx.note === "QA-A-expense");
  const polluted = snapA2.result?.transactions?.some((tx) => tx.note === "QA-B-only");
  check("A still has ₹1,500.50 after B's activity", again?.amountCents === 150050, JSON.stringify(again));
  check("A does not contain B's expense", polluted === false);
  await page.getByText("₹7,499.50").first().waitFor();
  check("A remaining still shows after login", true);

  const exportA = await page.evaluate(async () => {
    const mod = await import("/src/lib/budget/export-ledger.ts");
    const file = await mod.exportLedger({
      data: { range: "current", viewMonth: "2026-09", sections: ["transactions", "summary"] },
    });
    return { filename: file.filename, base64: file.base64, count: file.transactionCount };
  });
  const textAExport = await workbookText(exportA.base64);
  check(
    "A September export matches that account and month",
    exportA.filename.includes("September-2026") && textAExport.includes("QA-A-expense") && textAExport.includes("Not enough data to compare") && !textAExport.includes("QA-B-only"),
    `${exportA.filename} count ${exportA.count}`,
  );

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("heading", { name: "Settings" }).waitFor();
  await page.getByText("saved with this account").waitFor();
  await page.getByText("Not connected", { exact: true }).waitFor();
  const settings = await page.locator("body").innerText();
  check("settings no longer says the ledger stays on this device", settings.includes("saved with this account") && !settings.includes("stays on this device"));
  check("calendar is not shown as connected", settings.includes("Not connected") && !settings.includes("GOOGLE_CLIENT_ID"));
} catch (error) {
  check("script", false, error instanceof Error ? error.stack || error.message : String(error));
  await page.screenshot({ path: "/workspace/screenshots/qa-accounts-failure.png", fullPage: true }).catch(() => {});
} finally {
  const failed = report.checks.filter((item) => !item.ok);
  console.log(JSON.stringify({ failed: failed.length, passed: report.checks.filter((item) => item.ok).length }, null, 2));
  await browser.close();
  process.exit(failed.length === 0 ? 0 : 1);
}
