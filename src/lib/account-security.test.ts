import { describe, expect, test } from "bun:test";
import * as v from "valibot";

import {
  accountNavigation,
  accountSecurityErrorCode,
  backupCodesText,
  getTotpSecret,
  hasSecurityCleanupWarning,
  passwordConfirmationSchema,
  shouldRefreshTwoFactorStatusAfterClose,
  totpVerificationSchema,
} from "./account-security";

describe("Account Security navigation", () => {
  test("places Security between sign-in methods and applications", () => {
    expect(accountNavigation).toEqual([
      { label: "Profile", path: "/profile" },
      { label: "Sign-in methods", path: "/sign-in-methods" },
      { label: "Security", path: "/security" },
      { label: "Applications", path: "/applications" },
    ]);
  });
});

describe("Account Security input and setup material", () => {
  test("validates password confirmation and six-digit TOTP codes on submit", () => {
    expect(v.safeParse(passwordConfirmationSchema, { password: "" }).success).toBe(false);
    expect(v.safeParse(passwordConfirmationSchema, { password: "secret" }).success).toBe(true);
    expect(v.safeParse(totpVerificationSchema, { code: "12345" }).success).toBe(false);
    expect(v.safeParse(totpVerificationSchema, { code: "123456" }).success).toBe(true);
  });

  test("extracts only the manual TOTP secret and formats one-time Backup Codes", () => {
    expect(
      getTotpSecret(
        "otpauth://totp/Easy%20Auth:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Easy%20Auth",
      ),
    ).toBe("JBSWY3DPEHPK3PXP");
    expect(getTotpSecret("not-a-uri")).toBe("");
    expect(backupCodesText(["one", "two"])).toBe("one\ntwo");
  });

  test("refreshes authoritative Two-Factor status only after a successful dialog closes", () => {
    expect(shouldRefreshTwoFactorStatusAfterClose(true, true)).toBe(false);
    expect(shouldRefreshTwoFactorStatusAfterClose(false, false)).toBe(false);
    expect(shouldRefreshTwoFactorStatusAfterClose(false, true)).toBe(true);
  });

  test("recognizes freshness errors and security-cleanup warnings without exposing details", () => {
    expect(accountSecurityErrorCode({ body: { code: "SESSION_NOT_FRESH" } })).toBe(
      "SESSION_NOT_FRESH",
    );
    expect(hasSecurityCleanupWarning({ securityCleanupRequired: true })).toBe(true);
    expect(hasSecurityCleanupWarning({ sessionCleanupRequired: true })).toBe(false);
  });
});
