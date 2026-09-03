import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as v from "valibot";
import {
  captchaProtectedAuthEndpoints,
  composeAuthRequestHeaders,
  EMAIL_RESEND_COOLDOWN_SECONDS,
  credentialsSchema,
  deriveInitialName,
  derivePasswordResetPayload,
  deriveSignupPayload,
  deriveSignInMethodState,
  evaluateGithubLink,
  getGithubLinkOptions,
  getGithubSignInOptions,
  getInitials,
  getLoginFailureResolution,
  getPasswordConfirmationError,
  getPostLoginRedirect,
  getPasswordResetRequestSuccessMessage,
  getPostLogoutRedirect,
  getPostPasswordResetRedirect,
  getPostSignupDestination,
  getPostVerificationRedirect,
  getRouteRedirect,
  loginSchema,
  normalizeEmail,
  otpSchema,
  passwordResetCompletionSchema,
  passwordResetPolicy,
  passwordResetRequestSchema,
  profileSchema,
  shouldRejectPasswordlessOtpRequest,
  signupSchema,
  githubAuthPolicy,
  translateAuthError,
  translateGithubOauthError,
  translateProfileError,
  translateSignInMethodsError,
  validateGithubIdentity,
  verifyEmailFormSchema,
} from "./auth-policy";
import { PasswordResetEmail } from "../emails/password-reset-email";
import { VerificationEmail } from "../emails/verification-email";
import {
  createResendEmailSender,
  deliverAuthEmail,
  getAuthEmailContent,
  scheduleBackgroundTask,
  type AuthEmailMessage,
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

  describe("password reset validation and policy", () => {
    it("keeps password confirmation tolerant while the confirmation is a prefix", () => {
      expect(getPasswordConfirmationError("new-password", "")).toBeUndefined();
      expect(getPasswordConfirmationError("new-password", "new-")).toBeUndefined();
      expect(getPasswordConfirmationError("new-password", "new-password")).toBeUndefined();
      expect(getPasswordConfirmationError("new-password", "new-passw0rd")).toBe(
        "Passwords do not match",
      );
      expect(getPasswordConfirmationError("new-password", "new-password-extra")).toBe(
        "Passwords do not match",
      );
    });

    it("accepts a normalized reset request email and a complete matching reset payload", () => {
      expect(v.safeParse(passwordResetRequestSchema, { email: " User@Example.COM " }).success).toBe(
        true,
      );
      expect(
        v.safeParse(passwordResetCompletionSchema, {
          email: "user@example.com",
          otp: "123456",
          password: "new-password",
          confirmPassword: "new-password",
        }).success,
      ).toBe(true);
    });

    it("enforces Better Auth password limits and matching confirmation", () => {
      expect(
        v.safeParse(passwordResetCompletionSchema, {
          email: "user@example.com",
          otp: "123456",
          password: "short",
          confirmPassword: "short",
        }).success,
      ).toBe(false);
      expect(
        v.safeParse(passwordResetCompletionSchema, {
          email: "user@example.com",
          otp: "123456",
          password: "a".repeat(129),
          confirmPassword: "a".repeat(129),
        }).success,
      ).toBe(false);

      const mismatch = v.safeParse(passwordResetCompletionSchema, {
        email: "user@example.com",
        otp: "123456",
        password: "new-password",
        confirmPassword: "different-password",
      });
      expect(mismatch.success).toBe(false);
      if (!mismatch.success) {
        expect(mismatch.issues.some((issue) => issue.message === "Passwords do not match")).toBe(
          true,
        );
      }
    });

    it("derives the native Email OTP reset payload without confirmation state", () => {
      expect(
        derivePasswordResetPayload({
          email: " User@Example.COM ",
          otp: " 123456 ",
          password: "new-password",
        }),
      ).toEqual({
        email: "user@example.com",
        otp: "123456",
        password: "new-password",
      });
    });

    it("uses one non-enumerating success response for reset code requests", () => {
      expect(getPasswordResetRequestSuccessMessage()).toBe(
        "If an account exists for this email, a password reset code has been sent. Check your inbox before continuing.",
      );
    });

    it("uses a sixty-second cooldown for email code resends", () => {
      expect(EMAIL_RESEND_COOLDOWN_SECONDS).toBe(60);
    });

    it("revokes existing sessions and returns to login without creating a session", () => {
      expect(passwordResetPolicy).toEqual({
        revokeSessions: true,
        establishSession: false,
      });
      expect(getPostPasswordResetRedirect()).toBe("/login");
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
    it("configures exactly the public endpoints selected for captcha protection", () => {
      expect(captchaProtectedAuthEndpoints).toEqual([
        "/sign-up/email",
        "/email-otp/send-verification-otp",
        "/email-otp/request-password-reset",
      ]);
    });

    it("adds the captcha response only to protected operations", () => {
      expect(composeAuthRequestHeaders("password-signup", "test-token-123")).toEqual({
        "x-captcha-response": "test-token-123",
      });
      expect(composeAuthRequestHeaders("verification-otp-send", "test-token-123")).toEqual({
        "x-captcha-response": "test-token-123",
      });
      expect(composeAuthRequestHeaders("password-reset-request", "test-token-123")).toEqual({
        "x-captcha-response": "test-token-123",
      });
      expect(composeAuthRequestHeaders("email-verification", "test-token-123")).toEqual({});
      expect(composeAuthRequestHeaders("password-reset", "test-token-123")).toEqual({});
    });

    it("fails closed without a captcha token", () => {
      expect(composeAuthRequestHeaders("password-signup", null)).toEqual({});
      expect(composeAuthRequestHeaders("verification-otp-send", undefined)).toEqual({});
      expect(composeAuthRequestHeaders("password-reset-request", undefined)).toEqual({});
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

  describe("login failure resolution", () => {
    it("continues correct-password unverified users to the normalized verification flow", () => {
      expect(
        getLoginFailureResolution(
          { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
          " Alice+Demo@Example.COM ",
        ),
      ).toEqual({
        message: "Please verify your email address to continue.",
        destination: {
          to: "/verify-email",
          search: { email: "alice+demo@example.com" },
        },
      });
    });

    it("keeps incorrect credentials generic and does not expose a verification destination", () => {
      expect(
        getLoginFailureResolution(
          { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid credentials" },
          "unknown@example.com",
        ),
      ).toEqual({
        message: "Invalid email or password",
        destination: null,
      });
    });
  });

  describe("GitHub identity admission and OAuth feedback", () => {
    it("admits only GitHub identities with a verified email for create, sign-in, and link", () => {
      for (const action of ["create-user", "sign-in", "link-account"] as const) {
        expect(
          validateGithubIdentity(
            { email: "User@Example.com", emailVerified: true },
            { action, method: "oauth", oauth: { providerId: "github" } },
          ),
        ).toBeUndefined();
        expect(
          validateGithubIdentity(
            { email: "user@example.com", emailVerified: false },
            { action, method: "oauth", oauth: { providerId: "github" } },
          ),
        ).toEqual({
          error: "github_email_not_verified",
          errorDescription: "GitHub must provide a verified email address",
        });
      }

      expect(
        validateGithubIdentity(
          { emailVerified: false },
          { action: "create-user", method: "oauth", oauth: { providerId: "github" } },
        ),
      ).toEqual({
        error: "github_email_missing",
        errorDescription: "GitHub must provide an email address",
      });
    });

    it("does not apply GitHub admission policy to other authentication methods", () => {
      expect(
        validateGithubIdentity(
          { email: "user@example.com", emailVerified: false },
          { action: "create-user", method: "email-password" },
        ),
      ).toBeUndefined();
      expect(
        validateGithubIdentity(
          { email: "user@example.com", emailVerified: false },
          { action: "create-user", method: "oauth", oauth: { providerId: "google" } },
        ),
      ).toBeUndefined();
    });

    it("keeps linking explicit and preserves maintained profile data", () => {
      expect(githubAuthPolicy).toEqual({
        requireEmailVerification: true,
        overrideUserInfoOnSignIn: false,
        disableImplicitLinking: true,
        allowDifferentEmails: false,
        updateUserInfoOnLink: false,
        allowUnlinkingAll: false,
        encryptOAuthTokens: false,
      });
    });

    it("uses stable local destinations for GitHub sign-in", () => {
      expect(getGithubSignInOptions()).toEqual({
        provider: "github",
        callbackURL: "/profile",
        newUserCallbackURL: "/profile",
        errorCallbackURL: "/login",
      });
    });

    it("translates cancellation, unverified email, and collisions without exposing framework errors", () => {
      expect(translateGithubOauthError("access_denied")).toBe(
        "GitHub sign-in was canceled. Please try again.",
      );
      expect(translateGithubOauthError("github_email_missing")).toBe(
        "GitHub did not provide an email. Verify your primary email in GitHub and try again.",
      );
      expect(translateGithubOauthError("github_email_not_verified")).toBe(
        "Verify your primary email in GitHub before signing in.",
      );
      expect(translateGithubOauthError("account_not_linked")).toBe(
        "An account already exists with this email. Log in with an existing sign-in method, then link GitHub from Sign-in methods.",
      );
      expect(translateGithubOauthError("raw_provider_failure")).toBe(
        "Unable to sign in with GitHub. Please try again.",
      );
      expect(translateGithubOauthError(undefined)).toBeNull();
    });
  });

  describe("sign-in method policy", () => {
    it("derives password and GitHub state from Better Auth account records", () => {
      expect(
        deriveSignInMethodState([
          { id: "credential-1", providerId: "credential" },
          { id: "github-1", providerId: "github" },
        ]),
      ).toEqual({
        password: { isSet: true },
        github: { isLinked: true, accountId: "github-1", canUnlink: true, unlinkReason: null },
      });

      expect(deriveSignInMethodState([{ id: "github-1", providerId: "github" }])).toEqual({
        password: { isSet: false },
        github: {
          isLinked: true,
          accountId: "github-1",
          canUnlink: false,
          unlinkReason: "Set a password before unlinking your final sign-in method.",
        },
      });

      expect(deriveSignInMethodState([{ id: "credential-1", providerId: "credential" }])).toEqual({
        password: { isSet: true },
        github: { isLinked: false, accountId: null, canUnlink: false, unlinkReason: null },
      });
    });

    it("requires an unused, verified, same-email GitHub identity for explicit linking", () => {
      const base = {
        userId: "user-1",
        loginEmail: " User@Example.com ",
        providerEmail: "user@example.COM",
        providerEmailVerified: true,
        githubIdentityCount: 0,
        identityOwnerUserId: null,
      };

      expect(evaluateGithubLink(base)).toEqual({ allowed: true });
      expect(evaluateGithubLink({ ...base, providerEmailVerified: false })).toEqual({
        allowed: false,
        code: "github_email_not_verified",
      });
      expect(evaluateGithubLink({ ...base, providerEmail: "other@example.com" })).toEqual({
        allowed: false,
        code: "email_does_not_match",
      });
      expect(evaluateGithubLink({ ...base, githubIdentityCount: 1 })).toEqual({
        allowed: false,
        code: "github_already_linked",
      });
      expect(evaluateGithubLink({ ...base, identityOwnerUserId: "user-2" })).toEqual({
        allowed: false,
        code: "identity_owned_by_another_user",
      });
    });

    it("uses authenticated local destinations for explicit GitHub linking", () => {
      expect(getGithubLinkOptions()).toEqual({
        provider: "github",
        callbackURL: "/sign-in-methods?status=github-linked",
        errorCallbackURL: "/sign-in-methods",
      });
    });

    it("maps link and unlink errors to stable feedback", () => {
      expect(translateSignInMethodsError("email_does_not_match")).toBe(
        "The verified GitHub email must match your login email.",
      );
      expect(translateSignInMethodsError("account_already_linked_to_different_user")).toBe(
        "This GitHub identity is already linked to another account.",
      );
      expect(translateSignInMethodsError("unable_to_link_account")).toBe(
        "A GitHub identity is already linked, or the link could not be completed.",
      );
      expect(translateSignInMethodsError("FAILED_TO_UNLINK_LAST_ACCOUNT")).toBe(
        "Set a password before unlinking your final sign-in method.",
      );
      expect(translateSignInMethodsError("provider_raw_error")).toBe(
        "Unable to update sign-in methods. Please try again.",
      );
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
        "Unable to create account with provided details",
      );
      expect(translateAuthError("EMAIL_CANNOT_BE_USED", "signup")).toBe(
        "Unable to create account with provided details",
      );
      expect(translateAuthError(new Error("Database error"), "signup")).toBe(
        "Unable to create account with provided details",
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
      expect(translateAuthError("INVALID_OTP", "reset-password")).toBe(
        "Invalid verification code. Please check and try again.",
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

    it("keeps password reset request and completion failures application-owned", () => {
      expect(translateAuthError("USER_NOT_FOUND", "request-password-reset")).toBe(
        "Unable to send a reset code. Please try again.",
      );
      expect(translateAuthError("PASSWORD_TOO_SHORT", "reset-password")).toBe(
        "Unable to reset password. Please check your details and try again.",
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
      expect(getRouteRedirect({ pathname: "/forgot-password", hasSession: false })).toBeNull();
      expect(getRouteRedirect({ pathname: "/forgot-password", hasSession: true })).toBeNull();
    });

    it("redirects protected user-panel routes to /login for unauthenticated visitors", () => {
      expect(getRouteRedirect({ pathname: "/profile", hasSession: true })).toBeNull();
      expect(getRouteRedirect({ pathname: "/profile", hasSession: false })).toBe("/login");
      expect(getRouteRedirect({ pathname: "/sign-in-methods", hasSession: true })).toBeNull();
      expect(getRouteRedirect({ pathname: "/sign-in-methods", hasSession: false })).toBe("/login");
      expect(getRouteRedirect({ pathname: "/account-security", hasSession: true })).toBeNull();
      expect(getRouteRedirect({ pathname: "/account-security", hasSession: false })).toBe("/login");
    });

    it("returns expected post-action redirect paths", () => {
      expect(getPostLoginRedirect()).toBe("/profile");
      expect(getPostSignupDestination("Alice+Demo@example.com")).toEqual({
        to: "/verify-email",
        search: { email: "alice+demo@example.com" },
      });
      expect(getPostVerificationRedirect()).toBe("/profile");
      expect(getPostPasswordResetRedirect()).toBe("/login");
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

    it("renders the password reset OTP, validity, and unsolicited-request warning", () => {
      const html = renderToStaticMarkup(PasswordResetEmail({ otp: "246810", expiresInMinutes: 5 }));

      expect(html).toContain("246810");
      expect(html).toContain("valid for 5 minutes");
      expect(html).toContain("If you did not request a password reset");
    });

    it("selects separate verification and password reset templates", () => {
      const verification = getAuthEmailContent({
        purpose: "email-verification",
        to: "user@example.com",
        otp: "123456",
      });
      const passwordReset = getAuthEmailContent({
        purpose: "password-reset",
        to: "user@example.com",
        otp: "654321",
      });

      expect(verification.subject).toBe("Your Easy Auth verification code");
      expect(verification.react.type).toBe(VerificationEmail);
      expect(passwordReset.subject).toBe("Your Easy Auth password reset code");
      expect(passwordReset.react.type).toBe(PasswordResetEmail);
    });

    it("delivers through an injected deterministic sender", async () => {
      const sentMessages: AuthEmailMessage[] = [];
      const message: AuthEmailMessage = {
        purpose: "password-reset",
        to: "user@example.com",
        otp: "654321",
        expiresInMinutes: 5,
      };

      await deliverAuthEmail(message, async (sentMessage) => {
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
