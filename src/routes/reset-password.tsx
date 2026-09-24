import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { ResetPasswordPage } from "@/components/budget/reset-password-page";
import { gateLocation } from "@/lib/session-gate";
import { noindexHead } from "@/lib/seo";

type ResetSearch = { token?: string; error?: string };

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () =>
    noindexHead(
      "Choose a new password · Clearbook",
      "Choose a new Clearbook password from a reset link. An expired link can be requested again.",
    ),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: ResetPasswordLayout,
});

function ResetPasswordLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/reset-password") return <Outlet />;
  return <ResetFromSearch />;
}

function ResetFromSearch() {
  const search = Route.useSearch();
  const invalid = search.error === "INVALID_TOKEN" || !search.token;
  return <ResetPasswordPage token={search.token ?? ""} invalid={invalid} />;
}
