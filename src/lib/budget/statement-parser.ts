export type PdfText = { str: string; transform: number[] };
export type StatementRow = { date: string; kind: "income" | "expense"; amountCents: number; description: string; reference: string; balanceCents: number };

const MONEY = /^\d{1,3}(?:,\d{2,3})*(?:\.\d{2})$|^\d+\.\d{2}$/;
const DATE = /^([0-3]\d)-([A-Za-z]{3})-(20\d{2})$/;
const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const cents = (text: string) => Math.round(Number(text.replaceAll(",", "")) * 100);

/** IDFC FIRST Bank's selectable-text statement; returns no partial imports on ambiguity. */
export function parseIdfcStatement(pages: PdfText[][]): StatementRow[] {
  if (!pages.length || !pages[0].some((item) => /IDFC FIRST BANK/i.test(item.str))) throw new Error("Only IDFC FIRST Bank text PDFs are supported right now.");
  const result: StatementRow[] = [];
  let previousBalance: number | null = null;
  for (const page of pages) {
    const items = page.filter((item) => item.str.trim()).map((item) => ({ str: item.str.trim(), x: item.transform[4], y: item.transform[5] }));
    const header = items.find((item) => item.str === "Debit" && item.x > 350 && item.x < 440);
    if (!header) {
      if (items.some((item) => item.x < 95 && DATE.test(item.str))) throw new Error("Statement table could not be read.");
      continue;
    }
    const table = items.filter((item) => item.y < header.y - 8 && item.y > 45);
    const dates = table.filter((item) => item.x < 95 && DATE.test(item.str));
    const details = table.filter((item) => item.x >= 185 && item.x < 360 && !MONEY.test(item.str)).sort((a, b) => b.y - a.y || a.x - b.x);
    const blocks: typeof details[] = [];
    for (const item of details) {
      const block = blocks.at(-1);
      if (!block || block.at(-1)!.y - item.y > 14) blocks.push([item]);
      else block.push(item);
    }
    if (!dates.length && table.some((item) => item.x > 370 && MONEY.test(item.str))) throw new Error("No transactions could be read from a statement page.");
    for (const dateItem of dates) {
      const match = DATE.exec(dateItem.str)!;
      const date = `${match[3]}-${MONTHS[match[2]]}-${match[1]}`;
      if (!MONTHS[match[2]] || Number(match[1]) > new Date(Number(match[3]), Number(MONTHS[match[2]]), 0).getDate()) throw new Error("Invalid statement date.");
      const onLine = table.filter((item) => Math.abs(item.y - dateItem.y) < 2 && MONEY.test(item.str));
      const debit = onLine.find((item) => item.x >= 360 && item.x < 440);
      const credit = onLine.find((item) => item.x >= 440 && item.x < 520);
      const balance = onLine.find((item) => item.x >= 520);
      if (Number(Boolean(debit)) + Number(Boolean(credit)) !== 1 || !balance) throw new Error(`Amount columns could not be read for ${dateItem.str}.`);
      const candidates = blocks.filter((block) => block[0].y + 3 >= dateItem.y && block.at(-1)!.y - 3 <= dateItem.y);
      if (candidates.length !== 1) throw new Error(`Description could not be read for ${dateItem.str}.`);
      const block = candidates[0];
      blocks.splice(blocks.indexOf(block), 1);
      const description = block.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
      const reference = /(?:UPI\s*\/\s*(?:DR|CR)\s*\/\s*\d+|IMPS\/[A-Za-z0-9]+|NEFT\/[A-Za-z0-9]+|IFT\/\d+|\b\d{10,}\b)/i.exec(description)?.[0]?.toUpperCase().replace(/\s+/g, "") ?? "";
      const amountCents = cents((debit ?? credit)!.str);
      const balanceCents = cents(balance.str);
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !Number.isSafeInteger(balanceCents)) throw new Error("Invalid statement amount.");
      if (previousBalance !== null && previousBalance + (credit ? amountCents : -amountCents) !== balanceCents) throw new Error(`Statement balance does not match on ${dateItem.str}.`);
      result.push({ date, kind: credit ? "income" : "expense", amountCents, description, reference, balanceCents });
      previousBalance = balanceCents;
    }
  }
  if (!result.length) throw new Error("No transactions found in the PDF.");
  return result;
}

export async function extractIdfcStatement(file: File): Promise<StatementRow[]> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Choose a PDF statement.");
  if (file.size > 10 * 1024 * 1024) throw new Error("PDF must be smaller than 10 MB.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { default: workerSrc } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true }).promise;
  try {
    if (pdf.numPages > 50) throw new Error("Statement exceeds 50 pages.");
    const pages: PdfText[][] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const content = await (await pdf.getPage(pageNo)).getTextContent();
      pages.push(content.items.filter((item): item is PdfText & typeof item => "str" in item && "transform" in item).map((item) => ({ str: item.str, transform: item.transform })));
    }
    return parseIdfcStatement(pages);
  } finally { await pdf.destroy(); }
}
