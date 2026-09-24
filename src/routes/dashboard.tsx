import { createFileRoute } from "@tanstack/react-router";
import { Overview } from "@/components/budget/overview";
import { gateLocation } from "@/lib/session-gate";
import { privatePageHead } from "@/lib/seo";

export const Route = createFileRoute("/dashboard")({
  head: () => privatePageHead("Overview"),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: Overview,
});
