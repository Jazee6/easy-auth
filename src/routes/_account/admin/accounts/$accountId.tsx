import { createFileRoute, notFound } from "@tanstack/react-router";

import { AccountDetail, AccountNotFound } from "@/components/account-detail";
import { getAccount, getAccountSecurityActivity } from "@/lib/admin-server";

export const Route = createFileRoute("/_account/admin/accounts/$accountId")({
  staticData: { title: "Account" },
  loader: async ({ params }) => {
    const account = await getAccount({ data: { accountId: params.accountId } });
    if (!account) throw notFound();
    const securityActivity =
      account.role === "standard"
        ? await getAccountSecurityActivity({ data: { accountId: params.accountId } })
        : [];
    return { account, securityActivity };
  },
  component: AccountDetailPage,
  notFoundComponent: AccountNotFound,
});

function AccountDetailPage() {
  const { account, securityActivity } = Route.useLoaderData();
  return <AccountDetail account={account} securityActivity={securityActivity} />;
}
