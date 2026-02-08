import { createFileRoute, Link } from "@tanstack/react-router";
import { appName } from "@/lib/constants.ts";
import Footer from "@/components/footer.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { z } from "zod";
import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { authClient } from "@/lib/auth-client.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

export const Route = createFileRoute("/login")({
  component: Page,
  head: () => ({
    meta: [
      {
        title: `Login - ${appName}`,
      },
      {
        name: "description",
        content: `Log in to ${appName}`,
      },
    ],
  }),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

function Page() {
  const [socialLoading, setSocialLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setLoginLoading(true);
    const { email, password } = values;
    await authClient.signIn
      .email({
        email,
        password,
        callbackURL: "/profile",
        fetchOptions: {
          headers: {
            accept: "application/json",
          },
        },
      })
      .finally(() => setLoginLoading(false));
  };

  const onGithubLogin = async () => {
    setSocialLoading(true);
    await authClient.signIn
      .social({
        provider: "github",
        callbackURL: "/profile",
        newUserCallbackURL: "/profile?welcome=true",
      })
      .finally(() => setSocialLoading(false));
  };

  return (
    <main className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden p-0">
            <CardContent className="grid p-0 md:grid-cols-2">
              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col items-center text-center">
                    <h1 className="text-2xl font-bold">Login</h1>
                  </div>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-8"
                  >
                    <FieldSet>
                      <FieldGroup>
                        <Controller
                          name="email"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor={emailId}>Email</FieldLabel>
                              <Input
                                {...field}
                                id={emailId}
                                aria-invalid={fieldState.invalid}
                                type="email"
                                inputMode="email"
                              />
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </Field>
                          )}
                        />

                        <Controller
                          name="password"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor={passwordId}>
                                Password
                              </FieldLabel>
                              <Input
                                {...field}
                                id={passwordId}
                                aria-invalid={fieldState.invalid}
                                type="password"
                              />
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </Field>
                          )}
                        />
                      </FieldGroup>
                    </FieldSet>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={socialLoading || loginLoading}
                    >
                      {loginLoading && <Spinner />}
                      Login
                    </Button>
                  </form>
                  <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                    <span className="bg-background text-muted-foreground relative z-10 px-2">
                      Or continue with
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full"
                      onClick={onGithubLogin}
                      disabled={socialLoading}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                      >
                        <title>Github</title>
                        <path
                          d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="sr-only">
                        Log in using your Github account
                      </span>
                    </Button>
                  </div>

                  <div className="text-center text-sm">
                    Don't have an account?{" "}
                    <Link
                      to="/signup"
                      search
                      className="underline underline-offset-4"
                    >
                      Sign up
                    </Link>
                  </div>
                </div>
              </div>
              <div className="bg-muted relative hidden md:block">
                {/*<img*/}
                {/*  src="/placeholder.svg"*/}
                {/*  alt="Image"*/}
                {/*  className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"*/}
                {/*/>*/}
                <div className="inset-0 bg-linear-to-br from-cyan-50 to-lime-50 absolute"></div>
              </div>
            </CardContent>
          </Card>
          <Footer />
        </div>
      </div>
    </main>
  );
}
