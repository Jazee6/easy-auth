import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import * as v from "valibot";

import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import {
  composeAuthRequestHeaders,
  getPostVerificationRedirect,
  normalizeEmail,
  otpSchema,
  translateAuthError,
  verifyEmailFormSchema,
} from "@/lib/auth-policy";
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
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Turnstile, type TurnstileRef } from "@/components/turnstile";

export interface VerifyEmailFormProps extends React.ComponentProps<typeof Card> {
  initialEmail?: string;
}

export function VerifyEmailForm({ initialEmail = "", className, ...props }: VerifyEmailFormProps) {
  const navigate = useNavigate();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const turnstileRef = React.useRef<TurnstileRef>(null);

  const normalizedEmail = normalizeEmail(initialEmail);

  const resetCaptcha = () => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  };

  const form = useForm({
    defaultValues: {
      email: normalizedEmail,
      otp: "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setInfoMessage(null);

      if (!normalizedEmail) {
        setFormError("A valid login email is required to verify your email.");
        return;
      }

      const validation = v.safeParse(verifyEmailFormSchema, {
        email: normalizedEmail,
        otp: value.otp,
      });

      if (!validation.success) {
        return;
      }

      const res = await authClient.emailOtp.verifyEmail({
        email: normalizedEmail,
        otp: value.otp.trim(),
      });

      if (res.error) {
        setFormError(translateAuthError(res.error, "verify-email"));
        return;
      }

      await navigate({ to: getPostVerificationRedirect() });
    },
  });

  const handleResendOtp = async () => {
    setFormError(null);
    setInfoMessage(null);

    if (!turnstileToken) {
      setFormError("Please complete the security check to resend the code.");
      return;
    }

    if (!normalizedEmail) {
      setFormError("A valid email address is required to resend the code.");
      return;
    }

    setIsResending(true);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "email-verification",
        fetchOptions: {
          headers: composeAuthRequestHeaders("verification-otp-send", turnstileToken),
        },
      });

      resetCaptcha();

      if (res.error) {
        setFormError(translateAuthError(res.error, "resend-otp"));
        return;
      }

      setInfoMessage("A new verification code has been sent to your email.");
    } catch {
      resetCaptcha();
      setFormError("Failed to resend verification code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          Enter the 6-digit verification code sent to{" "}
          <strong className="text-foreground">{normalizedEmail || "your email"}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            {formError && (
              <div
                role="alert"
                className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium"
              >
                {formError}
              </div>
            )}

            {infoMessage && (
              <div
                role="status"
                className="rounded-md bg-primary/10 p-3 text-sm text-primary font-medium"
              >
                {infoMessage}
              </div>
            )}

            <Field>
              <FieldLabel htmlFor="email">Login email</FieldLabel>
              <Input
                id="email"
                type="email"
                value={normalizedEmail}
                readOnly
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
              <FieldDescription>Verification code was delivered to this address.</FieldDescription>
            </Field>

            <form.Field
              name="otp"
              validators={{
                onChange: ({ value }) => {
                  const res = v.safeParse(otpSchema, value);
                  return res.success ? undefined : res.issues[0].message;
                },
              }}
            >
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel htmlFor="otp">Verification code</FieldLabel>
                  <div className="flex justify-center py-1">
                    <InputOTP
                      id="otp"
                      name={field.name}
                      maxLength={6}
                      pattern={REGEXP_ONLY_DIGITS}
                      autoComplete="one-time-code"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(value) => field.handleChange(value)}
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

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Field>
                  <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                    Verify email
                  </Button>
                </Field>
              )}
            </form.Subscribe>

            <div className="pt-2 border-t border-border">
              <FieldDescription className="mb-2 text-center">
                Didn't receive the code or it expired? Complete the check below to request a new
                code.
              </FieldDescription>
              <div className="py-1">
                <Turnstile
                  ref={turnstileRef}
                  action="resend-otp"
                  onSuccess={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken(null)}
                  onError={() => {
                    resetCaptcha();
                    setFormError("Security verification encountered an error. Please try again.");
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                loading={isResending}
                disabled={!turnstileToken || isResending}
                onClick={handleResendOtp}
                className="w-full mt-2"
              >
                Resend code
              </Button>
            </div>

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
