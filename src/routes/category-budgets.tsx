import { createFileRoute } from "@tanstack/react-router";
import { CategoryBudgetsPage } from "@/components/budget/public-pages";
import { gateLocation } from "@/lib/session-gate";
import { pageByPath, publicPageHead } from "@/lib/seo";

export const Route = createFileRoute("/category-budgets")({
  head: () => publicPageHead(pageByPath("/category-budgets")),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: CategoryBudgetsPage,
});
