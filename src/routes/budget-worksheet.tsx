import { createFileRoute } from "@tanstack/react-router";
import { WorksheetPage } from "@/components/budget/public-pages";
import { gateLocation } from "@/lib/session-gate";
import { pageByPath, publicPageHead } from "@/lib/seo";

export const Route = createFileRoute("/budget-worksheet")({
  head: () => publicPageHead(pageByPath("/budget-worksheet")),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: WorksheetPage,
});
