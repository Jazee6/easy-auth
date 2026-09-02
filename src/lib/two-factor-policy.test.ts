import { describe, expect, it } from "bun:test";

import {
  isAllowedDirectTwoFactorPath,
  isDirectTwoFactorPath,
  getAuthHandlerPath,
  getConstrainedAuthSurfaceError,
  isUnsafeDirectSessionPath,
  TWO_FACTOR_ENDPOINT_PROHIBITED,
  UNSAFE_SESSION_ENDPOINT_PROHIBITED,
} from "./two-factor-policy";

describe("Two-Factor product HTTP policy", () => {
  it("allows exactly the selected Two-Factor operations", () => {
    for (const path of [
      "/two-factor/enable",
      "/two-factor/disable",
      "/two-factor/verify-totp",
      "/two-factor/verify-backup-code",
      "/two-factor/generate-backup-codes",
    ]) {
      expect(isDirectTwoFactorPath(path)).toBe(true);
      expect(isAllowedDirectTwoFactorPath(path)).toBe(true);
    }
  });

  it("rejects OTP, secret retrieval, server-only viewing, and unknown operations", () => {
    for (const path of [
      "/two-factor/send-otp",
      "/two-factor/verify-otp",
      "/two-factor/get-totp-uri",
      "/two-factor/view-backup-codes",
      "/two-factor/future-capability",
    ]) {
      expect(isDirectTwoFactorPath(path)).toBe(true);
      expect(isAllowedDirectTwoFactorPath(path)).toBe(false);
    }

    expect(isDirectTwoFactorPath("/sign-in/email")).toBe(false);
    expect(isAllowedDirectTwoFactorPath()).toBe(false);
  });

  it("blocks every native token-bearing Session surface replaced by the safe facade", () => {
    for (const path of [
      "/list-sessions",
      "/revoke-session",
      "/revoke-sessions",
      "/revoke-other-sessions",
    ]) {
      expect(isUnsafeDirectSessionPath(path)).toBe(true);
    }

    expect(isUnsafeDirectSessionPath("/sign-out")).toBe(false);
    expect(isUnsafeDirectSessionPath("/account/sessions")).toBe(false);
  });

  it("derives mounted auth paths and rejects unknown routes before Better Auth routing", () => {
    expect(getAuthHandlerPath("https://auth.example/api/auth/two-factor/future?value=secret")).toBe(
      "/two-factor/future",
    );
    expect(getAuthHandlerPath("https://auth.example/api/auth/list-sessions")).toBe(
      "/list-sessions",
    );
    expect(getConstrainedAuthSurfaceError("/two-factor/future")).toBe(
      TWO_FACTOR_ENDPOINT_PROHIBITED,
    );
    expect(getConstrainedAuthSurfaceError("/revoke-session")).toBe(
      UNSAFE_SESSION_ENDPOINT_PROHIBITED,
    );
    expect(getConstrainedAuthSurfaceError("/sign-out")).toBeNull();
  });

  it("uses stable non-sensitive prohibition errors", () => {
    expect(TWO_FACTOR_ENDPOINT_PROHIBITED).toEqual({
      code: "TWO_FACTOR_ENDPOINT_PROHIBITED",
      message: "This Two-Factor operation is not supported",
    });
    expect(UNSAFE_SESSION_ENDPOINT_PROHIBITED).toEqual({
      code: "SESSION_ENDPOINT_PROHIBITED",
      message: "Use the Easy Auth Session interface",
    });
  });
});
