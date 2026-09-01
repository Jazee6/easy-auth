import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import { listAccountSecurityActivity } from "./admin-security";
import { createEasyAuth } from "./auth-factory";
import type { SecurityActivityFailureEvent } from "./admin-security-plugin";

const BASE_URL = "http://easy-auth-ban.test";
const PASSWORD = "integration-password";

let miniflare: Miniflare;
let database: D1Database;
let auth: ReturnType<typeof createEasyAuth>;
const activityFailures: SecurityActivityFailureEvent[] = [];

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2025-09-02",
      compatibilityFlags: ["nodejs_compat"],
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: "admin-ban-test" },
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
      BETTER_AUTH_SECRET: "admin-ban-integration-secret-32-characters",
    },
    sendAuthEmail: async () => {},
    captchaEnabled: false,
    tanstackCookiesEnabled: false,
    onSecurityActivityFailure(event) {
      activityFailures.push(event);
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

async function createAccount(
  slug: string,
  role = "user",
): Promise<{ id: string; email: string; name: string }> {
  const email = `${slug}@example.com`;
  const name = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  await database.prepare("DELETE FROM rate_limit").run();
  const response = await postAuth("/sign-up/email", { name, email, password: PASSWORD });
  expect(response.status).toBe(200);
  const result = (await response.json()) as { user: { id: string } };
  await database
    .prepare("UPDATE user SET email_verified = 1, role = ? WHERE id = ?")
    .bind(role, result.user.id)
    .run();
  return { id: result.user.id, email, name };
}

async function signInCookie(email: string): Promise<string> {
  const response = await postAuth("/sign-in/email", { email, password: PASSWORD });
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Sign in did not set a session cookie");
  return setCookie.split(";", 1)[0];
}

async function seedOAuthState(prefix: string, userId: string, clientOwnerId: string) {
  const now = Date.now();
  const clientId = `${prefix}-client`;
  await database.batch([
    database
      .prepare(
        "INSERT INTO oauth_client (id, client_id, user_id, redirect_uris, name) VALUES (?, ?, ?, '[]', ?)",
      )
      .bind(`${prefix}-client-row`, clientId, clientOwnerId, `${prefix} client`),
    database
      .prepare(
        "INSERT INTO oauth_consent (id, client_id, user_id, scopes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(`${prefix}-consent`, clientId, userId, '["openid"]', now, now),
    database
      .prepare(
        "INSERT INTO oauth_refresh_token (id, token, client_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        `${prefix}-refresh`,
        `${prefix}-refresh-secret`,
        clientId,
        userId,
        now + 86_400_000,
        now,
        '["openid"]',
      ),
    database
      .prepare(
        "INSERT INTO oauth_access_token (id, token, client_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        `${prefix}-access`,
        `${prefix}-access-secret`,
        clientId,
        userId,
        now + 3_600_000,
        now,
        '["openid"]',
      ),
  ]);
  return { clientId };
}

async function count(table: string, where: string, binding: string): Promise<number> {
  return (
    (await database
      .prepare(`SELECT count(*) AS count FROM ${table} WHERE ${where}`)
      .bind(binding)
      .first<number>("count")) ?? 0
  );
}

describe("Standard Account Ban integration", () => {
  test("uses Better Auth Ban semantics, clears OAuth credentials, preserves consent, and appends safe snapshots", async () => {
    const admin = await createAccount("ban-main-admin", "admin");
    const target = await createAccount("ban-main-target");
    const unrelated = await createAccount("ban-main-unrelated");
    const adminCookie = await signInCookie(admin.email);
    await signInCookie(target.email);
    await signInCookie(unrelated.email);
    const targetOAuth = await seedOAuthState("ban-main-target", target.id, admin.id);
    await seedOAuthState("ban-main-unrelated", unrelated.id, admin.id);

    const startedAt = Date.now();
    const response = await postAuth(
      "/admin/ban-user",
      {
        userId: target.id,
        banReason: "  Suspicious activity  ",
        banExpiresIn: 86_400,
      },
      adminCookie,
    );
    expect(response.status).toBe(200);

    const targetState = await database
      .prepare("SELECT banned, ban_reason, ban_expires FROM user WHERE id = ?")
      .bind(target.id)
      .first<{ banned: number; ban_reason: string; ban_expires: number }>();
    expect(targetState?.banned).toBe(1);
    expect(targetState?.ban_reason).toBe("Suspicious activity");
    const targetExpiry = targetState?.ban_expires ?? 0;
    expect(targetExpiry >= startedAt + 86_399_000).toBe(true);
    expect(targetExpiry <= Date.now() + 86_401_000).toBe(true);

    expect(await count("session", "user_id = ?", target.id)).toBe(0);
    expect(await count("session", "user_id = ?", unrelated.id)).toBe(1);
    expect(await count("oauth_refresh_token", "user_id = ?", target.id)).toBe(0);
    expect(await count("oauth_access_token", "user_id = ?", target.id)).toBe(0);
    expect(await count("oauth_refresh_token", "user_id = ?", unrelated.id)).toBe(1);
    expect(await count("oauth_access_token", "user_id = ?", unrelated.id)).toBe(1);
    expect(await count("oauth_consent", "user_id = ?", target.id)).toBe(1);
    expect(await count("oauth_client", "client_id = ?", targetOAuth.clientId)).toBe(1);

    const activity = await database
      .prepare("SELECT * FROM security_activity WHERE target_user_id = ?")
      .bind(target.id)
      .first<Record<string, unknown>>();
    expect(activity?.actor_user_id).toBe(admin.id);
    expect(activity?.actor_name).toBe(admin.name);
    expect(activity?.actor_email).toBe(admin.email);
    expect(activity?.target_user_id).toBe(target.id);
    expect(activity?.target_name).toBe(target.name);
    expect(activity?.target_email).toBe(target.email);
    expect(activity?.action).toBe("ban");
    expect(JSON.parse(String(activity?.details))).toEqual({
      reason: "Suspicious activity",
      duration: "24-hours",
      expiresAt: targetState?.ban_expires,
    });
    const projectedActivity = await listAccountSecurityActivity(database, target.id);
    expect(projectedActivity).toEqual([
      {
        activityId: String(activity?.id),
        actorAccountId: admin.id,
        actorName: admin.name,
        actorEmail: admin.email,
        targetAccountId: target.id,
        targetName: target.name,
        targetEmail: target.email,
        action: "ban",
        details: {
          reason: "Suspicious activity",
          duration: "24-hours",
          expiresAt: targetState?.ban_expires,
        },
        createdAt: Number(activity?.created_at),
      },
    ]);
    const serialized = JSON.stringify({ activity, projectedActivity });
    for (const secret of [
      "refresh-secret",
      "access-secret",
      "password",
      "ip_address",
      "user_agent",
      "provider",
    ]) {
      expect(serialized.includes(secret)).toBe(false);
    }
  });

  test("supports one hour, seven day, 30 day, and permanent Bans", async () => {
    const admin = await createAccount("ban-duration-admin", "admin");
    const adminCookie = await signInCookie(admin.email);
    const durations = [
      ["one-hour", 3_600],
      ["seven-days", 604_800],
      ["30-days", 2_592_000],
      ["permanent", undefined],
    ] as const;

    for (const [label, seconds] of durations) {
      const target = await createAccount(`ban-duration-${label}`);
      const startedAt = Date.now();
      const response = await postAuth(
        "/admin/ban-user",
        {
          userId: target.id,
          banReason: "Policy violation",
          ...(seconds === undefined ? {} : { banExpiresIn: seconds }),
        },
        adminCookie,
      );
      expect(response.status).toBe(200);
      const expiry = await database
        .prepare("SELECT ban_expires FROM user WHERE id = ?")
        .bind(target.id)
        .first<number>("ban_expires");
      if (seconds === undefined) expect(expiry).toBeNull();
      else {
        expect((expiry ?? 0) >= startedAt + seconds * 1_000 - 1_000).toBe(true);
        expect((expiry ?? 0) <= Date.now() + seconds * 1_000 + 1_000).toBe(true);
      }
      const details = await database
        .prepare("SELECT details FROM security_activity WHERE target_user_id = ?")
        .bind(target.id)
        .first<string>("details");
      expect(JSON.parse(details ?? "{}").duration).toBe(label);
    }
  });

  test("rejects invalid input before changing state or recording activity", async () => {
    const admin = await createAccount("ban-invalid-admin", "admin");
    const target = await createAccount("ban-invalid-target");
    const adminCookie = await signInCookie(admin.email);
    const invalidBodies = [
      { userId: target.id, banReason: "   ", banExpiresIn: 3_600 },
      { userId: target.id, banReason: "x".repeat(501), banExpiresIn: 3_600 },
      { userId: target.id, banReason: "Abuse", banExpiresIn: 7_200 },
      { userId: target.id, banExpiresIn: 3_600 },
    ];

    for (const body of invalidBodies) {
      const response = await postAuth("/admin/ban-user", body, adminCookie);
      expect(response.status).toBe(400);
      expect((await response.json()) as unknown).toEqual({
        code: "SECURITY_ACTION_INVALID_INPUT",
        message: "Invalid Ban reason or duration",
      });
    }

    expect(
      await database
        .prepare("SELECT banned FROM user WHERE id = ?")
        .bind(target.id)
        .first<number>("banned"),
    ).toBe(0);
    expect(await count("security_activity", "target_user_id = ?", target.id)).toBe(0);
  });

  test("authenticates the actor and rejects Administrator targets including multi-role values", async () => {
    const admin = await createAccount("ban-guard-admin", "admin");
    const multiRoleAdmin = await createAccount("ban-guard-target", "user, admin");
    const standardActor = await createAccount("ban-guard-standard-actor");
    const standardTarget = await createAccount("ban-guard-standard-target");
    const adminCookie = await signInCookie(admin.email);
    const standardCookie = await signInCookie(standardActor.email);

    const administratorResponse = await postAuth(
      "/admin/ban-user",
      { userId: multiRoleAdmin.id, banReason: "Abuse", banExpiresIn: 3_600 },
      adminCookie,
    );
    expect(administratorResponse.status).toBe(403);
    expect(((await administratorResponse.json()) as { code: string }).code).toBe(
      "ADMINISTRATOR_TARGET_PROHIBITED",
    );

    const standardResponse = await postAuth(
      "/admin/ban-user",
      { userId: standardTarget.id, banReason: "Abuse", banExpiresIn: 3_600 },
      standardCookie,
    );
    expect(standardResponse.status).toBe(403);
    expect(((await standardResponse.json()) as { code: string }).code).toBe(
      "ADMINISTRATOR_ACCESS_REQUIRED",
    );

    const anonymousResponse = await postAuth("/admin/ban-user", {
      userId: standardTarget.id,
      banReason: "Abuse",
      banExpiresIn: 3_600,
    });
    expect(anonymousResponse.status).toBe(401);
    expect(((await anonymousResponse.json()) as { code: string }).code).toBe(
      "ADMIN_AUTHENTICATION_REQUIRED",
    );
    expect(await count("security_activity", "target_user_id = ?", multiRoleAdmin.id)).toBe(0);
  });

  test("reports cleanup failure, accepts residue recovery, then rejects a clean duplicate", async () => {
    const admin = await createAccount("ban-recovery-admin", "admin");
    const target = await createAccount("ban-recovery-target");
    const adminCookie = await signInCookie(admin.email);
    await signInCookie(target.email);
    await seedOAuthState("ban-recovery", target.id, admin.id);
    await database
      .prepare(
        `CREATE TRIGGER fail_ban_cleanup
        BEFORE DELETE ON oauth_refresh_token
        WHEN OLD.id = 'ban-recovery-refresh'
        BEGIN
          SELECT RAISE(FAIL, 'forced cleanup failure');
        END`,
      )
      .run();

    const body = { userId: target.id, banReason: "Compromised account", banExpiresIn: 604_800 };
    const failed = await postAuth("/admin/ban-user", body, adminCookie);
    expect(failed.status).toBe(500);
    expect(((await failed.json()) as { code: string }).code).toBe("SECURITY_CLEANUP_FAILED");
    expect(await count("session", "user_id = ?", target.id)).toBe(0);
    expect(await count("oauth_refresh_token", "user_id = ?", target.id)).toBe(1);
    expect(await count("oauth_access_token", "user_id = ?", target.id)).toBe(1);
    expect(await count("security_activity", "target_user_id = ?", target.id)).toBe(0);

    await database.prepare("DROP TRIGGER fail_ban_cleanup").run();
    const recovered = await postAuth("/admin/ban-user", body, adminCookie);
    expect(recovered.status).toBe(200);
    expect(await count("oauth_refresh_token", "user_id = ?", target.id)).toBe(0);
    expect(await count("oauth_access_token", "user_id = ?", target.id)).toBe(0);
    expect(await count("security_activity", "target_user_id = ?", target.id)).toBe(1);

    const duplicate = await postAuth("/admin/ban-user", body, adminCookie);
    expect(duplicate.status).toBe(409);
    expect(((await duplicate.json()) as { code: string }).code).toBe(
      "SECURITY_ACTION_INVALID_STATE",
    );
    expect(await count("security_activity", "target_user_id = ?", target.id)).toBe(1);
  });

  test("keeps a completed Ban successful when Security activity persistence fails", async () => {
    const admin = await createAccount("ban-activity-failure-admin", "admin");
    const target = await createAccount("ban-activity-failure-target");
    const adminCookie = await signInCookie(admin.email);
    await signInCookie(target.email);
    await seedOAuthState("ban-activity-failure", target.id, admin.id);
    await database
      .prepare(
        `CREATE TRIGGER fail_security_activity
        BEFORE INSERT ON security_activity
        WHEN NEW.target_user_id = '${target.id}'
        BEGIN
          SELECT RAISE(FAIL, 'forced activity failure');
        END`,
      )
      .run();

    const failureCount = activityFailures.length;
    const body = { userId: target.id, banReason: "Abuse", banExpiresIn: 2_592_000 };
    const response = await postAuth("/admin/ban-user", body, adminCookie);
    expect(response.status).toBe(200);
    expect(
      await database
        .prepare("SELECT banned FROM user WHERE id = ?")
        .bind(target.id)
        .first<number>("banned"),
    ).toBe(1);
    expect(await count("session", "user_id = ?", target.id)).toBe(0);
    expect(await count("oauth_refresh_token", "user_id = ?", target.id)).toBe(0);
    expect(await count("oauth_access_token", "user_id = ?", target.id)).toBe(0);
    expect(await count("security_activity", "target_user_id = ?", target.id)).toBe(0);
    expect(activityFailures.length).toBe(failureCount + 1);
    const logged = activityFailures.at(-1);
    expect(logged?.code).toBe("SECURITY_ACTIVITY_WRITE_FAILED");
    expect(typeof logged?.activityId).toBe("string");
    const serializedLog = JSON.stringify(logged);
    for (const sensitive of [target.id, target.email, "Abuse", "secret", "token"]) {
      expect(serializedLog.includes(sensitive)).toBe(false);
    }

    await database.prepare("DROP TRIGGER fail_security_activity").run();
    const duplicate = await postAuth("/admin/ban-user", body, adminCookie);
    expect(duplicate.status).toBe(409);
    expect(await count("security_activity", "target_user_id = ?", target.id)).toBe(0);
  });
});
