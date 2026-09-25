import { useEffect } from "react";

/** Install shell behavior without caching account or transaction responses. */
export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    // Do not register workers in Vite development or browser test previews.
    if (import.meta.env.DEV) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Installation still works in browsers without service worker support.
    });
  }, []);

  return null;
}
