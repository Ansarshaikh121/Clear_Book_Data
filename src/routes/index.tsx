import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/budget/home-page";
import { gateLocation } from "@/lib/session-gate";
import { publicHomeHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: publicHomeHead,
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: HomePage,
});
