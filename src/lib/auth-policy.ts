import * as v from "valibot";
import { sanitizeReturnDestination } from "./passkey-policy";

export const EMAIL_RESEND_COOLDOWN_SECONDS = 60;

export const emailSchema = v.pipe(
  v.string("Email is required"),
  v.trim(),
  v.nonEmpty("Email is required"),
  v.email("Invalid email address"),
);

export const passwordSchema = v.pipe(
  v.string("Password is required"),
  v.nonEmpty("Password is required"),
  v.minLength(8, "Password must be at least 8 characters"),
  v.maxLength(128, "Password must be at most 128 characters"),
);

export const credentialsSchema = v.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = credentialsSchema;
export const signupSchema = credentialsSchema;

export const otpSchema = v.pipe(
  v.string("Verification code is required"),
  v.trim(),
  v.regex(/^\d{6}$/, "Verification code must be 6 digits"),
);

export const verifyEmailFormSchema = v.object({
  email: emailSchema,
  otp: otpSchema,
});

export const passwordResetRequestSchema = v.object({
  email: emailSchema,
});

export const passwordResetCompletionSchema = v.pipe(
  v.object({
    email: emailSchema,
    otp: otpSchema,
    password: passwordSchema,
    confirmPassword: passwordSchema,
  }),
  v.forward(
    v.partialCheck(
      [["password"], ["confirmPassword"]],
      (input) => input.password === input.confirmPassword,
      "Passwords do not match",
    ),
    ["confirmPassword"],
  ),
);

export function getPasswordConfirmationError(
  password: string,
  confirmPassword: string,
): string | undefined {
  if (!confirmPassword || password.startsWith(confirmPassword)) return undefined;
  return "Passwords do not match";
}

export const passwordResetPolicy = {
  revokeSessions: true,
  establishSession: false,
} as const;

export const externalIdentityAuthPolicy = {
  requireEmailVerification: true,
  overrideUserInfoOnSignIn: false,
  disableImplicitLinking: true,
  allowDifferentEmails: false,
  updateUserInfoOnLink: false,
  allowUnlinkingAll: false,
  encryptOAuthTokens: false,
} as const;

export const externalIdentityProviders = ["google", "github"] as const;
export type ExternalIdentityProvider = (typeof externalIdentityProviders)[number];

const externalIdentityProviderNames: Record<ExternalIdentityProvider, string> = {
  google: "Google",
  github: "GitHub",
};

export function isExternalIdentityProvider(value: unknown): value is ExternalIdentityProvider {
  return externalIdentityProviders.includes(value as ExternalIdentityProvider);
}

export function getExternalIdentityProviderName(provider: ExternalIdentityProvider): string {
  return externalIdentityProviderNames[provider];
}

export interface ExternalIdentitySource {
  action: "create-user" | "link-account" | "sign-in";
  method: string;
  oauth?: { providerId: string };
}

export function validateExternalIdentity(
  user: { email?: string | null; emailVerified?: boolean | null },
  source: ExternalIdentitySource,
): { error: string; errorDescription: string } | undefined {
  const provider = source.oauth?.providerId;
  if (source.method !== "oauth" || !isExternalIdentityProvider(provider)) {
    return undefined;
  }

  const providerName = getExternalIdentityProviderName(provider);
  if (!user.email) {
    return {
      error: `${provider}_email_missing`,
      errorDescription: `${providerName} must provide an email address`,
    };
  }

  if (!user.emailVerified) {
    return {
      error: `${provider}_email_not_verified`,
      errorDescription: `${providerName} must provide a verified email address`,
    };
  }

  return undefined;
}

export interface ExternalIdentitySignInOptionsParams {
  returnTo?: string | null;
  search?: string | null;
}

function addProviderToLoginUrl(url: string, provider: ExternalIdentityProvider): string {
  const parsed = new URL(url, "https://easy-auth.invalid");
  parsed.searchParams.set("provider", provider);
  return `${parsed.pathname}${parsed.search}`;
}

export function getExternalIdentitySignInOptions(
  provider: ExternalIdentityProvider,
  params?: ExternalIdentitySignInOptionsParams,
): {
  provider: ExternalIdentityProvider;
  callbackURL: string;
  newUserCallbackURL: string;
  errorCallbackURL: string;
} {
  const { returnTo, search } = params ?? {};

  // Check if pending OAuth flow takes priority
  const query = search ? new URLSearchParams(search.startsWith("?") ? search : `?${search}`) : null;
  const hasOAuthFlow = Boolean(query?.has("sig") && query?.has("client_id"));

  if (hasOAuthFlow && search) {
    const formattedSearch = search.startsWith("?") ? search : `?${search}`;
    const oauthContinuationUrl = `/login${formattedSearch}`;
    return {
      provider,
      callbackURL: oauthContinuationUrl,
      newUserCallbackURL: oauthContinuationUrl,
      errorCallbackURL: addProviderToLoginUrl(oauthContinuationUrl, provider),
    };
  }

  const destination = sanitizeReturnDestination(returnTo);
  const errorCallbackURL = addProviderToLoginUrl(
    destination === "/profile"
      ? "/login"
      : `/login?${new URLSearchParams({ returnTo: destination })}`,
    provider,
  );

  return {
    provider,
    callbackURL: destination,
    newUserCallbackURL: destination,
    errorCallbackURL,
  };
}

