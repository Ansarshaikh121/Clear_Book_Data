import { createFileRoute } from "@tanstack/react-router";
import { BudgetsPage } from "@/components/budget/budgets-page";
import { gateLocation } from "@/lib/session-gate";
import { privatePageHead } from "@/lib/seo";

export const Route = createFileRoute("/budgets")({
  head: () => privatePageHead("Budgets"),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: BudgetsPage,
});
