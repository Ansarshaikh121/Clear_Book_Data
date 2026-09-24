import { createFileRoute } from "@tanstack/react-router";
import { SavingsGoalsPage } from "@/components/budget/public-pages";
import { gateLocation } from "@/lib/session-gate";
import { pageByPath, publicPageHead } from "@/lib/seo";

export const Route = createFileRoute("/savings-goals")({
  head: () => publicPageHead(pageByPath("/savings-goals")),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: SavingsGoalsPage,
});