export interface SignInMethodAccount {
  id: string;
  providerId: string;
}

export interface PasskeyItem {
  id: string;
  name?: string | null;
  createdAt?: Date | number | string | null;
  aaguid?: string | null;
}

export interface ExternalIdentityMethodState {
  isLinked: boolean;
  accountId: string | null;
  canUnlink: boolean;
  unlinkReason: string | null;
}

export function deriveSignInMethodState(
  accounts: SignInMethodAccount[],
  passkeys?: PasskeyItem[],
): {
  password: { isSet: boolean };
  google: ExternalIdentityMethodState;
  github: ExternalIdentityMethodState;
  passkey?: {
    items: PasskeyItem[];
    canDelete: (passkeyId: string) => boolean;
  };
} {
  const passwordAccount = accounts.find((account) => account.providerId === "credential");
  const providerAccounts = Object.fromEntries(
    externalIdentityProviders.map((provider) => [
      provider,
      accounts.find((account) => account.providerId === provider),
    ]),
  ) as Record<ExternalIdentityProvider, SignInMethodAccount | undefined>;
  const hasPasskey = Boolean(passkeys && passkeys.length > 0);

  const getExternalIdentityState = (
    provider: ExternalIdentityProvider,
  ): ExternalIdentityMethodState => {
    const providerAccount = providerAccounts[provider];
    const hasAnotherMethod =
      Boolean(passwordAccount) ||
      hasPasskey ||
      externalIdentityProviders.some(
        (candidate) => candidate !== provider && Boolean(providerAccounts[candidate]),
      );

    return {
      isLinked: Boolean(providerAccount),
      accountId: providerAccount?.id ?? null,
      canUnlink: Boolean(providerAccount && hasAnotherMethod),
      unlinkReason:
        providerAccount && !hasAnotherMethod
          ? "Add another sign-in method before unlinking your final sign-in method."
          : null,
    };
  };

  const result: {
    password: { isSet: boolean };
    google: ExternalIdentityMethodState;
    github: ExternalIdentityMethodState;
    passkey?: {
      items: PasskeyItem[];
      canDelete: (passkeyId: string) => boolean;
    };
  } = {
    password: { isSet: Boolean(passwordAccount) },
    google: getExternalIdentityState("google"),
    github: getExternalIdentityState("github"),
  };

  if (passkeys !== undefined) {
    result.passkey = {
      items: passkeys,
      canDelete(passkeyId: string) {
        const remainingPasskeys = passkeys.filter((p) => p.id !== passkeyId);
        const hasExternalIdentity = externalIdentityProviders.some((provider) =>
          Boolean(providerAccounts[provider]),
        );
        return Boolean(passwordAccount) || hasExternalIdentity || remainingPasskeys.length > 0;
      },
    };
  }

  return result;
}

interface ExternalIdentityLinkEvaluationInput {
  provider: ExternalIdentityProvider;
  userId: string;
  loginEmail: string;
  providerEmail?: string | null;
  providerEmailVerified: boolean;
  providerIdentityCount: number;
  identityOwnerUserId?: string | null;
}

export function evaluateExternalIdentityLink(
  input: ExternalIdentityLinkEvaluationInput,
): { allowed: true } | { allowed: false; code: string } {
  if (!input.providerEmail) {
    return { allowed: false, code: `${input.provider}_email_missing` };
  }

  if (!input.providerEmailVerified) {
    return { allowed: false, code: `${input.provider}_email_not_verified` };
  }

  if (normalizeEmail(input.providerEmail) !== normalizeEmail(input.loginEmail)) {
    return { allowed: false, code: "email_does_not_match" };
  }

  if (input.identityOwnerUserId && input.identityOwnerUserId !== input.userId) {
    return { allowed: false, code: "identity_owned_by_another_user" };
  }

  if (input.providerIdentityCount > 0) {
    return { allowed: false, code: `${input.provider}_already_linked` };
  }

  return { allowed: true };
}

