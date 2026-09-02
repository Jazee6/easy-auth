import * as v from "valibot";

import { otpSchema } from "./auth-policy";

const backupCodeSchema = v.pipe(
  v.string("Backup Code is required"),
  v.trim(),
  v.nonEmpty("Backup Code is required"),
  v.maxLength(128, "Backup Code is too long"),
);

export const twoFactorChallengeSchema = v.variant("method", [
  v.object({
    method: v.literal("totp"),
    code: otpSchema,
    trustDevice: v.boolean(),
  }),
  v.object({
    method: v.literal("backup"),
    code: backupCodeSchema,
    trustDevice: v.boolean(),
  }),
]);

export type TwoFactorChallengeInput = v.InferOutput<typeof twoFactorChallengeSchema>;
export type TwoFactorChallengeMethod = TwoFactorChallengeInput["method"];

export const initialTwoFactorChallengeValues: TwoFactorChallengeInput = {
  method: "totp",
  code: "",
  trustDevice: false,
};

export interface TwoFactorChallengeErrorResolution {
  message: string;
  restartRequired: boolean;
}

function getErrorCode(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error !== "object" || error === null) return "";
  if ("code" in error) return String((error as { code: unknown }).code);
  if ("status" in error && Number((error as { status: unknown }).status) === 429) {
    return "TOO_MANY_REQUESTS";
  }
  if (
    "message" in error &&
    String((error as { message: unknown }).message)
      .toLowerCase()
      .includes("too many requests")
  ) {
    return "TOO_MANY_REQUESTS";
  }
  if ("body" in error) return getErrorCode((error as { body: unknown }).body);
  return "";
}

export function resolveTwoFactorChallengeError(error: unknown): TwoFactorChallengeErrorResolution {
  const code = getErrorCode(error);

  if (code === "INVALID_CODE" || code === "INVALID_BACKUP_CODE") {
    return {
      message: "The code is invalid or has already been used.",
      restartRequired: false,
    };
  }

  if (code === "ACCOUNT_TEMPORARILY_LOCKED") {
    return {
      message: "Two-Factor verification is temporarily locked. Try again later.",
      restartRequired: false,
    };
  }

  if (code === "TOO_MANY_REQUESTS" || code === "RATE_LIMITED") {
    return {
      message: "Too many requests. Wait a moment before trying again.",
      restartRequired: false,
    };
  }

  if (code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") {
    return {
      message: "Too many invalid attempts. Restart login to try again.",
      restartRequired: true,
    };
  }

  if (
    code === "INVALID_TWO_FACTOR_COOKIE" ||
    code === "TOTP_NOT_ENABLED" ||
    code === "BACKUP_CODES_NOT_ENABLED" ||
    code === "TWO_FACTOR_NOT_ENABLED"
  ) {
    return {
      message: "This verification request is no longer valid. Restart login.",
      restartRequired: true,
    };
  }

  return {
    message: "Unable to verify the code. Restart login and try again.",
    restartRequired: true,
  };
}

function destinationWithSearch(pathname: string, search: string): string {
  if (!search) return pathname;
  return `${pathname}${search.startsWith("?") ? search : `?${search}`}`;
}

export function getTwoFactorChallengeUrl(search: string): string {
  return destinationWithSearch("/two-factor", search);
}

export function getLoginRestartUrl(search: string): string {
  return destinationWithSearch("/login", search);
}
