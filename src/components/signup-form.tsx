import * as React from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useForm, revalidateLogic } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import {
  composeAuthRequestHeaders,
  deriveSignupPayload,
  getPostSignupDestination,
  signupSchema,
  translateAuthError,
} from "@/lib/auth-policy";
import { getPendingOAuthVerificationUrl } from "@/lib/oauth-policy";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Turnstile, type TurnstileRef } from "@/components/turnstile";

export function SignupForm({ className, ...props }: React.ComponentProps<typeof Card>) {
  const navigate = useNavigate();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const turnstileRef = React.useRef<TurnstileRef>(null);

  const resetCaptcha = () => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  };

  const form = useForm({
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: signupSchema,
    },
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      if (!turnstileToken) {
        setFormError("Please complete the security check to continue.");
        return;
      }

      const payload = deriveSignupPayload({
        email: value.email,
        password: value.password,
      });

      try {
        const res = await authClient.signUp.email({
          ...payload,
          fetchOptions: {
            headers: composeAuthRequestHeaders("password-signup", turnstileToken),
          },
        });

        if (res.error) {
          setFormError(translateAuthError(res.error, "signup"));
          return;
        }

        const oauthVerificationUrl =
          typeof window === "undefined"
            ? null
            : getPendingOAuthVerificationUrl(window.location.search, payload.email);
        if (oauthVerificationUrl) {
          window.location.assign(oauthVerificationUrl);
          return;
        }
        await navigate(getPostSignupDestination(payload.email));
      } catch (error) {
        setFormError(translateAuthError(error, "signup"));
      } finally {
        resetCaptcha();
      }
    },
  });

  return (
    <Card className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>
          Enter your email and password below to create your account
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
              <Alert variant="destructive" className="border-destructive/25 bg-destructive/15">
                <CircleAlertIcon />
                <AlertTitle>{formError}</AlertTitle>
              </Alert>
            )}

            <form.Field name="email">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    name={field.name}
                    type="email"
                    placeholder="you@example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <Turnstile
              ref={turnstileRef}
              action="signup"
              onSuccess={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
              onError={() => {
                resetCaptcha();
                setFormError(
                  "Security verification encountered an error. Please refresh and try again.",
                );
              }}
            />

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Field>
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    disabled={!turnstileToken || isSubmitting}
                  >
                    Create account
                  </Button>
                  <FieldDescription className="text-center">
                    Already registered?{" "}
                    <Link
                      to="/login"
                      search={true}
                      className="underline underline-offset-4 hover:text-primary"
                    >
                      Log in
                    </Link>
                  </FieldDescription>
                </Field>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
