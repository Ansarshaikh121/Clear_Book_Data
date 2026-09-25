import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  AMOUNT_MESSAGE,
  CATEGORIES,
  currentMonthKey,
  isCategoryForKind,
  isPositiveCents,
  type CurrencyCode,
  type Goal,
  type GoalIcon,
  type Kind,
  type Transaction,
} from "@/lib/budget/model";
import type {
  BudgetLimit,
  CalendarPrefs,
  OverviewCardId,
  RecurringPayment,
  Settings,
} from "@/lib/budget/store";

const CARD_ORDER: OverviewCardId[] = ["snapshot", "stats", "breakdown", "recent", "rhythm", "goals", "notes"];

function emptySettings(): Settings {
  return {
    theme: "dark",
    monthStartsOn: 1,
    cardOrder: [...CARD_ORDER],
    budgets: [],
    recurring: [],
    calendar: {
      mode: "daily",
      startDate: "",
      includeAmount: false,
      includeMerchant: false,
      includeCategory: false,
      includeNotes: false,
      includeReminders: true,
      reminderTime: "09:00",
      reminderOffsetDays: 1,
      reminderFrequency: "monthly",
      timeZone: "",
    },
  };
}

export type LedgerSnapshot = {
  transactions: Transaction[];
  goals: Goal[];
  currency: CurrencyCode;
  settings: Settings;
  viewMonth: string;
};

const KINDS = new Set<Kind>(["income", "expense", "savings"]);
const ICONS = new Set<GoalIcon>(["shield", "home", "plane", "gift"]);
const CURRENCIES = new Set<CurrencyCode>(["INR", "USD", "EUR", "GBP"]);
const CATEGORY_IDS = new Set(CATEGORIES.map((category) => category.id));

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function parseTransaction(value: unknown): Transaction | null {
  const row = asRecord(value);
  if (!row) return null;
  const kind = row.kind;
  const date = row.date;
  const amount = row.amountCents;
  const categoryId = row.categoryId;
  if (typeof kind !== "string" || !KINDS.has(kind as Kind)) return null;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (typeof amount !== "number" || !isPositiveCents(amount)) return null;
  if (typeof categoryId !== "string" || !isCategoryForKind(categoryId, kind as Kind)) return null;
  if (typeof row.id !== "string" || row.id.length < 4 || row.id.length > 80) return null;
  const note = typeof row.note === "string" ? row.note.trim().slice(0, 80) : "";
  const merchant = typeof row.merchant === "string" && row.merchant.trim() ? row.merchant.trim().slice(0, 60) : undefined;
  const goalId = typeof row.goalId === "string" && row.goalId ? row.goalId.slice(0, 80) : undefined;
  return { id: row.id, kind: kind as Kind, amountCents: amount, categoryId, note, date, merchant, goalId };
}

export type TxSplit = { categoryId: string; amountCents: number };

export type TxExtras = {
  splits: TxSplit[] | null;
  refundOf: string | null;
  spendingClass: "fixed" | "everyday" | null;
  collectionName: string | null;
  collectionKind: "collection" | "trip" | "project" | null;
  touchSplits: boolean;
  touchRefundOf: boolean;
  touchSpendingClass: boolean;
  touchCollection: boolean;
};

export type LedgerWrite = Transaction & { extras: TxExtras };

function emptyExtras(): TxExtras {
  return {
    splits: null,
    refundOf: null,
    spendingClass: null,
    collectionName: null,
    collectionKind: null,
    touchSplits: false,
    touchRefundOf: false,
    touchSpendingClass: false,
    touchCollection: false,
  };
}

