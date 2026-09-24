import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { ensurePasswordResetDelivery } from "@/lib/mail/deliver.server";

async function handle(request: Request) {
  await ensurePasswordResetDelivery(auth);
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