export function getExternalIdentityLinkOptions(provider: ExternalIdentityProvider): {
  provider: ExternalIdentityProvider;
  callbackURL: string;
  errorCallbackURL: string;
} {
  return {
    provider,
    callbackURL: `/sign-in-methods?status=${provider}-linked`,
    errorCallbackURL: `/sign-in-methods?provider=${provider}`,
  };
}

export function translateSignInMethodsError(
  provider: ExternalIdentityProvider | undefined,
  error: string,
): string {
  const errorCode = error.toLowerCase();
  if (!provider) return "Unable to update sign-in methods. Please try again.";

  const providerName = getExternalIdentityProviderName(provider);
  if (
    errorCode === "email_does_not_match" ||
    errorCode === "linking_different_emails_not_allowed"
  ) {
    return `The verified ${providerName} email must match your login email.`;
  }

  if (
    errorCode === "account_already_linked_to_different_user" ||
    errorCode === "social_account_already_linked" ||
    errorCode === "identity_owned_by_another_user"
  ) {
    return `This ${providerName} identity is already linked to another account.`;
  }

  if (
    errorCode === "unable_to_link_account" ||
    errorCode === `${provider}_already_linked` ||
    errorCode === "linking_failed"
  ) {
    return `A ${providerName} identity is already linked, or the link could not be completed.`;
  }

  if (errorCode === `${provider}_email_missing` || errorCode === "email_not_found") {
    return `${providerName} did not provide an email. Verify your primary email in ${providerName} and try again.`;
  }

  if (errorCode === `${provider}_email_not_verified` || errorCode === "email_not_verified") {
    return `Verify your primary email in ${providerName} before linking.`;
  }

  if (errorCode === "failed_to_unlink_last_account") {
    return "Add another sign-in method before unlinking your final sign-in method.";
  }

  return "Unable to update sign-in methods. Please try again.";
}

export function translateExternalIdentityOauthError(
  provider: ExternalIdentityProvider | undefined,
  error?: string,
): string | null {
  if (!error) return null;
  if (!provider) return "Unable to sign in. Please try again.";

  const providerName = getExternalIdentityProviderName(provider);
  const errorCode = error.toLowerCase();
  if (errorCode === "access_denied" || errorCode === "no_code") {
    return `${providerName} sign-in was canceled. Please try again.`;
  }

  if (errorCode === "email_not_found" || errorCode === `${provider}_email_missing`) {
    return `${providerName} did not provide an email. Verify your primary email in ${providerName} and try again.`;
  }

  if (errorCode === "email_not_verified" || errorCode === `${provider}_email_not_verified`) {
    return `Verify your primary email in ${providerName} before signing in.`;
  }

  if (errorCode === "account_not_linked") {
    return `An account already exists with this email. Log in with an existing sign-in method, then link ${providerName} from Sign-in methods.`;
  }

  return `Unable to sign in with ${providerName}. Please try again.`;
}

export const profileSchema = v.object({
  name: v.pipe(v.string("Name is required"), v.trim(), v.nonEmpty("Name is required")),
  image: v.pipe(
    v.string(),
    v.trim(),
    v.check((val) => {
      if (!val) return true;
      try {
        const url = new URL(val);
        return url.protocol === "https:";
      } catch {
        return false;
      }
    }, "Avatar must be a valid HTTPS URL"),
  ),
});

export type CredentialsInput = v.InferInput<typeof credentialsSchema>;
export type LoginInput = CredentialsInput;
export type SignupInput = CredentialsInput;
export type ProfileInput = v.InferInput<typeof profileSchema>;
export type VerifyEmailFormInput = v.InferInput<typeof verifyEmailFormSchema>;
export type PasswordResetRequestInput = v.InferInput<typeof passwordResetRequestSchema>;
export type PasswordResetCompletionInput = v.InferInput<typeof passwordResetCompletionSchema>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function derivePasswordResetPayload(input: {
  email: string;
  otp: string;
  password: string;
}): {
  email: string;
  otp: string;
  password: string;
} {
  return {
    email: normalizeEmail(input.email),
    otp: input.otp.trim(),
    password: input.password,
  };
}

export function deriveInitialName(email: string): string {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.indexOf("@");
  if (atIndex === -1) {
    return normalized;
  }
  return normalized.slice(0, atIndex);
}

export function deriveSignupPayload(input: { email: string; password: string }): {
  email: string;
  password: string;
  name: string;
} {
  const normalizedEmail = normalizeEmail(input.email);
  const name = deriveInitialName(normalizedEmail);
  return {
    email: normalizedEmail,
    password: input.password,
    name,
  };
}

export function getInitials(name?: string | null): string {
  if (!name) return "U";
  const trimmed = name.trim();
  if (!trimmed) return "U";

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 1).toUpperCase();
}

export const captchaProtectedAuthEndpoints = [
  "/sign-up/email",
  "/email-otp/send-verification-otp",
  "/email-otp/request-password-reset",
] as const;

