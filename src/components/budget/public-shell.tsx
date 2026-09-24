import type { ReactNode } from "react";
import { Mark } from "@/components/budget/frame";
import { PUBLIC_PAGES } from "@/lib/seo";

const NAV = PUBLIC_PAGES.filter((page) => page.path !== "/");

export function PublicShell({ path, children }: { path: string; children: ReactNode }) {
  const page = PUBLIC_PAGES.find((item) => item.path === path);
  return (
    <div className={`public-shell mx-auto min-h-screen w-full px-4 pb-16 pt-4 sm:px-6 sm:pt-6 ${path === "/" ? "public-shell-home max-w-6xl" : "max-w-3xl"}`}>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="public-header flex flex-wrap items-center justify-between gap-3">
        <a href="/" className="public-brand flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" aria-label="Clearbook home">
          <Mark className="size-11 shrink-0" />
          <span className="wordmark public-wordmark text-foreground">Clearbook</span>
        </a>
        <nav aria-label="Account" className="flex flex-wrap items-center gap-2">
          <a
            href="/login?mode=login"
            className="press inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Log in
          </a>
          <a
            href="/login"
            className="press inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Create account
          </a>
        </nav>
      </header>
      <nav aria-label="Pages" className="public-pages mt-4 flex gap-1 overflow-x-auto pb-2">
        {NAV.map((item) => {
          const current = item.path === path;
          return (
            <a
              key={item.path}
              href={item.path}
              aria-current={current ? "page" : undefined}
              className={`public-nav-link ${current ? "public-nav-link-current" : ""}`}

            >
              {item.crumb}
            </a>
          );
        })}
      </nav>
      <main id="content" className="public-main">
        {page && path !== "/" ? (
          <p className="mt-6 text-sm text-muted-foreground">
            <a href="/" className="font-medium text-primary underline-offset-2 hover:underline">
              Home
            </a>
            <span aria-hidden="true"> / </span>
            <span>{page.crumb}</span>
          </p>
        ) : null}
        {children}
      </main>
      <footer className="public-footer mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
        <p>Clearbook is a ledger you keep yourself. It is not a bank, and it does not show anyone else’s records.</p>
        <p className="mt-3">
          Product notes updated 24 September 2026. These pages describe how Clearbook works. They are not personal financial advice.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {PUBLIC_PAGES.map((item) => (
            <li key={item.path}>
              <a href={item.path === "/" ? "/" : item.path} className="font-medium text-primary underline-offset-2 hover:underline">
                {item.crumb}
              </a>
            </li>
          ))}
          <li>
            <a href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
              Create account
            </a>
          </li>
        </ul>
      </footer>
    </div>
  );
}

export function ProseSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-foreground">{title}</h2>
      <div className="mt-3 grid gap-3 text-sm leading-6 text-foreground">{children}</div>
    </section>
  );
}
