import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";

import { authClient, continuePendingOAuth } from "@/lib/auth-client";
import { sanitizeReturnDestination } from "@/lib/passkey-policy";
import {
  getLoginRestartUrl,
  initialTwoFactorChallengeValues,
  resolveTwoFactorChallengeError,
  twoFactorChallengeSchema,
  type TwoFactorChallengeMethod,
} from "@/lib/two-factor-challenge";
import { cn } from "@/lib/utils";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

export interface TwoFactorChallengeFormProps extends React.ComponentProps<typeof Card> {
  returnTo?: string;
}

export function TwoFactorChallengeForm({
  returnTo,
  className,
  ...props
}: TwoFactorChallengeFormProps) {
  const navigate = useNavigate();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [restartRequired, setRestartRequired] = React.useState(false);

  const showVerificationError = (error: unknown) => {
    const resolution = resolveTwoFactorChallengeError(error);
    setFormError(resolution.message);
    setRestartRequired(resolution.restartRequired);
  };

  const form = useForm({
    validators: {
      onSubmit: twoFactorChallengeSchema,
    },
    defaultValues: initialTwoFactorChallengeValues,
    onSubmit: async ({ value }) => {
      setFormError(null);

      try {
        const result =
          value.method === "totp"
            ? await authClient.twoFactor.verifyTotp({
                code: value.code,
                trustDevice: value.trustDevice,
              })
            : await authClient.twoFactor.verifyBackupCode({
                code: value.code.trim(),
                trustDevice: value.trustDevice,
              });

        if (result.error) {
          showVerificationError(result.error);
          return;
        }
      } catch (error) {
        showVerificationError(error);
        return;
      }

      try {
        if (await continuePendingOAuth()) return;
      } catch {
        // The Session is already authoritative; the requesting application can restart OAuth.
      }
      const destination = sanitizeReturnDestination(returnTo);
      await navigate({ href: destination });
    },
  });

  const selectMethod = (method: TwoFactorChallengeMethod) => {
    setFormError(null);
    setRestartRequired(false);
    form.setFieldValue("method", method);
    form.setFieldValue("code", "");
  };

  return (
    <Card className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle>Verify your login</CardTitle>
        <CardDescription>
          Enter the code from your Authenticator App, or use one of your Backup Codes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <FieldGroup>
                {formError && (
                  <Alert variant="destructive" className="border-destructive/25 bg-destructive/15">
                    <CircleAlertIcon />
                    <AlertTitle>{formError}</AlertTitle>
                  </Alert>
                )}

                <form.Subscribe selector={(state) => state.values.method}>
                  {(method) => (
                    <form.Field name="code">
                      {(field) => (
                        <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                          <FieldLabel htmlFor="two-factor-code">
                            {method === "totp" ? "Authenticator code" : "Backup Code"}
                          </FieldLabel>
                          {method === "totp" ? (
                            <div className="flex justify-center py-1">
                              <InputOTP
                                id="two-factor-code"
                                name={field.name}
                                maxLength={6}
                                pattern={REGEXP_ONLY_DIGITS}
                                autoComplete="one-time-code"
                                autoFocus
                                disabled={isSubmitting || restartRequired}
                                aria-invalid={field.state.meta.errors.length > 0}
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
                          ) : (
                            <Input
                              id="two-factor-code"
                              name={field.name}
                              autoComplete="one-time-code"
                              autoFocus
                              disabled={isSubmitting || restartRequired}
                              aria-invalid={field.state.meta.errors.length > 0}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) => {
                                setFormError(null);
                                field.handleChange(event.target.value);
                              }}
                            />
                          )}
                          <FieldError errors={field.state.meta.errors} />
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto self-start p-0"
                            disabled={isSubmitting || restartRequired}
                            onClick={() => selectMethod(method === "totp" ? "backup" : "totp")}
                          >
                            {method === "totp"
                              ? "Use a Backup Code instead"
                              : "Use an Authenticator App instead"}
                          </Button>
                        </Field>
                      )}
                    </form.Field>
                  )}
                </form.Subscribe>

                <form.Field name="trustDevice">
                  {(field) => (
                    <Field
                      orientation="horizontal"
                      data-disabled={isSubmitting || restartRequired || undefined}
                    >
                      <Checkbox
                        id="trust-device"
                        name={field.name}
                        checked={field.state.value}
                        disabled={isSubmitting || restartRequired}
                        onCheckedChange={(checked) => {
                          setFormError(null);
                          field.handleChange(checked);
                        }}
                      />
                      <FieldContent>
                        <FieldLabel htmlFor="trust-device">Trust this device</FieldLabel>
                        <FieldDescription>
                          Trusted Device state is independent from your Session and follows Better
                          Auth&apos;s rolling 30-day period.
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  )}
                </form.Field>

                <Field>
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    disabled={isSubmitting || restartRequired}
                  >
                    Verify
                  </Button>
                  <Link
                    to="/login"
                    search={true}
                    aria-disabled={isSubmitting}
                    onClick={(event) => {
                      if (isSubmitting) {
                        event.preventDefault();
                        return;
                      }
                      if (typeof window !== "undefined") {
                        event.preventDefault();
                        window.location.assign(getLoginRestartUrl(window.location.search));
                      }
                    }}
                    className={buttonVariants({
                      variant: "outline",
                      className: isSubmitting ? "pointer-events-none opacity-50" : undefined,
                    })}
                  >
                    Restart login
                  </Link>
                </Field>
              </FieldGroup>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
