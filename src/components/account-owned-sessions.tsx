import * as React from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { accountSecurityError, accountSecurityErrorCode } from "@/lib/account-security";
import type { SelfServiceAccountSession } from "@/lib/admin-sessions";
import { authClient } from "@/lib/auth-client";
import { getPostLogoutRedirect } from "@/lib/auth-policy";
import { revokeAccountOwnedSession, revokeOtherAccountSessions } from "@/lib/auth-server";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function FreshSessionRequiredFooter({ onError }: { onError: (message: string) => void }) {
  const navigate = useNavigate();
  const [pending, setPending] = React.useState(false);

  const signInAgain = async () => {
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        onError(accountSecurityError(result.error, "Unable to sign out. Try again."));
        return;
      }
      await navigate({ to: getPostLogoutRedirect() });
    } catch (error) {
      onError(accountSecurityError(error, "Unable to sign out. Try again."));
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialogFooter>
      <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
      <AlertDialogAction loading={pending} disabled={pending} onClick={() => void signInAgain()}>
        Sign in again
      </AlertDialogAction>
    </AlertDialogFooter>
  );
}

function RevokeOwnedSession({ session }: { session: SelfServiceAccountSession }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [requiresFreshSignIn, setRequiresFreshSignIn] = React.useState(false);

  const revoke = async () => {
    setPending(true);
    setError(null);
    try {
      await revokeAccountOwnedSession({ data: { sessionId: session.sessionId } });
      setOpen(false);
      toast.add({
        title: "Session terminated",
        description: `${session.browser} on ${session.operatingSystem} can no longer authenticate.`,
        type: "success",
      });
      await router.invalidate();
    } catch (caught) {
      setRequiresFreshSignIn(accountSecurityErrorCode(caught) === "SESSION_NOT_FRESH");
      setError(
        accountSecurityError(caught, "Unable to terminate this Session. Refresh and try again."),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          setError(null);
          setPending(false);
          setRequiresFreshSignIn(false);
        }
      }}
    >
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        Terminate
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Terminate this Session?</AlertDialogTitle>
          <AlertDialogDescription>
            {session.browser} on {session.operatingSystem} will be signed out immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {requiresFreshSignIn ? (
          <FreshSessionRequiredFooter onError={setError} />
        ) : (
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={pending}
              disabled={pending}
              onClick={() => void revoke()}
            >
              Terminate Session
            </AlertDialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TerminateOtherSessions({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [requiresFreshSignIn, setRequiresFreshSignIn] = React.useState(false);

  const revoke = async () => {
    setPending(true);
    setError(null);
    try {
      await revokeOtherAccountSessions();
      setOpen(false);
      toast.add({
        title: "Other Sessions terminated",
        description: "This current Session remains active.",
        type: "success",
      });
      await router.invalidate();
    } catch (caught) {
      setRequiresFreshSignIn(accountSecurityErrorCode(caught) === "SESSION_NOT_FRESH");
      setError(
        accountSecurityError(caught, "Unable to terminate other Sessions. Refresh and try again."),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          setError(null);
          setPending(false);
          setRequiresFreshSignIn(false);
        }
      }}
    >
      <AlertDialogTrigger render={<Button variant="outline" disabled={disabled} />}>
        Terminate other Sessions
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Terminate every other Session?</AlertDialogTitle>
          <AlertDialogDescription>
            Every other browser and device will be signed out. This current Session remains active.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {requiresFreshSignIn ? (
          <FreshSessionRequiredFooter onError={setError} />
        ) : (
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={pending}
              disabled={pending}
              onClick={() => void revoke()}
            >
              Terminate other Sessions
            </AlertDialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function columns(): DataTableColumnDef<SelfServiceAccountSession>[] {
  return [
    {
      id: "device",
      header: "Device",
      cell: ({ row }) => (
        <div className="min-w-48">
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.browser}</span>
            {row.original.isCurrent && <Badge variant="secondary">Current</Badge>}
          </div>
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
      accessorKey: "updatedAt",
      header: "Last active",
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
          {row.original.isCurrent ? null : <RevokeOwnedSession session={row.original} />}
        </div>
      ),
    },
  ];
}

export function AccountOwnedSessions({ sessions }: { sessions: SelfServiceAccountSession[] }) {
  const hasOtherSessions = sessions.some((session) => !session.isCurrent);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <TerminateOtherSessions disabled={!hasOtherSessions} />
      </div>
      <DataTable
        data={sessions}
        columns={columns()}
        emptyMessage="No active Sessions"
        emptyDescription="No authenticated browser or device Sessions were found for this Account."
      />
    </div>
  );
}
