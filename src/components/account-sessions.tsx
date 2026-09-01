import { useState } from "react";
import { useRouter } from "@tanstack/react-router";

import { DataTable, type DataTableColumnDef } from "@/components/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { revokeAccountSession, revokeAllAccountSessions } from "@/lib/admin-server";
import type { SafeAccountSession } from "@/lib/admin-sessions";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function actionError(): string {
  return "Unable to revoke the selected Session. Refresh the Account and try again.";
}

function RevokeSessionAction({
  accountId,
  accountName,
  session,
}: {
  accountId: string;
  accountName: string;
  session: SafeAccountSession;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await revokeAccountSession({ data: { accountId, sessionId: session.sessionId } });
      toast.add({
        title: "Session revoked",
        description: `${session.browser} on ${session.operatingSystem} can no longer authenticate.`,
        type: "success",
      });
      setOpen(false);
      await router.invalidate();
    } catch {
      setError(actionError());
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(nextOpen) => {
        if (nextOpen) return;
        setError(null);
        setPending(false);
      }}
    >
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        Revoke
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke Session</AlertDialogTitle>
          <AlertDialogDescription>
            End this {accountName} Session immediately?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 text-sm">
          {error && (
            <div role="alert" className="rounded-md bg-destructive/15 p-3 text-destructive">
              {error}
            </div>
          )}
          <p>
            {session.browser} · {session.operatingSystem} · {session.deviceType}
          </p>
          <p className="text-muted-foreground">
            IP address {session.ipAddress}. This action may sign the Account out immediately on that
            device.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            loading={pending}
            disabled={pending}
            onClick={() => void confirm()}
          >
            Revoke Session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RevokeAllSessionsAction({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await revokeAllAccountSessions({ data: { accountId } });
      toast.add({
        title: "All Sessions revoked",
        description: `${accountName} has been signed out on every active device.`,
        type: "success",
      });
      setOpen(false);
      await router.invalidate();
    } catch {
      setError("Unable to revoke all Sessions. Refresh the Account and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(nextOpen) => {
        if (nextOpen) return;
        setError(null);
        setPending(false);
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        Revoke all Sessions
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke all Sessions</AlertDialogTitle>
          <AlertDialogDescription>
            Sign {accountName} out on every active device immediately?
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <div role="alert" className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          This affects every active Session for this Standard Account and cannot be undone.
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            loading={pending}
            disabled={pending}
            onClick={() => void confirm()}
          >
            Revoke all Sessions
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function sessionColumns(
  accountId: string,
  accountName: string,
): DataTableColumnDef<SafeAccountSession>[] {
  return [
    {
      id: "device",
      header: "Device",
      cell: ({ row }) => (
        <div className="min-w-48">
          <p className="font-medium">{row.original.browser}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.operatingSystem} · {row.original.deviceType}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "ipAddress",
      header: "IP address",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.ipAddress}</span>,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {dateFormatter.format(new Date(row.original.createdAt))}
        </span>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {dateFormatter.format(new Date(row.original.updatedAt))}
        </span>
      ),
    },
    {
      accessorKey: "expiresAt",
      header: "Expires",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {dateFormatter.format(new Date(row.original.expiresAt))}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <RevokeSessionAction
            accountId={accountId}
            accountName={accountName}
            session={row.original}
          />
        </div>
      ),
    },
  ];
}

export function AccountSessions({
  accountId,
  accountName,
  sessions,
}: {
  accountId: string;
  accountName: string;
  sessions: SafeAccountSession[];
}) {
  return (
    <div className="space-y-4">
      {sessions.length > 0 && (
        <div className="flex justify-end">
          <RevokeAllSessionsAction accountId={accountId} accountName={accountName} />
        </div>
      )}
      <DataTable
        data={sessions}
        columns={sessionColumns(accountId, accountName)}
        emptyMessage="No active Sessions"
        emptyDescription="This Standard Account has no active authenticated devices."
      />
    </div>
  );
}
