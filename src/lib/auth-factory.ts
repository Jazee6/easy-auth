import { APIError } from "@better-auth/core/error";
import { createAuthMiddleware } from "@better-auth/core/api";
import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, captcha, emailOTP, jwt, lastLoginMethod, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
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
  externalIdentityAuthPolicy,
  passwordResetPolicy,
  shouldRejectPasswordlessOtpRequest,
  validateExternalIdentity,
} from "./auth-policy";
import {
  createResendEmailSender,
  deliverAuthEmail,
  scheduleBackgroundTask,
  type AuthEmailSender,
} from "./email-service";
import { hasAdministratorRole, isDirectOAuthManagementPath } from "./oauth-policy";
import {
  createTwoFactorManagementPlugin,
  type TwoFactorCleanupFailureEvent,
} from "./two-factor-management-plugin";
import { getAuthHandlerPath, getConstrainedAuthSurfaceError } from "./two-factor-policy";
import { derivePasskeyRpConfig } from "./passkey-policy";
import { createPasskeyManagementPlugin } from "./passkey-management-plugin";

export interface AuthEnvironment {
  DB: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  TURNSTILE_SECRET_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
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
  onTwoFactorCleanupFailure?: (event: TwoFactorCleanupFailureEvent) => void;
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
  onTwoFactorCleanupFailure,
}: EasyAuthFactoryOptions) {
  const database = drizzle(environment.DB, { schema });
  const rpConfig = derivePasskeyRpConfig(environment.BETTER_AUTH_URL);

  const auth = betterAuth({
    appName: "Easy Auth",
    baseURL: environment.BETTER_AUTH_URL,
    secret: environment.BETTER_AUTH_SECRET,
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
    }),
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
        strategy: "compact",
        refreshCache: false,
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: passwordResetPolicy.revokeSessions,
    },
    emailVerification: {
      autoSignInAfterVerification: true,
    },
    socialProviders: {
      google: {
        clientId: environment.GOOGLE_CLIENT_ID ?? "",
        clientSecret: environment.GOOGLE_CLIENT_SECRET ?? "",
        requireEmailVerification: externalIdentityAuthPolicy.requireEmailVerification,
        overrideUserInfoOnSignIn: externalIdentityAuthPolicy.overrideUserInfoOnSignIn,
      },
      github: {
        clientId: environment.GITHUB_CLIENT_ID ?? "",
        clientSecret: environment.GITHUB_CLIENT_SECRET ?? "",
        requireEmailVerification: externalIdentityAuthPolicy.requireEmailVerification,
        overrideUserInfoOnSignIn: externalIdentityAuthPolicy.overrideUserInfoOnSignIn,
      },
    },
    user: {
      validateUserInfo(data) {
        return validateExternalIdentity(data.user, data.source);
      },
    },
    account: {
      encryptOAuthTokens: externalIdentityAuthPolicy.encryptOAuthTokens,
      accountLinking: {
        disableImplicitLinking: externalIdentityAuthPolicy.disableImplicitLinking,
        allowDifferentEmails: externalIdentityAuthPolicy.allowDifferentEmails,
        updateUserInfoOnLink: externalIdentityAuthPolicy.updateUserInfoOnLink,
        allowUnlinkingAll: externalIdentityAuthPolicy.allowUnlinkingAll,
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
      cookiePrefix: "ea",
      database: {
        joins: true,
        generateId: "uuid",
      },
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      backgroundTasks: {
        handler(task) {
          scheduleBackgroundTask(task, waitUntil ?? (() => {}));
        },
      },
    },
    plugins: [
      lastLoginMethod({
        customResolveMethod(ctx) {
          return ctx.path?.startsWith("/two-factor/verify-") ? "email" : null;
        },
      }),
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
      }),
      jwt(),
      twoFactor({
        issuer: "Easy Auth",
        allowPasswordless: false,
        skipVerificationOnEnable: false,
        backupCodeOptions: {
          storeBackupCodes: "encrypted",
        },
      }),
      createTwoFactorManagementPlugin(environment.DB, {
        onCleanupFailure: onTwoFactorCleanupFailure,
      }),
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
      passkey({
        rpID: rpConfig.rpID,
        origin: rpConfig.origin,
        rpName: rpConfig.rpName,
        authenticatorSelection: {
          userVerification: "required",
          residentKey: "preferred",
        },
        registration: {
          requireSession: true,
          async afterVerification({ verification }) {
            if (!verification.registrationInfo?.userVerified) {
              throw APIError.from("BAD_REQUEST", {
                code: "USER_VERIFICATION_REQUIRED",
                message: "User verification is required for passkey registration",
              });
            }
          },
        },
        authentication: {
          async afterVerification({ verification }) {
            if (!verification.authenticationInfo?.userVerified) {
              throw APIError.from("UNAUTHORIZED", {
                code: "USER_VERIFICATION_REQUIRED",
                message: "User verification is required for passkey authentication",
              });
            }

            const credentialId = verification.authenticationInfo.credentialID;
            const targetUser = await environment.DB.prepare(
              `SELECT user.id, user.banned, user.ban_expires, user.email_verified
                 FROM passkey
                 INNER JOIN user ON user.id = passkey.user_id
                 WHERE passkey.credential_id = ?`,
            )
              .bind(credentialId)
              .first<{
                id: string;
                banned: number | null;
                ban_expires: number | null;
                email_verified: number;
              }>();

            if (!targetUser) {
              throw APIError.from("UNAUTHORIZED", {
                code: "PASSKEY_NOT_FOUND",
                message: "Passkey credential not found",
              });
            }

            const now = Date.now();
            const isBanned =
              targetUser.banned === 1 &&
              (targetUser.ban_expires === null || targetUser.ban_expires > now);

            if (isBanned) {
              throw APIError.from("FORBIDDEN", {
                code: "ACCOUNT_BANNED",
                message: "This account has been banned",
              });
            }

            if (targetUser.email_verified !== 1) {
              throw APIError.from("FORBIDDEN", {
                code: "EMAIL_NOT_VERIFIED",
                message: "Please verify your email address to continue.",
              });
            }
          },
        },
      }),
      createPasskeyManagementPlugin(environment.DB),
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

  return {
    ...auth,
    async handler(request: Request): Promise<Response> {
      const error = getConstrainedAuthSurfaceError(getAuthHandlerPath(request.url));
      if (error) return Response.json(error, { status: 403 });
      return auth.handler(request);
    },
  };
}
