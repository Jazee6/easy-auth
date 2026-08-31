import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { CircleCheck, CircleOff, ClipboardPlus, KeyRound, PencilLine, Trash2 } from "lucide-react";

import { type OAuthClientDialogClient, CopyValueRow } from "@/components/oauth-client-dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import {
  formatAbsoluteTime,
  formatOAuthClientActivityEvent,
  formatRelativeTime,
  type OAuthClientActivityIcon,
  type OAuthClientActivityRecord,
} from "@/lib/oauth-activity";
import { getOAuthClientActivity, rotateOAuthClientSecret } from "@/lib/oauth-server";

const activityIcons: Record<OAuthClientActivityIcon, typeof ClipboardPlus> = {
  registered: ClipboardPlus,
  updated: PencilLine,
  disabled: CircleOff,
  enabled: CircleCheck,
  rotated: KeyRound,
  deleted: Trash2,
};

export function RelativeTime({ value }: { value: Date | number | string }) {
  const absolute = formatAbsoluteTime(value);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              className="cursor-help underline decoration-dotted underline-offset-4"
            />
          }
        >
          {formatRelativeTime(value)}
        </TooltipTrigger>
        <TooltipContent>{absolute}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ActivityCell({ record }: { record: OAuthClientActivityRecord }) {
  const event = formatOAuthClientActivityEvent(record);
  const Icon = activityIcons[event.icon];
  return (
    <div className="flex min-w-48 items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">{event.title}</p>
        <p className="text-sm text-muted-foreground">{event.summary}</p>
      </div>
    </div>
  );
}

export function ActivityTimeline({ activity }: { activity: OAuthClientActivityRecord[] }) {
  if (activity.length === 0) {
    return (
      <Empty className="min-h-64 border-0 p-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardPlus />
          </EmptyMedia>
          <EmptyTitle>No management activity yet.</EmptyTitle>
          <EmptyDescription>Changes to this client will appear here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ol className="space-y-8">
      {activity.map((record, index) => {
        const event = formatOAuthClientActivityEvent(record);
        const Icon = activityIcons[event.icon];
        return (
          <li key={record.id} className="relative pl-9">
            {index < activity.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-7 bottom-[-2rem] left-3.5 w-px bg-border"
              />
            )}
            <span className="absolute top-0 left-0 flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">{event.title}</p>
              <p className="text-sm text-muted-foreground">{event.summary}</p>
              <p className="text-xs text-muted-foreground">
                <RelativeTime value={record.createdAt} />
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function OAuthClientActivitySheet({
  client,
  open,
  onOpenChange,
}: {
  client: OAuthClientDialogClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activity, setActivity] = useState<OAuthClientActivityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void getOAuthClientActivity({ data: { clientId: client.clientId } })
      .then((items) => {
        if (!cancelled) setActivity(items);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load management activity. Try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client.clientId, open]);

  const handleOpenChangeComplete = (nextOpen: boolean) => {
    if (nextOpen) return;
    setActivity([]);
    setIsLoading(false);
    setError(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} onOpenChangeComplete={handleOpenChangeComplete}>
      <SheetContent className="gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Management activity</SheetTitle>
          <SheetDescription>
            <span className="block truncate">{client.name ?? "Unnamed application"}</span>
            <span className="block break-all font-mono text-xs">{client.clientId}</span>
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            {isLoading ? (
              <div className="flex min-h-64 items-center justify-center">
                <Spinner aria-label="Loading management activity" />
              </div>
            ) : error ? (
              <div
                role="alert"
                className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
              >
                {error}
              </div>
            ) : (
              <ActivityTimeline activity={activity} />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function RotateOAuthClientSecretDialog({
  client,
  open,
  onOpenChange,
}: {
  client: OAuthClientDialogClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isRotating) return;
    onOpenChange(nextOpen);
  };

  const handleOpenChangeComplete = (nextOpen: boolean) => {
    if (!nextOpen) setSecret(null);
  };

  const rotate = async () => {
    setIsRotating(true);
    try {
      const result = await rotateOAuthClientSecret({ data: { clientId: client.clientId } });
      setSecret(result.clientSecret ?? null);
      await router.invalidate();
      toast.add({
        title: "Client secret rotated",
        description: "The previous secret stopped working immediately.",
        type: "success",
      });
    } catch {
      toast.add({
        title: "Unable to rotate client secret",
        description: "Try again. The existing secret remains unchanged.",
        type: "error",
      });
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!isRotating}>
        {secret ? (
          <>
            <DialogHeader>
              <DialogTitle>Save the new client secret</DialogTitle>
              <DialogDescription>
                This secret is shown once. Closing this dialog clears it and it cannot be recovered.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">New client secret</p>
              <CopyValueRow value={secret} label="client secret" />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                I have saved it
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Rotate client secret?</DialogTitle>
              <DialogDescription>
                The previous secret will stop working immediately. The replacement is shown once, so
                save it before closing.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose
                disabled={isRotating}
                render={<Button variant="outline" type="button" />}
              >
                Cancel
              </DialogClose>
              <Button
                type="button"
                loading={isRotating}
                disabled={isRotating}
                onClick={() => void rotate()}
              >
                Rotate secret
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
