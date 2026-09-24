import { useState } from "react";
import { PublicShell, ProseSection } from "@/components/budget/public-shell";
import { PUBLIC_PAGES } from "@/lib/seo";
import { formatRupees, monthlyRemaining, parseWorksheetRupees } from "@/lib/budget/worksheet";

const EXPENSE_CATEGORIES = ["Housing", "Groceries", "Dining", "Transport", "Utilities", "Health", "Shopping", "Personal"] as const;
const INCOME_CATEGORIES = ["Pay", "Side work", "Refund", "Other income"] as const;

export function FeaturesPage() {
  const page = PUBLIC_PAGES.find((item) => item.path === "/features")!;
  return (
    <PublicShell path="/features">
      <h1 className="mt-6 font-display text-4xl leading-tight text-foreground">{page.h1}</h1>
      <p className="mt-4 text-sm leading-6 text-foreground">{page.description}</p>
      <ProseSection title="A record, not a bank feed">
        <p>
          Every number in Clearbook starts as something you type: an amount greater than zero, a category, a date, and an optional note and merchant. There is no bank connection and no reading of SMS or UPI alerts.
        </p>
        <p>
          You can search, filter, and sort the list, then edit, duplicate, or delete a record. A deletion can be undone. An expense can be split across categories. The split parts replace the original amount, so the expense is not counted twice.
        </p>
      </ProseSection>
      <ProseSection title="The month you are looking at">
        <p>
          Move forward or back by month. Remaining for that period is income minus expenses minus savings. Charts use only the spending recorded in the period. If the previous equivalent period has no records, Clearbook says there is not enough data to compare. It does not treat a missing month as zero spending. If that earlier period has records and the spending is zero, it says so and does not show a percentage increase.
        </p>
        <p>
          Scheduled payments can be listed, and you can download a calendar file. That file does not stay synced with Google Calendar.
        </p>
      </ProseSection>
      <ProseSection title="Your account only">
        <p>
          A new account starts empty. The ledger is stored with the account, so signing in on another device shows the same records. From Settings you can download an Excel file of your own transactions, goals, and budgets. Other people’s records are not in that file.
        </p>
        <p>Sign-in is email and password, Google, or X. A password reset can be requested from the login screen. Delivery depends on mail being set up for the site.</p>
      </ProseSection>
      <PageLinks except="/features" />
    </PublicShell>
  );
}

export function TrackExpensesPage() {
  const page = PUBLIC_PAGES.find((item) => item.path === "/track-expenses")!;
  return (
    <PublicShell path="/track-expenses">
      <h1 className="mt-6 font-display text-4xl leading-tight text-foreground">{page.h1}</h1>
      <p className="mt-4 text-sm leading-6 text-foreground">{page.description}</p>
      <ProseSection title="What one expense contains">
        <p>
          An expense needs an amount greater than zero, a date, and one of the spending categories: {EXPENSE_CATEGORIES.join(", ")}. A merchant and a note are optional. For example, a vegetable purchase can be Groceries, dated the day you paid, with the shop name as the merchant. That example is only a shape for a record. It is not a suggested budget.
        </p>
        <p>
          Clearbook will not accept a negative amount, zero, or a blank. A refund does not belong here as a minus. Record it as income. See <a className="font-medium text-primary underline-offset-2 hover:underline" href="/record-income">Record income</a>.
        </p>
      </ProseSection>
      <ProseSection title="Finding it later">
        <p>
          The transaction list can be searched and filtered, then sorted by date or amount. Open a row to edit it, duplicate it when the same payment happens again, or delete it and undo that delete if it was a mistake.
        </p>
        <p>
          If one payment covers two categories, split it. The parts stand in for the original amount. Totals do not add the parent and the parts together.
        </p>
      </ProseSection>
      <ProseSection title="What this page is not">
        <p>
          This is not automatic expense tracking. Clearbook does not see your bank, card, or UPI messages. Cash you do not write down is simply absent. The monthly picture is only as complete as the records you add.
        </p>
      </ProseSection>
      <p className="mt-8 text-sm">
        <a href="/login" className="font-medium text-primary underline-offset-2 hover:underline">Create an account</a>
        <span> to keep the list, or use the </span>
        <a href="/budget-worksheet" className="font-medium text-primary underline-offset-2 hover:underline">worksheet</a>
        <span> if you only want the monthly sum.</span>
      </p>
    </PublicShell>
  );
}

