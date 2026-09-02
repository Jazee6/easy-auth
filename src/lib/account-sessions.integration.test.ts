import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import { listOwnActiveSessions, resolveOwnedActiveSessionToken } from "./admin-sessions";
import {
  listOwnAccountSessions,
  revokeOtherOwnAccountSessions,
  revokeOwnAccountSession,
} from "./account-session-service";
import { createEasyAuth } from "./auth-factory";

const BASE_URL = "http://easy-auth-account-sessions.test";
const PASSWORD = "integration-password";

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
      d1Databases: { DB: "account-session-service-test" },
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
      BETTER_AUTH_SECRET: "account-session-service-secret-32-characters",
    },
    sendAuthEmail: async () => {},
    captchaEnabled: false,
    tanstackCookiesEnabled: false,
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

async function createAccount(slug: string, role = "user") {
  const email = `${slug}@example.com`;
  await database.prepare("DELETE FROM rate_limit").run();
  const response = await postAuth("/sign-up/email", { name: slug, email, password: PASSWORD });
  expect(response.status).toBe(200);
  const result = (await response.json()) as { user: { id: string } };
  await database
    .prepare("UPDATE user SET email_verified = 1, role = ? WHERE id = ?")
    .bind(role, result.user.id)
    .run();
  return { id: result.user.id, email };
}

async function signIn(email: string) {
  await database.prepare("DELETE FROM rate_limit").run();
  const response = await postAuth("/sign-in/email", { email, password: PASSWORD });
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Sign in did not set a Session cookie");
  const cookie = setCookie.split(";", 1)[0];
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  if (!session) throw new Error("Sign in did not establish a Session");
  return { cookie, sessionId: session.session.id, token: session.session.token };
}

async function count(table: string, where: string, binding: string): Promise<number> {
  return (
    (await database
      .prepare(`SELECT count(*) AS count FROM ${table} WHERE ${where}`)
      .bind(binding)
      .first<number>("count")) ?? 0
  );
}

function apiErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "body" in error
    ? (error.body as { code?: string }).code
    : undefined;
}

describe("Account-owned safe Session projection", () => {
  test("lists only owned active Sessions with the current Session first and no credentials", async () => {
    const account = await createAccount("projection-standard");
    const unrelated = await createAccount("projection-unrelated");
    const current = await signIn(account.email);
    const now = Date.now();
    const chrome =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    await database.batch([
      database
        .prepare(
          "INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "projection-same-b",
          "projection-same-b-secret",
          account.id,
          now + 60_000,
          now - 4_000,
          now - 1_000,
          "203.0.113.8",
          chrome,
        ),
      database
        .prepare(
          "INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "projection-same-a",
          "projection-same-a-secret",
          account.id,
          now + 60_000,
          now - 3_000,
          now - 1_000,
        ),
      database
        .prepare(
          "INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "projection-expired",
          "projection-expired-secret",
          account.id,
          now - 1,
          now - 5_000,
          now - 2_000,
        ),
      database
        .prepare(
          "INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "projection-cross-account",
          "projection-cross-account-secret",
          unrelated.id,
          now + 60_000,
          now - 2_000,
          now,
        ),
    ]);

    const sessions = await listOwnActiveSessions(database, account.id, current.sessionId, now);
    expect(sessions.map(({ sessionId, isCurrent }) => ({ sessionId, isCurrent }))).toEqual([
      { sessionId: current.sessionId, isCurrent: true },
      { sessionId: "projection-same-a", isCurrent: false },
      { sessionId: "projection-same-b", isCurrent: false },
    ]);
    expect(sessions[1]).toEqual({
      sessionId: "projection-same-a",
      isCurrent: false,
      browser: "Unknown browser",
      operatingSystem: "Unknown operating system",
      deviceType: "Unknown device",
      ipAddress: "Unknown",
      createdAt: now - 3_000,
      updatedAt: now - 1_000,
      expiresAt: now + 60_000,
    });

    const serialized = JSON.stringify(sessions);
    for (const sensitive of ["secret", "token", "userAgent", "Mozilla", current.token]) {
      expect(serialized.includes(sensitive)).toBe(false);
    }
  });

  test("allows an Administrator to project their own Sessions", async () => {
    const administrator = await createAccount("projection-administrator", "admin");
    const current = await signIn(administrator.email);
    const sessions = await listOwnActiveSessions(database, administrator.id, current.sessionId);
    expect(sessions.length).toBe(1);
    expect(sessions[0]?.isCurrent).toBe(true);
  });

  test("rejects anonymous inspection at the application-owned boundary", async () => {
    try {
      await listOwnAccountSessions({
        database,
        authApi: auth.api,
        headers: new Headers(),
      });
      throw new Error("Expected anonymous Session inspection to fail");
    } catch (error) {
      expect(apiErrorCode(error)).toBe("AUTHENTICATION_REQUIRED");
    }
  });

  test("resolves a trimmed active owned ID only inside the server boundary", async () => {
    const account = await createAccount("resolve-owned");
    const other = await createAccount("resolve-other");
    const session = await signIn(account.email);

    expect(
      await resolveOwnedActiveSessionToken(database, account.id, ` ${session.sessionId} `),
    ).toBe(session.token);
    expect(await resolveOwnedActiveSessionToken(database, other.id, session.sessionId)).toBeNull();
    expect(await resolveOwnedActiveSessionToken(database, account.id, "missing")).toBeNull();

    await database
      .prepare("UPDATE session SET expires_at = ? WHERE id = ?")
      .bind(Date.now() - 1, session.sessionId)
      .run();
    expect(
      await resolveOwnedActiveSessionToken(database, account.id, session.sessionId),
    ).toBeNull();
  });
});

