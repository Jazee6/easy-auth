import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";

import { AccountSessions } from "@/components/account-sessions";
import {
  BanBadge,
  EmailVerificationBadge,
  RoleBadge,
  TwoFactorBadge,
} from "@/components/account-badges";
import { BanAccountAction } from "@/components/ban-account-action";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { SecurityActivityTable } from "@/components/security-activity-table";
import { UnbanAccountAction } from "@/components/unban-account-action";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { AccountDetail as AccountDetailData } from "@/lib/admin-accounts";
import type { SecurityActivityItem } from "@/lib/admin-security";
import type { SafeAccountSession } from "@/lib/admin-sessions";
import { getInitials } from "@/lib/auth-policy";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "long",
  timeStyle: "short",
});

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

export function AccountNotFound() {
  return (
    <Empty className="min-h-[50vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestion />
        </EmptyMedia>
        <EmptyTitle>Account not found</EmptyTitle>
        <EmptyDescription>
          This Account does not exist or is no longer available in the Identity Domain.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link
          to="/admin/accounts"
          search={{ q: "", sort: "createdAt", direction: "desc", page: 1 }}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to Accounts
        </Link>
      </EmptyContent>
    </Empty>
  );
}

export function AccountDetail({
  account,
  securityActivity,
  sessions,
}: {
  account: AccountDetailData;
  securityActivity: SecurityActivityItem[];
  sessions: SafeAccountSession[];
}) {
  return (
    <div className="w-full max-w-7xl space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={
                <Link
                  to="/admin/accounts"
                  search={{ q: "", sort: "createdAt", direction: "desc", page: 1 }}
                />
              }
            >
              Accounts
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{account.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title={account.name}
        description={account.email}
        actions={
          <>
            {account.role === "standard" && account.banState !== "none" && (
              <UnbanAccountAction
                accountId={account.accountId}
                accountName={account.name}
                accountEmail={account.email}
              />
            )}
            {account.role === "standard" && (
              <BanAccountAction
                accountId={account.accountId}
                accountName={account.name}
                accountEmail={account.email}
                retry={account.banState === "active"}
              />
            )}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Account identity and current security state.</CardDescription>
          <CardAction>
            <Avatar size="lg">
              {account.image && <AvatarImage src={account.image} alt="" />}
              <AvatarFallback>{getInitials(account.name)}</AvatarFallback>
            </Avatar>
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Name">{account.name}</Detail>
            <Detail label="Login email">{account.email}</Detail>
            <Detail label="Role">
              <RoleBadge role={account.role} />
            </Detail>
            <Detail label="Email verification">
              <EmailVerificationBadge emailVerified={account.emailVerified} />
            </Detail>
            <Detail label="Two-Factor Authentication">
              <TwoFactorBadge enabled={account.twoFactorEnabled} />
            </Detail>
            <Detail label="Created">{dateFormatter.format(new Date(account.createdAt))}</Detail>
            <Detail label="Updated">{dateFormatter.format(new Date(account.updatedAt))}</Detail>
            <Detail label="Ban state">
              <BanBadge banState={account.banState} />
            </Detail>
            {account.banReason && <Detail label="Ban reason">{account.banReason}</Detail>}
            {account.banExpires && (
              <Detail label="Ban expiry">
                {dateFormatter.format(new Date(account.banExpires))}
              </Detail>
            )}
          </dl>
        </CardContent>
      </Card>

      {account.role === "standard" && (
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>
              Authenticated devices for this Standard Account. Session credentials remain private.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AccountSessions
              accountId={account.accountId}
              accountName={account.name}
              sessions={sessions}
            />
          </CardContent>
        </Card>
      )}

      {account.role === "standard" && (
        <Card>
          <CardHeader>
            <CardTitle>Security activity</CardTitle>
            <CardDescription>
              Best-effort operational history for this Standard Account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SecurityActivityTable activity={securityActivity} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Operational reference</CardTitle>
          <CardDescription>
            Use this identifier when correlating operational records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <code className="break-all text-sm">{account.accountId}</code>
            <CopyButton
              value={account.accountId}
              label="User ID"
              className="self-start sm:self-center"
            />
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {account.role === "administrator"
              ? "Administrator security is operations-only. Sessions and security controls are not available here."
              : "Security operations in the Admin Panel apply only to Standard Accounts. Unban never restores previously revoked Sessions or OAuth tokens."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
