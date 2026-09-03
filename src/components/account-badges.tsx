import { Ban, History, MailCheck, MailQuestion, ShieldCheck, ShieldOff, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AccountBanState, AccountRoleFilter } from "@/lib/admin-accounts";

export function RoleBadge({ role }: { role: AccountRoleFilter }) {
  return role === "administrator" ? (
    <Badge>
      <ShieldCheck aria-hidden="true" />
      Administrator
    </Badge>
  ) : (
    <Badge variant="secondary">
      <User aria-hidden="true" />
      Standard
    </Badge>
  );
}

export function EmailVerificationBadge({ emailVerified }: { emailVerified: boolean }) {
  return emailVerified ? (
    <Badge variant="secondary">
      <MailCheck aria-hidden="true" />
      Verified
    </Badge>
  ) : (
    <Badge variant="outline">
      <MailQuestion aria-hidden="true" />
      Unverified
    </Badge>
  );
}

export function BanBadge({ banState }: { banState: AccountBanState }) {
  if (banState === "none")
    return (
      <Badge variant="outline">
        <ShieldCheck aria-hidden="true" />
        Unrestricted
      </Badge>
    );
  if (banState === "active")
    return (
      <Badge variant="destructive">
        <Ban aria-hidden="true" />
        Banned
      </Badge>
    );
  return (
    <Badge variant="secondary">
      <History aria-hidden="true" />
      Expired
    </Badge>
  );
}

export function TwoFactorBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Badge variant="secondary">
      <ShieldCheck aria-hidden="true" />
      Enabled
    </Badge>
  ) : (
    <Badge variant="outline">
      <ShieldOff aria-hidden="true" />
      Disabled
    </Badge>
  );
}
