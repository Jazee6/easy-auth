import { APIError } from "@better-auth/core/error";
import { createAuthMiddleware } from "@better-auth/core/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { captcha, emailOTP } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env, waitUntil } from "cloudflare:workers";

import { db } from "../db";
import * as schema from "../db/schema";
import {
  createResendEmailSender,
  deliverVerificationEmail,
  scheduleBackgroundTask,
} from "./email-service";
import { shouldRejectPasswordlessOtpRequest } from "./auth-policy";

type AuthEnvironment = Cloudflare.Env & {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  TURNSTILE_SECRET_KEY?: string;
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
  },
  emailVerification: {
    autoSignInAfterVerification: true,
  },
  rateLimit: {
    storage: "database",
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
        if (data.type !== "email-verification") {
          throw new Error(`Unsupported email OTP type: ${data.type}`);
        }

        const sender = createResendEmailSender({
          apiKey: authEnvironment.RESEND_API_KEY,
          from: authEnvironment.EMAIL_FROM,
        });

        await deliverVerificationEmail(
          {
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
      endpoints: ["/sign-up/email", "/email-otp/send-verification-otp"],
    }),
    rejectPasswordlessOtpSignInPlugin(),
    tanstackStartCookies(),
  ],
});
