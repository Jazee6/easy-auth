import { AccountOwnedSessions } from "@/components/account-owned-sessions";
import { PageHeader } from "@/components/page-header";
import { TwoFactorSettings } from "@/components/two-factor-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SelfServiceAccountSession } from "@/lib/admin-sessions";
import type { TwoFactorAccountStatus } from "@/lib/two-factor-management";

export function AccountSecurity({
  twoFactorStatus,
  sessions,
  email,
}: {
  twoFactorStatus: TwoFactorAccountStatus;
  sessions: SelfServiceAccountSession[];
  email: string;
}) {
  return (
    <div className="w-full max-w-4xl space-y-6">
      <PageHeader
        title="Security"
        description="Manage Two-Factor Authentication and active Sessions for your Account."
      />
      <TwoFactorSettings status={twoFactorStatus} email={email} />
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>
            Review browsers and devices currently authenticated to your Account. Session credentials
            remain private.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountOwnedSessions sessions={sessions} />
        </CardContent>
      </Card>
    </div>
  );
}
