"use client";

import { z } from "zod";
import { useId, useRef, useState } from "react";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  "cf-turnstile-response": z.string().min(1),
});

const SignupForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileSuccess, setTurnstileSuccess] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const emailId = useId();
  const passwordId = useId();
  const router = useRouter();

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

    toast.success("Signup successful!");
    router.push("/");
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string}
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
  );
};

export default SignupForm;
