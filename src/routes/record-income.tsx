import { createFileRoute } from "@tanstack/react-router";
import { RecordIncomePage } from "@/components/budget/public-pages";
import { gateLocation } from "@/lib/session-gate";
import { pageByPath, publicPageHead } from "@/lib/seo";

export const Route = createFileRoute("/record-income")({
  head: () => publicPageHead(pageByPath("/record-income")),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: RecordIncomePage,
});
