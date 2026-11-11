import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import { createEasyAuth } from "./auth-factory";
import { captchaProtectedAuthEndpoints, disabledAuthEndpoints } from "./auth-policy";
import type { AuthEmailMessage } from "./email-service";

const BASE_URL = "http://easy-auth.test";

let miniflare: Miniflare;
let database: D1Database;
let auth: ReturnType<typeof createEasyAuth>;
const sentEmails: AuthEmailMessage[] = [];
let requestCounter = 0;

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2025-09-02",
      compatibilityFlags: ["nodejs_compat"],
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: "easy-auth-surface-test" },
    }),
  );
  database = (await miniflare.getD1Database("DB")) as unknown as D1Database;

  const migrations = (await readdir("drizzle")).filter((path) => path.endsWith(".sql")).sort();
  for (const migration of migrations) {
    const statements = (await readFile(join("drizzle", migration), "utf8"))
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => database.prepare(statement));
    await database.batch(statements);
  }

  auth = createEasyAuth({
    environment: {
      DB: database,
      BETTER_AUTH_URL: BASE_URL,
      BETTER_AUTH_SECRET: "surface-integration-test-secret-32-chars",
      TURNSTILE_SECRET_KEY: "surface-integration-turnstile-secret",
      GITHUB_CLIENT_ID: "github-integration-client",
      GITHUB_CLIENT_SECRET: "github-integration-secret",
      GOOGLE_CLIENT_ID: "google-integration-client",
      GOOGLE_CLIENT_SECRET: "google-integration-secret",
    },
    sendAuthEmail: async (email) => {
      sentEmails.push(email);
    },
    captchaEnabled: true,
    tanstackCookiesEnabled: false,
  });
});

afterAll(async () => {
  await miniflare.dispose();
});

interface InventoryEndpoint {
  path?: string;
  options?: { method?: string | string[]; metadata?: { SERVER_ONLY?: boolean } };
}

function endpointInventory(): string[] {
  return Object.values(auth.api as Record<string, InventoryEndpoint>)
    .filter((endpoint) => endpoint.path && !endpoint.options?.metadata?.SERVER_ONLY)
    .flatMap((endpoint) => {
      const method = endpoint.options?.method ?? "*";
      return (Array.isArray(method) ? method : [method]).map((m) => `${m} ${endpoint.path}`);
    })
    .sort();
}

/**
 * Every HTTP-reachable Better Auth endpoint, as reviewed for Better Auth 1.7.6.
 * A dependency upgrade that adds, removes or re-exposes an endpoint fails this
 * test, so the new surface is reviewed before it ships.
 */
