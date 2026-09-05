import * as React from "react";
import { useRouter } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { Fingerprint } from "lucide-react";
import * as v from "valibot";
import { WebAuthnAbortService } from "@simplewebauthn/browser";

import { authClient } from "@/lib/auth-client";
import type { PasskeyItem } from "@/lib/auth-policy";
import {
  consumePasskeyRegistrationDraft,
  savePasskeyRegistrationDraft,
} from "@/lib/passkey-registration-draft";
import {
  isPasskeyCancellation,
  passkeyNameSchema,
  renamePasskeySchema,
  translatePasskeyError,
} from "@/lib/passkey-policy";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogOverlay,
  AlertDialogPortal,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { toast } from "@/components/ui/toast";

const addPasskeyFormSchema = v.object({
  name: passkeyNameSchema,
});

const renamePasskeyFormSchema = v.object({
  name: renamePasskeySchema,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export interface PasskeySettingsProps {
  userId: string;
  resumeRegistration?: boolean;
  passkeys: PasskeyItem[];
  canDeletePasskey: (id: string) => boolean;
}

export function PasskeySettings({
  userId,
  resumeRegistration = false,
  passkeys,
  canDeletePasskey,
}: PasskeySettingsProps) {
  const router = useRouter();
  const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
  const hasResumedRegistration = React.useRef(false);

  const [isWebAuthnSupported, setIsWebAuthnSupported] = React.useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const isAddingRef = React.useRef(false);

  const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false);
  const [targetPasskeyForRename, setTargetPasskeyForRename] = React.useState<PasskeyItem | null>(
    null,
  );

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [targetPasskeyForDelete, setTargetPasskeyForDelete] = React.useState<PasskeyItem | null>(
    null,
  );
  const [isDeletingPasskey, setIsDeletingPasskey] = React.useState(false);

  React.useEffect(() => {
    setIsWebAuthnSupported(typeof window !== "undefined" && Boolean(window.PublicKeyCredential));
    return () => {
      WebAuthnAbortService.cancelCeremony();
    };
  }, []);

  const cancelAddCeremony = () => {
    if (isAddingRef.current) {
      isAddingRef.current = false;
      try {
        WebAuthnAbortService.cancelCeremony();
      } catch {}
    }
  };

  const addForm = useForm({
    validators: {
      onSubmit: addPasskeyFormSchema,
    },
    defaultValues: {
      name: "",
    },
    onSubmit: async ({ value }) => {
      isAddingRef.current = true;
      try {
        const result = await authClient.passkey.addPasskey({
          name: value.name.trim() || undefined,
        });

        // If dialog closed or cancelled while ceremony was in flight, abort silently
        if (!isAddingRef.current) return;
        isAddingRef.current = false;

        if (result.error) {
          if (isPasskeyCancellation(result.error)) {
            return;
          }
          const errorCode = (result.error as { code?: string } | null)?.code;
          if (errorCode === "SESSION_NOT_FRESH") {
            toast.add({
              title: "Recent sign-in required",
              description: "Please sign in again to register a passkey.",
              type: "error",
            });
            try {
              savePasskeyRegistrationDraft(window.sessionStorage, userId, value.name.trim());
            } catch {
              toast.add({
                title: "Passkey name could not be saved",
                description: "Browser storage is unavailable. Add the passkey after signing in.",
                type: "error",
              });
            }
            window.location.assign(
              `/login?${new URLSearchParams({
                returnTo: "/sign-in-methods?resume=add-passkey",
              })}`,
            );
            return;
          }
          toast.add({
            title: "Passkey was not added",
            description: translatePasskeyError(result.error),
            type: "error",
          });
          return;
        }

        setIsAddDialogOpen(false);
        toast.add({
          title: "Passkey added",
          description: "Your passkey has been registered and can now be used to sign in.",
          type: "success",
        });
        await router.invalidate();
      } catch (err) {
        if (!isAddingRef.current) return;
        isAddingRef.current = false;
        if (isPasskeyCancellation(err)) return;
        toast.add({
          title: "Passkey was not added",
          description: translatePasskeyError(err),
          type: "error",
        });
      }
    },
  });

  React.useEffect(() => {
    if (!resumeRegistration || hasResumedRegistration.current) return;
    hasResumedRegistration.current = true;

    try {
      const name = consumePasskeyRegistrationDraft(window.sessionStorage, userId);
      if (name !== null) {
        addForm.setFieldValue("name", name);
        setIsManageDialogOpen(true);
        setIsAddDialogOpen(true);
      }
    } catch {
      // Storage may be disabled; the user can still add a passkey manually.
    }

    void router.navigate({
      to: "/sign-in-methods",
      search: (previous) => ({ ...previous, resume: undefined }),
      replace: true,
    });
  }, [resumeRegistration, userId, addForm, router]);

  const renameForm = useForm({
    validators: {
      onSubmit: renamePasskeyFormSchema,
    },
    defaultValues: {
      name: "",
    },
    onSubmit: async ({ value }) => {
      if (!targetPasskeyForRename) return;

      try {
        const result = await authClient.passkey.updatePasskey({
          id: targetPasskeyForRename.id,
          name: value.name.trim(),
        });

        if (result.error) {
          toast.add({
            title: "Failed to rename passkey",
            description: translatePasskeyError(result.error),
            type: "error",
          });
          return;
        }

        setIsRenameDialogOpen(false);
        toast.add({
          title: "Passkey renamed",
          description: "The passkey name has been updated.",
          type: "success",
        });
        await router.invalidate();
      } catch (err) {
        toast.add({
          title: "Failed to rename passkey",
          description: translatePasskeyError(err),
          type: "error",
        });
      }
    },
  });

  const handleDeletePasskey = async () => {
    if (!targetPasskeyForDelete) return;

    setIsDeletingPasskey(true);
    try {
      const result = await authClient.passkey.deletePasskey({
        id: targetPasskeyForDelete.id,
      });

      if (result.error) {
        const errorCode = (result.error as { code?: string } | null)?.code;
        if (errorCode === "SESSION_NOT_FRESH") {
          toast.add({
            title: "Recent sign-in required",
            description: "Please sign in again to delete this passkey.",
            type: "error",
          });
          window.location.assign("/login?returnTo=/sign-in-methods");
          return;
        }
        toast.add({
          title: "Passkey was not deleted",
          description: translatePasskeyError(result.error),
          type: "error",
        });
        return;
      }

      setIsDeleteDialogOpen(false);
      toast.add({
        title: "Passkey deleted",
        description: "This passkey has been removed and can no longer be used.",
        type: "success",
      });
      await router.invalidate();
    } catch (err) {
      toast.add({
        title: "Passkey was not deleted",
        description: translatePasskeyError(err),
        type: "error",
      });
    } finally {
      setIsDeletingPasskey(false);
    }
  };

  const openRenameDialog = (pk: PasskeyItem) => {
    setTargetPasskeyForRename(pk);
    renameForm.setFieldValue("name", pk.name ?? "");
    setIsRenameDialogOpen(true);
  };

  const openDeleteDialog = (pk: PasskeyItem) => {
    setTargetPasskeyForDelete(pk);
    setIsDeleteDialogOpen(true);
  };

  return (
    <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
      <Item variant="outline">
        <ItemMedia variant="icon">
          <Fingerprint />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Passkeys</ItemTitle>
          <ItemDescription>
            {passkeys.length === 0
              ? "No passkeys registered"
              : `${passkeys.length} passkey${passkeys.length === 1 ? "" : "s"} registered`}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>Manage</DialogTrigger>
        </ItemActions>
      </Item>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage passkeys</DialogTitle>
          <DialogDescription>
            Sign in securely with biometric recognition, security keys, or your device lock.
          </DialogDescription>
        </DialogHeader>

        {!isWebAuthnSupported && (
          <p className="text-sm text-destructive" role="status">
            Passkeys are not supported in this browser.
          </p>
        )}

        {passkeys.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Fingerprint />
              </EmptyMedia>
              <EmptyTitle>No passkeys registered</EmptyTitle>
              <EmptyDescription>
                Add a passkey to sign in faster without typing a password.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="max-h-[50dvh] overflow-y-auto">
            {passkeys.map((pk) => {
              const canDelete = canDeletePasskey(pk.id);
              return (
                <Item key={pk.id} variant="outline">
                  <ItemMedia variant="icon">
                    <Fingerprint />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{pk.name || "Passkey"}</ItemTitle>
                    <ItemDescription>
                      Created{" "}
                      {pk.createdAt ? dateFormatter.format(new Date(pk.createdAt)) : "recently"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button variant="ghost" size="sm" onClick={() => openRenameDialog(pk)}>
                      Rename
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canDelete}
                      onClick={() => openDeleteDialog(pk)}
                      title={!canDelete ? "Cannot delete your only sign-in method" : undefined}
                    >
                      Delete
                    </Button>
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={!isWebAuthnSupported}
            onClick={() => setIsAddDialogOpen(true)}
          >
            Add passkey
          </Button>
        </DialogFooter>

        {/* Add Passkey Dialog */}
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              cancelAddCeremony();
            }
          }}
          onOpenChangeComplete={(open) => {
            if (!open) {
              cancelAddCeremony();
              addForm.reset();
            }
          }}
        >
          <DialogPortal>
            <DialogOverlay forceRender />
          </DialogPortal>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a passkey</DialogTitle>
              <DialogDescription>
                Give your passkey an optional name to help you recognize it later. You will then be
                prompted to verify your device PIN or biometrics.
              </DialogDescription>
            </DialogHeader>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addForm.handleSubmit();
              }}
            >
              <FieldGroup>
                <addForm.Field name="name">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="passkey-add-name">Name (optional)</FieldLabel>
                      <Input
                        id="passkey-add-name"
                        name={field.name}
                        placeholder="e.g. Work Laptop, Personal Phone"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </addForm.Field>
              </FieldGroup>
              <DialogFooter className="mt-4">
                <addForm.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <>
                      <DialogClose
                        render={
                          <Button variant="outline" type="button" disabled={isSubmitting}>
                            Cancel
                          </Button>
                        }
                      />
                      <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                        Continue
                      </Button>
                    </>
                  )}
                </addForm.Subscribe>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Rename Passkey Dialog - retains targetPasskeyForRename until exit animation completes */}
        <Dialog
          open={isRenameDialogOpen}
          onOpenChange={setIsRenameDialogOpen}
          onOpenChangeComplete={(open) => {
            if (!open) {
              setTargetPasskeyForRename(null);
              renameForm.reset();
            }
          }}
        >
          <DialogPortal>
            <DialogOverlay forceRender />
          </DialogPortal>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename passkey</DialogTitle>
              <DialogDescription>Update the display name for this passkey.</DialogDescription>
            </DialogHeader>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                renameForm.handleSubmit();
              }}
            >
              <FieldGroup>
                <renameForm.Field name="name">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="passkey-rename-name">Name</FieldLabel>
                      <Input
                        id="passkey-rename-name"
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </renameForm.Field>
              </FieldGroup>
              <DialogFooter className="mt-4">
                <renameForm.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <>
                      <DialogClose
                        render={
                          <Button variant="outline" type="button" disabled={isSubmitting}>
                            Cancel
                          </Button>
                        }
                      />
                      <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                        Save
                      </Button>
                    </>
                  )}
                </renameForm.Subscribe>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Passkey AlertDialog - retains targetPasskeyForDelete until exit animation completes */}
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onOpenChangeComplete={(open) => {
            if (!open) {
              setTargetPasskeyForDelete(null);
              setIsDeletingPasskey(false);
            }
          }}
        >
          <AlertDialogPortal>
            <AlertDialogOverlay forceRender />
          </AlertDialogPortal>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete passkey?</AlertDialogTitle>
              <AlertDialogDescription>
                This passkey can no longer be used to sign in to Easy Auth. Deleting a passkey does
                not revoke any existing sessions, OAuth tokens, or application authorizations.
                Manage active sessions separately in Account Security.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingPasskey}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                loading={isDeletingPasskey}
                disabled={isDeletingPasskey}
                onClick={handleDeletePasskey}
              >
                Delete passkey
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