export function parseLedgerWrite(value: unknown): LedgerWrite | null {
  const tx = parseTransaction(value);
  const row = asRecord(value);
  if (!tx || !row) return null;
  const extras = emptyExtras();
  extras.touchSplits = Object.prototype.hasOwnProperty.call(row, "splits");
  extras.touchRefundOf = Object.prototype.hasOwnProperty.call(row, "refundOf");
  extras.touchSpendingClass = Object.prototype.hasOwnProperty.call(row, "spendingClass");
  extras.touchCollection = Object.prototype.hasOwnProperty.call(row, "collectionName") || Object.prototype.hasOwnProperty.call(row, "collectionKind");

  if (extras.touchSplits && row.splits != null) {
    if (tx.kind !== "expense" || !Array.isArray(row.splits) || row.splits.length < 2 || row.splits.length > 12) return null;
    const splits: TxSplit[] = [];
    for (const item of row.splits) {
      const part = asRecord(item);
      if (!part || typeof part.categoryId !== "string" || !CATEGORY_IDS.has(part.categoryId)) return null;
      if (CATEGORIES.find((category) => category.id === part.categoryId)?.kind !== "expense") return null;
      if (!isPositiveCents(part.amountCents)) return null;
      splits.push({ categoryId: part.categoryId, amountCents: part.amountCents });
    }
    if (splits.reduce((sum, part) => sum + part.amountCents, 0) !== tx.amountCents) return null;
    extras.splits = splits;
  }
  if (extras.touchRefundOf && row.refundOf != null) {
    if (typeof row.refundOf !== "string" || row.refundOf.length < 4 || row.refundOf.length > 80) return null;
    if (tx.kind !== "income" || tx.categoryId !== "refund") return null;
    extras.refundOf = row.refundOf;
  }
  if (extras.touchSpendingClass && row.spendingClass != null) {
    if (row.spendingClass !== "fixed" && row.spendingClass !== "everyday") return null;
    if (tx.kind !== "expense") return null;
    extras.spendingClass = row.spendingClass;
  }
  if (extras.touchCollection) {
    if (row.collectionName != null) {
      if (typeof row.collectionName !== "string" || !row.collectionName.trim()) return null;
      extras.collectionName = row.collectionName.trim().slice(0, 80);
    }
    if (row.collectionKind != null) {
      if (row.collectionKind !== "collection" && row.collectionKind !== "trip" && row.collectionKind !== "project") return null;
      if (!extras.collectionName) return null;
      extras.collectionKind = row.collectionKind;
    }
  }
  return { ...tx, extras };
}

async function assertRefundLink(sql: Awaited<ReturnType<typeof db>>, userId: string, refundOf: string | null) {
  if (!refundOf) return;
  const rows = await sql<{ id: string }>`
    select id from ledger_transactions
    where user_id = ${userId} and id = ${refundOf} and kind = 'expense'
  `;
  if (rows.length === 0) throw new Error("Invalid transaction");
}

export function parseGoal(value: unknown): Goal | null {
  const row = asRecord(value);
  if (!row) return null;
  if (typeof row.id !== "string" || row.id.length < 4 || row.id.length > 80) return null;
  if (typeof row.name !== "string" || !row.name.trim()) return null;
  if (!isPositiveCents(row.targetCents)) return null;
  if (typeof row.icon !== "string" || !ICONS.has(row.icon as GoalIcon)) return null;
  return { id: row.id, name: row.name.trim().slice(0, 40), targetCents: row.targetCents, icon: row.icon as GoalIcon };
}

