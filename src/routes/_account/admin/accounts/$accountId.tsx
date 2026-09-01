import { createFileRoute, notFound } from "@tanstack/react-router";

import { AccountDetail, AccountNotFound } from "@/components/account-detail";
import { getAccount } from "@/lib/admin-server";

export const Route = createFileRoute("/_account/admin/accounts/$accountId")({
  staticData: { title: "Account" },
  loader: async ({ params }) => {
    const account = await getAccount({ data: { accountId: params.accountId } });
    if (!account) throw notFound();
    return account;
  },
  component: AccountDetailPage,
  notFoundComponent: AccountNotFound,
});

function AccountDetailPage() {
  return <AccountDetail account={Route.useLoaderData()} />;
}
