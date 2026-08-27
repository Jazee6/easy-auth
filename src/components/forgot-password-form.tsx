import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import * as v from "valibot";

import { authClient } from "@/lib/auth-client";
import {
  composeAuthRequestHeaders,
  derivePasswordResetPayload,
  emailSchema,
  getPasswordResetRequestSuccessMessage,
  getPostPasswordResetRedirect,
  normalizeEmail,
  otpSchema,
  passwordResetCompletionSchema,
  passwordResetRequestSchema,
  passwordSchema,
  translateAuthError,
} from "@/lib/auth-policy";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "@/components/ui/toast";
import { Turnstile, type TurnstileRef } from "@/components/turnstile";

export interface ForgotPasswordFormProps extends React.ComponentProps<typeof Card> {
  initialEmail?: string;
  action?: "set" | "reset";
}

export function ForgotPasswordForm({
  initialEmail = "",
  action = "reset",
  className,
  ...props
}: ForgotPasswordFormProps) {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<"request" | "complete">("request");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null);
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const turnstileRef = React.useRef<TurnstileRef>(null);

  const title = action === "set" ? "Set password" : "Reset password";

  const resetCaptcha = () => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  };

  const form = useForm({
    defaultValues: {
      email: normalizeEmail(initialEmail),
      otp: "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      if (step === "request") {
        await handleRequestCode(value.email);
        return;
      }

      const email = normalizeEmail(value.email);
      const validation = v.safeParse(passwordResetCompletionSchema, {
        email,
        otp: value.otp,
        password: value.password,
        confirmPassword: value.confirmPassword,
      });

      if (!validation.success) {
        return;
      }

      try {
        const res = await authClient.emailOtp.resetPassword(
          derivePasswordResetPayload(validation.output),
        );

        if (res.error) {
          setFormError(translateAuthError(res.error, "reset-password"));
          return;
        }

        toast.add({
          title: "Password updated",
          description: "Your password was updated. Log in again with your new password.",
          type: "success",
        });
        await navigate({ to: getPostPasswordResetRedirect() });
      } catch (error) {
        setFormError(translateAuthError(error, "reset-password"));
      }
    },
  });

  const handleRequestCode = async (emailValue: string) => {
    setFormError(null);
    setInfoMessage(null);

    if (!turnstileToken) {
      setFormError("Please complete the security check to request a reset code.");
      return;
    }

    const validation = v.safeParse(passwordResetRequestSchema, { email: emailValue });
    if (!validation.success) {
      resetCaptcha();
      return;
    }

    const email = normalizeEmail(emailValue);
    setIsRequesting(true);
    try {
      const res = await authClient.emailOtp.requestPasswordReset({
        email,
        fetchOptions: {
          headers: composeAuthRequestHeaders("password-reset-request", turnstileToken),
        },
      });

      if (res.error) {
        setFormError(translateAuthError(res.error, "request-password-reset"));
        return;
      }

      form.setFieldValue("email", email);
      setStep("complete");
      setInfoMessage(getPasswordResetRequestSuccessMessage());
    } catch (error) {
      setFormError(translateAuthError(error, "request-password-reset"));
    } finally {
      setIsRequesting(false);
      resetCaptcha();
    }
  };

  return (
    <Card className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {step === "request"
            ? "Enter your login email to request a verification code."
            : "Enter the code from your email and choose a new password."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            {formError && (
              <div
                role="alert"
                className="rounded-md bg-destructive/15 p-3 text-sm font-medium text-destructive"
              >
                {formError}
              </div>
            )}

            {infoMessage && (
              <div
                role="status"
                className="rounded-md bg-primary/10 p-3 text-sm font-medium text-primary"
              >
                {infoMessage}
              </div>
            )}

            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  const result = v.safeParse(emailSchema, value);
                  return result.success ? undefined : result.issues[0].message;
                },
              }}
            >
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel htmlFor="reset-email">Login email</FieldLabel>
                  <Input
                    id="reset-email"
                    name={field.name}
                    type="email"
                    autoComplete="email"
                    placeholder="user@example.com"
                    value={field.state.value}
                    readOnly={step === "complete"}
                    disabled={step === "complete"}
                    className={cn(
                      step === "complete" && "cursor-not-allowed bg-muted text-muted-foreground",
                    )}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={field.state.meta.errors.length > 0}
                    required
                  />
                  {step === "complete" && (
                    <FieldDescription>
                      The reset code was requested for this address.
                    </FieldDescription>
                  )}
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
                  )}
                </Field>
              )}
            </form.Field>

            {step === "complete" && (
              <>
                <form.Field
                  name="otp"
                  validators={{
                    onChange: ({ value }) => {
                      const result = v.safeParse(otpSchema, value);
                      return result.success ? undefined : result.issues[0].message;
                    },
                  }}
                >
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                      <FieldLabel htmlFor="reset-otp">Password reset code</FieldLabel>
                      <div className="flex justify-center py-1">
                        <InputOTP
                          id="reset-otp"
                          name={field.name}
                          maxLength={6}
                          pattern={REGEXP_ONLY_DIGITS}
                          autoComplete="one-time-code"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={field.handleChange}
                          aria-invalid={field.state.meta.errors.length > 0}
                          required
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <FieldDescription className="text-center">
                        Code is valid for 5 minutes.
                      </FieldDescription>
                      {field.state.meta.errors.length > 0 && (
                        <FieldError className="text-center">
                          {field.state.meta.errors[0]?.toString()}
                        </FieldError>
                      )}
                    </Field>
                  )}
                </form.Field>

                <form.Field
                  name="password"
                  validators={{
                    onChange: ({ value }) => {
                      const result = v.safeParse(passwordSchema, value);
                      return result.success ? undefined : result.issues[0].message;
                    },
                  }}
                >
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                      <FieldLabel htmlFor="new-password">New password</FieldLabel>
                      <Input
                        id="new-password"
                        name={field.name}
                        type="password"
                        autoComplete="new-password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={field.state.meta.errors.length > 0}
                        required
                      />
                      <FieldDescription>Must be between 8 and 128 characters.</FieldDescription>
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
                      )}
                    </Field>
                  )}
                </form.Field>

                <form.Field
                  name="confirmPassword"
                  validators={{
                    onChangeListenTo: ["password"],
                    onChange: ({ value, fieldApi }) => {
                      if (value !== fieldApi.form.getFieldValue("password")) {
                        return "Passwords do not match";
                      }
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                      <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
                      <Input
                        id="confirm-password"
                        name={field.name}
                        type="password"
                        autoComplete="new-password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={field.state.meta.errors.length > 0}
                        required
                      />
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
                      )}
                    </Field>
                  )}
                </form.Field>
              </>
            )}

            <div className="py-1">
              <Turnstile
                ref={turnstileRef}
                action="password-reset-request"
                onSuccess={setTurnstileToken}
                onExpire={() => setTurnstileToken(null)}
                onError={() => {
                  resetCaptcha();
                  setFormError("Security verification encountered an error. Please try again.");
                }}
              />
            </div>

            {step === "request" ? (
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button
                    type="submit"
                    loading={isSubmitting || isRequesting}
                    disabled={!turnstileToken || isSubmitting || isRequesting}
                  >
                    Send reset code
                  </Button>
                )}
              </form.Subscribe>
            ) : (
              <>
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                      {action === "set" ? "Set password" : "Reset password"}
                    </Button>
                  )}
                </form.Subscribe>
                <Button
                  type="button"
                  variant="outline"
                  loading={isRequesting}
                  disabled={!turnstileToken || isRequesting}
                  onClick={() => handleRequestCode(form.getFieldValue("email"))}
                >
                  Send another code
                </Button>
              </>
            )}

            <FieldDescription className="text-center">
              Back to{" "}
              <Link to="/login" className="underline underline-offset-4 hover:text-primary">
                Log in
              </Link>
            </FieldDescription>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
