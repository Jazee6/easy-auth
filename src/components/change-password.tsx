import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    newPasswordConfirm: z.string().min(8),
    revokeOtherSessions: z.boolean(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: "Passwords do not match",
    path: ["newPasswordConfirm"],
  });

const ChangePasswordDialog = ({ disabled }: { disabled?: boolean }) => {
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const newPasswordConfirmId = useId();
  const revokeOtherSessionsId = useId();
  const formId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      newPasswordConfirm: "",
      revokeOtherSessions: false,
    },
  });

  const onSubmit = async (data: z.infer<typeof changePasswordSchema>) => {
    const { currentPassword, newPassword, revokeOtherSessions } = data;

    setIsLoading(true);
    await authClient
      .changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      })
      .finally(() => setIsLoading(false));
    toast.success("Password changed successfully.");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="secondary" disabled={disabled}>
            Change Password
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} id={formId}>
          <FieldSet>
            <FieldGroup>
              <Controller
                name="currentPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={currentPasswordId}>
                      Current Password
                    </FieldLabel>
                    <Input
                      {...field}
                      id={currentPasswordId}
                      aria-invalid={fieldState.invalid}
                      type="password"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="newPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={newPasswordId}>
                      New Password
                    </FieldLabel>
                    <Input
                      {...field}
                      id={newPasswordId}
                      aria-invalid={fieldState.invalid}
                      type="password"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="newPasswordConfirm"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={newPasswordConfirmId}>
                      Confirm New Password
                    </FieldLabel>
                    <Input
                      {...field}
                      id={newPasswordConfirmId}
                      aria-invalid={fieldState.invalid}
                      type="password"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="revokeOtherSessions"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FieldSet data-invalid={fieldState.invalid}>
                    <FieldGroup data-slot="checkbox-group">
                      <Field orientation="horizontal">
                        <Checkbox
                          id={revokeOtherSessionsId}
                          name={field.name}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <FieldLabel htmlFor={revokeOtherSessionsId}>
                          Revoke other sessions
                        </FieldLabel>
                      </Field>
                    </FieldGroup>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </FieldSet>
                )}
              />
            </FieldGroup>
          </FieldSet>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button type="submit" form={formId} disabled={isLoading}>
            {isLoading && <Spinner />}
            Update Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
