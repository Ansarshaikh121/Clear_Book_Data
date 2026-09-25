#!/usr/bin/env node
/**
 * Generate the HTTPS Digital Asset Links file from the Play App Signing
 * certificate fingerprint (or the local signing certificate for local tests).
 * Do not guess the fingerprint: Google Play may re-sign the distributed app.
 */
const [packageName, fingerprint] = process.argv.slice(2);
if (!packageName || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/i.test(packageName)) {
  console.error("Usage: node scripts/android-assetlinks.mjs <package-id> <SHA-256-fingerprint>");
  process.exit(1);
}
if (!fingerprint || !/^(?:[0-9a-f]{2}:){31}[0-9a-f]{2}$/i.test(fingerprint)) {
  console.error("Provide the SHA-256 fingerprint as 32 colon-separated hex bytes.");
  process.exit(1);
}
console.log(JSON.stringify([{
  relation: ["delegate_permission/common.handle_all_urls"],
  target: {
    namespace: "android_app",
    package_name: packageName,
    sha256_cert_fingerprints: [fingerprint.toUpperCase()],
  },
}], null, 2));
