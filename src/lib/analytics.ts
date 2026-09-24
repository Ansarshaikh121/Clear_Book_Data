import { canMeasurePublicPage, publicPageLocation } from "./analytics-policy";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

const id = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? "").trim();
let initialized = false;
let lastPage = "";

export function analyticsAvailable(path: string): boolean {
  return typeof window !== "undefined" && canMeasurePublicPage(window.location.hostname, path, id);
}

export function trackPublicPage(path: string): void {
  if (!analyticsAvailable(path)) return;
  const location = publicPageLocation(path);
  if (!location || lastPage === location) return;

  if (!initialized) {
    initialized = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args: unknown[]) => { window.dataLayer?.push(args); };
    window.gtag("js", new Date());
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("config", id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: location,
      page_referrer: "",
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }

  lastPage = location;
  window.gtag?.("event", "page_view", {
    page_location: location,
    page_path: path,
    page_title: document.title,
    page_referrer: "",
  });
}

export function stopAnalytics(): void {
  window.gtag?.("consent", "update", { analytics_storage: "denied" });
  // The tag was loaded into this document. Reload without consent so it cannot
  // observe any later route or interaction in the same document.
  if (initialized) window.location.reload();
}