describe("Account-owned Better Auth Session mutation semantics", () => {
  test("revokes one resolved remote Session while preserving unrelated security state", async () => {
    const account = await createAccount("revoke-one");
    const other = await createAccount("revoke-one-other");
    const current = await signIn(account.email);
    const remote = await signIn(account.email);
    await signIn(other.email);
    const now = Date.now();

    await database.batch([
      database
        .prepare(
          "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind("trust-one", "trust-device-one", account.id, now + 60_000, now, now),
      database
        .prepare(
          "INSERT INTO oauth_client (id, client_id, user_id, redirect_uris, name) VALUES (?, ?, ?, '[]', ?)",
        )
        .bind("revoke-one-client-row", "revoke-one-client", account.id, "Client"),
      database
        .prepare(
          "INSERT INTO oauth_consent (id, client_id, user_id, scopes, created_at, updated_at) VALUES (?, ?, ?, '[]', ?, ?)",
        )
        .bind("revoke-one-consent", "revoke-one-client", account.id, now, now),
      database
        .prepare(
          "INSERT INTO oauth_refresh_token (id, token, client_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, '[]')",
        )
        .bind(
          "revoke-one-refresh",
          "revoke-one-refresh-secret",
          "revoke-one-client",
          account.id,
          now + 60_000,
          now,
        ),
      database
        .prepare(
          "INSERT INTO oauth_access_token (id, token, client_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, '[]')",
        )
        .bind(
          "revoke-one-access",
          "revoke-one-access-secret",
          "revoke-one-client",
          account.id,
          now + 60_000,
          now,
        ),
    ]);

    const privateToken = await resolveOwnedActiveSessionToken(
      database,
      account.id,
      remote.sessionId,
    );
    if (!privateToken) throw new Error("Expected remote Session token");
    await revokeOwnAccountSession({
      database,
      authApi: auth.api,
      headers: new Headers({ cookie: current.cookie }),
      sessionId: remote.sessionId,
    });

    expect(await count("session", "id = ?", remote.sessionId)).toBe(0);
    expect(await count("session", "id = ?", current.sessionId)).toBe(1);
    expect(await count("verification", "identifier = ?", "trust-device-one")).toBe(1);
    expect(await count("oauth_consent", "user_id = ?", account.id)).toBe(1);
    expect(await count("oauth_refresh_token", "user_id = ?", account.id)).toBe(1);
    expect(await count("oauth_access_token", "user_id = ?", account.id)).toBe(1);
    expect(await count("security_activity", "target_user_id = ?", account.id)).toBe(0);
  });

  test("revokes every other owned Session while preserving the current and another Account", async () => {
    const account = await createAccount("revoke-others");
    const other = await createAccount("revoke-others-other");
    const current = await signIn(account.email);
    await signIn(account.email);
    await signIn(account.email);
    const unrelated = await signIn(other.email);

    await revokeOtherOwnAccountSessions({
      database,
      authApi: auth.api,
      headers: new Headers({ cookie: current.cookie }),
    });

    expect(await count("session", "user_id = ?", account.id)).toBe(1);
    expect(await count("session", "id = ?", current.sessionId)).toBe(1);
    expect(await count("session", "id = ?", unrelated.sessionId)).toBe(1);
  });

  test("rejects current, cross-Account, missing, and already-revoked Session IDs", async () => {
    const account = await createAccount("revoke-invalid");
    const other = await createAccount("revoke-invalid-other");
    const current = await signIn(account.email);
    const remote = await signIn(account.email);
    const unrelated = await signIn(other.email);
    const headers = new Headers({ cookie: current.cookie });

    for (const { sessionId, code } of [
      { sessionId: current.sessionId, code: "CURRENT_SESSION_SIGN_OUT_REQUIRED" },
      { sessionId: unrelated.sessionId, code: "ACCOUNT_SESSION_NOT_FOUND" },
      { sessionId: "missing", code: "ACCOUNT_SESSION_NOT_FOUND" },
    ]) {
      try {
        await revokeOwnAccountSession({
          database,
          authApi: auth.api,
          headers,
          sessionId,
        });
        throw new Error("Expected invalid Session revocation to fail");
      } catch (error) {
        expect(apiErrorCode(error)).toBe(code);
      }
    }

    await revokeOwnAccountSession({
      database,
      authApi: auth.api,
      headers,
      sessionId: ` ${remote.sessionId} `,
    });
    try {
      await revokeOwnAccountSession({
        database,
        authApi: auth.api,
        headers,
        sessionId: remote.sessionId,
      });
      throw new Error("Expected repeated Session revocation to fail");
    } catch (error) {
      expect(apiErrorCode(error)).toBe("ACCOUNT_SESSION_NOT_FOUND");
    }
  });

  test("keeps reads available to a stale Session but rejects sensitive revocation", async () => {
    const account = await createAccount("stale-session");
    const stale = await signIn(account.email);
    const remote = await signIn(account.email);
    await database
      .prepare("UPDATE session SET created_at = ? WHERE id = ?")
      .bind(Date.now() - 25 * 60 * 60 * 1_000, stale.sessionId)
      .run();

    const listed = await listOwnAccountSessions({
      database,
      authApi: auth.api,
      headers: new Headers({ cookie: stale.cookie }),
    });
    expect(listed[0]?.sessionId).toBe(stale.sessionId);

    try {
      await revokeOwnAccountSession({
        database,
        authApi: auth.api,
        headers: new Headers({ cookie: stale.cookie }),
        sessionId: remote.sessionId,
      });
      throw new Error("Expected stale Session revocation to fail");
    } catch (error) {
      expect(apiErrorCode(error)).toBe("SESSION_NOT_FRESH");
    }

    try {
      await revokeOtherOwnAccountSessions({
        database,
        authApi: auth.api,
        headers: new Headers({ cookie: stale.cookie }),
      });
      throw new Error("Expected stale all-other Session revocation to fail");
    } catch (error) {
      expect(apiErrorCode(error)).toBe("SESSION_NOT_FRESH");
    }

    expect(await count("session", "id = ?", remote.sessionId)).toBe(1);
  });
});
