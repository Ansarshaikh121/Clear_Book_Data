import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  buildExportReport,
  exportActivity,
  parseExportRequest,
  resolveRange,
  type CollectionKind,
  type ExportSourceTx,
  type SpendingClass,
  type SplitAllocation,
} from "@/lib/budget/export-model";
import { type CurrencyCode, type GoalIcon } from "@/lib/budget/model";
import type { BudgetLimit, RecurringPayment } from "@/lib/budget/store";

async function db() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

type TxRow = {
  id: string;
  kind: string;
  amount_cents: number;
  category_id: string;
  note: string;
  merchant: string | null;
  goal_id: string | null;
  tx_date: string;
  splits: string | null;
  refund_of: string | null;
  spending_class: string | null;
  collection_name: string | null;
  collection_kind: string | null;
  created_at: string | Date | null;
};

function dateOnly(value: string | Date | null): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : undefined;
}

function parseSplits(raw: string | null): SplitAllocation[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const splits = parsed.flatMap((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
      if (!row || typeof row.categoryId !== "string" || typeof row.amountCents !== "number") return [];
      return [{ categoryId: row.categoryId, amountCents: row.amountCents }];
    });
    return splits.length >= 2 ? splits : undefined;
  } catch {
    return undefined;
  }
}

function spendingClass(value: string | null): SpendingClass | undefined {
  return value === "fixed" || value === "everyday" ? value : undefined;
}

function collectionKind(value: string | null): CollectionKind | undefined {
  return value === "collection" || value === "trip" || value === "project" ? value : undefined;
}

export type ExportFile = {
  filename: string;
  base64: string;
  transactionCount: number;
};

export const exportLedger = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parseExportRequest(input))
  .handler(async ({ context, data }): Promise<ExportFile> => {
    const sql = await db();
    const userId = context.userId;
    const profiles = await sql<{
      currency: string;
      month_starts_on: number;
      budgets: string;
      recurring: string;
      view_month: string | null;
    }>`
      select currency, month_starts_on, budgets, recurring, view_month
      from ledger_profiles
      where user_id = ${userId}
    `;
    const profile = profiles[0];
    const currency: CurrencyCode =
      profile?.currency === "USD" || profile?.currency === "EUR" || profile?.currency === "GBP" || profile?.currency === "INR"
        ? profile.currency
        : "INR";
    const monthStartsOn = profile ? Number(profile.month_starts_on) : 1;
    let budgets: BudgetLimit[] = [];
    let recurring: RecurringPayment[] = [];
    try {
      const parsed = profile ? (JSON.parse(profile.budgets) as unknown) : [];
      if (Array.isArray(parsed)) {
        budgets = parsed.flatMap((item) => {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
          if (!row || typeof row.categoryId !== "string" || typeof row.limitCents !== "number") return [];
          return [{ categoryId: row.categoryId, limitCents: row.limitCents }];
        });
      }
    } catch {
      budgets = [];
    }
    try {
      const parsed = profile ? (JSON.parse(profile.recurring) as unknown) : [];
      if (Array.isArray(parsed)) {
        recurring = parsed.flatMap((item) => {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
          if (!row || typeof row.id !== "string" || typeof row.label !== "string") return [];
          if (typeof row.categoryId !== "string" || typeof row.amountCents !== "number" || typeof row.dayOfMonth !== "number") return [];
          return [{
            id: row.id,
            label: row.label,
            categoryId: row.categoryId,
            amountCents: row.amountCents,
            dayOfMonth: row.dayOfMonth,
          }];
        });
      }
    } catch {
      recurring = [];
    }

    const txRows = await sql<TxRow>`
      select id, kind, amount_cents, category_id, note, merchant, goal_id, tx_date,
             splits, refund_of, spending_class, collection_name, collection_kind, created_at
      from ledger_transactions
      where user_id = ${userId}
      order by tx_date, id
    `;
    if (txRows.length > 5000) throw new Error("This ledger is too large to export at once.");
    const goals = await sql<{ id: string; name: string; target_cents: number; icon: string }>`
      select id, name, target_cents, icon from ledger_goals where user_id = ${userId}
    `;
    const people = await sql<{ name: string }>`select name from "user" where id = ${userId}`;
    const transactions: ExportSourceTx[] = txRows.map((row) => ({
      id: row.id,
      kind: row.kind as ExportSourceTx["kind"],
      amountCents: Number(row.amount_cents),
      categoryId: row.category_id,
      note: row.note,
      merchant: row.merchant ?? undefined,
      goalId: row.goal_id ?? undefined,
      date: String(row.tx_date).slice(0, 10),
      splits: parseSplits(row.splits),
      refundOf: row.refund_of ?? undefined,
      spendingClass: spendingClass(row.spending_class),
      collectionName: row.collection_name ?? undefined,
      collectionKind: collectionKind(row.collection_kind),
      createdAt: dateOnly(row.created_at),
    }));
    const savedMonth = profile?.view_month && /^\d{4}-\d{2}$/.test(profile.view_month) ? profile.view_month : undefined;
    const range = resolveRange({ ...data, viewMonth: data.viewMonth ?? savedMonth }, monthStartsOn);
    const report = buildExportReport({
      transactions,
      goals: goals.map((goal) => ({
        id: goal.id,
        name: goal.name,
        targetCents: Number(goal.target_cents),
        icon: (goal.icon === "home" || goal.icon === "plane" || goal.icon === "gift" ? goal.icon : "shield") as GoalIcon,
      })),
      budgets,
      recurring,
      currency,
      range,
      sections: data.sections,
      preparedFor: people[0]?.name?.trim() || "Your account",
      monthStartsOn,
    });
    if (!report.hasData) throw new Error("Nothing to export for this selection.");
    const activity = exportActivity(report);
    const { buildLedgerWorkbook } = await import("@/lib/budget/export-workbook");
    const file = await buildLedgerWorkbook(report);
    await sql`
      insert into ledger_export_log (id, user_id, range_type, range_start, range_end, sections)
      values (
        ${crypto.randomUUID()},
        ${userId},
        ${activity.rangeType},
        ${activity.rangeStart},
        ${activity.rangeEnd},
        ${activity.sections}
      )
    `;
    return {
      filename: report.filename,
      base64: file.toString("base64"),
      transactionCount: report.summary.transactionCount,
    };
  });
