import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";

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
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { revokeApplicationAuthorization } from "@/lib/oauth-server";

interface AuthorizationItem {
  consentId: string;
  clientId: string;
  clientName: string | null;
  scopes: string[];
  authorizedAt: Date;
}

export function AuthorizedApplications({ applications }: { applications: AuthorizationItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const revoke = async (clientId: string) => {
    setPendingId(clientId);
    setError(null);
    try {
      await revokeApplicationAuthorization({ data: { clientId } });
      await router.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to revoke this authorization.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="w-full max-w-4xl space-y-6">
      <PageHeader
        title="Applications"
        description="Revocation prevents future token use and silent reauthorization. It cannot recall an ID token already delivered or end a relying application's own local session."
      />
      <section className="space-y-4" aria-labelledby="authorized-applications-list-title">
        <h2
          id="authorized-applications-list-title"
          className="text-lg font-semibold tracking-tight"
        >
          Applications
        </h2>
        {error && (
          <div role="alert" className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {applications.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayoutGrid />
              </EmptyMedia>
              <EmptyTitle>No applications are authorized.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          applications.map((application) => (
            <div
              key={application.consentId}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{application.clientName ?? "Deleted application"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {application.scopes.map((scope) => (
                    <Badge key={scope} variant="secondary">
                      {scope}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Authorized {new Date(application.authorizedAt).toLocaleString()}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" disabled={pendingId === application.clientId} />
                  }
                >
                  Revoke
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Revoke {application.clientName ?? "this application"}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the Application Authorization and invalidates its refresh and
                      access tokens. It does not remove a Sign-in Method or your Easy Auth Session.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      loading={pendingId === application.clientId}
                      disabled={pendingId === application.clientId}
                      onClick={() => revoke(application.clientId)}
                    >
                      Revoke authorization
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
