import { useEffect, useRef, useState } from "react";
import { PublicShell, ProseSection } from "@/components/budget/public-shell";
import { HOME_DESCRIPTION, HOME_H1 } from "@/lib/seo";

const RECORD = [
  "Income, expenses, and money set aside, each with a category, date, note, and merchant.",
  "Search, filter, and sort those records. Edit, duplicate, or delete one. A deleted record can be undone.",
  "Amounts have to be greater than zero. A refund is its own income category, not a negative expense.",
] as const;

const MONTH = [
  "Move between months. The financial month can start on a day other than the 1st.",
  "Remaining is income, minus expenses, minus savings, for the period you are viewing. It is not a bank balance.",
  "Category budgets and savings goals are limits and targets you set yourself.",
  "Charts use the spending you recorded. A comparison with the previous period is shown only when that earlier period has records.",
] as const;

const ACCOUNT = [
  "Sign in with email and password, Google, or X. A new account starts empty.",
  "The ledger is saved with the account. Sign in on another device and the same records are there. They are not stored only in this browser.",
  "From Settings you can download an Excel file of your own transactions, goals, and budgets.",
] as const;

const LIMITS = [
  "Clearbook does not connect to a bank, and it does not read bank or UPI text messages.",
  "A currency label changes the symbol only. Amounts are not converted.",
  "Google Calendar is not connected. A calendar file you download does not stay in sync.",
  "Records are saved with your account on the server. Clearbook does not use end-to-end encryption.",
  "A password reset can be requested from the login screen.",
] as const;

const START = [
  { href: "/features", label: "Features", text: "The full list of what the ledger can and cannot do." },
  { href: "/track-expenses", label: "Daily expenses", text: "How to write down a purchase, search it later, or split it." },
  { href: "/record-income", label: "Income", text: "Pay, side work, and refunds, kept separate from expenses." },
  { href: "/category-budgets", label: "Category budgets", text: "A limit you set, compared with spending you recorded." },
  { href: "/savings-goals", label: "Savings goals", text: "Targets and the money you choose to set aside." },
  { href: "/budget-worksheet", label: "Worksheet", text: "Try the monthly remaining sum without creating an account." },
] as const;

export function HomePage() {
  const motionScope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (disposed || !motionScope.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const context = gsap.context(() => {
          gsap.from(".hero-art-layer", { opacity: 0, scale: 1.08, duration: 1.25, ease: "power2.out" });
          gsap.from(".hero-landing > p, .hero-landing > h1, .hero-landing > .hero-actions", {
            opacity: 0, y: 18, duration: 0.68, stagger: 0.12, ease: "power2.out",
          });
          gsap.from(".month-preview", {
            opacity: 0, y: 26, duration: 0.75, ease: "power2.out",
            scrollTrigger: { trigger: ".month-preview", start: "top 88%", once: true },
          });
          gsap.from(".month-preview-ring", {
            opacity: 0, scale: 0.88, rotate: -12, duration: 0.8, ease: "back.out(1.2)",
            scrollTrigger: { trigger: ".month-preview-visual", start: "top 85%", once: true },
          });
          gsap.from(".month-preview-entry", {
            opacity: 0, y: 14, stagger: 0.09, duration: 0.55, ease: "power2.out",
            scrollTrigger: { trigger: ".month-preview-entries", start: "top 90%", once: true },
          });
        }, motionScope);
        return () => context.revert();
      });
      cleanup = () => media.revert();
    }).catch(() => {
      // Content stays visible when animation code cannot load.
    });
    return () => { disposed = true; cleanup(); };
  }, []);

  return (
    <PublicShell path="/">
      <div ref={motionScope} className="home-motion">
      <section className="hero hero-landing mt-8 overflow-hidden px-6 py-10 sm:px-10 sm:py-14">
        <div className="hero-art-layer" aria-hidden="true" />
        <p className="text-sm text-hero-muted">Personal ledger</p>
        <h1 className="mt-3 max-w-xl font-display text-4xl leading-tight text-hero-foreground sm:text-5xl">{HOME_H1}</h1>
        <p className="mt-4 max-w-xl text-base text-hero-muted">{HOME_DESCRIPTION}</p>
        <div className="hero-actions mt-6 flex flex-wrap gap-3">
          <a
            href="/login"
            className="press inline-flex h-11 items-center rounded-md bg-hero-foreground px-4 text-sm font-medium text-hero hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hero-foreground"
          >
            Create account
          </a>
          <a
            href="/budget-worksheet"
            className="press inline-flex h-11 items-center rounded-md border border-white/20 px-4 text-sm font-medium text-hero-foreground hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hero-foreground"
          >
            Try the worksheet
          </a>
        </div>
      </section>

      <MonthPreview />

      <ProseSection title="Who it is for">
        <p>
          Clearbook is for a person tracking their own money: salary or other income, everyday expenses, and amounts set aside. Amounts display in rupees unless you change the symbol. It is not accounting software, and it does not prepare GST invoices, business books, or tax returns.
        </p>
        <p>
          It also does not import transactions. If you want an app that reads bank SMS, this is the wrong product. You type each record yourself.
        </p>
      </ProseSection>

      <ProseSection title="How a month works">
        <ol className="grid list-decimal gap-3 pl-5">
          <li>Create an account. It starts empty. Nobody else’s records are included.</li>
          <li>Add income, expenses, and savings for the dates they happened.</li>
          <li>
            Read the month you are viewing. Remaining is income, minus expenses, minus savings. That figure is not your bank balance.
          </li>
        </ol>
        <p>
          The financial month can start on any day from the 1st through the 28th. Someone paid on the 7th can start the month on the 7th.
        </p>
      </ProseSection>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-foreground">Read a specific part</h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {START.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="grid gap-1 py-3 hover:bg-muted">
                <span className="text-sm font-medium text-primary">{item.label}</span>
                <span className="text-sm leading-6 text-foreground">{item.text}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <FactList title="Record what happened" items={RECORD} />
      <FactList title="See the month" items={MONTH} />
      <FactList title="Kept with your account" items={ACCOUNT} />
      <FactList title="Good to know" items={LIMITS} />
      </div>
    </PublicShell>
  );
}

