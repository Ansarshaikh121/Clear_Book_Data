import { createFileRoute } from "@tanstack/react-router";
import { TrackExpensesPage } from "@/components/budget/public-pages";
import { gateLocation } from "@/lib/session-gate";
import { pageByPath, publicPageHead } from "@/lib/seo";

export const Route = createFileRoute("/track-expenses")({
  head: () => publicPageHead(pageByPath("/track-expenses")),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: TrackExpensesPage,
});
