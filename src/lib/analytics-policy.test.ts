import { test } from "node:test";
import assert from "node:assert/strict";
import { canMeasurePublicPage, publicPageLocation, validGaId } from "./analytics-policy.ts";

test("GA4 ID must be valid before public tracking", () => {
  assert.equal(validGaId("G-ABC12345"), true);
  assert.equal(validGaId("G-123;alert(1)"), false);
  assert.equal(canMeasurePublicPage("clearbookdata.in", "/features", "G-ABC12345"), true);
  assert.equal(canMeasurePublicPage("blade-sage-zinc-ember.grok.me", "/features", "G-ABC12345"), false);
});

test("private, auth, worksheet and query paths are excluded", () => {
  for (const path of ["/login", "/dashboard", "/transactions", "/budget-worksheet", "/reset-password"]) {
    assert.equal(canMeasurePublicPage("clearbookdata.in", path, "G-ABC12345"), false);
    assert.equal(publicPageLocation(path), null);
  }
  assert.equal(publicPageLocation("/features"), "https://clearbookdata.in/features");
  assert.equal(publicPageLocation("/features?email=secret@example.com"), null);
});
