import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import * as v from "valibot";

import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import {
  deriveSignupPayload,
  getPostSignupRedirect,
  signupSchema,
  translateAuthError,
} from "@/lib/auth-policy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SignupForm({ className, ...props }: React.ComponentProps<typeof Card>) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const validation = v.safeParse(signupSchema, value);
      if (!validation.success) {
        return;
      }

      const payload = deriveSignupPayload({
        email: value.email,
        password: value.password,
      });

      const res = await authClient.signUp.email(payload);

      if (res.error) {
        setFormError(translateAuthError(res.error, "signup"));
        return;
      }

      await navigate({ to: getPostSignupRedirect() });
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

            <form.Subscribe selector={(state) => [state.isSubmitting, state.canSubmit]}>
              {([isSubmitting]) => (
                <Field>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Creating user...
                      </>
                    ) : (
                      "Create user"
                    )}
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