function parseSettings(value: unknown): Settings {
  const base = emptySettings();
  const row = asRecord(value);
  if (!row) return base;
  const theme = row.theme === "light" ? "light" : "dark";
  const monthStartsOn = typeof row.monthStartsOn === "number" ? Math.min(28, Math.max(1, Math.round(row.monthStartsOn))) : 1;
  const cardOrder = Array.isArray(row.cardOrder)
    ? (row.cardOrder.filter((id) => CARD_ORDER.includes(id as OverviewCardId)) as OverviewCardId[])
    : [];
  const order = [...cardOrder, ...CARD_ORDER.filter((id) => !cardOrder.includes(id))];
  if (order.join(",") === "snapshot,stats,rhythm,breakdown,goals,notes,recent") order.splice(0, order.length, ...CARD_ORDER);
  const budgets = Array.isArray(row.budgets)
    ? row.budgets.flatMap((item) => {
        const budget = asRecord(item);
        if (!budget || typeof budget.categoryId !== "string" || !CATEGORY_IDS.has(budget.categoryId)) return [];
        if (!isPositiveCents(budget.limitCents)) return [];
        return [{ categoryId: budget.categoryId, limitCents: Math.round(budget.limitCents) } satisfies BudgetLimit];
      })
    : [];
  const recurring = Array.isArray(row.recurring)
    ? row.recurring.flatMap((item) => {
        const payment = asRecord(item);
        if (!payment || typeof payment.id !== "string" || typeof payment.label !== "string") return [];
        if (typeof payment.categoryId !== "string" || !CATEGORY_IDS.has(payment.categoryId)) return [];
        if (!isPositiveCents(payment.amountCents)) return [];
        if (typeof payment.dayOfMonth !== "number") return [];
        return [{
          id: payment.id.slice(0, 120),
          label: payment.label.slice(0, 80),
          categoryId: payment.categoryId,
          amountCents: Math.round(payment.amountCents),
          dayOfMonth: Math.min(28, Math.max(1, Math.round(payment.dayOfMonth))),
        } satisfies RecurringPayment];
      })
    : [];
  const calendarRow = asRecord(row.calendar);
  const calendar: CalendarPrefs = {
    ...base.calendar,
    ...(calendarRow
      ? {
          mode: calendarRow.mode === "individual" ? "individual" : "daily",
          startDate: typeof calendarRow.startDate === "string" ? calendarRow.startDate.slice(0, 10) : "",
          includeAmount: calendarRow.includeAmount === true,
          includeMerchant: calendarRow.includeMerchant === true,
          includeCategory: calendarRow.includeCategory === true,
          includeNotes: calendarRow.includeNotes === true,
          includeReminders: calendarRow.includeReminders !== false,
          reminderTime: typeof calendarRow.reminderTime === "string" ? calendarRow.reminderTime.slice(0, 5) : "09:00",
          reminderOffsetDays: calendarRow.reminderOffsetDays === 0 || calendarRow.reminderOffsetDays === 2 ? calendarRow.reminderOffsetDays : 1,
          reminderFrequency:
            calendarRow.reminderFrequency === "weekly" || calendarRow.reminderFrequency === "yearly"
              ? calendarRow.reminderFrequency
              : "monthly",
          timeZone: typeof calendarRow.timeZone === "string" ? calendarRow.timeZone.slice(0, 80) : "",
        }
      : {}),
  };
  return { theme, monthStartsOn, cardOrder: order, budgets, recurring, calendar };
}

function parseCurrency(value: unknown): CurrencyCode {
  return typeof value === "string" && CURRENCIES.has(value as CurrencyCode) ? (value as CurrencyCode) : "INR";
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
};

type GoalRow = { id: string; name: string; target_cents: number; icon: string };
type ProfileRow = {
  currency: string;
  theme: string;
  month_starts_on: number;
  card_order: string;
  budgets: string;
  recurring: string;
  calendar: string;
  view_month: string;
};

function txFromRow(row: TxRow): Transaction {
  return {
    id: row.id,
    kind: row.kind as Kind,
    amountCents: Number(row.amount_cents),
    categoryId: row.category_id,
    note: row.note,
    merchant: row.merchant ?? undefined,
    goalId: row.goal_id ?? undefined,
    date: String(row.tx_date).slice(0, 10),
  };
}

