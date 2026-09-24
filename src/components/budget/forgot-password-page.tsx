import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/budget/frame";
import { getPasswordResetNotice, RESET_REQUEST_MESSAGE } from "@/lib/mail/password-reset";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void getPasswordResetNotice()
      .then((result) => {
        if (live) setNotice(result.notice);
      })
      .catch(() => {
        if (live) setNotice(null);
      });
    return () => {
      live = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });
      if (response.status >= 500) {
        setError("Something went wrong. Try again in a moment.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-lg place-items-center px-4 py-10">
      <div className="w-full">
        <a href="/" className="flex items-center gap-3 rounded-md" aria-label="Clearbook home">
          <Mark className="size-14 shrink-0" />
          <p className="wordmark text-3xl text-foreground">Clearbook</p>
        </a>
        <h1 className="mt-6 text-2xl font-medium text-foreground">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the email on your account. We always give the same reply, so this page never says whether that email is registered.
        </p>
        {notice ? (
          <p className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground" role="note">
            <span className="font-medium text-foreground">Developer notice. </span>
            {notice}
          </p>
        ) : null}
        {sent ? (
          <div className="panel mt-4 grid gap-3 p-4" role="status">
            <p className="text-sm">{RESET_REQUEST_MESSAGE}</p>
            <Link to="/login" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
              Back to log in
            </Link>
          </div>
        ) : (
          <form className="panel mt-4 grid gap-3 p-4" onSubmit={submit}>
            <label className="grid gap-1 text-sm font-medium">
              Email
              <input className="field" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {error ? <p className="text-sm text-negative" role="alert">{error}</p> : null}
            <Button type="submit" disabled={pending}>{pending ? "Please wait…" : "Send reset link"}</Button>
            <Link to="/login" className="text-center text-sm font-medium text-primary underline-offset-2 hover:underline">
              Back to log in
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
