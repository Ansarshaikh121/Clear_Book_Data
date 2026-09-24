import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "@/components/budget/forgot-password-page";
import { gateLocation } from "@/lib/session-gate";
import { noindexHead } from "@/lib/seo";

export const Route = createFileRoute("/forgot-password")({
  head: () =>
    noindexHead(
      "Reset your password · Clearbook",
      "Request a password reset for a Clearbook account. The reply is the same whether or not the email is registered.",
    ),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: ForgotPasswordPage,
});
