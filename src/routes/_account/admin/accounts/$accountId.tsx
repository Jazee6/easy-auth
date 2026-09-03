import { createFileRoute, notFound } from "@tanstack/react-router";

import { AccountDetail, AccountNotFound } from "@/components/account-detail";
import { getAccount, getAccountSecurityActivity, listAccountSessions } from "@/lib/admin-server";
import { privatePageHead } from "@/lib/page-metadata";

export const Route = createFileRoute("/_account/admin/accounts/$accountId")({
  staticData: { title: "Account" },
  head: () => privatePageHead("Account details"),
  loader: async ({ params }) => {
    const account = await getAccount({ data: { accountId: params.accountId } });
    if (!account) throw notFound();
    const [securityActivity, sessions] =
      account.role === "standard"
        ? await Promise.all([
            getAccountSecurityActivity({ data: { accountId: params.accountId } }),
            listAccountSessions({ data: { accountId: params.accountId } }),
          ])
        : [[], []];
    return { account, securityActivity, sessions };
  },
  component: AccountDetailPage,
  notFoundComponent: AccountNotFound,
});

function AccountDetailPage() {
  const { account, securityActivity, sessions } = Route.useLoaderData();
  return (
    <AccountDetail account={account} securityActivity={securityActivity} sessions={sessions} />
  );
}