export function RecordIncomePage() {
  const page = PUBLIC_PAGES.find((item) => item.path === "/record-income")!;
  return (
    <PublicShell path="/record-income">
      <h1 className="mt-6 font-display text-4xl leading-tight text-foreground">{page.h1}</h1>
      <p className="mt-4 text-sm leading-6 text-foreground">{page.description}</p>
      <ProseSection title="Income categories">
        <p>Income uses four categories: {INCOME_CATEGORIES.join(", ")}. Each record still needs an amount greater than zero and a date.</p>
        <p>
          Pay is for wages or salary you choose to record. Side work is for other earned money. Other income is the rest. None of these categories creates an invoice or a tax form.
        </p>
      </ProseSection>
      <ProseSection title="A refund is income">
        <p>
          If a shop returns money, record a Refund for the amount you received. Do not enter the original expense as a negative number. The original expense can stay as the spending that happened. The refund is new income on the day it arrived. That keeps expenses from being silently reduced.
        </p>
      </ProseSection>
      <ProseSection title="How income changes the month">
        <p>
          Remaining for the period you are viewing is income, minus expenses, minus savings. Income you have not entered is not assumed. A month with expenses and no income records will show those expenses against zero income, which is a gap in the ledger, not a bank overdraft.
        </p>
      </ProseSection>
      <p className="mt-8 text-sm">
        <a href="/track-expenses" className="font-medium text-primary underline-offset-2 hover:underline">Expenses</a>
        <span> and </span>
        <a href="/savings-goals" className="font-medium text-primary underline-offset-2 hover:underline">savings goals</a>
        <span> are recorded separately, so they are not mixed into income.</span>
      </p>
    </PublicShell>
  );
}

export function CategoryBudgetsPage() {
  const page = PUBLIC_PAGES.find((item) => item.path === "/category-budgets")!;
  return (
    <PublicShell path="/category-budgets">
      <h1 className="mt-6 font-display text-4xl leading-tight text-foreground">{page.h1}</h1>
      <p className="mt-4 text-sm leading-6 text-foreground">{page.description}</p>
      <ProseSection title="A limit is not a payment">
        <p>
          A category budget is a ceiling you type for a spending category, such as Groceries or Transport. Clearbook compares that ceiling with the expenses you recorded in the month you are viewing. If recorded spending is higher, the category is over the limit you set. Clearbook does not block the purchase, transfer money, or tell you what the limit should be.
        </p>
        <p>
          The limit itself must be greater than zero. Leaving a category without a limit means there is nothing to compare. That is different from a limit of zero, which the product does not accept.
        </p>
      </ProseSection>
      <ProseSection title="A labeled example">
        <p>
          Suppose you set Groceries to ₹8,000 for the month you are viewing, and the grocery expenses you recorded add up to more than that. The category is over by the difference. Those rupees are an illustration of the comparison, not a recommended grocery budget for a household in India.
        </p>
      </ProseSection>
      <ProseSection title="Tied to the month you open">
        <p>
          Budgets follow the financial month, including a start day from the 1st through the 28th. Changing the month changes which expenses are counted against the limit. Spending outside that window is not silently included.
        </p>
      </ProseSection>
      <p className="mt-8 text-sm">
        <a href="/track-expenses" className="font-medium text-primary underline-offset-2 hover:underline">Record the expenses</a>
        <span> first. A budget with no records has nothing to measure.</span>
      </p>
    </PublicShell>
  );
}

export function SavingsGoalsPage() {
  const page = PUBLIC_PAGES.find((item) => item.path === "/savings-goals")!;
  return (
    <PublicShell path="/savings-goals">
      <h1 className="mt-6 font-display text-4xl leading-tight text-foreground">{page.h1}</h1>
      <p className="mt-4 text-sm leading-6 text-foreground">{page.description}</p>
      <ProseSection title="More than one target">
        <p>
          You can keep more than one goal, each with a name and a target amount greater than zero. A savings record is money you set aside on a date. It can point at a goal. Savings are not income and they are not an expense. They reduce remaining, because remaining is income minus expenses minus savings.
        </p>
      </ProseSection>
      <ProseSection title="Progress, and when a pace is shown">
        <p>
          Progress is the amount saved toward that goal compared with the target you set. Clearbook does not invent a monthly pace. A completion estimate is shown only when the period you are viewing already contains a savings contribution. With no savings record in the period, there is no estimate.
        </p>
        <p>
          An emergency fund, a trip, or a purchase are names you choose. The product does not suggest a target amount.
        </p>
      </ProseSection>
      <p className="mt-8 text-sm">
        <a href="/budget-worksheet" className="font-medium text-primary underline-offset-2 hover:underline">The worksheet</a>
        <span> uses the same remaining sum if you want to try figures before you create an account.</span>
      </p>
    </PublicShell>
  );
}

