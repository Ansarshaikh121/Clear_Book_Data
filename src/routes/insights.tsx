import { createFileRoute } from "@tanstack/react-router";
import { InsightsPage } from "@/components/budget/insights-page";
import { gateLocation } from "@/lib/session-gate";
import { privatePageHead } from "@/lib/seo";

export const Route = createFileRoute("/insights")({
  head: () => privatePageHead("Insights"),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: InsightsPage,
});
