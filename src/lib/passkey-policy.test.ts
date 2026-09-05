import { describe, expect, it } from "bun:test";
import * as v from "valibot";

import {
  derivePasskeyRpConfig,
  isPasskeyCancellation,
  passkeyNameSchema,
  renamePasskeySchema,
  sanitizeReturnDestination,
  translatePasskeyError,
} from "./passkey-policy";
import { deriveSignInMethodState } from "./auth-policy";

describe("passkey-policy", () => {
  describe("derivePasskeyRpConfig", () => {
    it("derives rpID and origin from BETTER_AUTH_URL", () => {
      const config = derivePasskeyRpConfig("https://auth.example.com:8443/api/auth");
      expect(config).toEqual({
        rpID: "auth.example.com",
        origin: "https://auth.example.com:8443",
        rpName: "Easy Auth",
      });
    });

    it("uses documented local default when BETTER_AUTH_URL is absent", () => {
      expect(derivePasskeyRpConfig()).toEqual({
        rpID: "localhost",
        origin: "http://localhost:3000",
        rpName: "Easy Auth",
      });
      expect(derivePasskeyRpConfig("")).toEqual({
        rpID: "localhost",
        origin: "http://localhost:3000",
        rpName: "Easy Auth",
      });
    });

    it("rejects malformed configured URLs instead of falling back to localhost", () => {
      expect(() => derivePasskeyRpConfig("not-a-valid-url")).toThrow(/Invalid BETTER_AUTH_URL/);
      expect(() => derivePasskeyRpConfig("ftp://example.com")).toThrow(/Invalid BETTER_AUTH_URL/);
    });
  });

  describe("validation schemas", () => {
    it("validates optional passkey name on creation", () => {
      expect(v.parse(passkeyNameSchema, "")).toBe("");
      expect(v.parse(passkeyNameSchema, "  My MacBook  ")).toBe("My MacBook");
      expect(() => v.parse(passkeyNameSchema, "a".repeat(65))).toThrow();
    });

    it("requires trimmed non-empty name on rename", () => {
      expect(v.parse(renamePasskeySchema, "  Work YubiKey  ")).toBe("Work YubiKey");
      expect(() => v.parse(renamePasskeySchema, "")).toThrow();
      expect(() => v.parse(renamePasskeySchema, "   ")).toThrow();
      expect(() => v.parse(renamePasskeySchema, "a".repeat(65))).toThrow();
    });
  });

  describe("isPasskeyCancellation", () => {
    it("recognizes exact client cancellation codes and DOMExceptions", () => {
      expect(isPasskeyCancellation({ code: "AUTH_CANCELLED" })).toBe(true);
      expect(isPasskeyCancellation({ code: "REGISTRATION_CANCELLED" })).toBe(true);
      expect(isPasskeyCancellation({ code: "ERROR_CEREMONY_ABORTED" })).toBe(true);
      expect(
        isPasskeyCancellation({
          code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
          cause: { name: "NotAllowedError" },
        }),
      ).toBe(true);
      expect(
        isPasskeyCancellation({
          code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
          cause: { name: "AbortError" },
        }),
      ).toBe(true);
      expect(isPasskeyCancellation({ name: "NotAllowedError" })).toBe(true);
      expect(isPasskeyCancellation({ name: "AbortError" })).toBe(true);
    });

    it("does not treat server authorization or substantive errors as cancellation", () => {
      expect(
        isPasskeyCancellation({
          code: "YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY",
          message: "You are not allowed to register this passkey",
        }),
      ).toBe(false);
      expect(
        isPasskeyCancellation({
          message: "You are not allowed to register this passkey",
        }),
      ).toBe(false);
      expect(isPasskeyCancellation({ code: "USER_VERIFICATION_REQUIRED" })).toBe(false);
      expect(isPasskeyCancellation({ code: "PASSKEY_NOT_FOUND" })).toBe(false);
      expect(isPasskeyCancellation({ code: "ACCOUNT_BANNED" })).toBe(false);
      expect(isPasskeyCancellation({ code: "SESSION_NOT_FRESH" })).toBe(false);
      expect(isPasskeyCancellation(null)).toBe(false);
      expect(isPasskeyCancellation(new Error("Network connection lost"))).toBe(false);
    });
  });

  describe("translatePasskeyError", () => {
    it("translates known security and lifecycle errors", () => {
      expect(translatePasskeyError({ code: "SESSION_NOT_FRESH" })).toBe(
        "Recent sign-in required. Please sign in again to continue.",
      );
      expect(translatePasskeyError({ code: "CANNOT_DELETE_LAST_METHOD" })).toBe(
        "You cannot remove your final sign-in method.",
      );
      expect(translatePasskeyError({ code: "USER_VERIFICATION_REQUIRED" })).toBe(
        "Device verification (PIN or biometrics) is required.",
      );
      expect(translatePasskeyError({ code: "ACCOUNT_BANNED" })).toBe(
        "This account has been banned.",
      );
      expect(translatePasskeyError({ code: "EMAIL_NOT_VERIFIED" })).toBe(
        "Please verify your email address to continue.",
      );
      expect(translatePasskeyError({ code: "PREVIOUSLY_REGISTERED" })).toBe(
        "This passkey has already been registered.",
      );
    });

    it("falls back gracefully for unknown or empty errors", () => {
      expect(translatePasskeyError(null)).toBe("Passkey operation failed. Please try again.");
      expect(translatePasskeyError("Custom error message")).toBe("Custom error message");
    });
  });

  describe("sanitizeReturnDestination", () => {
    it("constrains to /sign-in-methods or fallback /profile", () => {
      expect(sanitizeReturnDestination("/sign-in-methods")).toBe("/sign-in-methods");
      expect(sanitizeReturnDestination("/profile")).toBe("/profile");
      // Arbitrary internal routes fall back to /profile
      expect(sanitizeReturnDestination("/security")).toBe("/profile");
      expect(sanitizeReturnDestination("/applications")).toBe("/profile");
      expect(sanitizeReturnDestination("/admin")).toBe("/profile");
      // External, protocol-relative, backslash, and encoded paths fall back to /profile
      expect(sanitizeReturnDestination("https://evil.com")).toBe("/profile");
      expect(sanitizeReturnDestination("//evil.com")).toBe("/profile");
      expect(sanitizeReturnDestination("\\evil.com")).toBe("/profile");
      expect(sanitizeReturnDestination("/sign-in-methods%2f..")).toBe("/profile");
      expect(sanitizeReturnDestination("/%2e%2e/sign-in-methods")).toBe("/profile");
      expect(sanitizeReturnDestination(null)).toBe("/profile");
      expect(sanitizeReturnDestination(undefined)).toBe("/profile");
      expect(sanitizeReturnDestination("")).toBe("/profile");
    });

    it("rejects whitespace and control characters instead of normalizing a destination", () => {
      expect(sanitizeReturnDestination(" /sign-in-methods")).toBe("/profile");
      expect(sanitizeReturnDestination("/sign-in-methods\n")).toBe("/profile");
      expect(sanitizeReturnDestination("/sign-in-methods\u0000")).toBe("/profile");
    });
  });

  describe("deriveSignInMethodState with passkeys", () => {
    it("allows unlinking GitHub when passkey is present without password", () => {
      const state = deriveSignInMethodState(
        [{ id: "gh-1", providerId: "github" }],
        [{ id: "pk-1", name: "Key 1" }],
      );
      expect(state.github.canUnlink).toBe(true);
      expect(state.github.unlinkReason).toBeNull();
      expect(state.password.isSet).toBe(false);
      // Can delete this passkey because GitHub is still linked
      expect(state.passkey?.canDelete("pk-1")).toBe(true);
    });

    it("allows deleting a passkey when multiple passkeys exist", () => {
      const state = deriveSignInMethodState(
        [],
        [
          { id: "pk-1", name: "Key 1" },
          { id: "pk-2", name: "Key 2" },
        ],
      );
      expect(state.passkey?.canDelete("pk-1")).toBe(true);
      expect(state.passkey?.canDelete("pk-2")).toBe(true);
    });

    it("allows deleting a passkey when password or GitHub exists", () => {
      const withPassword = deriveSignInMethodState(
        [{ id: "cred-1", providerId: "credential" }],
        [{ id: "pk-1", name: "Key 1" }],
      );
      expect(withPassword.passkey?.canDelete("pk-1")).toBe(true);

      const withGithub = deriveSignInMethodState(
        [{ id: "gh-1", providerId: "github" }],
        [{ id: "pk-1", name: "Key 1" }],
      );
      expect(withGithub.passkey?.canDelete("pk-1")).toBe(true);
    });

    it("forbids deleting the only passkey when no other login methods exist", () => {
      const state = deriveSignInMethodState([], [{ id: "pk-1", name: "Key 1" }]);
      expect(state.passkey?.canDelete("pk-1")).toBe(false);
    });
  });
});