const EXAMPLE = { income: "80000", expenses: "45000", savings: "10000" };

export function WorksheetPage() {
  const page = PUBLIC_PAGES.find((item) => item.path === "/budget-worksheet")!;
  const [income, setIncome] = useState("");
  const [expenses, setExpenses] = useState("");
  const [savings, setSavings] = useState("");
  const [tried, setTried] = useState(false);
  const incomeValue = parseWorksheetRupees(income);
  const expenseValue = parseWorksheetRupees(expenses);
  const savingsValue = parseWorksheetRupees(savings);
  const ready = incomeValue !== null && expenseValue !== null && savingsValue !== null;
  const remaining = ready ? monthlyRemaining(incomeValue, expenseValue, savingsValue) : null;
  const invalid = tried && !ready;

  return (
    <PublicShell path="/budget-worksheet">
      <h1 className="mt-6 font-display text-4xl leading-tight text-foreground">{page.h1}</h1>
      <p className="mt-4 text-sm leading-6 text-foreground">{page.description}</p>
      <ProseSection title="The sum">
        <p>Remaining = income − expenses − savings. This is the same relationship Clearbook uses for the month you are viewing inside an account. It is not a bank balance, and it does not say whether the result is a good one.</p>
        <p>
          Example, not a recommendation: income ₹80,000, expenses ₹45,000, and savings ₹10,000 leave ₹25,000. Use “Fill the example” if you want those figures in the form. Replace them with your own, or clear them. Nothing on this page is uploaded or saved.
        </p>
      </ProseSection>
      <form
        className="panel mt-8 grid gap-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setTried(true);
        }}
      >
        <AmountField label="Income for the month" value={income} onChange={setIncome} />
        <AmountField label="Expenses for the month" value={expenses} onChange={setExpenses} />
        <AmountField label="Savings set aside" value={savings} onChange={setSavings} />
        {invalid ? (
          <p className="text-sm text-negative" role="alert">
            Use zero or a positive amount with at most two decimal places. Negative amounts are not accepted.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="press inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Calculate
          </button>
          <button
            type="button"
            className="press inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
            onClick={() => {
              setIncome(EXAMPLE.income);
              setExpenses(EXAMPLE.expenses);
              setSavings(EXAMPLE.savings);
              setTried(true);
            }}
          >
            Fill the example
          </button>
          <button
            type="button"
            className="press inline-flex h-11 items-center rounded-md px-4 text-sm font-medium text-muted-foreground"
            onClick={() => {
              setIncome("");
              setExpenses("");
              setSavings("");
              setTried(false);
            }}
          >
            Clear
          </button>
        </div>
        <p className="text-sm leading-6" role="status" aria-live="polite">
          {remaining === null
            ? "Enter all three amounts to see remaining."
            : remaining < 0
              ? `Remaining is ${formatRupees(remaining)}. Expenses and savings are higher than income in these figures. That is not a bank overdraft.`
              : `Remaining is ${formatRupees(remaining)}.`}
        </p>
      </form>
      <p className="mt-6 text-sm leading-6">
        Inside an account, each record must be greater than zero. This worksheet allows zero so you can describe a month with no expenses or nothing set aside.{" "}
        <a href="/login" className="font-medium text-primary underline-offset-2 hover:underline">Create an account</a> when you want the records kept.
      </p>
    </PublicShell>
  );
}

function AmountField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <label className="grid gap-1 text-sm font-medium" htmlFor={id}>
      {label}
      <input
        id={id}
        className="field"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function PageLinks({ except }: { except: string }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-foreground">Related pages</h2>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {PUBLIC_PAGES.filter((item) => item.path !== "/" && item.path !== except).map((item) => (
          <li key={item.path}>
            <a href={item.path} className="block py-3 text-sm font-medium text-primary hover:underline">
              {item.h1}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
