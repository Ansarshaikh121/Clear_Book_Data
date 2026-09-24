import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/budget/settings-page";
import { gateLocation } from "@/lib/session-gate";
import { privatePageHead } from "@/lib/seo";

export const Route = createFileRoute("/settings")({
  head: () => privatePageHead("Settings"),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: SettingsPage,
});
