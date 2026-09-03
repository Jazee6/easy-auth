import * as React from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { Download, KeyRound, ShieldCheck } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { encode } from "uqr";

import { TwoFactorBadge } from "@/components/account-badges";
import { CopyButton } from "@/components/copy-button";
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
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
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
import {
  accountSecurityError,
  backupCodesText,
  getTotpSecret,
  hasSecurityCleanupWarning,
  passwordConfirmationSchema,
  shouldRefreshTwoFactorStatusAfterClose,
  totpVerificationSchema,
} from "@/lib/account-security";
import { authClient } from "@/lib/auth-client";
import type { TwoFactorAccountStatus } from "@/lib/two-factor-management";

function TotpQrCode({ value }: { value: string }) {
  const qr = React.useMemo(() => encode(value, { border: 4, ecc: "M" }), [value]);
  const path = React.useMemo(
    () =>
      qr.data
        .flatMap((row, y) => row.flatMap((filled, x) => (filled ? [`M${x} ${y}h1v1H${x}z`] : [])))
        .join(""),
    [qr],
  );

  return (
    <svg
      role="img"
      aria-label="Authenticator App setup QR code"
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      className="size-52 rounded-md bg-white p-2"
      shapeRendering="crispEdges"
    >
      <rect width={qr.size} height={qr.size} fill="white" />
      <path d={path} fill="black" />
    </svg>
  );
}

