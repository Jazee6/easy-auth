import * as v from "valibot";

export const PASSKEY_SESSION_FRESH_AGE_MS = 5 * 60 * 1000;

export const passkeyNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(64, "Passkey name must be at most 64 characters"),
);

export const renamePasskeySchema = v.pipe(
  v.string("Name is required"),
  v.trim(),
  v.nonEmpty("Name is required"),
  v.maxLength(64, "Passkey name must be at most 64 characters"),
);

export interface PasskeyRpConfig {
  rpID: string;
  origin: string;
  rpName: string;
}

export function derivePasskeyRpConfig(betterAuthUrl?: string): PasskeyRpConfig {
  if (!betterAuthUrl) {
    return {
      rpID: "localhost",
      origin: "http://localhost:3000",
      rpName: "Easy Auth",
    };
  }

  let url: URL;
  try {
    url = new URL(betterAuthUrl);
  } catch {
    throw new Error(`Invalid BETTER_AUTH_URL: "${betterAuthUrl}"`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Invalid BETTER_AUTH_URL protocol: "${betterAuthUrl}"`);
  }

  if (!url.hostname) {
    throw new Error(`Invalid BETTER_AUTH_URL hostname: "${betterAuthUrl}"`);
  }

  return {
    rpID: url.hostname,
    origin: url.origin,
    rpName: "Easy Auth",
  };
}

export function isPasskeyCancellation(error: unknown): boolean {
  if (!error) return false;

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";

  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? (error as { cause: unknown }).cause
      : null;

  const causeName =
    typeof cause === "object" && cause !== null && "name" in cause
      ? String((cause as { name: unknown }).name)
      : "";

  // Server authorization and validation errors are never cancellations
  if (
    code === "YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY" ||
    code === "USER_VERIFICATION_REQUIRED" ||
    code === "SESSION_REQUIRED" ||
    code === "SESSION_NOT_FRESH" ||
    code === "ACCOUNT_BANNED" ||
    code === "EMAIL_NOT_VERIFIED" ||
    code === "PASSKEY_NOT_FOUND" ||
    code === "AUTHENTICATION_FAILED" ||
    code === "FAILED_TO_VERIFY_REGISTRATION" ||
    code === "FAILED_TO_UPDATE_PASSKEY" ||
    code === "CANNOT_DELETE_LAST_METHOD" ||
    code === "FAILED_TO_UNLINK_LAST_ACCOUNT"
  ) {
    return false;
  }

  // Exact documented client cancellation codes and names
  if (
    code === "AUTH_CANCELLED" ||
    code === "REGISTRATION_CANCELLED" ||
    code === "ERROR_CEREMONY_ABORTED"
  ) {
    return true;
  }

  if (
    code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY" &&
    (causeName === "NotAllowedError" || causeName === "AbortError")
  ) {
    return true;
  }

  if (name === "NotAllowedError" || name === "AbortError") {
    return true;
  }

  return false;
}

export function translatePasskeyError(error: unknown): string {
  if (!error) return "Passkey operation failed. Please try again.";

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : typeof error === "string"
        ? error
        : "";

  if (code === "SESSION_NOT_FRESH" || code === "SESSION_REQUIRED" || message.includes("fresh")) {
    return "Recent sign-in required. Please sign in again to continue.";
  }

  if (
    code === "CANNOT_DELETE_LAST_METHOD" ||
    code === "FAILED_TO_UNLINK_LAST_ACCOUNT" ||
    message.includes("final sign-in method")
  ) {
    return "You cannot remove your final sign-in method.";
  }

  if (code === "USER_VERIFICATION_REQUIRED") {
    return "Device verification (PIN or biometrics) is required.";
  }

  if (code === "ACCOUNT_BANNED") {
    return "This account has been banned.";
  }

  if (code === "EMAIL_NOT_VERIFIED") {
    return "Please verify your email address to continue.";
  }

  if (code === "PREVIOUSLY_REGISTERED" || code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
    return "This passkey has already been registered.";
  }

  if (code === "PASSKEY_NOT_FOUND") {
    return "Passkey not found.";
  }

  return message || "Passkey operation failed. Please try again.";
}

export type SafeReturnDestination =
  | "/sign-in-methods"
  | "/sign-in-methods?resume=add-passkey"
  | "/profile";

export function sanitizeReturnDestination(returnTo?: string | null): SafeReturnDestination {
  if (returnTo === "/sign-in-methods" || returnTo === "/sign-in-methods?resume=add-passkey") {
    return returnTo;
  }
  return "/profile";
}