const reviewedEndpointInventory = [
  "GET /account-info",
  "GET /admin/get-user",
  "GET /admin/list-users",
  "GET /callback/:id",
  "GET /delete-user/callback",
  "GET /error",
  "GET /get-session",
  "GET /jwks",
  "GET /list-accounts",
  "GET /list-sessions",
  "GET /oauth2/authorize",
  "GET /oauth2/end-session",
  "GET /oauth2/get-client",
  "GET /oauth2/get-clients",
  "GET /oauth2/get-consent",
  "GET /oauth2/get-consents",
  "GET /oauth2/public-client",
  "GET /oauth2/userinfo",
  "GET /ok",
  "GET /passkey/generate-authenticate-options",
  "GET /passkey/generate-register-options",
  "GET /passkey/list-user-passkeys",
  "GET /reset-password/:token",
  "GET /token",
  "GET /verify-email",
  "POST /admin/ban-user",
  "POST /admin/create-user",
  "POST /admin/has-permission",
  "POST /admin/impersonate-user",
  "POST /admin/list-user-sessions",
  "POST /admin/remove-user",
  "POST /admin/revoke-user-session",
  "POST /admin/revoke-user-sessions",
  "POST /admin/set-role",
  "POST /admin/set-user-password",
  "POST /admin/stop-impersonating",
  "POST /admin/unban-user",
  "POST /admin/update-user",
  "POST /callback/:id",
  "POST /change-email",
  "POST /change-password",
  "POST /delete-user",
  "POST /email-otp/change-email",
  "POST /email-otp/check-verification-otp",
  "POST /email-otp/request-email-change",
  "POST /email-otp/request-password-reset",
  "POST /email-otp/reset-password",
  "POST /email-otp/send-verification-otp",
  "POST /email-otp/verify-email",
  "POST /forget-password/email-otp",
  "POST /get-access-token",
  "POST /get-session",
  "POST /link-social",
  "POST /oauth2/authorize",
  "POST /oauth2/client/rotate-secret",
  "POST /oauth2/consent",
  "POST /oauth2/continue",
  "POST /oauth2/create-client",
  "POST /oauth2/delete-client",
  "POST /oauth2/delete-consent",
  "POST /oauth2/end-session",
  "POST /oauth2/end-session/confirm",
  "POST /oauth2/introspect",
  "POST /oauth2/public-client-prelogin",
  "POST /oauth2/register",
  "POST /oauth2/revoke",
  "POST /oauth2/token",
  "POST /oauth2/update-client",
  "POST /oauth2/update-consent",
  "POST /oauth2/userinfo",
  "POST /passkey/delete-passkey",
  "POST /passkey/update-passkey",
  "POST /passkey/verify-authentication",
  "POST /passkey/verify-registration",
  "POST /refresh-token",
  "POST /request-password-reset",
  "POST /reset-password",
  "POST /revoke-other-sessions",
  "POST /revoke-session",
  "POST /revoke-sessions",
  "POST /send-verification-email",
  "POST /sign-in/email",
  "POST /sign-in/email-otp",
  "POST /sign-in/social",
  "POST /sign-out",
  "POST /sign-up/email",
  "POST /two-factor/disable",
  "POST /two-factor/enable",
  "POST /two-factor/generate-backup-codes",
  "POST /two-factor/get-totp-uri",
  "POST /two-factor/send-otp",
  "POST /two-factor/verify-backup-code",
  "POST /two-factor/verify-otp",
  "POST /two-factor/verify-totp",
  "POST /unlink-account",
  "POST /update-session",
  "POST /update-user",
  "POST /verify-password",
];

async function postWithoutCaptcha(path: string, body: unknown): Promise<Response> {
  requestCounter += 1;
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        // A distinct client per request keeps the rate limiter from masking the result.
        "cf-connecting-ip": `198.51.100.${requestCounter % 250}`,
      },
      body: JSON.stringify(body),
    }),
  );
}

async function createAccount(email: string, verified: boolean): Promise<void> {
  const result = await auth.api.signUpEmail({
    body: { name: email.split("@")[0], email, password: "surface-password" },
  });
  await database
    .prepare("UPDATE user SET email_verified = ? WHERE id = ?")
    .bind(verified ? 1 : 0, result.user.id)
    .run();
}

describe("Auth endpoint surface", () => {
  test("matches the reviewed endpoint inventory", () => {
    expect(endpointInventory()).toEqual(reviewedEndpointInventory);
  });

  test("disabled endpoints return 404 over HTTP", async () => {
    for (const path of disabledAuthEndpoints) {
      const response = await postWithoutCaptcha(path, { email: "nobody@example.com" });
      expect({ path, status: response.status }).toEqual({ path, status: 404 });
    }
  });

  test("captcha-protected endpoints reject requests without a Turnstile response", async () => {
    for (const path of captchaProtectedAuthEndpoints) {
      const response = await postWithoutCaptcha(path, {
        email: "captcha@example.com",
        type: "email-verification",
        password: "surface-password",
        name: "captcha",
      });
      expect({ path, status: response.status }).toEqual({ path, status: 400 });
    }
  });

  test("no HTTP endpoint sends email without a Turnstile response", async () => {
    await createAccount("verified@example.com", true);
    await createAccount("unverified@example.com", false);
    sentEmails.length = 0;

    const postPaths = endpointInventory()
      .filter((entry) => entry.startsWith("POST "))
      .map((entry) => entry.slice("POST ".length))
      .filter((path) => !path.includes(":"));

    const otpTypes = ["email-verification", "forget-password", "sign-in", "change-email"];
    for (const email of ["verified@example.com", "unverified@example.com"]) {
      for (const path of postPaths) {
        // Only the OTP sender branches on `type`; every other endpoint ignores it.
        const types = path === "/email-otp/send-verification-otp" ? otpTypes : ["forget-password"];
        for (const type of types) {
          await postWithoutCaptcha(path, {
            email,
            newEmail: `new-${email}`,
            type,
            name: "surface",
            password: "surface-password",
            newPassword: "surface-password-2",
            callbackURL: "/profile",
          });
        }
      }
    }

    expect(sentEmails.map((email) => `${email.purpose} ${email.to}`)).toEqual([]);
  }, 30_000);
});