function downloadBackupCodes(codes: string[]) {
  const url = URL.createObjectURL(
    new Blob([`${backupCodesText(codes)}\n`], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "easy-auth-backup-codes.txt";
  link.click();
  URL.revokeObjectURL(url);
}

function BackupCodes({
  codes,
  acknowledged,
  onAcknowledgedChange,
}: {
  codes: string[];
  acknowledged: boolean;
  onAcknowledgedChange: (checked: boolean) => void;
}) {
  return (
    <FieldGroup>
      <Alert>
        <ShieldCheck />
        <AlertTitle>Save these one-time Backup Codes now. They cannot be shown again.</AlertTitle>
      </Alert>
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-4 font-mono text-sm sm:grid-cols-3">
        {codes.map((code) => (
          <span key={code}>{code}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton value={backupCodesText(codes)} label="Backup Codes" variant="outline">
          Copy all
        </CopyButton>
        <Button type="button" variant="outline" onClick={() => downloadBackupCodes(codes)}>
          <Download />
          Download
        </Button>
      </div>
      <Field orientation="horizontal">
        <Checkbox
          id="backup-codes-saved"
          checked={acknowledged}
          onCheckedChange={onAcknowledgedChange}
        />
        <FieldContent>
          <FieldLabel htmlFor="backup-codes-saved">I saved my Backup Codes</FieldLabel>
          <FieldDescription>
            Each code works once. Generating another set invalidates this entire set.
          </FieldDescription>
        </FieldContent>
      </Field>
    </FieldGroup>
  );
}

function cleanupWarning(data: unknown) {
  if (!hasSecurityCleanupWarning(data)) return;
  toast.add({
    title: "Security setting changed",
    description:
      "Some security cleanup could not be completed. Terminate other Sessions and contact operations before re-enabling Two-Factor Authentication.",
    type: "warning",
  });
}

function EnrollmentDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [stage, setStage] = React.useState<"password" | "setup" | "codes">("password");
  const [totpURI, setTotpURI] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const allowClose = React.useRef(false);
  const refreshAfterClose = React.useRef(false);

  const passwordForm = useForm({
    defaultValues: { password: "" },
    validators: { onSubmit: passwordConfirmationSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const result = await authClient.twoFactor.enable({
          password: value.password,
          method: "totp",
        });
        if (result.error) {
          setFormError(
            accountSecurityError(result.error, "Unable to start Two-Factor setup. Try again."),
          );
          return;
        }
        if (!result.data || result.data.method !== "totp") {
          setFormError("Unable to start Authenticator App setup. Try again.");
          return;
        }
        setTotpURI(result.data.totpURI);
        setBackupCodes(result.data.backupCodes);
        setStage("setup");
      } catch (error) {
        setFormError(accountSecurityError(error, "Unable to start Two-Factor setup. Try again."));
      }
    },
  });

  const verificationForm = useForm({
    defaultValues: { code: "" },
    validators: { onSubmit: totpVerificationSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const result = await authClient.twoFactor.verifyTotp({
          code: value.code,
          trustDevice: false,
        });
        if (result.error) {
          setFormError(
            accountSecurityError(result.error, "Unable to verify the Authenticator code."),
          );
          return;
        }
        cleanupWarning(result.data);
        refreshAfterClose.current = true;
        setStage("codes");
        toast.add({
          title: "Two-Factor Authentication enabled",
          description: "Other Easy Auth Sessions have been terminated.",
          type: "success",
        });
      } catch (error) {
        setFormError(accountSecurityError(error, "Unable to verify the Authenticator code."));
      }
    },
  });

  const reset = () => {
    setStage("password");
    setTotpURI("");
    setBackupCodes([]);
    setAcknowledged(false);
    setFormError(null);
    allowClose.current = false;
    refreshAfterClose.current = false;
    passwordForm.reset();
    verificationForm.reset();
  };

  const requestOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setOpen(true);
      return;
    }
    if (stage === "codes" && !acknowledged && !allowClose.current) {
      setDiscardOpen(true);
      return;
    }
    setOpen(false);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={requestOpenChange}
        onOpenChangeComplete={(nextOpen) => {
          const shouldRefresh = shouldRefreshTwoFactorStatusAfterClose(
            nextOpen,
            refreshAfterClose.current,
          );
          if (!nextOpen) reset();
          if (shouldRefresh) void router.invalidate();
        }}
      >
        <DialogTrigger render={<Button />}>Set up</DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {stage === "password"
                ? "Confirm your password"
                : stage === "setup"
                  ? "Connect your Authenticator App"
                  : "Save your Backup Codes"}
            </DialogTitle>
            <DialogDescription>
              {stage === "password"
                ? "Two-Factor Authentication protects local password sign-in. Confirm your current password to begin."
                : stage === "setup"
                  ? "Scan the QR code, then enter the current six-digit code from your app."
                  : "This is the only time Easy Auth will display this set."}
            </DialogDescription>
          </DialogHeader>

          {stage === "password" && (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void passwordForm.handleSubmit();
              }}
            >
              <passwordForm.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <FieldGroup>
                    {formError && <FieldError errors={[{ message: formError }]} />}
                    <passwordForm.Field name="password">
                      {(field) => (
                        <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                          <FieldLabel htmlFor="two-factor-password">Current password</FieldLabel>
                          <Input
                            id="two-factor-password"
                            name={field.name}
                            type="password"
                            autoComplete="current-password"
                            autoFocus
                            disabled={isSubmitting}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              setFormError(null);
                              field.handleChange(event.target.value);
                            }}
                          />
                          <FieldError errors={field.state.meta.errors} />
                        </Field>
                      )}
                    </passwordForm.Field>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                        Continue
                      </Button>
                    </DialogFooter>
                  </FieldGroup>
                )}
              </passwordForm.Subscribe>
            </form>
          )}

          {stage === "setup" && (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void verificationForm.handleSubmit();
              }}
            >
              <verificationForm.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <FieldGroup>
                    <div className="flex justify-center">
                      <TotpQrCode value={totpURI} />
                    </div>
                    <Field>
                      <FieldLabel htmlFor="manual-setup-key">Manual setup key</FieldLabel>
                      <div className="flex gap-2">
                        <Input
                          id="manual-setup-key"
                          readOnly
                          value={getTotpSecret(totpURI)}
                          className="font-mono"
                        />
                        <CopyButton
                          value={getTotpSecret(totpURI)}
                          label="Manual setup key"
                          variant="outline"
                          size="icon"
                        />
                      </div>
                    </Field>
                    {formError && <FieldError errors={[{ message: formError }]} />}
                    <verificationForm.Field name="code">
                      {(field) => (
                        <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                          <FieldLabel htmlFor="enrollment-totp">Authenticator code</FieldLabel>
                          <div className="flex justify-center py-1">
                            <InputOTP
                              id="enrollment-totp"
                              name={field.name}
                              maxLength={6}
                              pattern={REGEXP_ONLY_DIGITS}
                              autoComplete="one-time-code"
                              disabled={isSubmitting}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(value) => {
                                setFormError(null);
                                field.handleChange(value);
                              }}
                            >
                              <InputOTPGroup>
                                {Array.from({ length: 6 }, (_, index) => (
                                  <InputOTPSlot key={index} index={index} />
                                ))}
                              </InputOTPGroup>
                            </InputOTP>
                          </div>
                          <FieldError errors={field.state.meta.errors} />
                        </Field>
                      )}
                    </verificationForm.Field>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        Cancel setup
                      </Button>
                      <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                        Verify and enable
                      </Button>
                    </DialogFooter>
                  </FieldGroup>
                )}
              </verificationForm.Subscribe>
            </form>
          )}

          {stage === "codes" && (
            <>
              <BackupCodes
                codes={backupCodes}
                acknowledged={acknowledged}
                onAcknowledgedChange={setAcknowledged}
              />
              <DialogFooter>
                <Button
                  disabled={!acknowledged}
                  onClick={() => {
                    allowClose.current = true;
                    setOpen(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving your Backup Codes?</AlertDialogTitle>
            <AlertDialogDescription>
              These codes cannot be displayed again. Without them, losing your Authenticator App
              requires operations recovery.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Return to codes</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                allowClose.current = true;
                setDiscardOpen(false);
                setOpen(false);
              }}
            >
              Discard codes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RegenerateBackupCodesDialog() {
  const [open, setOpen] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [codes, setCodes] = React.useState<string[] | null>(null);
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const allowClose = React.useRef(false);

  const form = useForm({
    defaultValues: { password: "" },
    validators: { onSubmit: passwordConfirmationSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const result = await authClient.twoFactor.generateBackupCodes({ password: value.password });
        if (result.error) {
          setFormError(accountSecurityError(result.error, "Unable to generate new Backup Codes."));
          return;
        }
        setCodes(result.data?.backupCodes ?? []);
        toast.add({
          title: "New Backup Codes generated",
          description: "Every previous Backup Code is now invalid.",
          type: "success",
        });
      } catch (error) {
        setFormError(accountSecurityError(error, "Unable to generate new Backup Codes."));
      }
    },
  });

  const reset = () => {
    setCodes(null);
    setAcknowledged(false);
    setFormError(null);
    allowClose.current = false;
    form.reset();
  };

  const requestOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setOpen(true);
      return;
    }
    if (codes && !acknowledged && !allowClose.current) {
      setDiscardOpen(true);
      return;
    }
    setOpen(false);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={requestOpenChange}
        onOpenChangeComplete={(nextOpen) => {
          if (!nextOpen) reset();
        }}
      >
        <DialogTrigger render={<Button variant="outline" />}>
          Generate new Backup Codes
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {codes ? "Save your new Backup Codes" : "Generate new Backup Codes"}
            </DialogTitle>
            <DialogDescription>
              {codes
                ? "This is the only time Easy Auth will display this set."
                : "Generating a new set immediately invalidates every existing Backup Code."}
            </DialogDescription>
          </DialogHeader>
          {codes ? (
            <>
              <BackupCodes
                codes={codes}
                acknowledged={acknowledged}
                onAcknowledgedChange={setAcknowledged}
              />
              <DialogFooter>
                <Button
                  disabled={!acknowledged}
                  onClick={() => {
                    allowClose.current = true;
                    setOpen(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
              }}
            >
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <FieldGroup>
                    {formError && <FieldError errors={[{ message: formError }]} />}
                    <form.Field name="password">
                      {(field) => (
                        <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                          <FieldLabel htmlFor="regenerate-backup-password">
                            Current password
                          </FieldLabel>
                          <Input
                            id="regenerate-backup-password"
                            name={field.name}
                            type="password"
                            autoComplete="current-password"
                            autoFocus
                            disabled={isSubmitting}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              setFormError(null);
                              field.handleChange(event.target.value);
                            }}
                          />
                          <FieldError errors={field.state.meta.errors} />
                        </Field>
                      )}
                    </form.Field>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                        Generate new codes
                      </Button>
                    </DialogFooter>
                  </FieldGroup>
                )}
              </form.Subscribe>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving your new Backup Codes?</AlertDialogTitle>
            <AlertDialogDescription>
              The previous set is already invalid and this new set cannot be displayed again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Return to codes</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                allowClose.current = true;
                setDiscardOpen(false);
                setOpen(false);
              }}
            >
              Discard codes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DisableTwoFactorDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const refreshAfterClose = React.useRef(false);

  const form = useForm({
    defaultValues: { password: "" },
    validators: { onSubmit: passwordConfirmationSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const result = await authClient.twoFactor.disable({ password: value.password });
        if (result.error) {
          setFormError(
            accountSecurityError(result.error, "Unable to disable Two-Factor Authentication."),
          );
          return;
        }
        cleanupWarning(result.data);
        refreshAfterClose.current = true;
        setOpen(false);
        toast.add({
          title: "Two-Factor Authentication disabled",
          description: "Trusted Devices were removed and other Easy Auth Sessions were terminated.",
          type: "success",
        });
      } catch (error) {
        setFormError(accountSecurityError(error, "Unable to disable Two-Factor Authentication."));
      }
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(nextOpen) => {
        const shouldRefresh = shouldRefreshTwoFactorStatusAfterClose(
          nextOpen,
          refreshAfterClose.current,
        );
        if (!nextOpen) {
          setFormError(null);
          refreshAfterClose.current = false;
          form.reset();
        }
        if (shouldRefresh) void router.invalidate();
      }}
    >
      <DialogTrigger render={<Button variant="destructive" />}>Disable</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable Two-Factor Authentication?</DialogTitle>
          <DialogDescription>
            Local password sign-in will no longer require an Authenticator code. Trusted Devices
            will be removed and every other Easy Auth Session will be terminated.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <FieldGroup>
                {formError && <FieldError errors={[{ message: formError }]} />}
                <form.Field name="password">
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                      <FieldLabel htmlFor="disable-two-factor-password">
                        Current password
                      </FieldLabel>
                      <Input
                        id="disable-two-factor-password"
                        name={field.name}
                        type="password"
                        autoComplete="current-password"
                        autoFocus
                        disabled={isSubmitting}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          setFormError(null);
                          field.handleChange(event.target.value);
                        }}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    Disable
                  </Button>
                </DialogFooter>
              </FieldGroup>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TwoFactorSettings({
  status,
  email,
}: {
  status: TwoFactorAccountStatus;
  email: string;
}) {
  return (
    <ItemGroup>
      <Item variant="outline">
        <ItemMedia variant="icon">
          <ShieldCheck />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            <span>Two-Factor Authentication</span>
            <TwoFactorBadge enabled={status.enabled} />
          </ItemTitle>
          <ItemDescription>
            {!status.hasLocalPassword && !status.enabled
              ? "Two-Factor Authentication protects local password sign-in only. Set a password before enabling it."
              : "Require an Authenticator App after local password sign-in."}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          {status.enabled ? (
            <>
              <RegenerateBackupCodesDialog />
              <DisableTwoFactorDialog />
            </>
          ) : status.hasLocalPassword ? (
            <EnrollmentDialog />
          ) : (
            <Link
              to="/forgot-password"
              search={{ action: "set", email }}
              className={buttonVariants({ variant: "outline" })}
            >
              <KeyRound />
              Set password
            </Link>
          )}
        </ItemActions>
      </Item>
    </ItemGroup>
  );
}
