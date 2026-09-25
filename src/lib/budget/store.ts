import { create } from "zustand";
import {
  AMOUNT_MESSAGE,
  currentMonthKey,
  DEFAULT_GOAL,
  isPositiveCents,
  periodBounds,
  type CurrencyCode,
  type Goal,
  type GoalIcon,
  type Transaction,
} from "@/lib/budget/model";
import {
  createLedgerTransaction,
  deleteLedgerGoal,
  deleteLedgerTransaction,
  saveLedgerGoal,
  saveLedgerProfile,
  updateLedgerTransaction,
  type LedgerSnapshot,
} from "@/lib/budget/ledger";

export type OverviewCardId = "snapshot" | "stats" | "rhythm" | "breakdown" | "goals" | "notes" | "recent";

export type BudgetLimit = { categoryId: string; limitCents: number };

export type RecurringPayment = {
  id: string;
  label: string;
  categoryId: string;
  amountCents: number;
  dayOfMonth: number;
};

export type CalendarPrefs = {
  mode: "daily" | "individual";
  startDate: string;
  includeAmount: boolean;
  includeMerchant: boolean;
  includeCategory: boolean;
  includeNotes: boolean;
  includeReminders: boolean;
  reminderTime: string;
  reminderOffsetDays: 0 | 1 | 2;
  reminderFrequency: "monthly" | "weekly" | "yearly";
  timeZone: string;
};

export type Settings = {
  theme: "light" | "dark";
  monthStartsOn: number;
  cardOrder: OverviewCardId[];
  budgets: BudgetLimit[];
  recurring: RecurringPayment[];
  calendar: CalendarPrefs;
};

export const DEFAULT_CARD_ORDER: OverviewCardId[] = [
  "snapshot",
  "stats",
  "breakdown",
  "recent",
  "rhythm",
  "goals",
  "notes",
];

