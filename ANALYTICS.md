# Clearbook Google Analytics setup

1. In Google Analytics, create a GA4 property and Web data stream for `https://clearbookdata.in`.
2. Copy the public Measurement ID (format `G-XXXXXXXX`).
3. Set `VITE_GA_MEASUREMENT_ID` in the website's production deployment environment to that ID and redeploy.
4. In the GA4 Web stream's enhanced measurement settings, turn off automatic page views on browser history changes. Clearbook sends one manual `page_view` for approved public pages after the visitor opts in.
5. Visit `https://clearbookdata.in/features`, choose **Allow analytics**, and verify the page appears in GA4 Realtime. Choose **No thanks** and verify no Google tag loads on a fresh visit.

This feature is inactive without an ID. Analytics runs only on the canonical domain's informational pages and never on login, account data, bank-statement import, or the interactive worksheet. Query strings, account identifiers, financial amounts and uploaded files are excluded. Visitors can change their choice with the **Analytics settings** control on public pages. The measurement ID is public configuration, not a secret.
