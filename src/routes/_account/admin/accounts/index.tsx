import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { Accounts } from "@/components/accounts";
import { normalizeAccountListSearch } from "@/lib/admin-accounts";
import { listAccounts } from "@/lib/admin-server";

export const Route = createFileRoute("/_account/admin/accounts/")({
  staticData: { title: "Accounts" },
  search: {
    middlewares: [stripSearchParams({ q: "", sort: "createdAt", direction: "desc", page: 1 })],
  },
  validateSearch: normalizeAccountListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listAccounts({ data: deps }),
  component: AccountsPage,
});

function AccountsPage() {
  const result = Route.useLoaderData();
  const search = Route.useSearch();
  return <Accounts result={result} search={search} />;
}