function FactList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-foreground">{title}</h2>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {items.map((item) => (
          <li key={item} className="py-3 text-sm leading-6 text-foreground">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

const previewMoney = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function MonthPreview() {
  const income = 80_000;
  const expenses = 45_000;
  const [savings, setSavings] = useState(10_000);
  const remaining = income - expenses - savings;
  const expenseShare = expenses / income * 100;
  const savingsShare = savings / income * 100;
  const remainingShare = remaining / income * 100;
  const money = (amount: number) => previewMoney.format(amount);

  return (
    <section className="month-preview enter enter-2 mt-6" aria-labelledby="month-preview-title">
      <div className="month-preview-header">
        <div>
          <p className="month-preview-eyebrow">A clearer view of your month</p>
          <h2 id="month-preview-title" className="font-display text-2xl text-foreground">See where the money went.</h2>
        </div>
        <span className="month-preview-badge">Illustrative example</span>
      </div>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        Add your own records to see a monthly picture like this. These figures are examples, not a real account or suggested budget.
      </p>
      <div className="month-preview-grid">
        <div className="month-preview-balance">
          <p className="text-sm text-muted-foreground">Remaining after expenses and savings</p>
          <output className="month-preview-amount block" aria-live="polite">{money(remaining)}</output>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{money(income)} income − {money(expenses)} expenses − {money(savings)} savings</p>
          <div className="month-preview-visual">
            <div
              className="month-preview-ring"
              style={{ background: `conic-gradient(var(--color-expense) 0% ${expenseShare}%, var(--color-savings) ${expenseShare}% ${expenseShare + savingsShare}%, var(--color-income) ${expenseShare + savingsShare}% 100%)` }}
              role="img"
              aria-label={`Example allocation of ${money(income)} income: ${money(expenses)} expenses, ${money(savings)} savings, and ${money(remaining)} remaining`}
            >
              <div className="month-preview-ring-center" aria-hidden="true">
                <span>Still available</span>
                <strong>{money(remaining)}</strong>
                <small>{Math.round(remainingShare)}% of income</small>
              </div>
            </div>
            <div className="month-preview-visual-note">
              <span className="month-preview-visual-kicker">One month, at a glance</span>
              <strong>See the whole picture.</strong>
              <span>Move the savings slider below to see what changes.</span>
            </div>
          </div>
          <div className="month-preview-bar mt-5" role="img" aria-label={`Example: ${money(expenses)} expenses, ${money(savings)} savings, and ${money(remaining)} remaining from ${money(income)} income`}>
            <span className="month-preview-segment month-preview-expenses" style={{ width: `${expenseShare}%` }} />
            <span className="month-preview-segment month-preview-savings" style={{ width: `${savingsShare}%` }} />
            <span className="month-preview-segment month-preview-remaining" style={{ width: `${remainingShare}%` }} />
          </div>
          <div className="month-preview-legend" aria-hidden="true">
            <span><i className="month-preview-dot month-preview-dot-expenses" />Expenses</span>
            <span><i className="month-preview-dot month-preview-dot-savings" />Savings</span>
            <span><i className="month-preview-dot month-preview-dot-remaining" />Remaining</span>
          </div>
        </div>
        <div className="month-preview-entries" aria-label="Illustrative ledger entries">
          <div className="month-preview-entry"><span className="month-preview-entry-icon month-preview-entry-icon-income" aria-hidden="true">+</span><span><strong>Pay</strong><small>Income recorded</small></span><b>+{money(income)}</b></div>
          <div className="month-preview-entry"><span className="month-preview-entry-icon month-preview-entry-icon-expense" aria-hidden="true">−</span><span><strong>Groceries &amp; more</strong><small>Expenses recorded</small></span><b>−{money(expenses)}</b></div>
          <div className="month-preview-entry"><span className="month-preview-entry-icon month-preview-entry-icon-savings" aria-hidden="true">↗</span><span><strong>Money set aside</strong><small>Savings recorded</small></span><b>{savings === 0 ? money(0) : `−${money(savings)}`}</b></div>
        </div>
      </div>
      <div className="month-preview-try">
        <div className="month-preview-try-heading">
          <div>
            <label htmlFor="preview-savings" className="font-medium text-foreground">What if you set aside {money(savings)}?</label>
            <p id="month-preview-range-help" className="mt-1 text-xs text-muted-foreground">Move the slider to see how savings change the amount remaining.</p>
          </div>
          <button type="button" className="month-preview-reset" onClick={() => setSavings(10_000)}>Reset</button>
        </div>
        <input id="preview-savings" className="month-preview-range" type="range" min="0" max="30000" step="1000" value={savings} onChange={(event) => setSavings(Number(event.target.value))} aria-describedby="month-preview-range-help" />
        <div className="month-preview-range-labels" aria-hidden="true"><span>₹0</span><span>₹30,000</span></div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Try the example here; your changes are not saved to an account.</p>
      </div>
      <a href="/budget-worksheet" className="month-preview-link">Try your own figures <span aria-hidden="true">→</span></a>
    </section>
  );
}
