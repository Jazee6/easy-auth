import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import { listAccountSecurityActivity } from "./admin-security";
import { createEasyAuth } from "./auth-factory";
import { listActiveAccountSessions, resolveActiveSessionToken } from "./admin-sessions";
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
  await database.prepare("DELETE FROM rate_limit").run();
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
        message: "Invalid security action input",
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

describe("Standard Account Unban integration", () => {
  test("clears active Ban state without restoring credentials and records an isolated activity", async () => {
    const admin = await createAccount("unban-active-admin", "admin");
    const target = await createAccount("unban-active-target");
    const unrelated = await createAccount("unban-active-unrelated");
    const adminCookie = await signInCookie(admin.email);
    await signInCookie(target.email);
    await signInCookie(unrelated.email);
    const targetOAuth = await seedOAuthState("unban-active-target", target.id, admin.id);
    await seedOAuthState("unban-active-unrelated", unrelated.id, admin.id);

    const banResponse = await postAuth(
      "/admin/ban-user",
      { userId: target.id, banReason: "Compromised account", banExpiresIn: 604_800 },
      adminCookie,
    );
    expect(banResponse.status).toBe(200);
    const unbanResponse = await postAuth("/admin/unban-user", { userId: target.id }, adminCookie);
    expect(unbanResponse.status).toBe(200);

    expect(
      await database
        .prepare("SELECT banned, ban_reason, ban_expires FROM user WHERE id = ?")
        .bind(target.id)
        .first(),
    ).toEqual({ banned: 0, ban_reason: null, ban_expires: null });
    expect(await count("session", "user_id = ?", target.id)).toBe(0);
    expect(await count("oauth_refresh_token", "user_id = ?", target.id)).toBe(0);
    expect(await count("oauth_access_token", "user_id = ?", target.id)).toBe(0);
    expect(await count("oauth_consent", "user_id = ?", target.id)).toBe(1);
    expect(await count("oauth_client", "client_id = ?", targetOAuth.clientId)).toBe(1);
    expect(await count("session", "user_id = ?", unrelated.id)).toBe(1);
    expect(await count("oauth_refresh_token", "user_id = ?", unrelated.id)).toBe(1);
    expect(await count("oauth_access_token", "user_id = ?", unrelated.id)).toBe(1);

    const activity = await listAccountSecurityActivity(database, target.id);
    expect(activity.map((item) => item.action)).toEqual(["unban", "ban"]);
    expect({
      actorAccountId: activity[0]?.actorAccountId,
      actorName: activity[0]?.actorName,
      actorEmail: activity[0]?.actorEmail,
      targetAccountId: activity[0]?.targetAccountId,
      targetName: activity[0]?.targetName,
      targetEmail: activity[0]?.targetEmail,
      action: activity[0]?.action,
      details: activity[0]?.details,
    }).toEqual({
      actorAccountId: admin.id,
      actorName: admin.name,
      actorEmail: admin.email,
      targetAccountId: target.id,
      targetName: target.name,
      targetEmail: target.email,
      action: "unban",
      details: {},
    });
    const serialized = JSON.stringify(activity[0]);
    for (const sensitive of ["secret", "token", "password", "ipAddress", "userAgent"]) {
      expect(serialized.includes(sensitive)).toBe(false);
    }
  });

  test("clears an expired stored Ban without mutating unrelated state", async () => {
    const admin = await createAccount("unban-expired-admin", "admin");
    const target = await createAccount("unban-expired-target");
    const adminCookie = await signInCookie(admin.email);
    await database
      .prepare(
        "UPDATE user SET banned = 1, ban_reason = 'Policy violation', ban_expires = ? WHERE id = ?",
      )
      .bind(Date.now() - 60_000, target.id)
      .run();

    const response = await postAuth("/admin/unban-user", { userId: target.id }, adminCookie);
    expect(response.status).toBe(200);
    expect(
      await database
        .prepare("SELECT banned, ban_reason, ban_expires FROM user WHERE id = ?")
        .bind(target.id)
        .first(),
    ).toEqual({ banned: 0, ban_reason: null, ban_expires: null });
    expect(
      (await listAccountSecurityActivity(database, target.id)).map((item) => item.action),
    ).toEqual(["unban"]);
  });

  test("rejects unrestricted and Administrator targets without activity", async () => {
    const admin = await createAccount("unban-guard-admin", "admin");
    const unrestricted = await createAccount("unban-guard-unrestricted");
    const administratorTarget = await createAccount("unban-guard-target", "user, admin");
    const adminCookie = await signInCookie(admin.email);
    await database
      .prepare(
        "UPDATE user SET banned = 1, ban_reason = 'Operations', ban_expires = NULL WHERE id = ?",
      )
      .bind(administratorTarget.id)
      .run();

    const unrestrictedResponse = await postAuth(
      "/admin/unban-user",
      { userId: unrestricted.id },
      adminCookie,
    );
    expect(unrestrictedResponse.status).toBe(409);
    expect(((await unrestrictedResponse.json()) as { code: string }).code).toBe(
      "SECURITY_ACTION_INVALID_STATE",
    );

    const administratorResponse = await postAuth(
      "/admin/unban-user",
      { userId: administratorTarget.id },
      adminCookie,
    );
    expect(administratorResponse.status).toBe(403);
    expect(((await administratorResponse.json()) as { code: string }).code).toBe(
      "ADMINISTRATOR_TARGET_PROHIBITED",
    );
    expect(await count("security_activity", "target_user_id = ?", unrestricted.id)).toBe(0);
    expect(await count("security_activity", "target_user_id = ?", administratorTarget.id)).toBe(0);
  });

  test("blocks Unban while incomplete Ban cleanup residue remains", async () => {
    const admin = await createAccount("unban-residue-admin", "admin");
    const target = await createAccount("unban-residue-target");
    const adminCookie = await signInCookie(admin.email);
    await signInCookie(target.email);
    await seedOAuthState("unban-residue", target.id, admin.id);
    await database
      .prepare(
        "UPDATE user SET banned = 1, ban_reason = 'Compromised account', ban_expires = NULL WHERE id = ?",
      )
      .bind(target.id)
      .run();

    const response = await postAuth("/admin/unban-user", { userId: target.id }, adminCookie);
    expect(response.status).toBe(409);
    expect(((await response.json()) as { code: string }).code).toBe("SECURITY_CLEANUP_INCOMPLETE");
    expect(
      await database
        .prepare("SELECT banned FROM user WHERE id = ?")
        .bind(target.id)
        .first<number>("banned"),
    ).toBe(1);
    expect(await count("session", "user_id = ?", target.id)).toBe(1);
    expect(await count("oauth_refresh_token", "user_id = ?", target.id)).toBe(1);
    expect(await count("oauth_access_token", "user_id = ?", target.id)).toBe(1);
    expect(await count("security_activity", "target_user_id = ?", target.id)).toBe(0);
  });

  test("keeps Unban successful when Security activity persistence fails", async () => {
    const admin = await createAccount("unban-activity-failure-admin", "admin");
    const target = await createAccount("unban-activity-failure-target");
    const adminCookie = await signInCookie(admin.email);
    await database
      .prepare("UPDATE user SET banned = 1, ban_reason = 'Abuse', ban_expires = NULL WHERE id = ?")
      .bind(target.id)
      .run();
    await database
      .prepare(
        `CREATE TRIGGER fail_unban_activity
        BEFORE INSERT ON security_activity
        WHEN NEW.target_user_id = '${target.id}' AND NEW.action = 'unban'
        BEGIN
          SELECT RAISE(FAIL, 'forced unban activity failure');
        END`,
      )
      .run();

    const failureCount = activityFailures.length;
    const response = await postAuth("/admin/unban-user", { userId: target.id }, adminCookie);
    expect(response.status).toBe(200);
    expect(
      await database
        .prepare("SELECT banned FROM user WHERE id = ?")
        .bind(target.id)
        .first<number>("banned"),
    ).toBe(0);
    expect(await count("security_activity", "target_user_id = ?", target.id)).toBe(0);
    expect(activityFailures.length).toBe(failureCount + 1);
    const logged = activityFailures.at(-1);
    expect(logged?.code).toBe("SECURITY_ACTIVITY_WRITE_FAILED");
    const serializedLog = JSON.stringify(logged);
    for (const sensitive of [target.id, target.email, "Abuse", "secret", "token"]) {
      expect(serializedLog.includes(sensitive)).toBe(false);
    }

    await database.prepare("DROP TRIGGER fail_unban_activity").run();
    const duplicate = await postAuth("/admin/unban-user", { userId: target.id }, adminCookie);
    expect(duplicate.status).toBe(409);
    expect(await count("security_activity", "target_user_id = ?", target.id)).toBe(0);
  });
});

