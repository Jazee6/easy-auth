import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { SecurityActivity } from "@/components/security-activity";
import { normalizeSecurityActivitySearch } from "@/lib/admin-security";
import { listSecurityActivity } from "@/lib/admin-server";

export const Route = createFileRoute("/_account/admin/security-activity/")({
  staticData: { title: "Security activity" },
  search: {
    middlewares: [stripSearchParams({ q: "", page: 1 })],
  },
  validateSearch: normalizeSecurityActivitySearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listSecurityActivity({ data: deps }),
  component: SecurityActivityPage,
});

function SecurityActivityPage() {
  const result = Route.useLoaderData();
  const search = Route.useSearch();
  return <SecurityActivity result={result} search={search} />;
}