async function db() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function readSnapshot(userId: string): Promise<LedgerSnapshot> {
  const sql = await db();
  const defaults = emptySettings();
  const month = currentMonthKey();
  await sql`
    insert into ledger_profiles (user_id, currency, theme, month_starts_on, card_order, budgets, recurring, calendar, view_month)
    values (
      ${userId},
      'INR',
      'dark',
      1,
      ${JSON.stringify(defaults.cardOrder)},
      '[]',
      '[]',
      ${JSON.stringify(defaults.calendar)},
      ${month}
    )
    on conflict (user_id) do nothing
  `;
  const transactions = await sql<TxRow>`
    select id, kind, amount_cents, category_id, note, merchant, goal_id, tx_date
    from ledger_transactions
    where user_id = ${userId}
    order by tx_date desc, id desc
  `;
  const goals = await sql<GoalRow>`
    select id, name, target_cents, icon from ledger_goals where user_id = ${userId} order by name
  `;
  const profiles = await sql<ProfileRow>`
    select currency, theme, month_starts_on, card_order, budgets, recurring, calendar, view_month
    from ledger_profiles
    where user_id = ${userId}
  `;
  const profile = profiles[0];
  const settings = parseSettings(
    profile
      ? {
          theme: profile.theme,
          monthStartsOn: Number(profile.month_starts_on),
          cardOrder: JSON.parse(profile.card_order),
          budgets: JSON.parse(profile.budgets),
          recurring: JSON.parse(profile.recurring),
          calendar: JSON.parse(profile.calendar),
        }
      : null,
  );
  return {
    transactions: transactions.map(txFromRow),
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetCents: Number(goal.target_cents),
      icon: (ICONS.has(goal.icon as GoalIcon) ? goal.icon : "shield") as GoalIcon,
    })),
    currency: parseCurrency(profile?.currency),
    settings,
    viewMonth: profile?.view_month && /^\d{4}-\d{2}$/.test(profile.view_month) ? profile.view_month : month,
  };
}

export const loadLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<LedgerSnapshot> => readSnapshot(context.userId));

function rejectBadAmounts(row: Record<string, unknown> | null, fields: string[]) {
  if (!row) return;
  for (const field of fields) {
    if (field in row && !isPositiveCents(row[field])) throw new Error(AMOUNT_MESSAGE);
  }
}

export const createLedgerTransaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    rejectBadAmounts(row, ["amountCents"]);
    if (row && Array.isArray(row.splits)) {
      for (const item of row.splits) rejectBadAmounts(asRecord(item), ["amountCents"]);
    }
    const tx = parseLedgerWrite(input);
    if (!tx) throw new Error("Invalid transaction");
    return tx;
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await assertRefundLink(sql, context.userId, data.extras.refundOf);
    await sql`
      insert into ledger_transactions (
        id, user_id, kind, amount_cents, category_id, note, merchant, goal_id, tx_date,
        splits, refund_of, spending_class, collection_name, collection_kind, created_at
      )
      values (
        ${data.id},
        ${context.userId},
        ${data.kind},
        ${data.amountCents},
        ${data.categoryId},
        ${data.note},
        ${data.merchant ?? null},
        ${data.goalId ?? null},
        ${data.date},
        ${data.extras.splits ? JSON.stringify(data.extras.splits) : null},
        ${data.extras.refundOf},
        ${data.extras.spendingClass},
        ${data.extras.collectionName},
        ${data.extras.collectionKind},
        now()
      )
      on conflict (user_id, id) do nothing
    `;
    return data;
  });

export const updateLedgerTransaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    rejectBadAmounts(row, ["amountCents"]);
    if (row && Array.isArray(row.splits)) {
      for (const item of row.splits) rejectBadAmounts(asRecord(item), ["amountCents"]);
    }
    const tx = parseLedgerWrite(input);
    if (!tx) throw new Error("Invalid transaction");
    return tx;
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    if (data.extras.touchRefundOf) await assertRefundLink(sql, context.userId, data.extras.refundOf);
    const rows = await sql<{ id: string }>`
      update ledger_transactions
      set kind = ${data.kind},
          amount_cents = ${data.amountCents},
          category_id = ${data.categoryId},
          note = ${data.note},
          merchant = ${data.merchant ?? null},
          goal_id = ${data.goalId ?? null},
          tx_date = ${data.date},
          splits = case when ${data.extras.touchSplits} then ${data.extras.splits ? JSON.stringify(data.extras.splits) : null} else splits end,
          refund_of = case when ${data.extras.touchRefundOf} then ${data.extras.refundOf} else refund_of end,
          spending_class = case when ${data.extras.touchSpendingClass} then ${data.extras.spendingClass} else spending_class end,
          collection_name = case when ${data.extras.touchCollection} then ${data.extras.collectionName} else collection_name end,
          collection_kind = case when ${data.extras.touchCollection} then ${data.extras.collectionKind} else collection_kind end
      where user_id = ${context.userId} and id = ${data.id}
      returning id
    `;
    if (rows.length === 0) throw new Error("Not found");
    return data;
  });

