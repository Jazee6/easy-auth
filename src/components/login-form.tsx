import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import * as v from "valibot";

import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { getPostLoginRedirect, loginSchema, translateAuthError } from "@/lib/auth-policy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const validation = v.safeParse(loginSchema, value);
      if (!validation.success) {
        return;
      }

      const res = await authClient.signIn.email({
        email: value.email.trim().toLowerCase(),
        password: value.password,
      });

      if (res.error) {
        setFormError(translateAuthError(res.error, "login"));
        return;
      }

      await navigate({ to: getPostLoginRedirect() });
    },
  });

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to Easy Auth</CardTitle>
          <CardDescription>Enter your email and password below to log in</CardDescription>
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
                    const res = v.safeParse(loginSchema.entries.email, value);
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
                    const res = v.safeParse(loginSchema.entries.password, value);
                    return res.success ? undefined : res.issues[0].message;
                  },
                }}
              >
                {(field) => (
                  <Field>
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <span
                        aria-disabled="true"
                        className="text-xs text-muted-foreground select-none cursor-not-allowed"
                      >
                        Forgot password? (Coming soon)
                      </span>
                    </div>
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

              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Field>
                    <Button type="submit" loading={isSubmitting}>
                      Login
                    </Button>
                    <Button variant="outline" type="button" disabled aria-disabled="true">
                      Login with Google (Coming soon)
                    </Button>
                    <FieldDescription className="text-center">
                      Don&apos;t have a user?{" "}
                      <Link
                        to="/signup"
                        className="underline underline-offset-4 hover:text-primary"
                      >
                        Sign up
                      </Link>
                    </FieldDescription>
                  </Field>
                )}
              </form.Subscribe>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
