import { createFileRoute } from "@tanstack/react-router";

import { AccountSecurity } from "@/components/account-security";
import { fetchAccountSessions, fetchTwoFactorStatus } from "@/lib/auth-server";

export const Route = createFileRoute("/_account/account-security")({
  staticData: {
    title: "Account Security",
  },
  loader: async () => {
    const [twoFactorStatus, sessions] = await Promise.all([
      fetchTwoFactorStatus(),
      fetchAccountSessions(),
    ]);
    return { twoFactorStatus, sessions };
  },
  component: AccountSecurityPage,
});

function AccountSecurityPage() {
  const { twoFactorStatus, sessions } = Route.useLoaderData();
  const { session } = Route.useRouteContext();

  return (
    <AccountSecurity
      twoFactorStatus={twoFactorStatus}
      sessions={sessions}
      email={session.user.email}
    />
  );
}
