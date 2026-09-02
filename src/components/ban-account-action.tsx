import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import * as v from "valibot";

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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  BAN_DURATIONS,
  BAN_REASON_PRESETS,
  banReasonSchema,
  formatBanDuration,
  translateBanAccountError,
  type BanDuration,
} from "@/lib/admin-security";
import { banAccount } from "@/lib/admin-server";

const CUSTOM_REASON = "custom" as const;
const reasonChoices = [...BAN_REASON_PRESETS, CUSTOM_REASON] as const;

const banFormSchema = v.pipe(
  v.object({
    reasonChoice: v.picklist(reasonChoices),
    customReason: v.string(),
    duration: v.picklist(BAN_DURATIONS),
  }),
  v.forward(
    v.check(
      (input) =>
        input.reasonChoice !== CUSTOM_REASON ||
        v.safeParse(banReasonSchema, input.customReason).success,
      "Enter a custom reason from 1 through 500 characters",
    ),
    ["customReason"],
  ),
);

type BanFormValue = v.InferInput<typeof banFormSchema>;

function selectedReason(value: BanFormValue): string {
  return value.reasonChoice === CUSTOM_REASON ? value.customReason.trim() : value.reasonChoice;
}

export function BanAccountAction({
  accountId,
  accountName,
  accountEmail,
  retry = false,
}: {
  accountId: string;
  accountName: string;
  accountEmail: string;
  retry?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      reasonChoice: BAN_REASON_PRESETS[0],
      customReason: "",
      duration: "24-hours",
    } as BanFormValue,
    validators: { onSubmit: banFormSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await banAccount({
          data: {
            accountId,
            reason: selectedReason(value),
            duration: value.duration,
          },
        });
        toast.add({
          title: "Account banned",
          description: `${accountName}'s Sessions and OAuth tokens have been invalidated.`,
          type: "success",
        });
        setOpen(false);
        await router.invalidate();
      } catch (cause) {
        setError(translateBanAccountError(cause));
      }
    },
  });

  function clearSubmissionError() {
    setError(null);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(nextOpen) => {
        if (nextOpen) return;
        form.reset();
        setError(null);
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        {retry ? "Retry Ban" : "Ban Account"}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{retry ? "Retry Account Ban" : "Ban Account"}</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm the security action for {accountName} ({accountEmail}).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <FieldGroup className="mt-5">
            {error && (
              <div
                role="alert"
                className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <form.Field name="reasonChoice">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="ban-reason">Reason</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => {
                      clearSubmissionError();
                      if (reasonChoices.includes(value as (typeof reasonChoices)[number])) {
                        field.handleChange(value as (typeof reasonChoices)[number]);
                      }
                    }}
                  >
                    <SelectTrigger id="ban-reason" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {reasonChoices.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason === CUSTOM_REASON ? "Custom reason" : reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.values.reasonChoice}>
              {(reasonChoice) =>
                reasonChoice === CUSTOM_REASON ? (
                  <form.Field name="customReason">
                    {(field) => (
                      <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                        <FieldLabel htmlFor="ban-custom-reason">Custom reason</FieldLabel>
                        <Textarea
                          id="ban-custom-reason"
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            clearSubmissionError();
                            field.handleChange(event.target.value);
                          }}
                          aria-invalid={field.state.meta.errors.length > 0}
                        />
                        <FieldDescription>1–500 characters after trimming.</FieldDescription>
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    )}
                  </form.Field>
                ) : null
              }
            </form.Subscribe>

            <form.Field name="duration">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="ban-duration">Duration</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => {
                      clearSubmissionError();
                      if (BAN_DURATIONS.includes(value as BanDuration)) {
                        field.handleChange(value as BanDuration);
                      }
                    }}
                  >
                    <SelectTrigger id="ban-duration" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BAN_DURATIONS.map((duration) => (
                        <SelectItem key={duration} value={duration}>
                          {formatBanDuration(duration)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.values}>
              {(value) => (
                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <p className="font-medium">Confirm these effects</p>
                  <dl className="grid gap-2 sm:grid-cols-[7rem_1fr]">
                    <dt className="text-muted-foreground">Target</dt>
                    <dd>{accountName}</dd>
                    <dt className="text-muted-foreground">Reason</dt>
                    <dd>{selectedReason(value) || "Enter a custom reason"}</dd>
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd>{formatBanDuration(value.duration)}</dd>
                  </dl>
                  <p className="text-muted-foreground">
                    Every active Session and issued OAuth refresh or opaque access token will be
                    invalidated. Application Authorizations will be preserved.
                  </p>
                </div>
              )}
            </form.Subscribe>
          </FieldGroup>

          <AlertDialogFooter className="mt-6">
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <>
                  <AlertDialogCancel type="button" disabled={isSubmitting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    type="submit"
                    variant="destructive"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    {retry ? "Retry Ban" : "Ban Account"}
                  </AlertDialogAction>
                </>
              )}
            </form.Subscribe>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