describe("Standard Account Session security integration", () => {
  test("projects only active Sessions without bearer tokens or raw User-Agents", async () => {
    const target = await createAccount("session-projection-target");
    const administrator = await createAccount("session-projection-admin", "admin");
    const now = Date.now();
    const chrome =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    await database.batch([
      database
        .prepare(
          "INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "projection-active",
          "projection-active-secret",
          target.id,
          now + 60_000,
          now - 2_000,
          now - 1_000,
          "203.0.113.8",
          chrome,
        ),
      database
        .prepare(
          "INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)",
        )
        .bind(
          "projection-unknown",
          "projection-unknown-secret",
          target.id,
          now + 120_000,
          now - 1_000,
          now - 500,
        ),
      database
        .prepare(
          "INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "projection-expired",
          "projection-expired-secret",
          target.id,
          now - 1,
          now - 3_000,
          now - 2_000,
        ),
    ]);

    const sessions = await listActiveAccountSessions(database, target.id, now);
    expect(sessions).toEqual([
      {
        sessionId: "projection-unknown",
        browser: "Unknown browser",
        operatingSystem: "Unknown operating system",
        deviceType: "Unknown device",
        ipAddress: "Unknown",
        createdAt: now - 1_000,
        updatedAt: now - 500,
        expiresAt: now + 120_000,
      },
      {
        sessionId: "projection-active",
        browser: "Chrome 131.0.0.0",
        operatingSystem: "Windows 10",
        deviceType: "Desktop",
        ipAddress: "203.0.113.8",
        createdAt: now - 2_000,
        updatedAt: now - 1_000,
        expiresAt: now + 60_000,
      },
    ]);
    const serialized = JSON.stringify(sessions);
    for (const sensitive of ["secret", "token", "userAgent", "Mozilla"]) {
      expect(serialized.includes(sensitive)).toBe(false);
    }
    expect(await resolveActiveSessionToken(database, target.id, "projection-active", now)).toBe(
      "projection-active-secret",
    );
    expect(
      await resolveActiveSessionToken(database, target.id, "projection-expired", now),
    ).toBeNull();
    expect(await resolveActiveSessionToken(database, target.id, "projection-unknown", now)).toBe(
      "projection-unknown-secret",
    );
    try {
      await listActiveAccountSessions(database, administrator.id, now);
      throw new Error("Expected Administrator Session projection to be rejected");
    } catch (error) {
      expect(error instanceof Error ? error.message : "").toBe(
        "Administrator Sessions are operations-only",
      );
    }
  });

  test("revokes one Session by private token while activity retains only its Session ID", async () => {
    const admin = await createAccount("session-single-admin", "admin");
    const target = await createAccount("session-single-target");
    const unrelated = await createAccount("session-single-unrelated");
    const administratorTarget = await createAccount("session-single-admin-target", "admin");
    const adminCookie = await signInCookie(admin.email);
    const targetCookie = await signInCookie(target.email);
    await signInCookie(unrelated.email);
    await signInCookie(administratorTarget.email);
    const selected = await database
      .prepare("SELECT id, token FROM session WHERE user_id = ?")
      .bind(target.id)
      .first<{ id: string; token: string }>();
    const administratorSession = await database
      .prepare("SELECT token FROM session WHERE user_id = ?")
      .bind(administratorTarget.id)
      .first<string>("token");
    if (!selected || !administratorSession) throw new Error("Expected seeded Sessions");

    const response = await postAuth(
      "/admin/revoke-user-session",
      { sessionToken: selected.token },
      adminCookie,
    );
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json()).includes(selected.token)).toBe(false);
    expect(await count("session", "id = ?", selected.id)).toBe(0);
    expect(await count("session", "user_id = ?", unrelated.id)).toBe(1);
    const authenticated = await auth.handler(
      new Request(`${BASE_URL}/api/auth/get-session`, { headers: { cookie: targetCookie } }),
    );
    expect(await authenticated.json()).toBeNull();

    const activity = await listAccountSecurityActivity(database, target.id);
    expect(activity.map((item) => item.action)).toEqual(["revoke-session"]);
    expect(activity[0]?.details).toEqual({ sessionId: selected.id });
    const serialized = JSON.stringify(activity[0]);
    expect(serialized.includes(selected.token)).toBe(false);

    expect(await resolveActiveSessionToken(database, unrelated.id, selected.id)).toBeNull();

    const unknown = await postAuth(
      "/admin/revoke-user-session",
      { sessionToken: "missing-session-token" },
      adminCookie,
    );
    expect(unknown.status).toBe(404);
    expect(((await unknown.json()) as { code: string }).code).toBe("SECURITY_SESSION_NOT_FOUND");

    const administratorResponse = await postAuth(
      "/admin/revoke-user-session",
      { sessionToken: administratorSession },
      adminCookie,
    );
    expect(administratorResponse.status).toBe(403);
    expect(((await administratorResponse.json()) as { code: string }).code).toBe(
      "ADMINISTRATOR_TARGET_PROHIBITED",
    );
    const administratorAllResponse = await postAuth(
      "/admin/revoke-user-sessions",
      { userId: administratorTarget.id },
      adminCookie,
    );
    expect(administratorAllResponse.status).toBe(403);
    expect(((await administratorAllResponse.json()) as { code: string }).code).toBe(
      "ADMINISTRATOR_TARGET_PROHIBITED",
    );
  });

  test("revokes all target Sessions without affecting another Account", async () => {
    const admin = await createAccount("session-all-admin", "admin");
    const target = await createAccount("session-all-target");
    const unrelated = await createAccount("session-all-unrelated");
    const adminCookie = await signInCookie(admin.email);
    await signInCookie(target.email);
    await signInCookie(target.email);
    await signInCookie(unrelated.email);

    expect(await count("session", "user_id = ?", target.id)).toBe(2);
    const response = await postAuth(
      "/admin/revoke-user-sessions",
      { userId: target.id },
      adminCookie,
    );
    expect(response.status).toBe(200);
    expect(await count("session", "user_id = ?", target.id)).toBe(0);
    expect(await count("session", "user_id = ?", unrelated.id)).toBe(1);
    const activity = await listAccountSecurityActivity(database, target.id);
    expect(activity.map((item) => item.action)).toEqual(["revoke-all-sessions"]);
    expect(activity[0]?.details).toEqual({ scope: "all" });
    const serialized = JSON.stringify(activity[0]);
    for (const sensitive of ["token", "ipAddress", "userAgent"]) {
      expect(serialized.includes(sensitive)).toBe(false);
    }
  });

  test("keeps Session revocation successful when Security activity persistence fails", async () => {
    const admin = await createAccount("session-activity-failure-admin", "admin");
    const target = await createAccount("session-activity-failure-target");
    const adminCookie = await signInCookie(admin.email);
    await signInCookie(target.email);
    const selected = await database
      .prepare("SELECT id, token FROM session WHERE user_id = ?")
      .bind(target.id)
      .first<{ id: string; token: string }>();
    if (!selected) throw new Error("Expected target Session");
    await database
      .prepare(
        `CREATE TRIGGER fail_session_activity
        BEFORE INSERT ON security_activity
        WHEN NEW.target_user_id = '${target.id}' AND NEW.action = 'revoke-session'
        BEGIN
          SELECT RAISE(FAIL, 'forced Session activity failure');
        END`,
      )
      .run();

    const failureCount = activityFailures.length;
    const response = await postAuth(
      "/admin/revoke-user-session",
      { sessionToken: selected.token },
      adminCookie,
    );
    expect(response.status).toBe(200);
    expect(await count("session", "id = ?", selected.id)).toBe(0);
    expect(await count("security_activity", "target_user_id = ?", target.id)).toBe(0);
    expect(activityFailures.length).toBe(failureCount + 1);
    const logged = activityFailures.at(-1);
    expect(logged?.code).toBe("SECURITY_ACTIVITY_WRITE_FAILED");
    const serializedLog = JSON.stringify(logged);
    for (const sensitive of [target.id, target.email, selected.id, selected.token, "userAgent"]) {
      expect(serializedLog.includes(sensitive)).toBe(false);
    }
    await database.prepare("DROP TRIGGER fail_session_activity").run();
  });
});