export const deleteLedgerTransaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: unknown) => {
    if (typeof id !== "string" || id.length < 4) throw new Error("Invalid transaction");
    return id;
  })
  .handler(async ({ context, data: id }) => {
    const sql = await db();
    const rows = await sql<{ id: string }>`
      delete from ledger_transactions where user_id = ${context.userId} and id = ${id} returning id
    `;
    if (rows.length === 0) throw new Error("Not found");
    return id;
  });

export const saveLedgerGoal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    rejectBadAmounts(row, ["targetCents"]);
    const goal = parseGoal(input);
    if (!goal) throw new Error("Invalid goal");
    return goal;
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await sql`
      insert into ledger_goals (id, user_id, name, target_cents, icon)
      values (${data.id}, ${context.userId}, ${data.name}, ${data.targetCents}, ${data.icon})
      on conflict (user_id, id) do update
      set name = excluded.name, target_cents = excluded.target_cents, icon = excluded.icon
    `;
    return data;
  });

export const deleteLedgerGoal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: unknown) => {
    if (typeof id !== "string" || id.length < 4) throw new Error("Invalid goal");
    return id;
  })
  .handler(async ({ context, data: id }) => {
    const sql = await db();
    const rows = await sql<{ id: string }>`
      delete from ledger_goals where user_id = ${context.userId} and id = ${id} returning id
    `;
    if (rows.length === 0) throw new Error("Not found");
    await sql`update ledger_transactions set goal_id = null where user_id = ${context.userId} and goal_id = ${id}`;
    return id;
  });

export const saveLedgerProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    if (!row) throw new Error("Invalid profile");
    const settingsRow = asRecord(row.settings);
    if (settingsRow && Array.isArray(settingsRow.budgets)) {
      for (const item of settingsRow.budgets) rejectBadAmounts(asRecord(item), ["limitCents"]);
    }
    if (settingsRow && Array.isArray(settingsRow.recurring)) {
      for (const item of settingsRow.recurring) rejectBadAmounts(asRecord(item), ["amountCents"]);
    }
    const viewMonth = typeof row.viewMonth === "string" && /^\d{4}-\d{2}$/.test(row.viewMonth) ? row.viewMonth : currentMonthKey();
    return { currency: parseCurrency(row.currency), settings: parseSettings(row.settings), viewMonth };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await sql`
      insert into ledger_profiles (user_id, currency, theme, month_starts_on, card_order, budgets, recurring, calendar, view_month)
      values (
        ${context.userId},
        ${data.currency},
        ${data.settings.theme},
        ${data.settings.monthStartsOn},
        ${JSON.stringify(data.settings.cardOrder)},
        ${JSON.stringify(data.settings.budgets)},
        ${JSON.stringify(data.settings.recurring)},
        ${JSON.stringify(data.settings.calendar)},
        ${data.viewMonth}
      )
      on conflict (user_id) do update set
        currency = excluded.currency,
        theme = excluded.theme,
        month_starts_on = excluded.month_starts_on,
        card_order = excluded.card_order,
        budgets = excluded.budgets,
        recurring = excluded.recurring,
        calendar = excluded.calendar,
        view_month = excluded.view_month
    `;
    return data;
  });


