import { useState } from "react";
import { useRouter } from "@tanstack/react-router";

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
import { translateUnbanAccountError } from "@/lib/admin-security";
import { unbanAccount } from "@/lib/admin-server";

export function UnbanAccountAction({
  accountId,
  accountName,
  accountEmail,
}: {
  accountId: string;
  accountName: string;
  accountEmail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmUnban() {
    setPending(true);
    setError(null);
    try {
      await unbanAccount({ data: { accountId } });
      toast.add({
        title: "Account unbanned",
        description: "Previous Sessions and OAuth tokens remain invalid.",
        type: "success",
      });
      setOpen(false);
      await router.invalidate();
    } catch (cause) {
      setError(translateUnbanAccountError(cause));
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
      <AlertDialogTrigger render={<Button variant="outline" />}>Unban Account</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unban Account</AlertDialogTitle>
          <AlertDialogDescription>
            Confirm that {accountName} ({accountEmail}) may sign in again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 text-sm">
          {error && (
            <div role="alert" className="rounded-md bg-destructive/15 p-3 text-destructive">
              {error}
            </div>
          )}
          <p>
            This clears the stored Ban, reason, and expiry. Previously revoked Sessions, OAuth
            access tokens, and OAuth refresh tokens will not be restored.
          </p>
          <p className="text-muted-foreground">Application Authorizations remain unchanged.</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            loading={pending}
            disabled={pending}
            onClick={() => void confirmUnban()}
          >
            Unban Account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
