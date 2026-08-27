import { describe, expect, it } from "bun:test";
import {
  deriveInitialName,
  deriveSignupPayload,
  getInitials,
  getPostLoginRedirect,
  getPostLogoutRedirect,
  getPostSignupRedirect,
  getRouteRedirect,
  loginSchema,
  normalizeEmail,
  profileSchema,
  signupSchema,
  translateAuthError,
  translateProfileError,
} from "./auth-policy";
import * as v from "valibot";

describe("auth-policy", () => {
  describe("email normalization and initial name derivation", () => {
    it("normalizes uppercase and surrounding whitespace in email addresses", () => {
      expect(normalizeEmail(" Alice+demo@example.com ")).toBe("alice+demo@example.com");
      expect(normalizeEmail("USER.NAME+tag@Sub.Domain.COM")).toBe("user.name+tag@sub.domain.com");
    });

    it("derives the framework-required initial name from the local part before @, preserving plus tags and punctuation", () => {
      expect(deriveInitialName("alice+demo@example.com")).toBe("alice+demo");
      expect(deriveInitialName("User.Name+Tag@Example.COM")).toBe("user.name+tag");
      expect(deriveInitialName("john_doe-123@domain.org")).toBe("john_doe-123");
    });

    it("derives complete signup payload with normalized email and derived name", () => {
      const payload = deriveSignupPayload({
        email: " Alice+demo@Example.COM ",
        password: "securePassword123!",
      });

      expect(payload).toEqual({
        email: "alice+demo@example.com",
        password: "securePassword123!",
        name: "alice+demo",
      });
    });
  });

  describe("initials derivation for avatar fallback", () => {
    it("derives uppercase initials from multi-word names", () => {
      expect(getInitials("Alice Smith")).toBe("AS");
      expect(getInitials("John Robert Doe")).toBe("JR");
    });

    it("derives uppercase initials from single-word or local-part names", () => {
      expect(getInitials("alice+demo")).toBe("A");
      expect(getInitials("bob")).toBe("B");
    });

    it("handles empty or whitespace-only names gracefully", () => {
      expect(getInitials("")).toBe("U");
      expect(getInitials("   ")).toBe("U");
    });
  });

  describe("login and signup validation schemas", () => {
    it("validates correct login credentials", () => {
      const valid = v.safeParse(loginSchema, {
        email: "user@example.com",
        password: "password123",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects malformed or empty email in login", () => {
      const emptyEmail = v.safeParse(loginSchema, {
        email: "",
        password: "password123",
      });
      expect(emptyEmail.success).toBe(false);

      const invalidEmail = v.safeParse(loginSchema, {
        email: "not-an-email",
        password: "password123",
      });
      expect(invalidEmail.success).toBe(false);
    });

    it("rejects password shorter than Better Auth default 8 characters in login", () => {
      const shortPassword = v.safeParse(loginSchema, {
        email: "user@example.com",
        password: "1234567",
      });
      expect(shortPassword.success).toBe(false);
    });

    it("rejects password longer than Better Auth default 128 characters in login", () => {
      const longPassword = v.safeParse(loginSchema, {
        email: "user@example.com",
        password: "a".repeat(129),
      });
      expect(longPassword.success).toBe(false);
    });

    it("validates signup payload requiring only email and password with Better Auth defaults", () => {
      const valid = v.safeParse(signupSchema, {
        email: "newuser@example.com",
        password: "password123",
      });
      expect(valid.success).toBe(true);

      const invalid = v.safeParse(signupSchema, {
        email: "invalid-email",
        password: "short",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("profile validation schema", () => {
    it("accepts valid profile with required name and empty avatar", () => {
      const result = v.safeParse(profileSchema, {
        name: "Alice Doe",
        image: "",
      });
      expect(result.success).toBe(true);

      const resultUndefined = v.safeParse(profileSchema, {
        name: "Alice Doe",
      });
      expect(resultUndefined.success).toBe(true);
    });

    it("accepts valid profile with required name and valid HTTPS avatar URL", () => {
      const result = v.safeParse(profileSchema, {
        name: "Alice Doe",
        image: "https://example.com/avatar.jpg",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty or whitespace-only name", () => {
      const result = v.safeParse(profileSchema, {
        name: "   ",
        image: "https://example.com/avatar.jpg",
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-HTTPS or invalid avatar URLs", () => {
      const httpResult = v.safeParse(profileSchema, {
        name: "Alice Doe",
        image: "http://example.com/avatar.jpg",
      });
      expect(httpResult.success).toBe(false);

      const malformedResult = v.safeParse(profileSchema, {
        name: "Alice Doe",
        image: "not-a-valid-url",
      });
      expect(malformedResult.success).toBe(false);

      const scriptResult = v.safeParse(profileSchema, {
        name: "Alice Doe",
        image: "javascript:alert(1)",
      });
      expect(scriptResult.success).toBe(false);
    });
  });

  describe("error translation", () => {
    it("maps authentication failure to generic error message without disclosing user existence", () => {
      expect(translateAuthError("INVALID_EMAIL_OR_PASSWORD", "login")).toBe(
        "Invalid email or password",
      );
      expect(translateAuthError("USER_NOT_FOUND", "login")).toBe("Invalid email or password");
      expect(translateAuthError("INVALID_PASSWORD", "login")).toBe("Invalid email or password");
      expect(translateAuthError(new Error("Generic error"), "login")).toBe(
        "Invalid email or password",
      );
    });

    it("maps duplicate registration or signup failure to generic error message", () => {
      expect(translateAuthError("USER_ALREADY_EXISTS", "signup")).toBe(
        "Unable to create user with provided details",
      );
      expect(translateAuthError("EMAIL_CANNOT_BE_USED", "signup")).toBe(
        "Unable to create user with provided details",
      );
      expect(translateAuthError(new Error("Database error"), "signup")).toBe(
        "Unable to create user with provided details",
      );
    });

    it("maps profile update errors to a stable generic error message", () => {
      expect(translateProfileError(new Error("Database connection lost"))).toBe(
        "Failed to update profile. Please try again.",
      );
      expect(translateProfileError("UNKNOWN")).toBe("Failed to update profile. Please try again.");
    });
  });

  describe("route redirect decisions", () => {
    it("redirects root (/) to /profile for authenticated users and /login for unauthenticated visitors", () => {
      expect(getRouteRedirect({ pathname: "/", hasSession: true })).toBe("/profile");
      expect(getRouteRedirect({ pathname: "/", hasSession: false })).toBe("/login");
    });

    it("redirects login and signup to /profile for authenticated users, but allows unauthenticated visitors", () => {
      expect(getRouteRedirect({ pathname: "/login", hasSession: true })).toBe("/profile");
      expect(getRouteRedirect({ pathname: "/login", hasSession: false })).toBeNull();

      expect(getRouteRedirect({ pathname: "/signup", hasSession: true })).toBe("/profile");
      expect(getRouteRedirect({ pathname: "/signup", hasSession: false })).toBeNull();
    });

    it("redirects protected /profile to /login for unauthenticated visitors, but allows authenticated users", () => {
      expect(getRouteRedirect({ pathname: "/profile", hasSession: true })).toBeNull();
      expect(getRouteRedirect({ pathname: "/profile", hasSession: false })).toBe("/login");
    });

    it("returns expected post-action redirect paths", () => {
      expect(getPostLoginRedirect()).toBe("/profile");
      expect(getPostSignupRedirect()).toBe("/profile");
      expect(getPostLogoutRedirect()).toBe("/login");
    });
  });
});
