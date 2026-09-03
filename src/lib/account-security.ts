import * as v from "valibot";

export const accountNavigation = [
  { label: "Profile", path: "/profile" },
  { label: "Sign-in methods", path: "/sign-in-methods" },
  { label: "Account Security", path: "/account-security" },
  { label: "Authorized applications", path: "/authorized-applications" },
] as const;

export const passwordConfirmationSchema = v.object({
  password: v.pipe(v.string("Password is required"), v.nonEmpty("Password is required")),
});

export const totpVerificationSchema = v.object({
  code: v.pipe(
    v.string("Authenticator code is required"),
    v.regex(/^\d{6}$/, "Enter the 6-digit code from your Authenticator App"),
  ),
});

export function getTotpSecret(totpURI: string): string {
  try {
    return new URL(totpURI).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

export function backupCodesText(codes: string[]): string {
  return codes.join("\n");
}

export function accountSecurityErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  if ("code" in error) return String((error as { code: unknown }).code);
  if ("body" in error) return accountSecurityErrorCode((error as { body: unknown }).body);
  return "";
}

export function accountSecurityError(error: unknown, fallback: string): string {
  const code = accountSecurityErrorCode(error);

  if (code === "INVALID_PASSWORD" || code === "INVALID_EMAIL_OR_PASSWORD") {
    return "The current password is incorrect.";
  }
  if (code === "SESSION_NOT_FRESH") {
    return "Sign in again before changing this security setting.";
  }
  if (code === "INVALID_CODE") {
    return "The Authenticator code is invalid. Try the current code from your app.";
  }
  if (code === "TWO_FACTOR_ALREADY_ENABLED") {
    return "Two-Factor Authentication is already enabled. Refresh this page.";
  }
  if (code === "TWO_FACTOR_NOT_ENABLED") {
    return "Two-Factor Authentication is no longer enabled. Refresh this page.";
  }
  if (code === "ACCOUNT_SESSION_NOT_FOUND") {
    return "That Session is no longer active. Refresh this page.";
  }
  if (code === "TOO_MANY_REQUESTS" || code === "RATE_LIMITED") {
    return "Too many requests. Wait a moment and try again.";
  }

  return fallback;
}

export function shouldRefreshTwoFactorStatusAfterClose(
  nextOpen: boolean,
  mutationSucceeded: boolean,
): boolean {
  return !nextOpen && mutationSucceeded;
}

export function hasSecurityCleanupWarning(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "securityCleanupRequired" in data &&
    (data as { securityCleanupRequired?: unknown }).securityCleanupRequired === true
  );
}
