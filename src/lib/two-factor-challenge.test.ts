import { describe, expect, test } from "bun:test";
import * as v from "valibot";

import {
  getLoginRestartUrl,
  getTwoFactorChallengeUrl,
  initialTwoFactorChallengeValues,
  resolveTwoFactorChallengeError,
  twoFactorChallengeSchema,
} from "./two-factor-challenge";

describe("Two-Factor challenge form policy", () => {
  test("starts with TOTP and no implicit Trusted Device intent", () => {
    expect(initialTwoFactorChallengeValues).toEqual({
      method: "totp",
      code: "",
      trustDevice: false,
    });
  });

  test("accepts a six-digit TOTP and an explicit Backup Code with trust intent", () => {
    expect(
      v.safeParse(twoFactorChallengeSchema, {
        method: "totp",
        code: "012345",
        trustDevice: false,
      }).success,
    ).toBe(true);
    expect(
      v.safeParse(twoFactorChallengeSchema, {
        method: "backup",
        code: "  alpha-bravo  ",
        trustDevice: true,
      }).success,
    ).toBe(true);
  });

  test("rejects malformed TOTP and empty or oversized Backup Codes", () => {
    for (const input of [
      { method: "totp", code: "12345", trustDevice: false },
      { method: "totp", code: "abcdef", trustDevice: false },
      { method: "backup", code: "   ", trustDevice: false },
      { method: "backup", code: "x".repeat(129), trustDevice: false },
    ]) {
      expect(v.safeParse(twoFactorChallengeSchema, input).success).toBe(false);
    }
  });
});

describe("Two-Factor challenge error policy", () => {
  test("uses one safe response for invalid or consumed factors", () => {
    for (const code of ["INVALID_CODE", "INVALID_BACKUP_CODE"]) {
      expect(resolveTwoFactorChallengeError({ code })).toEqual({
        message: "The code is invalid or has already been used.",
        restartRequired: false,
      });
    }
  });

  test("classifies missing, expired, exhausted, and wrong-state challenges for restart", () => {
    for (const code of [
      "INVALID_TWO_FACTOR_COOKIE",
      "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
      "TOTP_NOT_ENABLED",
      "BACKUP_CODES_NOT_ENABLED",
      "TWO_FACTOR_NOT_ENABLED",
    ]) {
      expect(resolveTwoFactorChallengeError({ code }).restartRequired).toBe(true);
    }
  });

  test("distinguishes lockout and throttling without exposing internals", () => {
    expect(resolveTwoFactorChallengeError({ code: "ACCOUNT_TEMPORARILY_LOCKED" })).toEqual({
      message: "Two-Factor verification is temporarily locked. Try again later.",
      restartRequired: false,
    });
    for (const error of [{ code: "TOO_MANY_REQUESTS" }, { status: 429 }]) {
      expect(resolveTwoFactorChallengeError(error)).toEqual({
        message: "Too many requests. Wait a moment before trying again.",
        restartRequired: false,
      });
    }
    expect(resolveTwoFactorChallengeError(new Error("secret database detail"))).toEqual({
      message: "Unable to verify the code. Restart login and try again.",
      restartRequired: true,
    });
  });
});

describe("Two-Factor continuation destinations", () => {
  test("preserves the signed continuation byte-for-byte through challenge and restart", () => {
    const search = "?client_id=client-1&state=a%2Bb&sig=signed&ba_param=client_id";
    expect(getTwoFactorChallengeUrl(search)).toBe(`/two-factor${search}`);
    expect(getLoginRestartUrl(search)).toBe(`/login${search}`);
  });

  test("uses clean ordinary-login destinations without inventing search state", () => {
    expect(getTwoFactorChallengeUrl("")).toBe("/two-factor");
    expect(getLoginRestartUrl("")).toBe("/login");
  });
});