export function defaultSettings(): Settings {
  return {
    theme: "dark",
    monthStartsOn: 1,
    cardOrder: [...DEFAULT_CARD_ORDER],
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

type Notice = { text: string; undo: Transaction | null };

export type DisplayRange = { start: string; end: string; custom: boolean };

function rangeFor(month: string, startsOn: number): DisplayRange {
  const bounds = periodBounds(month, startsOn);
  return { start: bounds.start, end: bounds.end, custom: false };
}

type BudgetState = {
  status: "signed_out" | "loading" | "ready";
  ownerId: string | null;
  epoch: number;
  transactions: Transaction[];
  goals: Goal[];
  currency: CurrencyCode;
  settings: Settings;
  viewMonth: string;
  displayRange: DisplayRange;
  notice: Notice | null;
  beginSession: (userId: string) => number;
  applyRemote: (epoch: number, snapshot: LedgerSnapshot) => void;
  clearSession: () => void;
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (id: string, patch: Omit<Transaction, "id">) => void;
  deleteTransaction: (id: string) => void;
  undoDelete: () => void;
  dismissNotice: () => void;
  duplicateTransaction: (id: string) => void;
  addGoal: (goal: Goal) => void;
  updateGoal: (goal: Goal) => void;
  deleteGoal: (id: string) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setViewMonth: (month: string) => void;
  setDisplayRange: (range: DisplayRange) => void;
  patchSettings: (patch: Partial<Settings>) => void;
  moveCard: (id: OverviewCardId, direction: -1 | 1) => void;
  confirmRecurring: (item: RecurringPayment) => void;
  removeRecurring: (id: string) => void;
  setBudget: (limit: BudgetLimit) => void;
  removeBudget: (categoryId: string) => void;
};

type Persisted = {
  transactions?: Transaction[];
  goals?: Goal[];
  goal?: { id?: string; name?: string; targetCents?: number; icon?: GoalIcon };
  currency?: CurrencyCode;
  settings?: Partial<Settings>;
  viewMonth?: string;
};

function asGoal(value: Persisted["goal"], fallbackId: string): Goal {
  return {
    id: value?.id || fallbackId,
    name: value?.name?.trim() || DEFAULT_GOAL.name,
    targetCents: value?.targetCents && value.targetCents > 0 ? value.targetCents : DEFAULT_GOAL.targetCents,
    icon: value?.icon || "shield",
  };
}

export function migrateBudget(persisted: unknown): Pick<BudgetState, "transactions" | "goals" | "currency" | "settings" | "viewMonth"> {
  const state = (persisted ?? {}) as Persisted;
  const goals = Array.isArray(state.goals)
    ? state.goals
    : state.goal
      ? [asGoal(state.goal, DEFAULT_GOAL.id)]
      : [];
  const primary = goals[0]?.id ?? DEFAULT_GOAL.id;
  const transactions = (Array.isArray(state.transactions) ? state.transactions : []).map((tx) =>
    tx.kind === "savings" && !tx.goalId ? { ...tx, goalId: primary } : tx,
  );
  const settings = { ...defaultSettings(), ...(state.settings ?? {}) };
  if (!Array.isArray(settings.cardOrder) || settings.cardOrder.length === 0) settings.cardOrder = [...DEFAULT_CARD_ORDER];
  const known = new Set(DEFAULT_CARD_ORDER);
  settings.cardOrder = [
    ...settings.cardOrder.filter((id) => known.has(id)),
    ...DEFAULT_CARD_ORDER.filter((id) => !settings.cardOrder.includes(id)),
  ];
  if (settings.cardOrder.join(",") === "snapshot,stats,rhythm,breakdown,goals,notes,recent") settings.cardOrder = [...DEFAULT_CARD_ORDER];
  settings.monthStartsOn = Math.min(28, Math.max(1, Math.round(settings.monthStartsOn) || 1));
  const calendar = { ...defaultSettings().calendar, ...(state.settings?.calendar ?? {}) };
  if (calendar.mode !== "daily" && calendar.mode !== "individual") calendar.mode = "daily";
  if (calendar.reminderOffsetDays !== 0 && calendar.reminderOffsetDays !== 1 && calendar.reminderOffsetDays !== 2) {
    calendar.reminderOffsetDays = 1;
  }
  if (calendar.reminderFrequency !== "monthly" && calendar.reminderFrequency !== "weekly" && calendar.reminderFrequency !== "yearly") {
    calendar.reminderFrequency = "monthly";
  }
  settings.calendar = calendar;
  return {
    transactions,
    goals,
    currency: state.currency === "USD" || state.currency === "EUR" || state.currency === "GBP" || state.currency === "INR" ? state.currency : "INR",
    settings,
    viewMonth: typeof state.viewMonth === "string" && /^\d{4}-\d{2}$/.test(state.viewMonth) ? state.viewMonth : currentMonthKey(),
  };
}

function blankLedger(): Pick<BudgetState, "transactions" | "goals" | "currency" | "settings" | "viewMonth" | "displayRange" | "notice"> {
  const viewMonth = currentMonthKey();
  return {
    transactions: [],
    goals: [],
    currency: "INR",
    settings: defaultSettings(),
    viewMonth,
    displayRange: rangeFor(viewMonth, 1),
    notice: null,
  };
}

function sameSession(epoch: number, ownerId: string | null) {
  const state = useBudget.getState();
  return state.epoch === epoch && state.ownerId === ownerId && state.status === "ready";
}

let ledgerAbort = new AbortController();

/** Signal for the current account. Aborted on logout or account switch. */
export function ledgerRequestSignal(): AbortSignal {
  return ledgerAbort.signal;
}

function rotateLedgerAbort() {
  ledgerAbort.abort();
  ledgerAbort = new AbortController();
}

function persistProfile(epoch: number, ownerId: string | null) {
  const state = useBudget.getState();
  const signal = ledgerRequestSignal();
  void saveLedgerProfile({
    data: { currency: state.currency, settings: state.settings, viewMonth: state.viewMonth },
    signal,
  }).catch(() => {
    if (signal.aborted || !sameSession(epoch, ownerId)) return;
    useBudget.setState({ notice: { text: "Could not save those preferences.", undo: null } });
  });
}

export const useBudget = create<BudgetState>()((set, get) => ({
  status: "signed_out",
  ownerId: null,
  epoch: 0,
  ...blankLedger(),
  beginSession: (userId) => {
    rotateLedgerAbort();
    const epoch = get().epoch + 1;
    set({ status: "loading", ownerId: userId, epoch, ...blankLedger() });
    return epoch;
  },
  applyRemote: (epoch, snapshot) => {
    const state = get();
    if (state.epoch !== epoch || state.status === "signed_out") return;
    set({
      status: "ready",
      transactions: snapshot.transactions,
      goals: snapshot.goals,
      currency: snapshot.currency,
      settings: snapshot.settings,
      viewMonth: snapshot.viewMonth,
      displayRange: rangeFor(snapshot.viewMonth, snapshot.settings.monthStartsOn),
    });
  },
  clearSession: () => {
    rotateLedgerAbort();
    set({ status: "signed_out", ownerId: null, epoch: get().epoch + 1, ...blankLedger() });
  },
  addTransaction: (tx) => {
    const { epoch, ownerId } = get();
    if (!ownerId) return;
    if (!isPositiveCents(tx.amountCents)) {
      set({ notice: { text: AMOUNT_MESSAGE, undo: null } });
      return;
    }
    const signal = ledgerRequestSignal();
    set((state) => ({ transactions: [tx, ...state.transactions], notice: null }));
    void createLedgerTransaction({ data: tx, signal }).catch(() => {
      if (signal.aborted || !sameSession(epoch, ownerId)) return;
      set((state) => ({
        transactions: state.transactions.filter((item) => item.id !== tx.id),
        notice: { text: "Could not save that transaction.", undo: null },
      }));
    });
  },
  updateTransaction: (id, patch) => {
    const { epoch, ownerId } = get();
    const previous = get().transactions.find((item) => item.id === id);
    if (!previous || !ownerId) return;
    if (!isPositiveCents(patch.amountCents)) {
      set({ notice: { text: AMOUNT_MESSAGE, undo: null } });
      return;
    }
    const next = { id, ...patch };
    const signal = ledgerRequestSignal();
    set((state) => ({ transactions: state.transactions.map((item) => (item.id === id ? next : item)) }));
    void updateLedgerTransaction({ data: next, signal }).catch(() => {
      if (signal.aborted || !sameSession(epoch, ownerId)) return;
      set((state) => ({
        transactions: state.transactions.map((item) => (item.id === id ? previous : item)),
        notice: { text: "Could not update that transaction.", undo: null },
      }));
    });
  },
  deleteTransaction: (id) => {
    const { epoch, ownerId } = get();
    const tx = get().transactions.find((item) => item.id === id);
    if (!tx || !ownerId) return;
    const signal = ledgerRequestSignal();
    set((state) => ({
      transactions: state.transactions.filter((item) => item.id !== id),
      notice: { text: "Transaction deleted.", undo: tx },
    }));
    void deleteLedgerTransaction({ data: id, signal }).catch(() => {
      if (signal.aborted || !sameSession(epoch, ownerId)) return;
      set((state) => ({
        transactions: state.transactions.some((item) => item.id === id) ? state.transactions : [tx, ...state.transactions],
        notice: { text: "Could not delete that transaction.", undo: null },
      }));
    });
  },
  undoDelete: () => {
    const undo = get().notice?.undo;
    if (!undo) return;
    set({ notice: null });
    get().addTransaction(undo);
  },
  dismissNotice: () => set({ notice: null }),
  duplicateTransaction: (id) => {
    const tx = get().transactions.find((item) => item.id === id);
    if (!tx) return;
    get().addTransaction({ ...tx, id: crypto.randomUUID() });
    set({ notice: { text: "Transaction duplicated.", undo: null } });
  },
  addGoal: (goal) => {
    const { epoch, ownerId } = get();
    if (!ownerId) return;
    if (!isPositiveCents(goal.targetCents)) {
      set({ notice: { text: AMOUNT_MESSAGE, undo: null } });
      return;
    }
    const signal = ledgerRequestSignal();
    set((state) => ({ goals: [...state.goals, goal] }));
    void saveLedgerGoal({ data: goal, signal }).catch(() => {
      if (signal.aborted || !sameSession(epoch, ownerId)) return;
      set((state) => ({ goals: state.goals.filter((item) => item.id !== goal.id) }));
    });
  },
  updateGoal: (goal) => {
    const { epoch, ownerId } = get();
    const previous = get().goals.find((item) => item.id === goal.id);
    if (!previous || !ownerId) return;
    if (!isPositiveCents(goal.targetCents)) {
      set({ notice: { text: AMOUNT_MESSAGE, undo: null } });
      return;
    }
    const signal = ledgerRequestSignal();
    set((state) => ({ goals: state.goals.map((item) => (item.id === goal.id ? goal : item)) }));
    void saveLedgerGoal({ data: goal, signal }).catch(() => {
      if (signal.aborted || !sameSession(epoch, ownerId)) return;
      set((state) => ({ goals: state.goals.map((item) => (item.id === goal.id ? previous : item)) }));
    });
  },
  deleteGoal: (id) => {
    const { epoch, ownerId } = get();
    const previous = get().goals.find((item) => item.id === id);
    if (!previous || !ownerId) return;
    const signal = ledgerRequestSignal();
    set((state) => ({ goals: state.goals.filter((goal) => goal.id !== id) }));
    void deleteLedgerGoal({ data: id, signal }).catch(() => {
      if (signal.aborted || !sameSession(epoch, ownerId)) return;
      set((state) => ({ goals: state.goals.some((goal) => goal.id === id) ? state.goals : [...state.goals, previous] }));
    });
  },
  setCurrency: (currency) => {
    const { epoch, ownerId } = get();
    set({ currency });
    persistProfile(epoch, ownerId);
  },
  setViewMonth: (viewMonth) => {
    const { epoch, ownerId } = get();
    set({ viewMonth, displayRange: rangeFor(viewMonth, get().settings.monthStartsOn) });
    persistProfile(epoch, ownerId);
  },
  setDisplayRange: (displayRange) => set({ displayRange }),
  patchSettings: (patch) => {
    const { epoch, ownerId } = get();
    const settings = { ...get().settings, ...patch };
    set({
      settings,
      ...(patch.monthStartsOn != null ? { displayRange: rangeFor(get().viewMonth, settings.monthStartsOn) } : {}),
    });
    persistProfile(epoch, ownerId);
  },
  moveCard: (id, direction) => {
    const { epoch, ownerId } = get();
    const order = [...get().settings.cardOrder];
    const index = order.indexOf(id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    const [item] = order.splice(index, 1);
    order.splice(next, 0, item);
    set((state) => ({ settings: { ...state.settings, cardOrder: order } }));
    persistProfile(epoch, ownerId);
  },
  confirmRecurring: (item) => {
    const { epoch, ownerId } = get();
    set((state) => ({
      settings: {
        ...state.settings,
        recurring: state.settings.recurring.some((row) => row.id === item.id)
          ? state.settings.recurring
          : [...state.settings.recurring, item],
      },
      notice: { text: "Scheduled payment saved. It is not a recorded transaction.", undo: null },
    }));
    persistProfile(epoch, ownerId);
  },
  removeRecurring: (id) => {
    const { epoch, ownerId } = get();
    set((state) => ({
      settings: { ...state.settings, recurring: state.settings.recurring.filter((item) => item.id !== id) },
    }));
    persistProfile(epoch, ownerId);
  },
  setBudget: (limit) => {
    const { epoch, ownerId } = get();
    if (!isPositiveCents(limit.limitCents)) {
      set({ notice: { text: AMOUNT_MESSAGE, undo: null } });
      return;
    }
    set((state) => ({
      settings: {
        ...state.settings,
        budgets: [...state.settings.budgets.filter((item) => item.categoryId !== limit.categoryId), limit],
      },
    }));
    persistProfile(epoch, ownerId);
  },
  removeBudget: (categoryId) => {
    const { epoch, ownerId } = get();
    set((state) => ({
      settings: { ...state.settings, budgets: state.settings.budgets.filter((item) => item.categoryId !== categoryId) },
    }));
    persistProfile(epoch, ownerId);
  },
}));
