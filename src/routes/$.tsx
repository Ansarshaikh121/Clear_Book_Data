import { createFileRoute, notFound } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/budget/not-found-page";
import { noindexHead } from "@/lib/seo";

export const Route = createFileRoute("/$")({
  head: () =>
    noindexHead(
      "Page not found · Clearbook",
      "That address is not a page on Clearbook.",
    ),
  loader: () => {
    throw notFound();
  },
  notFoundComponent: NotFoundPage,
});
