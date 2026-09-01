import { APIError } from "@better-auth/core/error";
import { createAuthMiddleware } from "@better-auth/core/api";
import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, captcha, emailOTP, jwt } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "../db/schema";
import {
  ADMIN_PLUGIN_ENDPOINT_PROHIBITED,
  isAllowedDirectAdminPluginPath,
  isDirectAdminPluginPath,
} from "./admin-policy";
import {
  createAdminSecurityPlugin,
  type SecurityActivityFailureEvent,
} from "./admin-security-plugin";
import {
  captchaProtectedAuthEndpoints,
  EMAIL_RESEND_COOLDOWN_SECONDS,
  githubAuthPolicy,
  passwordResetPolicy,
  shouldRejectPasswordlessOtpRequest,
  validateGithubIdentity,
} from "./auth-policy";
import {
  createResendEmailSender,
  deliverAuthEmail,
  scheduleBackgroundTask,
  type AuthEmailSender,
} from "./email-service";
import { hasAdministratorRole, isDirectOAuthManagementPath } from "./oauth-policy";

export interface AuthEnvironment {
  DB: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  TURNSTILE_SECRET_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_SECRET?: string;
}

export interface EasyAuthFactoryOptions {
  environment: AuthEnvironment;
  waitUntil?: (task: Promise<unknown>) => void;
  sendAuthEmail?: AuthEmailSender;
  captchaEnabled?: boolean;
  tanstackCookiesEnabled?: boolean;
  onSecurityActivityFailure?: (event: SecurityActivityFailureEvent) => void;
}

const defaultDenyAdminPlugin = () => ({
  id: "default-deny-admin-plugin",
  hooks: {
    before: [
      {
        matcher(ctx: { path?: string }) {
          return isDirectAdminPluginPath(ctx.path) && !isAllowedDirectAdminPluginPath(ctx.path);
        },
        handler: createAuthMiddleware(async () => {
          throw APIError.from("FORBIDDEN", ADMIN_PLUGIN_ENDPOINT_PROHIBITED);
        }),
      },
    ],
  },
});

const constrainOAuthManagementPlugin = () => ({
  id: "constrain-oauth-management",
  hooks: {
    before: [
      {
        matcher(ctx: { path?: string }) {
          return isDirectOAuthManagementPath(ctx.path);
        },
        handler: createAuthMiddleware(async () => {
          throw APIError.from("FORBIDDEN", {
            code: "OAUTH_MANAGEMENT_SERVER_ONLY",
            message: "Use the Easy Auth management interface",
          });
        }),
      },
    ],
  },
});

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

export function createEasyAuth({
  environment,
  waitUntil,
  sendAuthEmail,
  captchaEnabled = true,
  tanstackCookiesEnabled = true,
  onSecurityActivityFailure,
}: EasyAuthFactoryOptions) {
  const database = drizzle(environment.DB, { schema });

  return betterAuth({
    baseURL: environment.BETTER_AUTH_URL,
    secret: environment.BETTER_AUTH_SECRET,
    database: drizzleAdapter(database, {
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
        clientId: environment.GITHUB_CLIENT_ID ?? "",
        clientSecret: environment.GITHUB_CLIENT_SECRET ?? "",
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
          scheduleBackgroundTask(task, waitUntil ?? (() => {}));
        },
      },
    },
    plugins: [
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
      }),
      jwt(),
      oauthProvider({
        loginPage: "/login",
        consentPage: "/consent",
        signup: {
          page: "/signup",
        },
        scopes: ["openid", "profile", "email", "offline_access"],
        grantTypes: ["authorization_code", "refresh_token"],
        allowDynamicClientRegistration: false,
        allowUnauthenticatedClientRegistration: false,
        allowPublicClientPrelogin: true,
        clientRegistrationRequirePKCE: true,
        refreshTokenReuseInterval: 0,
        storeClientSecret: "hashed",
        prefix: {
          clientSecret: "ea_cs_",
          opaqueAccessToken: "ea_at_",
          refreshToken: "ea_rt_",
        },
        clientPrivileges: ({ user }) => hasAdministratorRole(user?.role),
      }),
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

          const sender =
            sendAuthEmail ??
            createResendEmailSender({
              apiKey: environment.RESEND_API_KEY,
              from: environment.EMAIL_FROM,
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
      ...(captchaEnabled
        ? [
            captcha({
              provider: "cloudflare-turnstile" as const,
              secretKey: environment.TURNSTILE_SECRET_KEY ?? "",
              endpoints: [...captchaProtectedAuthEndpoints],
            }),
          ]
        : []),
      createAdminSecurityPlugin(environment.DB, { onSecurityActivityFailure }),
      defaultDenyAdminPlugin(),
      constrainOAuthManagementPlugin(),
      rejectPasswordlessOtpSignInPlugin(),
      ...(tanstackCookiesEnabled ? [tanstackStartCookies()] : []),
    ],
  });
}