describe("Profile write validation", () => {
  async function signInCookie(email: string): Promise<string> {
    const response = await postWithoutCaptcha("/sign-in/email", {
      email,
      password: "surface-password",
    });
    expect(response.status).toBe(200);
    return (response.headers.get("set-cookie") ?? "").split(";", 1)[0];
  }

  async function updateUser(cookie: string, body: unknown): Promise<Response> {
    return auth.handler(
      new Request(`${BASE_URL}/api/auth/update-user`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL, cookie },
        body: JSON.stringify(body),
      }),
    );
  }

  async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
      return undefined;
    } catch (error) {
      return (error as { body?: { code?: string } }).body?.code;
    }
  }

  async function storedProfile(email: string) {
    return database
      .prepare("SELECT name, image FROM user WHERE email = ?")
      .bind(email)
      .first<{ name: string; image: string | null }>();
  }

  test("rejects oversized names and avatars at sign-up", async () => {
    expect(
      await errorCode(
        auth.api.signUpEmail({
          body: {
            name: "x".repeat(20_000),
            email: "long-name@example.com",
            password: "surface-password",
          },
        }),
      ),
    ).toBe("INVALID_PROFILE");
    expect(
      await errorCode(
        auth.api.signUpEmail({
          body: {
            name: "avatar",
            email: "avatar-signup@example.com",
            password: "surface-password",
            image: "javascript:alert(1)",
          },
        }),
      ),
    ).toBe("INVALID_PROFILE");
    expect(await storedProfile("long-name@example.com")).toBeNull();
    expect(await storedProfile("avatar-signup@example.com")).toBeNull();
  });

  test("validates name and image on update-user", async () => {
    const email = "profile-update@example.com";
    await createAccount(email, true);
    const cookie = await signInCookie(email);

    for (const body of [
      { name: "x".repeat(20_000) },
      { name: "   " },
      { image: "http://tracker.example/pixel.gif" },
      { image: "javascript:alert(1)" },
      { image: `https://example.com/${"a".repeat(3000)}` },
      { name: `a${" ".repeat(20_000)}` },
      { image: `https://example.com/a.png${" ".repeat(20_000)}` },
    ]) {
      const response = await updateUser(cookie, body);
      expect({ body, status: response.status }).toEqual({ body, status: 400 });
    }
    expect(await storedProfile(email)).toEqual({ name: "profile-update", image: null });

    expect(
      (await updateUser(cookie, { name: "Profile", image: "https://example.com/a.png" })).status,
    ).toBe(200);
    expect(await storedProfile(email)).toEqual({
      name: "Profile",
      image: "https://example.com/a.png",
    });

    expect((await updateUser(cookie, { image: null })).status).toBe(200);
    expect(await storedProfile(email)).toEqual({ name: "Profile", image: null });
  });
});

describe("Database rate limiting", () => {
  async function requestFrom(ip: string, method: string, path: string, body?: unknown) {
    return auth.handler(
      new Request(`${BASE_URL}/api/auth${path}`, {
        method,
        headers: { "content-type": "application/json", origin: BASE_URL, "cf-connecting-ip": ip },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  }

  async function rateLimitRows(ip: string): Promise<number> {
    const row = await database
      .prepare("SELECT count(*) AS count FROM rate_limit WHERE key LIKE ?")
      .bind(`${ip}%`)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  test("skips read-only requests and keeps per-endpoint rules for writes", async () => {
    const ip = "203.0.113.77";
    for (let i = 0; i < 5; i += 1) {
      expect((await requestFrom(ip, "GET", "/get-session")).status).toBe(200);
      expect((await requestFrom(ip, "GET", "/jwks")).status).toBe(200);
    }
    expect(await rateLimitRows(ip)).toBe(0);

    const body = { email: "cooldown@example.com", type: "email-verification" };
    const first = await requestFrom(ip, "POST", "/email-otp/send-verification-otp", body);
    const second = await requestFrom(ip, "POST", "/email-otp/send-verification-otp", body);
    expect([first.status, second.status]).toEqual([400, 429]);
    expect(await rateLimitRows(ip)).toBe(1);
  });
});
