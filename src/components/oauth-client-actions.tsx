import { useState } from "react";
import {
  CircleCheck,
  CircleOff,
  Clipboard,
  Ellipsis,
  Eye,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { OAuthClientDialog, type OAuthClientDialogClient } from "@/components/oauth-client-dialog";
import {
  OAuthClientActivitySheet,
  RotateOAuthClientSecretDialog,
} from "@/components/oauth-client-activity";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { deleteOAuthClient, setOAuthClientDisabled } from "@/lib/oauth-server";
import { getOAuthManagementActionError } from "@/lib/oauth-policy";
import { useRouter } from "@tanstack/react-router";

export function OAuthClientActions({ client }: { client: OAuthClientDialogClient }) {
  const router = useRouter();
  const [pending, setPending] = useState<"status" | "delete" | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isConfidential = client.tokenEndpointAuthMethod !== "none";
  const isDisabled = Boolean(client.disabled);

  const changeStatus = async (disabled: boolean) => {
    setPending("status");
    try {
      await setOAuthClientDisabled({ data: { clientId: client.clientId, disabled } });
      toast.add({
        title: disabled ? "OAuth client disabled" : "OAuth client enabled",
        description: disabled
          ? "New and existing token use is blocked immediately; application authorizations remain."
          : "New authorization and token flows are available again. Existing unexpired tokens can be used again.",
        type: "success",
      });
      setStatusConfirmOpen(false);
      await router.invalidate();
    } catch (cause) {
      toast.add({
        title: disabled ? "Unable to disable client" : "Unable to enable client",
        description: getOAuthManagementActionError("status", cause),
        type: "error",
      });
    } finally {
      setPending(null);
    }
  };

  const enable = () => void changeStatus(false);

  const remove = async () => {
    setPending("delete");
    try {
      await deleteOAuthClient({ data: { clientId: client.clientId } });
      toast.add({
        title: "OAuth client deleted",
        description: "The client and dependent authorization state were removed.",
        type: "success",
      });
      setDeleteConfirmOpen(false);
      await router.invalidate();
    } catch (cause) {
      toast.add({
        title: "Unable to delete OAuth client",
        description: getOAuthManagementActionError("delete", cause),
        type: "error",
      });
    } finally {
      setPending(null);
    }
  };

  const copyClientId = async () => {
    try {
      await navigator.clipboard.writeText(client.clientId);
      toast.add({
        title: "Client ID copied",
        description: "The OAuth client ID is ready to paste.",
        type: "success",
      });
    } catch {
      toast.add({
        title: "Unable to copy client ID",
        description: "Copy the client ID manually from the table.",
        type: "error",
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending !== null}
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              loading={pending !== null}
              aria-label={`Actions for ${client.name ?? "OAuth client"}`}
            />
          }
        >
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44 whitespace-nowrap" align="end">
          <DropdownMenuItem onClick={() => void copyClientId()}>
            <Clipboard />
            Copy client ID
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActivityOpen(true)}>
            <Eye />
            View activity
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isDisabled ? (
            <DropdownMenuItem onClick={enable}>
              <CircleCheck />
              Enable
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setStatusConfirmOpen(true)}>
              <CircleOff />
              Disable
            </DropdownMenuItem>
          )}
          {isConfidential && (
            <DropdownMenuItem onClick={() => setRotateOpen(true)}>
              <RotateCcw />
              Rotate secret
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <OAuthClientDialog client={client} open={editOpen} onOpenChange={setEditOpen} />
      <OAuthClientActivitySheet
        client={client}
        open={activityOpen}
        onOpenChange={setActivityOpen}
      />
      {isConfidential && (
        <RotateOAuthClientSecretDialog
          client={client}
          open={rotateOpen}
          onOpenChange={setRotateOpen}
        />
      )}
      <ClientActionDialog
        open={statusConfirmOpen}
        onOpenChange={setStatusConfirmOpen}
        title={`Disable ${client.name ?? client.clientId}?`}
        description="New authorization, token exchange, refresh, client authentication, and existing access token use will be blocked immediately. Application authorizations remain; re-enabling restores any token that has not expired or been revoked."
        actionLabel="Disable"
        pending={pending === "status"}
        onConfirm={() => changeStatus(true)}
      />
      <ClientActionDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Permanently delete ${client.name ?? client.clientId}?`}
        description="The OAuth client, its application authorizations, refresh tokens, access tokens, and dependent provider state will be removed. Management activity is retained. This cannot be undone."
        actionLabel="Delete permanently"
        destructive
        pending={pending === "delete"}
        onConfirm={remove}
      />
    </>
  );
}

function ClientActionDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  destructive = false,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  pending: boolean;
  onConfirm: () => Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            loading={pending}
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
