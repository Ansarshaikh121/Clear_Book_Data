import { createFileRoute } from "@tanstack/react-router";
import { FeaturesPage } from "@/components/budget/public-pages";
import { gateLocation } from "@/lib/session-gate";
import { pageByPath, publicPageHead } from "@/lib/seo";

export const Route = createFileRoute("/features")({
  head: () => publicPageHead(pageByPath("/features")),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: FeaturesPage,
});
