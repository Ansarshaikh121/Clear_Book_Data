import { isMarketingPath } from "./seo.ts";

export type SessionGate = {
  user: { id: string } | null;
  enforceRedirect: boolean;
};

/**
 * Where a direct visit should go, or null to render the route.
 * "/" and the other marketing pages are public. Signed-in visitors who open
 * "/" are sent to the ledger. Other public pages stay readable.
 * Production (enforceRedirect) sends signed-out visitors to login from private
 * routes before any ledger HTML. Preview does not, because the session may be
 * a bearer token the first server render cannot see.
 * Reset links stay reachable either way. Login never reveals account data.
 */
export function authRedirectTarget(session: SessionGate, pathname: string): "/login" | "/dashboard" | null {
  if (pathname === "/") {
    return session.user ? "/dashboard" : null;
  }
  if (isMarketingPath(pathname)) return null;
  if (pathname === "/login" || pathname === "/forgot-password") {
    return session.user ? "/dashboard" : null;
  }
  if (pathname === "/reset-password" || pathname.startsWith("/reset-password/")) {
    return null;
  }
  if (!session.user && session.enforceRedirect) return "/login";
  return null;
}
