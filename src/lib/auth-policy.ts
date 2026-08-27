import * as v from "valibot";

export const credentialsSchema = v.object({
  email: v.pipe(
    v.string("Email is required"),
    v.trim(),
    v.nonEmpty("Email is required"),
    v.email("Invalid email address"),
  ),
  password: v.pipe(
    v.string("Password is required"),
    v.nonEmpty("Password is required"),
    v.minLength(8, "Password must be at least 8 characters"),
    v.maxLength(128, "Password must be at most 128 characters"),
  ),
});

export const loginSchema = credentialsSchema;
export const signupSchema = credentialsSchema;

export const otpSchema = v.pipe(
  v.string("Verification code is required"),
  v.trim(),
  v.regex(/^\d{6}$/, "Verification code must be 6 digits"),
);

export const verifyEmailFormSchema = v.object({
  email: v.pipe(
    v.string("Email is required"),
    v.trim(),
    v.nonEmpty("Email is required"),
    v.email("Invalid email address"),
  ),
  otp: otpSchema,
});

export const profileSchema = v.object({
  name: v.pipe(v.string("Name is required"), v.trim(), v.nonEmpty("Name is required")),
  image: v.optional(
    v.pipe(
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
  ),
});

export type CredentialsInput = v.InferInput<typeof credentialsSchema>;
export type LoginInput = CredentialsInput;
export type SignupInput = CredentialsInput;
export type ProfileInput = v.InferInput<typeof profileSchema>;
export type VerifyEmailFormInput = v.InferInput<typeof verifyEmailFormSchema>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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

export type AuthRequestOperation =
  | "password-signup"
  | "verification-otp-send"
  | "email-verification";

export function composeAuthRequestHeaders(
  operation: AuthRequestOperation,
  captchaToken?: string | null,
): Record<string, string> {
  const isCaptchaProtected =
    operation === "password-signup" || operation === "verification-otp-send";

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

export function translateAuthError(
  error: unknown,
  mode: "login" | "signup" | "verify-email" | "resend-otp",
): string {
  const errCode =
    typeof error === "string"
      ? error
      : typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "";

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
    return "Unable to create user with provided details";
  }

  if (mode === "verify-email") {
    return "Failed to verify email. Please try again or request a new code.";
  }

  if (mode === "resend-otp") {
    return "Failed to resend verification code. Please try again.";
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

  if (cleanPath === "/profile") {
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

export function getPostLogoutRedirect(): string {
  return "/login";
}
