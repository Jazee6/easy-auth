import { APIError } from "@better-auth/core/error";
import { createAuthMiddleware } from "@better-auth/core/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { captcha, emailOTP } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env, waitUntil } from "cloudflare:workers";

import { db } from "../db";
import * as schema from "../db/schema";
import { createResendEmailSender, deliverAuthEmail, scheduleBackgroundTask } from "./email-service";
import {
  captchaProtectedAuthEndpoints,
  EMAIL_RESEND_COOLDOWN_SECONDS,
  githubAuthPolicy,
  passwordResetPolicy,
  shouldRejectPasswordlessOtpRequest,
  validateGithubIdentity,
} from "./auth-policy";

type AuthEnvironment = Cloudflare.Env & {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  TURNSTILE_SECRET_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
};

const authEnvironment = env as AuthEnvironment;

const rejectPasswordlessOtpSignInPlugin = () => ({
  id: "reject-passwordless-otp-sign-in",
  hooks: {
    before: [
      {
        matcher(ctx: { path?: string; body?: { type?: string } }) {
          return shouldRejectPasswordlessOtpRequest(ctx.path, ctx.body?.type);
        },
        handler: createAuthMiddleware(async () => {
          throw APIError.from("BAD_REQUEST", {
            code: "PASSWORDLESS_OTP_DISABLED",
            message: "Passwordless OTP sign-in is not supported",
          });
        }),
      },
    ],
  },
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: passwordResetPolicy.revokeSessions,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    github: {
      clientId: authEnvironment.GITHUB_CLIENT_ID ?? "",
      clientSecret: authEnvironment.GITHUB_CLIENT_SECRET ?? "",
      requireEmailVerification: githubAuthPolicy.requireEmailVerification,
      overrideUserInfoOnSignIn: githubAuthPolicy.overrideUserInfoOnSignIn,
    },
  },
  user: {
    validateUserInfo(data) {
      return validateGithubIdentity(data.user, data.source);
    },
  },
  account: {
    encryptOAuthTokens: githubAuthPolicy.encryptOAuthTokens,
    accountLinking: {
      disableImplicitLinking: githubAuthPolicy.disableImplicitLinking,
      allowDifferentEmails: githubAuthPolicy.allowDifferentEmails,
      updateUserInfoOnLink: githubAuthPolicy.updateUserInfoOnLink,
      allowUnlinkingAll: githubAuthPolicy.allowUnlinkingAll,
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/email-otp/send-verification-otp": {
        window: EMAIL_RESEND_COOLDOWN_SECONDS,
        max: 1,
      },
      "/email-otp/request-password-reset": {
        window: EMAIL_RESEND_COOLDOWN_SECONDS,
        max: 1,
      },
    },
  },
  advanced: {
    backgroundTasks: {
      handler(task) {
        scheduleBackgroundTask(task, waitUntil);
      },
    },
  },
  plugins: [
    emailOTP({
      sendVerificationOnSignUp: true,
      storeOTP: "plain",
      expiresIn: 300,
      allowedAttempts: 3,
      resendStrategy: "rotate",
      async sendVerificationOTP(data) {
        if (data.type !== "email-verification" && data.type !== "forget-password") {
          throw new Error(`Unsupported email OTP type: ${data.type}`);
        }

        const sender = createResendEmailSender({
          apiKey: authEnvironment.RESEND_API_KEY,
          from: authEnvironment.EMAIL_FROM,
        });

        await deliverAuthEmail(
          {
            purpose: data.type === "forget-password" ? "password-reset" : "email-verification",
            to: data.email,
            otp: data.otp,
            expiresInMinutes: 5,
          },
          sender,
        );
      },
    }),
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: authEnvironment.TURNSTILE_SECRET_KEY ?? "",
      endpoints: [...captchaProtectedAuthEndpoints],
    }),
    rejectPasswordlessOtpSignInPlugin(),
    tanstackStartCookies(),
  ],
});
