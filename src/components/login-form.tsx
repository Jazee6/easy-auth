import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon, Fingerprint } from "lucide-react";
import { WebAuthnAbortService } from "@simplewebauthn/browser";

import { cn } from "@/lib/utils";
import { authClient, continuePendingOAuth } from "@/lib/auth-client";
import {
  getExternalIdentitySignInOptions,
  getLoginFailureResolution,
  loginSchema,
  normalizeEmail,
  translateAuthError,
  translateExternalIdentityOauthError,
  type ExternalIdentityProvider,
} from "@/lib/auth-policy";
import {
  isPasskeyCancellation,
  sanitizeReturnDestination,
  translatePasskeyError,
} from "@/lib/passkey-policy";
import { getPendingOAuthVerificationUrl } from "@/lib/oauth-policy";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "@/components/github-icon";
import { GoogleIcon } from "@/components/google-icon";
import { LegalLinks } from "@/components/legal-links";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface LoginFormProps extends React.ComponentProps<"div"> {
  oauthError?: string;
  oauthProvider?: ExternalIdentityProvider;
  returnTo?: string;
}

function LastUsedBadge({
  method,
  lastUsedMethod,
}: {
  method: string;
  lastUsedMethod: string | null;
}) {
  if (method !== lastUsedMethod) return null;
  return <Badge variant="secondary">Last used</Badge>;
}

