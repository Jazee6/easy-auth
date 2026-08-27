import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import * as v from "valibot";

import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import {
  composeAuthRequestHeaders,
  deriveSignupPayload,
  getPostSignupDestination,
  signupSchema,
  translateAuthError,
} from "@/lib/auth-policy";
import { Button } from "@/components/ui/button";
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

      const validation = v.safeParse(signupSchema, value);
      if (!validation.success) {
        resetCaptcha();
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
        <CardTitle>Create user</CardTitle>
        <CardDescription>Enter your email and password below to create your user</CardDescription>
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

            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  const res = v.safeParse(signupSchema.entries.email, value);
                  return res.success ? undefined : res.issues[0].message;
                },
              }}
            >
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    name={field.name}
                    type="email"
                    placeholder="user@example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
                  )}
                </Field>
              )}
            </form.Field>

            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) => {
                  const res = v.safeParse(signupSchema.entries.password, value);
                  return res.success ? undefined : res.issues[0].message;
                },
              }}
            >
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
                  <FieldDescription>Must be at least 8 characters long.</FieldDescription>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
                  )}
                </Field>
              )}
            </form.Field>

            <div className="py-1">
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
            </div>

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Field>
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    disabled={!turnstileToken || isSubmitting}
                  >
                    Create user
                  </Button>
                  <Button variant="outline" type="button" disabled aria-disabled="true">
                    Sign up with Google (Coming soon)
                  </Button>
                  <FieldDescription className="text-center">
                    Already registered?{" "}
                    <Link to="/login" className="underline underline-offset-4 hover:text-primary">
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
