import * as v from "valibot";

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

export const githubAuthPolicy = {
  requireEmailVerification: true,
  overrideUserInfoOnSignIn: false,
  disableImplicitLinking: true,
  allowDifferentEmails: false,
  updateUserInfoOnLink: false,
  allowUnlinkingAll: false,
  encryptOAuthTokens: false,
} as const;

export interface GithubIdentitySource {
  action: "create-user" | "link-account" | "sign-in";
  method: string;
  oauth?: { providerId: string };
}

export function validateGithubIdentity(
  user: { email?: string | null; emailVerified?: boolean | null },
  source: GithubIdentitySource,
): { error: string; errorDescription: string } | undefined {
  if (source.method !== "oauth" || source.oauth?.providerId !== "github") {
    return undefined;
  }

  if (!user.email) {
    return {
      error: "github_email_missing",
      errorDescription: "GitHub must provide an email address",
    };
  }

  if (!user.emailVerified) {
    return {
      error: "github_email_not_verified",
      errorDescription: "GitHub must provide a verified email address",
    };
  }

  return undefined;
}

export function getGithubSignInOptions(): {
  provider: "github";
  callbackURL: "/profile";
  newUserCallbackURL: "/profile";
  errorCallbackURL: "/login";
} {
  return {
    provider: "github",
    callbackURL: "/profile",
    newUserCallbackURL: "/profile",
    errorCallbackURL: "/login",
  };
}

export interface SignInMethodAccount {
  id: string;
  providerId: string;
}

export function deriveSignInMethodState(accounts: SignInMethodAccount[]): {
  password: { isSet: boolean };
  github: {
    isLinked: boolean;
    accountId: string | null;
    canUnlink: boolean;
    unlinkReason: string | null;
  };
} {
  const passwordAccount = accounts.find((account) => account.providerId === "credential");
  const githubAccount = accounts.find((account) => account.providerId === "github");
  const hasAnotherMethod = accounts.some((account) => account.providerId !== "github");

  return {
    password: { isSet: Boolean(passwordAccount) },
    github: {
      isLinked: Boolean(githubAccount),
      accountId: githubAccount?.id ?? null,
      canUnlink: Boolean(githubAccount && hasAnotherMethod),
      unlinkReason:
        githubAccount && !hasAnotherMethod
          ? "Set a password before unlinking your final sign-in method."
          : null,
    },
  };
}

interface GithubLinkEvaluationInput {
  userId: string;
  loginEmail: string;
  providerEmail?: string | null;
  providerEmailVerified: boolean;
  githubIdentityCount: number;
  identityOwnerUserId?: string | null;
}

export function evaluateGithubLink(
  input: GithubLinkEvaluationInput,
): { allowed: true } | { allowed: false; code: string } {
  if (!input.providerEmail) {
    return { allowed: false, code: "github_email_missing" };
  }

  if (!input.providerEmailVerified) {
    return { allowed: false, code: "github_email_not_verified" };
  }

  if (normalizeEmail(input.providerEmail) !== normalizeEmail(input.loginEmail)) {
    return { allowed: false, code: "email_does_not_match" };
  }

  if (input.identityOwnerUserId && input.identityOwnerUserId !== input.userId) {
    return { allowed: false, code: "identity_owned_by_another_user" };
  }

  if (input.githubIdentityCount > 0) {
    return { allowed: false, code: "github_already_linked" };
  }

  return { allowed: true };
}

export function getGithubLinkOptions(): {
  provider: "github";
  callbackURL: "/sign-in-methods?status=github-linked";
  errorCallbackURL: "/sign-in-methods";
} {
  return {
    provider: "github",
    callbackURL: "/sign-in-methods?status=github-linked",
    errorCallbackURL: "/sign-in-methods",
  };
}

export function translateSignInMethodsError(error: string): string {
  const errorCode = error.toLowerCase();

  if (
    errorCode === "email_does_not_match" ||
    errorCode === "linking_different_emails_not_allowed"
  ) {
    return "The verified GitHub email must match your login email.";
  }

  if (
    errorCode === "account_already_linked_to_different_user" ||
    errorCode === "social_account_already_linked" ||
    errorCode === "identity_owned_by_another_user"
  ) {
    return "This GitHub identity is already linked to another account.";
  }

  if (
    errorCode === "unable_to_link_account" ||
    errorCode === "github_already_linked" ||
    errorCode === "linking_failed"
  ) {
    return "A GitHub identity is already linked, or the link could not be completed.";
  }

  if (errorCode === "github_email_missing" || errorCode === "email_not_found") {
    return "GitHub did not provide an email. Verify your primary email in GitHub and try again.";
  }

  if (errorCode === "github_email_not_verified" || errorCode === "email_not_verified") {
    return "Verify your primary email in GitHub before linking.";
  }

  if (errorCode === "failed_to_unlink_last_account") {
    return "Set a password before unlinking your final sign-in method.";
  }

  return "Unable to update sign-in methods. Please try again.";
}

export function translateGithubOauthError(error?: string): string | null {
  if (!error) return null;

  if (error === "access_denied" || error === "no_code") {
    return "GitHub sign-in was canceled. Please try again.";
  }

  if (error === "email_not_found" || error === "github_email_missing") {
    return "GitHub did not provide an email. Verify your primary email in GitHub and try again.";
  }

  if (error === "email_not_verified" || error === "github_email_not_verified") {
    return "Verify your primary email in GitHub before signing in.";
  }

  if (error === "account_not_linked") {
    return "An account already exists with this email. Log in with an existing sign-in method, then link GitHub from Sign-in methods.";
  }

  return "Unable to sign in with GitHub. Please try again.";
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
