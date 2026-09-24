import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "@/components/budget/reset-password-page";
import { gateLocation } from "@/lib/session-gate";
import { noindexHead } from "@/lib/seo";

export const Route = createFileRoute("/reset-password/$token")({
  head: () =>
    noindexHead(
      "Choose a new password · Clearbook",
      "Choose a new Clearbook password from a reset link. An expired link can be requested again.",
    ),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: ResetFromToken,
});

function ResetFromToken() {
  const { token } = Route.useParams();
  return <ResetPasswordPage token={token} />;
}
