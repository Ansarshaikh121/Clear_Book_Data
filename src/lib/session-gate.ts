import { redirect } from "@tanstack/react-router";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { authRedirectTarget } from "@/lib/auth-redirect";
import { isMarketingPath } from "@/lib/seo";

const forwardBearer = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const bearerToken = (context as { bearerToken?: string }).bearerToken;
    return next({ context: { bearerToken } });
  });

export const fetchSessionUser = createServerFn({ method: "GET" })
  .middleware([forwardBearer])
  .handler(async ({ context }) => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const { isWorkspacePreview } = await import("@/lib/env.server");
    const user = await getSessionUser(context.bearerToken);
    return {
      user: user ? { id: user.id, email: user.email } : null,
      enforceRedirect: !isWorkspacePreview(),
    };
  });

export async function gateLocation(pathname: string) {
  // Public feature pages never need a session. Keep /'s signed-in redirect.
  if (pathname !== "/" && isMarketingPath(pathname)) return;
  const session = await fetchSessionUser();
  const target = authRedirectTarget(session, pathname);
  if (target) throw redirect({ to: target });
}
