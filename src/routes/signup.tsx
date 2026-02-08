import {
  createFileRoute,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { appName } from "@/lib/constants.ts";
import { LogIn } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import Footer from "@/components/footer.tsx";
import z from "zod";
import { useId, useRef, useState } from "react";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import { Controller, useForm } from "react-hook-form";
import { authClient } from "@/lib/auth-client.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

export const Route = createFileRoute("/signup")({
  component: Page,
  head: () => ({
    meta: [
      {
        title: `Login - ${appName}`,
      },
      {
        name: "description",
        content: `Create an account on ${appName}`,
      },
    ],
  }),
});

const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  "cf-turnstile-response": z.string().min(1),
});

function Page() {
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileSuccess, setTurnstileSuccess] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const emailId = useId();
  const passwordId = useId();
  const search = useSearch({
    strict: false,
  });
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      "cf-turnstile-response": "",
    },
  });

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    setIsLoading(true);
    const { "cf-turnstile-response": turnstileToken, email, password } = values;

    const { error } = await authClient.signUp
      .email({
        name: email,
        email,
        password,
        callbackURL: "/profile",
        fetchOptions: {
          headers: {
            "x-captcha-response": turnstileToken,
          },
        },
      })
      .finally(() => setIsLoading(false));

    if (error) {
      turnstileRef.current?.reset();
      setTurnstileSuccess(false);
      return;
    }

    if (search.client_id) {
      const { data } = await authClient.oauth2.continue({
        created: true,
        fetchOptions: {
          headers: {
            accept: "application/json",
          },
        },
      });

      if (data?.redirect) {
        location.href = data.uri;
      }
      return;
    }

    await navigate({
      to: "/profile",
    });
  };

  return (
    <main className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a
          href="https://github.com/Jazee6/easy-auth"
          target="_blank"
          className="flex items-center gap-2 self-center font-medium"
          rel="noopener"
        >
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <LogIn className="size-4" />
          </div>
          Easy Auth
        </a>
        <div className={"flex flex-col gap-6"}>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Sign up</CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent>
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
                            autoComplete="off"
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
                          <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
                          <Input
                            {...field}
                            id={passwordId}
                            aria-invalid={fieldState.invalid}
                            autoComplete="off"
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

                <Turnstile
                  ref={turnstileRef}
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  options={{
                    size: "flexible",
                    action: "signup",
                  }}
                  onSuccess={(token) => {
                    form.setValue("cf-turnstile-response", token);
                    setTurnstileSuccess(true);
                  }}
                />

                <Button
                  className="w-full"
                  type="submit"
                  disabled={isLoading || !turnstileSuccess}
                >
                  {isLoading && <Spinner />}
                  Sign up
                </Button>
              </form>

              <div className="text-center text-sm mt-4">
                Already have an account?{" "}
                <Link
                  to="/login"
                  search
                  className="underline underline-offset-4"
                >
                  Login
                </Link>
              </div>
            </CardContent>
          </Card>
          <Footer />
        </div>
      </div>
    </main>
  );
}
