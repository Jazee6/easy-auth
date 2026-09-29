// Config entry for `bun run auth:generate`. The Better Auth CLI cannot resolve
// Cloudflare bindings, so build the auth instance from placeholder values.
import { createEasyAuth } from "../src/lib/auth-factory";

export const auth = createEasyAuth({
  environment: {
    DB: {} as D1Database,
    BETTER_AUTH_URL: "http://localhost:3000",
  },
  tanstackCookiesEnabled: false,
});
