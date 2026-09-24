import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/budget/frame";

export function Welcome({ initialMode = "signup" }: { initialMode?: "login" | "signup" }) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const result =
      mode === "signup"
        ? await authClient.signUp.email({ email, password, name: name.trim() || "Clearbook", callbackURL: "/dashboard" })
        : await authClient.signIn.email({ email, password, callbackURL: "/dashboard" });
    setPending(false);
    if (result.error) setError(result.error.message || "Could not sign in.");
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-5xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-12 lg:py-12">
      <div className="order-1 w-full lg:order-2">
        <a href="/" className="flex items-center gap-3 rounded-md" aria-label="Clearbook home">
          <Mark className="size-14 shrink-0" />
          <div>
            <p className="wordmark text-3xl text-foreground">Clearbook</p>
            <p className="text-sm text-muted-foreground">Your money, made clear.</p>
          </div>
        </a>
        <h1 className="mt-6 text-2xl font-medium text-foreground">{mode === "signup" ? "Create your account" : "Log in to your ledger"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signup"
            ? "Start with an empty ledger. Add your own records and see your month take shape."
            : "Open your own records, budgets, and savings goals where you left off."}
        </p>
        <p className="auth-quick-benefit">Track expenses <span aria-hidden="true">·</span> Set goals <span aria-hidden="true">·</span> Export your records</p>
        <form className="panel mt-4 grid gap-3 p-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            <button type="button" className={mode === "signup" ? "press h-11 rounded-sm bg-card text-sm font-medium" : "press h-11 rounded-sm text-sm text-muted-foreground"} onClick={() => setMode("signup")}>
              Create account
            </button>
            <button type="button" className={mode === "login" ? "press h-11 rounded-sm bg-card text-sm font-medium" : "press h-11 rounded-sm text-sm text-muted-foreground"} onClick={() => setMode("login")}>
              Log in
            </button>
          </div>
          {mode === "signup" ? (
            <label className="grid gap-1 text-sm font-medium">
              Name
              <input className="field" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            </label>
          ) : null}
          <label className="grid gap-1 text-sm font-medium">
            Email
            <input className="field" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Password
            <input className="field" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </label>
          {mode === "login" ? (
            <Link to="/forgot-password" className="justify-self-start text-sm font-medium text-primary underline-offset-2 hover:underline">
              Forgot password?
            </Link>
          ) : null}
          {error ? <p className="text-sm text-negative" role="alert">{error}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}</Button>
        </form>
        <div className="mt-3 grid gap-2">
          {GROK_PROVIDERS.map((provider) => (
            <Button key={provider.providerId} variant="secondary" onClick={() => signIn(provider.providerId, { callbackURL: "/dashboard" })}>
              Continue with {provider.label}
            </Button>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Use the same email and password, or Google or X, to open this account on another device.
        </p>
      </div>
      <section className="auth-story order-2 lg:order-1" aria-labelledby="auth-story-title">
        <p className="auth-story-eyebrow">A ledger you actually understand</p>
        <h2 id="auth-story-title" className="font-display text-3xl leading-tight sm:text-4xl">Make sense of the money you record.</h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-hero-muted">Write down income, spending, and savings. See what remains for the month, then come back to the same ledger on another device.</p>
        <ul className="auth-story-list">
          <li><span aria-hidden="true">01</span><div><strong>Record in your own way</strong><p>Add an amount, category, date, and optional note. No bank connection is required.</p></div></li>
          <li><span aria-hidden="true">02</span><div><strong>Understand your month</strong><p>See the expenses you entered alongside budgets and savings goals you set.</p></div></li>
          <li><span aria-hidden="true">03</span><div><strong>Keep a copy</strong><p>Export your own ledger to Excel from Settings when you need it.</p></div></li>
        </ul>
        <p className="mt-7 text-xs leading-5 text-hero-muted">Clearbook is a manual personal ledger. It does not read your bank messages or show a bank balance.</p>
      </section>
    </main>
  );
}
