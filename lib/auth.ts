import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, captcha, jwt } from "better-auth/plugins";
import { db } from "@/lib/db";
import { oauthProvider } from "@better-auth/oauth-provider";

export const auth = betterAuth({
  appName: "Easy Auth",
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  plugins: [
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: process.env.TURNSTILE_SECRET_KEY as string,
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
  advanced: {
    cookiePrefix: "ea",
    database: { generateId: "uuid" },
  },
  experimental: {
    joins: true,
  },
});