function statementReference(note: string): string {
  return /(?:UPI\s*\/\s*(?:DR|CR)\s*\/\s*\d+|IMPS\/[A-Z0-9]+|NEFT\/[A-Z0-9]+|IFT\/\d+|POS-VISA\/[^/]*\/\d+|ATM-NFS\/[^/]*\/[^/]*\/\d+|\b\d{10,}\b)/i.exec(note)?.[0]?.toUpperCase().replace(/\s+/g, "") ?? "";
}

/** Import only validated transactions belonging to the signed-in account. */
export const importStatementTransactions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    if (!row) throw new Error("Invalid statement");
    const month = row.month;
    if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month");
    if (!Array.isArray(row.transactions) || row.transactions.length === 0 || row.transactions.length > 300) throw new Error("Invalid statement size");
    const transactions = row.transactions.map((value: unknown) => {
      const tx = parseTransaction(value);
      if (!tx || !tx.id.startsWith("stmt-idfc-") || tx.date.slice(0, 7) !== month || tx.kind === "savings" || tx.goalId) throw new Error("Invalid statement row");
      return tx;
    });
    return { month, transactions };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const existing = await sql<TxRow>`
      select id, kind, amount_cents, category_id, note, merchant, goal_id, tx_date
      from ledger_transactions where user_id = ${context.userId}
    `;
    const seenIds = new Set(existing.map((row) => row.id));
    const seenReferences = new Set(existing.flatMap((row) => {
      const reference = statementReference(row.note);
      return reference ? [`${row.kind}:${row.amount_cents}:${reference}`] : [];
    }));
    let added = 0;
    let skipped = 0;
    for (const tx of data.transactions) {
      const reference = statementReference(tx.note);
      const key = reference ? `${tx.kind}:${tx.amountCents}:${reference}` : "";
      // Legacy manual entries can have a bank reference despite a random id.
      if (seenIds.has(tx.id) || (key && seenReferences.has(key)) || (reference && existing.some((row) => row.kind === tx.kind && Number(row.amount_cents) === tx.amountCents && row.note.includes(reference.match(/\\d{10,}/)?.[0] ?? "\u0000")))) { skipped++; continue; }
      const inserted = await sql<{ id: string }>`
        insert into ledger_transactions (id, user_id, kind, amount_cents, category_id, note, merchant, goal_id, tx_date)
        values (${tx.id}, ${context.userId}, ${tx.kind}, ${tx.amountCents}, ${tx.categoryId},
                ${tx.note}, ${tx.merchant ?? null}, null, ${tx.date})
        on conflict (user_id, id) do nothing returning id
      `;
      if (inserted.length) { added++; seenIds.add(tx.id); if (key) seenReferences.add(key); }
      else skipped++;
    }
    return { added, skipped, snapshot: await readSnapshot(context.userId) };
  });

export const importOwnedLedger = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const row = asRecord(input);
    if (!row || row.confirm !== true) throw new Error("Import must be confirmed");
    const transactions = Array.isArray(row.transactions) ? row.transactions.map(parseTransaction).filter((tx): tx is Transaction => tx !== null) : [];
    const goals = Array.isArray(row.goals) ? row.goals.map(parseGoal).filter((goal): goal is Goal => goal !== null) : [];
    if (transactions.length > 500 || goals.length > 50) throw new Error("Import is too large");
    return { transactions, goals };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    for (const goal of data.goals) {
      await sql`
        insert into ledger_goals (id, user_id, name, target_cents, icon)
        values (${goal.id}, ${context.userId}, ${goal.name}, ${goal.targetCents}, ${goal.icon})
        on conflict (user_id, id) do nothing
      `;
    }
    for (const tx of data.transactions) {
      await sql`
        insert into ledger_transactions (id, user_id, kind, amount_cents, category_id, note, merchant, goal_id, tx_date)
        values (
          ${tx.id}, ${context.userId}, ${tx.kind}, ${tx.amountCents}, ${tx.categoryId},
          ${tx.note}, ${tx.merchant ?? null}, ${tx.goalId ?? null}, ${tx.date}
        )
        on conflict (user_id, id) do nothing
      `;
    }
    return readSnapshot(context.userId);
  });
