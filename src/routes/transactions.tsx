import { createFileRoute } from "@tanstack/react-router";
import { TransactionsPage } from "@/components/budget/transactions-page";
import { gateLocation } from "@/lib/session-gate";
import { privatePageHead } from "@/lib/seo";

type TxSearch = {
  kind?: "income" | "expense" | "savings";
  category?: string;
  day?: string;
  q?: string;
  from?: string;
  to?: string;
  min?: string;
  max?: string;
  sort?: "date" | "amount";
};

export const Route = createFileRoute("/transactions")({
  validateSearch: (search: Record<string, unknown>): TxSearch => ({
    kind: search.kind === "income" || search.kind === "expense" || search.kind === "savings" ? search.kind : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
    day: typeof search.day === "string" ? search.day : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
    min: typeof search.min === "string" ? search.min : undefined,
    max: typeof search.max === "string" ? search.max : undefined,
    sort: search.sort === "amount" || search.sort === "date" ? search.sort : undefined,
  }),
  head: () => privatePageHead("Transactions"),
  beforeLoad: ({ location }) => gateLocation(location.pathname),
  component: TransactionsPage,
});
