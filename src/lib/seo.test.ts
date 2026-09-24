import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { HOME_DESCRIPTION, ROBOTS_DISALLOW, SITEMAP_URLS, robotsTxt, sitemapXml } from "./seo.ts";

test("robots.txt matches the public crawl rules", () => {
  const file = readFileSync(new URL("../../public/robots.txt", import.meta.url), "utf8");
  assert.equal(file, robotsTxt());
  assert.match(file, /^Allow: \/$/m);
  assert.match(file, /^Sitemap: https:\/\/clearbookdata\.in\/sitemap\.xml$/m);
  assert.doesNotMatch(file, /Disallow:\s*\/login\b/);
  assert.doesNotMatch(file, /Disallow:\s*\/\s*$/m);
  for (const path of ROBOTS_DISALLOW) {
    assert.match(file, new RegExp(`^Disallow: ${path.replaceAll("/", "\\/")}$`, "m"));
  }
});

test("sitemap lists only the public pages", () => {
  const file = readFileSync(new URL("../../public/sitemap.xml", import.meta.url), "utf8");
  assert.equal(file, sitemapXml());
  const locs = [...file.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locs, [...SITEMAP_URLS]);
  for (const blocked of ["/login", "/dashboard", "/pricing", "/about", "/contact", "/transactions", "/settings", "/budgets", "/goals", "grok.me"]) {
    assert.equal(locs.some((loc) => loc.includes(blocked)), false, blocked);
  }
  assert.equal(locs.some((loc) => loc.endsWith("/features")), true);
});

test("share identity matches the homepage and lives on the canonical host", () => {
  const site = JSON.parse(readFileSync(new URL("./og/site.json", import.meta.url), "utf8"));
  assert.equal(site.title, "Clearbook");
  assert.equal(site.description, HOME_DESCRIPTION);
  assert.equal(site.host, "clearbookdata.in");
  assert.equal(site.card, "custom");
  assert.equal(site.image, undefined);
  const card = statSync(new URL("../../public/og.jpg", import.meta.url));
  assert.ok(card.size > 0 && card.size < 600 * 1024);
});
