import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/budget/frame";
import { checkResetToken } from "@/lib/mail/password-reset";

type Phase = "checking" | "ready" | "invalid" | "done";

export function ResetPasswordPage({ token, invalid }: { token: string; invalid?: boolean }) {
  const [phase, setPhase] = useState<Phase>(invalid || !token ? "invalid" : "checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (invalid || !token) return;
    let live = true;
    void checkResetToken({ data: { token } })
      .then((result) => {
        if (!live) return;
        setPhase(result.status === "valid" ? "ready" : "invalid");
      })
      .catch(() => {
        if (live) setPhase("invalid");
      });
    return () => {
      live = false;
    };
  }, [token, invalid]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don’t match.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ newPassword: password, token }),
      });
      if (response.ok) {
        setPhase("done");
        return;
      }
      const body = (await response.json().catch(() => null)) as { code?: string } | null;
      if (body?.code === "PASSWORD_TOO_SHORT" || body?.code === "PASSWORD_TOO_LONG") {
        setError("Use a password between 8 and 128 characters.");
        return;
      }
      setPhase("invalid");
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
        <h1 className="mt-6 text-2xl font-medium text-foreground">Choose a new password</h1>
        {phase === "checking" ? <p className="mt-6 text-sm text-muted-foreground">Checking this reset link…</p> : null}
        {phase === "invalid" ? (
          <div className="panel mt-6 grid gap-3 p-4" role="alert">
            <h2 className="text-lg font-medium">This link has expired</h2>
            <p className="text-sm text-muted-foreground">
              It may have already been used, or more than an hour has passed. Request a new link. We won’t say whether an account exists.
            </p>
            <Link to="/forgot-password" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
              Request a new link
            </Link>
          </div>
        ) : null}
        {phase === "done" ? (
          <div className="panel mt-6 grid gap-3 p-4" role="status">
            <h2 className="text-lg font-medium">Password updated</h2>
            <p className="text-sm text-muted-foreground">You can log in with the new password. Older sessions for this account were signed out.</p>
            <Link to="/login" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
              Log in
            </Link>
          </div>
        ) : null}
        {phase === "ready" ? (
          <form className="panel mt-6 grid gap-3 p-4" onSubmit={submit}>
            <label className="grid gap-1 text-sm font-medium">
              New password
              <input className="field" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Confirm password
              <input className="field" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            </label>
            {error ? <p className="text-sm text-negative" role="alert">{error}</p> : null}
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Update password"}</Button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
