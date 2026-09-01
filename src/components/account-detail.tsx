import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, FileQuestion } from "lucide-react";

import { BanAccountAction } from "@/components/ban-account-action";
import { PageHeader } from "@/components/page-header";
import { SecurityActivityTable } from "@/components/security-activity-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { toast } from "@/components/ui/toast";
import type { AccountListItem } from "@/lib/admin-accounts";
import type { SecurityActivityItem } from "@/lib/admin-security";
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

function BanBadge({ account }: { account: AccountListItem }) {
  if (account.banState === "none") return <Badge variant="outline">Unrestricted</Badge>;
  return (
    <Badge variant={account.banState === "active" ? "destructive" : "secondary"}>
      {account.banState === "active" ? "Banned" : "Expired"}
    </Badge>
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
}: {
  account: AccountListItem;
  securityActivity: SecurityActivityItem[];
}) {
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        to="/admin/accounts"
        search={{ q: "", sort: "createdAt", direction: "desc", page: 1 }}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        Back to Accounts
      </Link>

      <PageHeader
        title={account.name}
        description={account.email}
        actions={
          <>
            {account.role === "standard" && (
              <BanAccountAction
                accountId={account.accountId}
                accountName={account.name}
                accountEmail={account.email}
                retry={account.banState === "active"}
              />
            )}
            <Badge variant={account.role === "administrator" ? "default" : "secondary"}>
              {account.role === "administrator" ? "Administrator" : "Standard"}
            </Badge>
            <BanBadge account={account} />
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
            <Detail label="Email verification">
              {account.emailVerified ? "Verified" : "Unverified"}
            </Detail>
            <Detail label="Created">{dateFormatter.format(new Date(account.createdAt))}</Detail>
            <Detail label="Updated">{dateFormatter.format(new Date(account.updatedAt))}</Detail>
            <Detail label="Ban state">
              <BanBadge account={account} />
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
            <Button
              variant="outline"
              loading={copying}
              disabled={copying}
              onClick={async () => {
                setCopying(true);
                try {
                  await navigator.clipboard.writeText(account.accountId);
                  setCopied(true);
                  toast.add({ title: "User ID copied" });
                } catch {
                  toast.add({
                    title: "Unable to copy User ID",
                    description: "Copy the identifier manually and try again if needed.",
                  });
                } finally {
                  setCopying(false);
                }
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy User ID"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {account.role === "administrator"
              ? "Administrator security is operations-only. Sessions and security controls are not available here."
              : "Security operations in the Admin Panel apply only to Standard Accounts."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
