import { CANONICAL_ORIGIN, isMarketingPath } from "./seo.ts";

export function validGaId(value: string): boolean {
  return /^G-[A-Z0-9]{5,20}$/.test(value);
}

export function canMeasurePublicPage(host: string, path: string, id: string): boolean {
  return host === new URL(CANONICAL_ORIGIN).hostname && isMarketingPath(path) && validGaId(id);
}

/** Never send query strings, fragments, email addresses, or private ledger URLs. */
export function publicPageLocation(path: string): string | null {
  return isMarketingPath(path) ? new URL(path, CANONICAL_ORIGIN).href : null;
}
