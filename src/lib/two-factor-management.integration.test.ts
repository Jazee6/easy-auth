import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { base32 } from "@better-auth/utils/base32";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import { revokeOtherOwnAccountSessions } from "./account-session-service";
import { createEasyAuth } from "./auth-factory";
import { getOwnTwoFactorStatus } from "./two-factor-management";
import type { TwoFactorCleanupFailureEvent } from "./two-factor-management-plugin";

const BASE_URL = "http://easy-auth-two-factor-management.test";
const PASSWORD = "integration-password";

let miniflare: Miniflare;
let database: D1Database;
let auth: ReturnType<typeof createEasyAuth>;
const cleanupFailures: TwoFactorCleanupFailureEvent[] = [];

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2025-09-02",
      compatibilityFlags: ["nodejs_compat"],
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: "two-factor-management-test" },
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
      BETTER_AUTH_SECRET: "two-factor-management-secret-32-characters",
    },
    sendAuthEmail: async () => {},
    captchaEnabled: false,
    tanstackCookiesEnabled: false,
    onTwoFactorCleanupFailure(event) {
      cleanupFailures.push(event);
    },
  });
});

afterAll(async () => {
  await miniflare.dispose();
});

async function postAuth(path: string, body: unknown, cookie?: string): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json", origin: BASE_URL });
  if (cookie) headers.set("cookie", cookie);
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

async function createAccount(slug: string) {
  const email = `${slug}@example.com`;
  await database.prepare("DELETE FROM rate_limit").run();
  const response = await postAuth("/sign-up/email", { name: slug, email, password: PASSWORD });
  expect(response.status).toBe(200);
  const payload = (await response.json()) as { user: { id: string } };
  await database
    .prepare("UPDATE user SET email_verified = 1 WHERE id = ?")
    .bind(payload.user.id)
    .run();
  return { id: payload.user.id, email };
}

function responseCookie(response: Response): string {
  const cookies = new Map<string, string>();
  for (const setCookie of response.headers.getSetCookie()) {
    const cookie = setCookie.split(";", 1)[0];
    const separator = cookie.indexOf("=");
    if (separator > 0) cookies.set(cookie.slice(0, separator), cookie);
  }
  if (cookies.size === 0) throw new Error("Expected a Session cookie");
  return [...cookies.values()].join("; ");
}

async function signIn(email: string) {
  await database.prepare("DELETE FROM rate_limit").run();
  const response = await postAuth("/sign-in/email", { email, password: PASSWORD });
  expect(response.status).toBe(200);
  const cookie = responseCookie(response);
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  if (!session) throw new Error("Expected an authenticated Session");
  return { cookie, sessionId: session.session.id };
}

async function generateCurrentCode(totpURI: string): Promise<string> {
  const secret = new URL(totpURI).searchParams.get("secret");
  if (!secret) throw new Error("Expected a TOTP secret in the setup URI");
  const decodedSecret = new TextDecoder().decode(base32.decode(secret));
  const result = await auth.api.generateTOTP({ body: { secret: decodedSecret } });
  return result.code;
}

