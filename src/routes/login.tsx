import { createFileRoute } from "@tanstack/react-router";
import { Welcome } from "@/components/budget/welcome";
import { gateLocation } from "@/lib/session-gate";
import { noindexHead } from "@/lib/seo";

type LoginSearch = { mode?: "login" };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    mode: search.mode === "login" ? "login" : undefined,
  }),
  head: () =>
    noindexHead(
      "Sign in · Clearbook",
      "Sign in or create a Clearbook account. A new account starts empty, and the ledger is saved with that account.",
    ),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: LoginScreen,
});

function LoginScreen() {
  const { mode } = Route.useSearch();
  return <Welcome initialMode={mode === "login" ? "login" : "signup"} />;
}
