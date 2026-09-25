import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/budget/not-found-page";
import { Frame } from "@/components/budget/frame";
import { AuthProvider } from "@/lib/auth/provider";
import { PwaRegistration } from "@/components/pwa-registration";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Clearbook";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Your money, made clear. A personal ledger for income, expenses, and savings goals.",
      },
      { name: "theme-color", content: "#F6F4EF" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <PreviewHostBridge />
        <PwaRegistration />
        <AuthProvider>
          <Frame>
            <Outlet />
          </Frame>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