export function LoginForm({
  oauthError,
  oauthProvider,
  returnTo,
  className,
  ...props
}: LoginFormProps) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(() =>
    translateExternalIdentityOauthError(oauthProvider, oauthError),
  );
  const [pendingProvider, setPendingProvider] = useState<ExternalIdentityProvider | null>(null);
  const [lastUsedLoginMethod, setLastUsedLoginMethod] = useState<string | null>(null);
  const [isPasskeyPending, setIsPasskeyPending] = useState(false);
  const [isWebAuthnSupported, setIsWebAuthnSupported] = useState(true);
  const activeCeremonyRef = useRef<"none" | "conditional" | "explicit">("none");

  const abortCeremony = () => {
    if (activeCeremonyRef.current !== "none") {
      activeCeremonyRef.current = "none";
      try {
        WebAuthnAbortService.cancelCeremony();
      } catch {}
    }
  };

  const handlePostSignInRedirect = async () => {
    if (await continuePendingOAuth()) return;
    const destination = sanitizeReturnDestination(returnTo);
    await navigate({ href: destination });
  };

  useEffect(() => {
    let active = true;
    setLastUsedLoginMethod(authClient.getLastUsedLoginMethod());

    async function initConditionalUI() {
      if (typeof window === "undefined" || !window.PublicKeyCredential) {
        setIsWebAuthnSupported(false);
        return;
      }
      setIsWebAuthnSupported(true);

      if (!window.PublicKeyCredential.isConditionalMediationAvailable) return;
      try {
        const available = await window.PublicKeyCredential.isConditionalMediationAvailable();
        if (!available || !active) return;

        if (activeCeremonyRef.current !== "none") return;
        activeCeremonyRef.current = "conditional";

        const res = await authClient.signIn.passkey({ autoFill: true });
        if (!active || activeCeremonyRef.current !== "conditional") return;
        activeCeremonyRef.current = "none";

        if (res.error) {
          if (!isPasskeyCancellation(res.error)) {
            setFormError(translatePasskeyError(res.error));
          }
          return;
        }

        if (res.data?.session) {
          await handlePostSignInRedirect();
        }
      } catch (err) {
        if (!active || activeCeremonyRef.current !== "conditional") return;
        activeCeremonyRef.current = "none";
        if (!isPasskeyCancellation(err)) {
          setFormError(translatePasskeyError(err));
        }
      }
    }

    void initConditionalUI();

    return () => {
      active = false;
      abortCeremony();
    };
  }, []);

  const signInWithPasskey = async () => {
    setFormError(null);
    setIsPasskeyPending(true);
    abortCeremony();
    activeCeremonyRef.current = "explicit";

    try {
      const res = await authClient.signIn.passkey();
      if (activeCeremonyRef.current !== "explicit") return;

      if (res.error) {
        if (!isPasskeyCancellation(res.error)) {
          setFormError(translatePasskeyError(res.error));
        }
        return;
      }

      if (res.data?.session) {
        await handlePostSignInRedirect();
      }
    } catch (err) {
      if (activeCeremonyRef.current !== "explicit") return;
      if (!isPasskeyCancellation(err)) {
        setFormError(translatePasskeyError(err));
      }
    } finally {
      activeCeremonyRef.current = "none";
      setIsPasskeyPending(false);
    }
  };

  const signInWithExternalIdentity = async (provider: ExternalIdentityProvider) => {
    setFormError(null);
    abortCeremony();
    setPendingProvider(provider);

    try {
      const search = typeof window !== "undefined" ? window.location.search : undefined;
      const result = await authClient.signIn.social(
        getExternalIdentitySignInOptions(provider, { returnTo, search }),
      );
      if (result.error) {
        setFormError(translateExternalIdentityOauthError(provider, result.error.code));
        setPendingProvider(null);
      }
    } catch {
      setFormError(translateExternalIdentityOauthError(provider, "oauth_provider_failure"));
      setPendingProvider(null);
    }
  };

  const form = useForm({
    validators: {
      onSubmit: loginSchema,
    },
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      abortCeremony();

      const email = normalizeEmail(value.email);

      try {
        const res = await authClient.signIn.email({
          email,
          password: value.password,
        });

        if (res.error) {
          const failure = getLoginFailureResolution(res.error, email);
          if (failure.destination) {
            const oauthVerificationUrl =
              typeof window === "undefined"
                ? null
                : getPendingOAuthVerificationUrl(window.location.search, email);
            if (oauthVerificationUrl) {
              window.location.assign(oauthVerificationUrl);
              return;
            }
            await navigate(failure.destination);
            return;
          }

          setFormError(failure.message);
          return;
        }

        if (res.data && "twoFactorRedirect" in res.data && res.data.twoFactorRedirect) {
          return;
        }

        await handlePostSignInRedirect();
      } catch (error) {
        setFormError(translateAuthError(error, "login"));
      }
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
            noValidate
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
                      autoComplete="username webauthn"
                      placeholder="you@example.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        setFormError(null);
                        field.handleChange(e.target.value);
                      }}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <form.Field name="password">
                {(field) => (
                  <Field>
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <Link
                        to="/forgot-password"
                        className="text-xs underline-offset-4 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      name={field.name}
                      type="password"
                      autoComplete="current-password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        setFormError(null);
                        field.handleChange(e.target.value);
                      }}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Field>
                    <Button
                      type="submit"
                      loading={isSubmitting}
                      disabled={isSubmitting || pendingProvider !== null || isPasskeyPending}
                    >
                      Login
                      <LastUsedBadge method="email" lastUsedMethod={lastUsedLoginMethod} />
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      loading={isPasskeyPending}
                      aria-describedby={
                        !isWebAuthnSupported ? "passkey-unsupported-explanation" : undefined
                      }
                      disabled={
                        isSubmitting ||
                        pendingProvider !== null ||
                        isPasskeyPending ||
                        !isWebAuthnSupported
                      }
                      onClick={signInWithPasskey}
                    >
                      <Fingerprint />
                      Sign in with Passkey
                      <LastUsedBadge method="passkey" lastUsedMethod={lastUsedLoginMethod} />
                    </Button>
                    {!isWebAuthnSupported && (
                      <p
                        id="passkey-unsupported-explanation"
                        className="text-xs text-muted-foreground text-center"
                        role="status"
                      >
                        Passkeys are not supported in this browser.
                      </p>
                    )}
                    <Button
                      variant="outline"
                      type="button"
                      loading={pendingProvider === "google"}
                      disabled={isSubmitting || pendingProvider !== null || isPasskeyPending}
                      onClick={() => signInWithExternalIdentity("google")}
                    >
                      <GoogleIcon />
                      Continue with Google
                      <LastUsedBadge method="google" lastUsedMethod={lastUsedLoginMethod} />
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      loading={pendingProvider === "github"}
                      disabled={isSubmitting || pendingProvider !== null || isPasskeyPending}
                      onClick={() => signInWithExternalIdentity("github")}
                    >
                      <GithubIcon />
                      Continue with GitHub
                      <LastUsedBadge method="github" lastUsedMethod={lastUsedLoginMethod} />
                    </Button>
                    <FieldDescription className="text-center">
                      Don&apos;t have an account?{" "}
                      <Link
                        to="/signup"
                        search={true}
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
      <LegalLinks />
    </div>
  );
}
