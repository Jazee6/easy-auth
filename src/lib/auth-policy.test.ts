import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as v from "valibot";
import {
  composeAuthRequestHeaders,
  credentialsSchema,
  deriveInitialName,
  deriveSignupPayload,
  getInitials,
  getPostLoginRedirect,
  getPostLogoutRedirect,
  getPostSignupDestination,
  getPostVerificationRedirect,
  getRouteRedirect,
  loginSchema,
  normalizeEmail,
  otpSchema,
  profileSchema,
  shouldRejectPasswordlessOtpRequest,
  signupSchema,
  translateAuthError,
  translateProfileError,
  verifyEmailFormSchema,
} from "./auth-policy";
import { VerificationEmail } from "../emails/verification-email";
import {
  createResendEmailSender,
  deliverVerificationEmail,
  scheduleBackgroundTask,
  type VerificationEmailMessage,
} from "./email-service";

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

  describe("OTP schema and verification form validation", () => {
    it("validates valid 6-digit numeric OTP", () => {
      expect(v.safeParse(otpSchema, "123456").success).toBe(true);
      expect(v.safeParse(otpSchema, "000000").success).toBe(true);
      expect(v.safeParse(otpSchema, "999999").success).toBe(true);
    });

    it("rejects non-numeric, short, or long OTP codes", () => {
      expect(v.safeParse(otpSchema, "12345").success).toBe(false);
      expect(v.safeParse(otpSchema, "1234567").success).toBe(false);
      expect(v.safeParse(otpSchema, "abcdef").success).toBe(false);
      expect(v.safeParse(otpSchema, "123 56").success).toBe(false);
    });

    it("validates verifyEmailFormSchema with valid email and OTP", () => {
      const result = v.safeParse(verifyEmailFormSchema, {
        email: "user@example.com",
        otp: "654321",
      });
      expect(result.success).toBe(true);
    });

    it("rejects verifyEmailFormSchema with invalid email or invalid OTP", () => {
      const badEmail = v.safeParse(verifyEmailFormSchema, {
        email: "invalid-email",
        otp: "654321",
      });
      expect(badEmail.success).toBe(false);

      const badOtp = v.safeParse(verifyEmailFormSchema, {
        email: "user@example.com",
        otp: "123",
      });
      expect(badOtp.success).toBe(false);
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
    it("shares identical credentials schema between login and signup", () => {
      expect(loginSchema).toBe(credentialsSchema);
      expect(signupSchema).toBe(credentialsSchema);
    });

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

  describe("captcha request composition", () => {
    it("adds the captcha response only to protected operations", () => {
      expect(composeAuthRequestHeaders("password-signup", "test-token-123")).toEqual({
        "x-captcha-response": "test-token-123",
      });
      expect(composeAuthRequestHeaders("verification-otp-send", "test-token-123")).toEqual({
        "x-captcha-response": "test-token-123",
      });
      expect(composeAuthRequestHeaders("email-verification", "test-token-123")).toEqual({});
    });

    it("fails closed without a captcha token", () => {
      expect(composeAuthRequestHeaders("password-signup", null)).toEqual({});
      expect(composeAuthRequestHeaders("verification-otp-send", undefined)).toEqual({});
    });
  });

  describe("product policy: passwordless OTP sign-in rejection", () => {
    it("rejects both passwordless OTP issuance and sign-in API paths", () => {
      expect(
        shouldRejectPasswordlessOtpRequest("/email-otp/send-verification-otp", "sign-in"),
      ).toBe(true);
      expect(shouldRejectPasswordlessOtpRequest("/sign-in/email-otp")).toBe(true);
    });

    it("allows product-supported email verification OTP operations", () => {
      expect(
        shouldRejectPasswordlessOtpRequest(
          "/email-otp/send-verification-otp",
          "email-verification",
        ),
      ).toBe(false);
      expect(shouldRejectPasswordlessOtpRequest("/email-otp/verify-email")).toBe(false);
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

    it("translates unverified email outcome to actionable verification guidance", () => {
      expect(translateAuthError("EMAIL_NOT_VERIFIED", "login")).toBe(
        "Please verify your email address to continue.",
      );
    });

    it("translates OTP error codes to stable user-facing messages", () => {
      expect(translateAuthError("INVALID_OTP", "verify-email")).toBe(
        "Invalid verification code. Please check and try again.",
      );
      expect(translateAuthError("OTP_EXPIRED", "verify-email")).toBe(
        "Verification code has expired. Please request a new code.",
      );
      expect(translateAuthError("TOO_MANY_ATTEMPTS", "verify-email")).toBe(
        "Too many invalid attempts. Please request a new code.",
      );
      expect(translateAuthError("TOO_MANY_REQUESTS", "resend-otp")).toBe(
        "Too many requests. Please wait a moment before trying again.",
      );
      expect(translateAuthError("RATE_LIMITED", "resend-otp")).toBe(
        "Too many requests. Please wait a moment before trying again.",
      );
    });

    it("translates Captcha errors to security verification failure message", () => {
      expect(translateAuthError("CAPTCHA_VERIFICATION_FAILED", "signup")).toBe(
        "Security verification failed. Please try again.",
      );
      expect(translateAuthError("VERIFICATION_FAILED", "signup")).toBe(
        "Security verification failed. Please try again.",
      );
      expect(translateAuthError("MISSING_RESPONSE", "signup")).toBe(
        "Security verification failed. Please try again.",
      );
      expect(translateAuthError("UNKNOWN_ERROR", "signup")).toBe(
        "Security verification failed. Please try again.",
      );
      expect(translateAuthError("SERVICE_UNAVAILABLE", "signup")).toBe(
        "Security verification failed. Please try again.",
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

    it("redirects login, signup, and verify-email to /profile for authenticated users, but allows unauthenticated visitors", () => {
      expect(getRouteRedirect({ pathname: "/login", hasSession: true })).toBe("/profile");
      expect(getRouteRedirect({ pathname: "/login", hasSession: false })).toBeNull();

      expect(getRouteRedirect({ pathname: "/signup", hasSession: true })).toBe("/profile");
      expect(getRouteRedirect({ pathname: "/signup", hasSession: false })).toBeNull();

      expect(getRouteRedirect({ pathname: "/verify-email", hasSession: true })).toBe("/profile");
      expect(getRouteRedirect({ pathname: "/verify-email", hasSession: false })).toBeNull();
    });

    it("redirects protected /profile to /login for unauthenticated visitors, but allows authenticated users", () => {
      expect(getRouteRedirect({ pathname: "/profile", hasSession: true })).toBeNull();
      expect(getRouteRedirect({ pathname: "/profile", hasSession: false })).toBe("/login");
    });

    it("returns expected post-action redirect paths", () => {
      expect(getPostLoginRedirect()).toBe("/profile");
      expect(getPostSignupDestination("Alice+Demo@example.com")).toEqual({
        to: "/verify-email",
        search: { email: "alice+demo@example.com" },
      });
      expect(getPostVerificationRedirect()).toBe("/profile");
      expect(getPostLogoutRedirect()).toBe("/login");
    });
  });

  describe("email template and sender service seam", () => {
    it("renders the OTP, five-minute validity, and unsolicited-request warning", () => {
      const html = renderToStaticMarkup(VerificationEmail({ otp: "123456", expiresInMinutes: 5 }));

      expect(html).toContain("123456");
      expect(html).toContain("valid for 5 minutes");
      expect(html).toContain("If you did not request this verification code");
    });

    it("delivers through an injected deterministic sender", async () => {
      const sentMessages: VerificationEmailMessage[] = [];
      const message = {
        to: "user@example.com",
        otp: "654321",
        expiresInMinutes: 5,
      };

      await deliverVerificationEmail(message, async (sentMessage) => {
        sentMessages.push(sentMessage);
      });

      expect(sentMessages).toEqual([message]);
    });

    it("requires both Resend bindings", () => {
      expect(() => createResendEmailSender({})).toThrow(
        "RESEND_API_KEY and EMAIL_FROM must be configured",
      );
      expect(() => createResendEmailSender({ apiKey: "re_test" })).toThrow(
        "RESEND_API_KEY and EMAIL_FROM must be configured",
      );
    });

    it("catches sender failures inside the scheduled background task", async () => {
      const deliveryError = new Error("Resend network error");
      const loggedErrors: unknown[] = [];
      let scheduledTask: Promise<unknown> | undefined;

      scheduleBackgroundTask(
        Promise.reject(deliveryError),
        (task) => {
          scheduledTask = task;
        },
        (error) => {
          loggedErrors.push(error);
        },
      );

      expect(scheduledTask).toBeDefined();
      await scheduledTask;
      expect(loggedErrors).toEqual([deliveryError]);
    });
  });
});
