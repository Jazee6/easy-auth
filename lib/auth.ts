import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, captcha, oidcProvider } from "better-auth/plugins";
import { db } from "@/lib/db";

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
    oidcProvider({
      loginPage: "/login",
      consentPage: "/consent",
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL as string],
  advanced: {
    cookiePrefix: "ea",
  },
});
