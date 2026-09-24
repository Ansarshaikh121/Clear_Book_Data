import assert from "node:assert/strict";
import test from "node:test";
import { authRedirectTarget } from "./auth-redirect.ts";

const guest = { user: null, enforceRedirect: true };
const member = { user: { id: "user-1" }, enforceRedirect: true };
const previewGuest = { user: null, enforceRedirect: false };

test("the public homepage stays open for guests and sends members to the ledger", () => {
  assert.equal(authRedirectTarget(guest, "/"), null);
  assert.equal(authRedirectTarget(previewGuest, "/"), null);
  assert.equal(authRedirectTarget(member, "/"), "/dashboard");
});

test("production guests are sent to login from private app routes", () => {
  for (const path of ["/dashboard", "/transactions", "/budgets", "/goals", "/reports", "/insights", "/settings"]) {
    assert.equal(authRedirectTarget(guest, path), "/login");
  }
});

test("signed-in people stay on app routes and leave the login screens", () => {
  assert.equal(authRedirectTarget(member, "/dashboard"), null);
  assert.equal(authRedirectTarget(member, "/transactions"), null);
  assert.equal(authRedirectTarget(member, "/login"), "/dashboard");
  assert.equal(authRedirectTarget(member, "/forgot-password"), "/dashboard");
});

test("reset links stay open for guests and members", () => {
  assert.equal(authRedirectTarget(guest, "/reset-password"), null);
  assert.equal(authRedirectTarget(guest, "/reset-password/abc"), null);
  assert.equal(authRedirectTarget(member, "/reset-password/abc"), null);
});

test("marketing pages stay public for guests and signed-in people", () => {
  for (const path of ["/features", "/track-expenses", "/record-income", "/category-budgets", "/savings-goals", "/budget-worksheet"]) {
    assert.equal(authRedirectTarget(guest, path), null);
    assert.equal(authRedirectTarget(member, path), null);
    assert.equal(authRedirectTarget(previewGuest, path), null);
  }
});

test("preview does not bounce a guest before the client session resolves", () => {
  assert.equal(authRedirectTarget(previewGuest, "/dashboard"), null);
  assert.equal(authRedirectTarget(previewGuest, "/login"), null);
});
