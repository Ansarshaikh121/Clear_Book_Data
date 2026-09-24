import { createFileRoute } from "@tanstack/react-router";
import { GoalsPage } from "@/components/budget/goals-page";
import { gateLocation } from "@/lib/session-gate";
import { privatePageHead } from "@/lib/seo";

export const Route = createFileRoute("/goals")({
  head: () => privatePageHead("Savings goals"),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: GoalsPage,
});
