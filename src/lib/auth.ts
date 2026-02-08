import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, captcha, jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { db } from "@/db";
import { appName } from "@/lib/constants.ts";

export const auth = betterAuth({
  appName,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
  plugins: [
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: process.env.TURNSTILE_SECRET_KEY,
      endpoints: ["/sign-up/email", "/forget-password"],
    }),
    admin(),
    jwt(),
    oauthProvider({
      loginPage: "/login",
      consentPage: "/consent",
      signup: {
        page: "/signup",
      },
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
    storeSessionInDatabase: true,
  },
  disabledPaths: ["/token"],
  advanced: {
    cookiePrefix: "ea",
    database: { generateId: "uuid" },
  },
  experimental: {
    joins: true,
  },
});
