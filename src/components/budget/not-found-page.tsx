import { Mark } from "@/components/budget/frame";

export function NotFoundPage() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-lg place-items-center px-4 py-10">
      <div className="w-full">
        <a href="/" className="flex items-center gap-3 rounded-md" aria-label="Clearbook home">
          <Mark className="size-11 shrink-0" />
          <span className="wordmark text-foreground">Clearbook</span>
        </a>
        <h1 className="mt-8 font-display text-3xl text-foreground">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">That address is not a page on Clearbook.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/"
            className="press inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Home
          </a>
          <a
            href="/login"
            className="press inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Log in
          </a>
        </div>
      </div>
    </main>
  );
}