export type AuthRequestOperation =
  | "password-signup"
  | "verification-otp-send"
  | "email-verification"
  | "password-reset-request"
  | "password-reset";

export function composeAuthRequestHeaders(
  operation: AuthRequestOperation,
  captchaToken?: string | null,
): Record<string, string> {
  const isCaptchaProtected =
    operation === "password-signup" ||
    operation === "verification-otp-send" ||
    operation === "password-reset-request";

  if (!isCaptchaProtected || !captchaToken) {
    return {};
  }

  return { "x-captcha-response": captchaToken };
}

export function shouldRejectPasswordlessOtpRequest(path?: string, otpType?: string): boolean {
  return (
    path === "/sign-in/email-otp" ||
    (path === "/email-otp/send-verification-otp" && otpType === "sign-in")
  );
}

function getAuthErrorCode(error: unknown): string {
  return typeof error === "string"
    ? error
    : typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
}

export interface LoginFailureResolution {
  message: string;
  destination: ReturnType<typeof getPostSignupDestination> | null;
}

export function getLoginFailureResolution(error: unknown, email: string): LoginFailureResolution {
  return {
    message: translateAuthError(error, "login"),
    destination:
      getAuthErrorCode(error) === "EMAIL_NOT_VERIFIED" ? getPostSignupDestination(email) : null,
  };
}

export function translateAuthError(
  error: unknown,
  mode:
    | "login"
    | "signup"
    | "verify-email"
    | "resend-otp"
    | "request-password-reset"
    | "reset-password",
): string {
  const errCode = getAuthErrorCode(error);

  if (errCode === "EMAIL_NOT_VERIFIED") {
    return "Please verify your email address to continue.";
  }

  if (
    errCode === "CAPTCHA_VERIFICATION_FAILED" ||
    errCode === "VERIFICATION_FAILED" ||
    errCode === "MISSING_RESPONSE" ||
    errCode === "UNKNOWN_ERROR" ||
    errCode === "SERVICE_UNAVAILABLE" ||
    errCode === "MISSING_SECRET_KEY"
  ) {
    return "Security verification failed. Please try again.";
  }

  if (errCode === "INVALID_OTP") {
    return "Invalid verification code. Please check and try again.";
  }

  if (errCode === "OTP_EXPIRED") {
    return "Verification code has expired. Please request a new code.";
  }

  if (errCode === "TOO_MANY_ATTEMPTS") {
    return "Too many invalid attempts. Please request a new code.";
  }

  if (errCode === "TOO_MANY_REQUESTS" || errCode === "RATE_LIMITED") {
    return "Too many requests. Please wait a moment before trying again.";
  }

  if (mode === "login") {
    return "Invalid email or password";
  }

  if (mode === "signup") {
    return "Unable to create account with provided details";
  }

  if (mode === "verify-email") {
    return "Failed to verify email. Please try again or request a new code.";
  }

  if (mode === "resend-otp") {
    return "Failed to resend verification code. Please try again.";
  }

  if (mode === "request-password-reset") {
    return "Unable to send a reset code. Please try again.";
  }

  if (mode === "reset-password") {
    return "Unable to reset password. Please check your details and try again.";
  }

  return "An unexpected error occurred. Please try again.";
}

export function translateProfileError(_error: unknown): string {
  return "Failed to update profile. Please try again.";
}

export interface RouteRedirectParams {
  pathname: string;
  hasSession: boolean;
}

export function getRouteRedirect({ pathname, hasSession }: RouteRedirectParams): string | null {
  const cleanPath = pathname === "" ? "/" : pathname;

  if (cleanPath === "/") {
    return hasSession ? "/profile" : "/login";
  }

  if (cleanPath === "/login" || cleanPath === "/signup" || cleanPath === "/verify-email") {
    return hasSession ? "/profile" : null;
  }

  if (
    cleanPath === "/profile" ||
    cleanPath === "/sign-in-methods" ||
    cleanPath === "/security" ||
    cleanPath === "/applications"
  ) {
    return hasSession ? null : "/login";
  }

  return null;
}

export function getPostLoginRedirect(): string {
  return "/profile";
}

export function getPostSignupDestination(email: string): {
  to: "/verify-email";
  search: { email: string };
} {
  return {
    to: "/verify-email",
    search: { email: normalizeEmail(email) },
  };
}

export function getPostVerificationRedirect(): string {
  return "/profile";
}

export function getPasswordResetRequestSuccessMessage(): string {
  return "If an account exists for this email, a password reset code has been sent. Check your inbox before continuing.";
}

export function getPostPasswordResetRedirect(): string {
  return "/login";
}

export function getPostLogoutRedirect(): string {
  return "/login";
}
