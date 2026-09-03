import { createFileRoute } from "@tanstack/react-router";

import { AccountSecurity } from "@/components/account-security";
import { fetchAccountSessions, fetchTwoFactorStatus } from "@/lib/auth-server";
import { privatePageHead } from "@/lib/page-metadata";

export const Route = createFileRoute("/_account/security")({
  staticData: {
    title: "Security",
  },
  head: () => privatePageHead("Security"),
  loader: async () => {
    const [twoFactorStatus, sessions] = await Promise.all([
      fetchTwoFactorStatus(),
      fetchAccountSessions(),
    ]);
    return { twoFactorStatus, sessions };
  },
  component: SecurityPage,
});

function SecurityPage() {
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
