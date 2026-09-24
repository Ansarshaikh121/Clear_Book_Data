/** Public canonical host. Do not list preview or www hosts. */
export const CANONICAL_ORIGIN = "https://clearbookdata.in";

export const HOME_TITLE = "Clearbook — a personal ledger for income, expenses, and savings";

export const HOME_DESCRIPTION =
  "Clearbook is a personal ledger for income, expenses, and savings. Track categories and goals, then export your own records. Sign in to keep them with your account.";

export const HOME_H1 = "Your money, made clear.";

export type PublicPage = {
  path: string;
  title: string;
  description: string;
  h1: string;
  crumb: string;
};

/**
 * Indexable pages only. Paths must not collide with private app routes
 * such as /budgets or /goals.
 */
export const PUBLIC_PAGES: readonly PublicPage[] = [
  {
    path: "/",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    h1: HOME_H1,
    crumb: "Home",
  },
  {
    path: "/features",
    title: "Features · Clearbook personal ledger",
    description:
      "See what Clearbook records: income, expenses, savings, category budgets, goals, month comparisons, and an Excel export of your own account.",
    h1: "What Clearbook actually does",
    crumb: "Features",
  },
  {
    path: "/track-expenses",
    title: "Track daily expenses · Clearbook",
    description:
      "Enter each expense with a category, date, merchant, and note. Search, edit, or split it. Clearbook does not read bank SMS or connect to a bank.",
    h1: "Track daily expenses you write down",
    crumb: "Expenses",
  },
  {
    path: "/record-income",
    title: "Record income · Clearbook",
    description:
      "Record pay, side work, refunds, and other income. A refund is its own income category, not a negative expense. Remaining uses the income you entered.",
    h1: "Record income, including refunds",
    crumb: "Income",
  },
  {
    path: "/category-budgets",
    title: "Category budgets · Clearbook",
    description:
      "Set a spending limit for categories such as groceries or transport. Clearbook compares that limit with what you recorded. It does not pay bills or move money.",
    h1: "Set a limit for each spending category",
    crumb: "Budgets",
  },
  {
    path: "/savings-goals",
    title: "Savings goals · Clearbook",
    description:
      "Create savings goals, record money you set aside, and see progress toward each target. A pace estimate appears only after a savings record in the period.",
    h1: "Track savings goals you choose",
    crumb: "Goals",
  },
  {
    path: "/budget-worksheet",
    title: "Monthly remaining worksheet · Clearbook",
    description:
      "Calculate one month as income minus expenses minus savings. The figures stay in this tab. They are not saved, and the result is not a bank balance.",
    h1: "Monthly remaining worksheet",
    crumb: "Worksheet",
  },
];

/** The only URLs that belong in the sitemap. */
export const SITEMAP_URLS = PUBLIC_PAGES.map((page) =>
  page.path === "/" ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}${page.path}`,
);

export function pageByPath(path: string): PublicPage {
  const page = PUBLIC_PAGES.find((item) => item.path === path);
  if (!page) throw new Error(`Unknown public page: ${path}`);
  return page;
}

export function isMarketingPath(pathname: string): boolean {
  return PUBLIC_PAGES.some((page) => page.path === pathname);
}

/**
 * Prefixes crawlers should not fetch. /login is intentionally absent so
 * its noindex tag can be read. Private ledgers stay behind sign-in as well.
 */
export const ROBOTS_DISALLOW = [
  "/dashboard",
  "/transactions",
  "/budgets",
  "/goals",
  "/reports",
  "/insights",
  "/settings",
  "/forgot-password",
  "/reset-password",
  "/api/",
] as const;

function canonicalUrl(page: PublicPage): string {
  return page.path === "/" ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}${page.path}`;
}

function breadcrumbSchema(page: PublicPage) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${CANONICAL_ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: page.crumb, item: canonicalUrl(page) },
    ],
  };
}

function webPageSchema(page: PublicPage) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.h1,
    description: page.description,
    url: canonicalUrl(page),
    isPartOf: { "@type": "WebSite", name: "Clearbook", url: `${CANONICAL_ORIGIN}/` },
  };
}

export function publicPageHead(page: PublicPage) {
  const meta: Array<Record<string, unknown>> = [
    { title: page.title },
    { name: "description", content: page.description },
    { name: "robots", content: "index, follow" },
  ];
  if (page.path === "/") {
    meta.push({
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Clearbook",
        url: `${CANONICAL_ORIGIN}/`,
        description: HOME_DESCRIPTION,
      },
    });
  } else {
    meta.push({ "script:ld+json": webPageSchema(page) });
    meta.push({ "script:ld+json": breadcrumbSchema(page) });
  }
  return {
    meta,
    links: [{ rel: "canonical", href: canonicalUrl(page) }],
  };
}

export function publicHomeHead() {
  return publicPageHead(pageByPath("/"));
}

export function noindexHead(title: string, description?: string) {
  return {
    meta: [
      { title },
      ...(description ? [{ name: "description", content: description }] : []),
      { name: "robots", content: "noindex, nofollow" },
    ],
  };
}

export function privatePageHead(title: string) {
  return noindexHead(`${title} · Clearbook`);
}

export function robotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemapXml(): string {
  const body = SITEMAP_URLS.map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