async function startEnrollment(cookie: string) {
  const response = await postAuth(
    "/two-factor/enable",
    { password: PASSWORD, method: "totp" },
    cookie,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as {
    method: "totp";
    totpURI: string;
    backupCodes: string[];
  };
}

async function completeEnrollment(cookie: string) {
  const setup = await startEnrollment(cookie);
  const response = await postAuth(
    "/two-factor/verify-totp",
    { code: await generateCurrentCode(setup.totpURI), trustDevice: false },
    cookie,
  );
  expect(response.status).toBe(200);
  return { setup, response, cookie: responseCookie(response) };
}

async function insertRemoteSession(
  accountId: string,
  slug: string,
): Promise<{ sessionId: string }> {
  const now = Date.now();
  const sessionId = `${slug}-session`;
  await database
    .prepare(
      "INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(sessionId, `${slug}-token`, accountId, now + 60_000, now, now)
    .run();
  return { sessionId };
}

async function count(table: string, where: string, binding: string): Promise<number> {
  return (
    (await database
      .prepare(`SELECT count(*) AS count FROM ${table} WHERE ${where}`)
      .bind(binding)
      .first<number>("count")) ?? 0
  );
}

describe("Two-Factor Account status", () => {
  test("projects only authoritative state and local-password eligibility", async () => {
    const account = await createAccount("two-factor-status");
    const current = await signIn(account.email);

    expect(
      await getOwnTwoFactorStatus({
        database,
        authApi: auth.api,
        headers: new Headers({ cookie: current.cookie }),
      }),
    ).toEqual({ enabled: false, hasLocalPassword: true });

    await database
      .prepare(
        "UPDATE account SET provider_id = 'github', issuer = 'github', password = NULL WHERE user_id = ?",
      )
      .bind(account.id)
      .run();
    const projected = await getOwnTwoFactorStatus({
      database,
      authApi: auth.api,
      headers: new Headers({ cookie: current.cookie }),
    });
    expect(projected).toEqual({ enabled: false, hasLocalPassword: false });
    expect(/secret|backup|token|totpURI/i.test(JSON.stringify(projected))).toBe(false);
  });
});

describe("Two-Factor enrollment lifecycle", () => {
  test("validates the password, replaces unfinished setup, then enables once and cleans Sessions", async () => {
    const account = await createAccount("two-factor-enable");
    const current = await signIn(account.email);
    const remote = await signIn(account.email);

    const invalidPassword = await postAuth(
      "/two-factor/enable",
      { password: "wrong-password", method: "totp" },
      current.cookie,
    );
    expect(invalidPassword.status).toBe(400);
    expect(JSON.stringify(await invalidPassword.json()).includes("wrong-password")).toBe(false);

    const first = await startEnrollment(current.cookie);
    const firstRow = await database
      .prepare("SELECT secret, backup_codes, verified FROM two_factor WHERE user_id = ?")
      .bind(account.id)
      .first<{ secret: string; backup_codes: string; verified: number }>();
    expect(firstRow?.verified).toBe(0);
    expect(firstRow?.secret.includes(new URL(first.totpURI).searchParams.get("secret") ?? "")).toBe(
      false,
    );
    expect(firstRow?.backup_codes.includes(first.backupCodes[0])).toBe(false);
    expect(
      await database
        .prepare("SELECT two_factor_enabled FROM user WHERE id = ?")
        .bind(account.id)
        .first<number>("two_factor_enabled"),
    ).toBe(0);

    const second = await startEnrollment(current.cookie);
    expect(second.totpURI === first.totpURI).toBe(false);
    expect(JSON.stringify(second.backupCodes) === JSON.stringify(first.backupCodes)).toBe(false);
    expect(await count("two_factor", "user_id = ?", account.id)).toBe(1);

    const invalidCode = await postAuth(
      "/two-factor/verify-totp",
      { code: "000000", trustDevice: false },
      current.cookie,
    );
    expect(invalidCode.status).toBe(401);
    expect(await count("session", "user_id = ?", account.id)).toBe(2);

    const verified = await postAuth(
      "/two-factor/verify-totp",
      { code: await generateCurrentCode(second.totpURI), trustDevice: false },
      current.cookie,
    );
    expect(verified.status).toBe(200);
    const rotatedCookie = responseCookie(verified);
    const rotated = await auth.api.getSession({ headers: new Headers({ cookie: rotatedCookie }) });
    expect(rotated?.user.twoFactorEnabled).toBe(true);
    expect(await count("session", "user_id = ?", account.id)).toBe(1);
    expect(await count("session", "id = ?", remote.sessionId)).toBe(0);

    const persistedBeforeDuplicate = await database
      .prepare("SELECT secret, backup_codes FROM two_factor WHERE user_id = ?")
      .bind(account.id)
      .first<{ secret: string; backup_codes: string }>();
    await database.prepare("DELETE FROM rate_limit").run();
    const duplicate = await postAuth(
      "/two-factor/enable",
      { password: PASSWORD, method: "totp" },
      rotatedCookie,
    );
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({
      code: "TWO_FACTOR_ALREADY_ENABLED",
      message: "Two-Factor Authentication is already enabled",
    });
    expect(
      await database
        .prepare("SELECT secret, backup_codes FROM two_factor WHERE user_id = ?")
        .bind(account.id)
        .first(),
    ).toEqual(persistedBeforeDuplicate);
  });
});

describe("Two-Factor disable lifecycle", () => {
  test("requires a fresh Session and the current password before changing state", async () => {
    const account = await createAccount("two-factor-disable-guard");
    const initial = await signIn(account.email);
    const enabled = await completeEnrollment(initial.cookie);

    const wrongPassword = await postAuth(
      "/two-factor/disable",
      { password: "wrong-password" },
      enabled.cookie,
    );
    expect(wrongPassword.status).toBe(400);
    expect(await count("two_factor", "user_id = ?", account.id)).toBe(1);

    const current = await auth.api.getSession({ headers: new Headers({ cookie: enabled.cookie }) });
    if (!current) throw new Error("Expected the enabled Session");
    await database
      .prepare("UPDATE session SET created_at = ? WHERE id = ?")
      .bind(Date.now() - 24 * 60 * 60 * 1_000, current.session.id)
      .run();

    const stale = await postAuth("/two-factor/disable", { password: PASSWORD }, enabled.cookie);
    expect(stale.status).toBe(403);
    expect(await stale.json()).toEqual({
      code: "SESSION_NOT_FRESH",
      message: "Sign in again before changing Two-Factor Authentication",
    });
    expect(await count("two_factor", "user_id = ?", account.id)).toBe(1);
  });

  test("disables, rotates the current Session, cleans others, and preserves unrelated credentials", async () => {
    const account = await createAccount("two-factor-disable");
    const initial = await signIn(account.email);
    const enabled = await completeEnrollment(initial.cookie);
    const remote = await insertRemoteSession(account.id, "disable-remote");
    const now = Date.now();

    await database.batch([
      database
        .prepare(
          "INSERT INTO account (id, issuer, account_id, provider_id, user_id, access_token, refresh_token, created_at, updated_at) VALUES (?, 'github', ?, 'github', ?, ?, ?, ?, ?)",
        )
        .bind(
          "disable-github",
          "github-disable",
          account.id,
          "linked-access",
          "linked-refresh",
          now,
          now,
        ),
      database
        .prepare(
          "INSERT INTO oauth_client (id, client_id, user_id, redirect_uris, name) VALUES (?, ?, ?, '[]', ?)",
        )
        .bind("disable-client-row", "disable-client", account.id, "Client"),
      database
        .prepare(
          "INSERT INTO oauth_consent (id, client_id, user_id, scopes, created_at, updated_at) VALUES (?, ?, ?, '[]', ?, ?)",
        )
        .bind("disable-consent", "disable-client", account.id, now, now),
      database
        .prepare(
          "INSERT INTO oauth_refresh_token (id, token, client_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, '[]')",
        )
        .bind(
          "disable-refresh",
          "disable-refresh-secret",
          "disable-client",
          account.id,
          now + 60_000,
          now,
        ),
      database
        .prepare(
          "INSERT INTO oauth_access_token (id, token, client_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, '[]')",
        )
        .bind(
          "disable-access",
          "disable-access-secret",
          "disable-client",
          account.id,
          now + 60_000,
          now,
        ),
      database
        .prepare(
          "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind("disable-trust-one", "trust-device-disable-one", account.id, now + 60_000, now, now),
      database
        .prepare(
          "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind("disable-trust-two", "trust-device-disable-two", account.id, now + 60_000, now, now),
      database
        .prepare(
          "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "disable-unrelated-trust",
          "trust-device-disable-unrelated",
          "another-account-id",
          now + 60_000,
          now,
          now,
        ),
      database
        .prepare(
          "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "disable-unrelated-verification",
          "unrelated-verification",
          account.id,
          now + 60_000,
          now,
          now,
        ),
    ]);

    const response = await postAuth("/two-factor/disable", { password: PASSWORD }, enabled.cookie);
    expect(response.status).toBe(200);
    expect(await response.clone().json()).toEqual({ status: true });
    const rotatedCookie = responseCookie(response);
    const rotated = await auth.api.getSession({ headers: new Headers({ cookie: rotatedCookie }) });
    expect(rotated?.user.twoFactorEnabled).toBe(false);
    expect(await count("two_factor", "user_id = ?", account.id)).toBe(0);
    expect(await count("session", "user_id = ?", account.id)).toBe(1);
    expect(await count("session", "id = ?", remote.sessionId)).toBe(0);
    expect(await count("account", "user_id = ?", account.id)).toBe(2);
    expect(await count("oauth_consent", "user_id = ?", account.id)).toBe(1);
    expect(await count("oauth_refresh_token", "user_id = ?", account.id)).toBe(1);
    expect(await count("oauth_access_token", "user_id = ?", account.id)).toBe(1);
    expect(
      await count("verification", "identifier GLOB 'trust-device-*' AND value = ?", account.id),
    ).toBe(0);
    expect(await count("verification", "id = ?", "disable-unrelated-trust")).toBe(1);
    expect(await count("verification", "id = ?", "disable-unrelated-verification")).toBe(1);
    expect(await count("security_activity", "target_user_id = ?", account.id)).toBe(0);
  });

  test("keeps the state change successful when Session cleanup fails and supports safe retry", async () => {
    const account = await createAccount("two-factor-cleanup-retry");
    const initial = await signIn(account.email);
    const enabled = await completeEnrollment(initial.cookie);
    const remote = await insertRemoteSession(account.id, "cleanup-retry-remote");

    cleanupFailures.length = 0;
    await database
      .prepare(
        `CREATE TRIGGER fail_two_factor_session_cleanup
         BEFORE DELETE ON session
         WHEN OLD.id = '${remote.sessionId}'
         BEGIN
           SELECT RAISE(FAIL, 'forced cleanup failure');
         END`,
      )
      .run();

    const response = await postAuth("/two-factor/disable", { password: PASSWORD }, enabled.cookie);
    expect(response.status).toBe(200);
    expect(await response.clone().json()).toEqual({
      status: true,
      securityCleanupRequired: true,
    });
    expect(await count("two_factor", "user_id = ?", account.id)).toBe(0);
    expect(await count("session", "id = ?", remote.sessionId)).toBe(1);
    expect(cleanupFailures).toEqual([
      {
        code: "TWO_FACTOR_SECURITY_CLEANUP_FAILED",
        operation: "disable",
        accountId: account.id,
      },
    ]);
    expect(JSON.stringify(cleanupFailures).includes("forced cleanup failure")).toBe(false);

    await database.prepare("DROP TRIGGER fail_two_factor_session_cleanup").run();
    const rotatedCookie = responseCookie(response);
    await revokeOtherOwnAccountSessions({
      database,
      authApi: auth.api,
      headers: new Headers({ cookie: rotatedCookie }),
    });
    expect(await count("session", "user_id = ?", account.id)).toBe(1);
  });

  test("reports residual cleanup when a Trusted Device cannot be removed", async () => {
    const account = await createAccount("two-factor-trust-cleanup-failure");
    const initial = await signIn(account.email);
    const enabled = await completeEnrollment(initial.cookie);
    const remote = await insertRemoteSession(account.id, "trust-cleanup-failure-remote");
    const now = Date.now();

    await database
      .prepare(
        "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "undeletable-trust-device",
        "trust-device-undeletable",
        account.id,
        now + 60_000,
        now,
        now,
      )
      .run();
    cleanupFailures.length = 0;
    await database
      .prepare(
        `CREATE TRIGGER fail_two_factor_trusted_device_cleanup
         BEFORE DELETE ON verification
         WHEN OLD.id = 'undeletable-trust-device'
         BEGIN
           SELECT RAISE(FAIL, 'forced trusted device cleanup failure');
         END`,
      )
      .run();

    const response = await postAuth("/two-factor/disable", { password: PASSWORD }, enabled.cookie);
    expect(response.status).toBe(200);
    expect(await response.clone().json()).toEqual({
      status: true,
      securityCleanupRequired: true,
    });
    expect(await count("two_factor", "user_id = ?", account.id)).toBe(0);
    expect(await count("verification", "id = ?", "undeletable-trust-device")).toBe(1);
    expect(await count("session", "id = ?", remote.sessionId)).toBe(0);
    expect(cleanupFailures).toEqual([
      {
        code: "TWO_FACTOR_SECURITY_CLEANUP_FAILED",
        operation: "disable",
        accountId: account.id,
      },
    ]);

    await database.prepare("DROP TRIGGER fail_two_factor_trusted_device_cleanup").run();
  });
});
