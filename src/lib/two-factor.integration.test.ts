import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import { createEasyAuth } from "./auth-factory";

const BASE_URL = "http://easy-auth-two-factor.test";

let miniflare: Miniflare;
let database: D1Database;
let auth: ReturnType<typeof createEasyAuth>;

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2025-09-02",
      compatibilityFlags: ["nodejs_compat"],
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: "two-factor-foundation-test" },
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
      BETTER_AUTH_SECRET: "two-factor-foundation-secret-32-characters",
    },
    sendAuthEmail: async () => {},
    captchaEnabled: false,
    tanstackCookiesEnabled: false,
  });
});

afterAll(async () => {
  await miniflare.dispose();
});

async function requestAuth(path: string, method: "GET" | "POST" = "POST"): Promise<Response> {
  const request =
    method === "POST"
      ? new Request(`${BASE_URL}/api/auth${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: BASE_URL },
          body: "{}",
        })
      : new Request(`${BASE_URL}/api/auth${path}`);
  return auth.handler(request);
}

describe("Two-Factor schema and product HTTP boundary", () => {
  test("applies a disabled default to pre-0.5.0-style User inserts", async () => {
    const now = Date.now();
    await database
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind("pre-050-user", "Existing Account", "existing-050@example.com", now, now)
      .run();

    const row = await database
      .prepare("SELECT two_factor_enabled FROM user WHERE id = ?")
      .bind("pre-050-user")
      .first<{ two_factor_enabled: number | null }>();

    expect(row?.two_factor_enabled).toBe(0);
  });

  test("lets selected Two-Factor endpoints reach maintained authorization and validation", async () => {
    for (const path of [
      "/two-factor/enable",
      "/two-factor/disable",
      "/two-factor/verify-totp",
      "/two-factor/verify-backup-code",
      "/two-factor/generate-backup-codes",
    ]) {
      const response = await requestAuth(path);
      const payload = (await response.json()) as { code?: string };
      expect(payload.code === "TWO_FACTOR_ENDPOINT_PROHIBITED").toBe(false);
      expect(response.status === 404).toBe(false);
    }
  });

  test("rejects every unselected Two-Factor endpoint with one stable safe error", async () => {
    for (const path of [
      "/two-factor/send-otp",
      "/two-factor/verify-otp",
      "/two-factor/get-totp-uri",
      "/two-factor/view-backup-codes",
      "/two-factor/future-capability",
    ]) {
      const response = await requestAuth(path);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        code: "TWO_FACTOR_ENDPOINT_PROHIBITED",
        message: "This Two-Factor operation is not supported",
      });
    }
  });

  test("rejects native token-bearing Session endpoints before authentication", async () => {
    for (const { path, method } of [
      { path: "/list-sessions", method: "GET" as const },
      { path: "/revoke-session", method: "POST" as const },
      { path: "/revoke-sessions", method: "POST" as const },
      { path: "/revoke-other-sessions", method: "POST" as const },
    ]) {
      const response = await requestAuth(path, method);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        code: "SESSION_ENDPOINT_PROHIBITED",
        message: "Use the Easy Auth Session interface",
      });
    }
  });
});
