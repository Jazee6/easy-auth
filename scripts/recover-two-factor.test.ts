import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

const SCRIPT = "scripts/recover-two-factor.sh";
const TEMPLATE_PREFIX_HASH = "33fa2aa97b8244f5d0675da4be7a82674d43cb0c8c28755f7eb56e980205fd0f";
const STAGES_MARKER = "# STAGES — author this section.";
const TARGET_ID = "target'account";
const UNRELATED_ID = "unrelated-account";

let miniflare: Miniflare;
let database: D1Database;

const executeFile = promisify(execFile);

async function runScript(...args: string[]) {
  const { stdout } = await executeFile("bash", [SCRIPT, ...args], { encoding: "utf8" });
  return stdout;
}

async function count(table: string, where = "1 = 1", value?: string): Promise<number> {
  const statement = database.prepare(`SELECT count(*) AS count FROM ${table} WHERE ${where}`);
  const query = value === undefined ? statement : statement.bind(value);
  return (await query.first<number>("count")) ?? 0;
}

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2025-09-02",
      compatibilityFlags: ["nodejs_compat"],
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: "two-factor-recovery-test" },
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

  const now = Date.now();
  await database.batch([
    database
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at, role, two_factor_enabled) VALUES (?, ?, ?, 1, ?, ?, ?, 1)",
      )
      .bind(TARGET_ID, "Target Account", "target@example.com", now, now, "user, admin"),
    database
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at, role, two_factor_enabled) VALUES (?, ?, ?, 1, ?, ?, 'user', 1)",
      )
      .bind(UNRELATED_ID, "Unrelated Account", "unrelated@example.com", now, now),
  ]);

  for (const [prefix, userId] of [
    ["target", TARGET_ID],
    ["unrelated", UNRELATED_ID],
  ] as const) {
    await database.batch([
      database
        .prepare(
          "INSERT INTO two_factor (id, secret, backup_codes, user_id, verified, failed_verification_count, locked_until) VALUES (?, ?, ?, ?, 1, 4, ?)",
        )
        .bind(`${prefix}-two-factor`, `${prefix}-secret`, `${prefix}-backup-codes`, userId, now),
      database
        .prepare(
          "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(`${prefix}-challenge-row`, `2fa-${prefix}-challenge`, userId, now + 60_000, now, now),
      database
        .prepare(
          "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, '3', ?, ?, ?)",
        )
        .bind(
          `${prefix}-attempt-row`,
          `2fa-attempts-2fa-${prefix}-challenge`,
          now + 60_000,
          now,
          now,
        ),
      database
        .prepare(
          "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(`${prefix}-trust-row`, `trust-device-${prefix}`, userId, now + 60_000, now, now),
      database
        .prepare(
          "INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(`${prefix}-session`, `${prefix}-session-token`, userId, now + 60_000, now, now),
      database
        .prepare(
          "INSERT INTO account (id, issuer, account_id, provider_id, user_id, password, access_token, refresh_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `${prefix}-credential`,
          "credential",
          userId,
          "credential",
          userId,
          `${prefix}-password-hash`,
          null,
          null,
          now,
          now,
        ),
      database
        .prepare(
          "INSERT INTO account (id, issuer, account_id, provider_id, user_id, access_token, refresh_token, created_at, updated_at) VALUES (?, 'github', ?, 'github', ?, ?, ?, ?, ?)",
        )
        .bind(
          `${prefix}-github`,
          `${prefix}-github-id`,
          userId,
          `${prefix}-provider-access`,
          `${prefix}-provider-refresh`,
          now,
          now,
        ),
      database
        .prepare(
          "INSERT INTO oauth_client (id, client_id, user_id, name, redirect_uris) VALUES (?, ?, ?, ?, '[]')",
        )
        .bind(`${prefix}-client-row`, `${prefix}-client`, userId, `${prefix} client`),
      database
        .prepare(
          "INSERT INTO oauth_refresh_token (id, token, client_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, '[]')",
        )
        .bind(
          `${prefix}-refresh-row`,
          `${prefix}-oauth-refresh`,
          `${prefix}-client`,
          userId,
          now + 60_000,
          now,
        ),
      database
        .prepare(
          "INSERT INTO oauth_access_token (id, token, client_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, '[]')",
        )
        .bind(
          `${prefix}-access-row`,
          `${prefix}-oauth-access`,
          `${prefix}-client`,
          userId,
          now + 60_000,
          now,
        ),
      database
        .prepare(
          "INSERT INTO oauth_consent (id, client_id, user_id, scopes, created_at, updated_at) VALUES (?, ?, ?, '[]', ?, ?)",
        )
        .bind(`${prefix}-consent`, `${prefix}-client`, userId, now, now),
      database
        .prepare(
          "INSERT INTO oauth_client_audit (id, actor_user_id, owner_user_id, client_id, client_name, action, summary, created_at) VALUES (?, ?, ?, ?, ?, 'create', 'preserve', ?)",
        )
        .bind(`${prefix}-audit`, userId, userId, `${prefix}-client`, `${prefix} client`, now),
      database
        .prepare(
          "INSERT INTO security_activity (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, target_email, action, details, created_at) VALUES (?, ?, 'Operator', 'operator@example.com', ?, ?, ?, 'ban', '{}', ?)",
        )
        .bind(
          `${prefix}-security`,
          userId,
          userId,
          `${prefix} account`,
          `${prefix}@example.com`,
          now,
        ),
    ]);
  }
});

afterAll(async () => {
  await miniflare.dispose();
});

describe("Two-Factor operations recovery wizard", () => {
  test("keeps the shared wizard library unchanged and defines exactly six selected stages", async () => {
    const source = await readFile(SCRIPT, "utf8");
    const markerIndex = source.indexOf(STAGES_MARKER);
    expect(markerIndex > 0).toBe(true);
    const prefixEnd = source.indexOf("\n", source.indexOf("# ─", markerIndex) + 1) + 1;
    const prefix = source.slice(0, prefixEnd);
    expect(createHash("sha256").update(prefix).digest("hex")).toBe(TEMPLATE_PREFIX_HASH);
    expect([...source.matchAll(/^stage "([^"]+)"/gm)].map((match) => match[1])).toEqual([
      "Preflight",
      "Locate Account",
      "Impact Preview",
      "Recovery Point",
      "Final Confirmation and Execute",
      "Verify",
    ]);
    expect(source.includes("ask CONFIRMED_ACCOUNT_ID")).toBe(false);
    expect(source.includes("ask CONFIRMED_PHRASE")).toBe(false);
    expect(source).toContain('ask_fresh CONFIRMED_ACCOUNT_ID "Type the full immutable User ID:"');
    expect(source).toContain('ask_fresh CONFIRMED_PHRASE "Type $RECOVERY_PHRASE:"');
    expect(
      source.indexOf('stage "Recovery Point"') <
        source.indexOf('stage "Final Confirmation and Execute"'),
    ).toBe(true);
    expect(
      source.indexOf('stage "Final Confirmation and Execute"') <
        source.indexOf('bunx wrangler d1 execute "$D1_DATABASE" "$MODE_FLAG" --file'),
    ).toBe(true);
  });

  test("defaults to local and requires an explicit remote mode and Account ID", async () => {
    expect((await runScript("--print-mode-flag")).trim()).toBe("--local");
    expect((await runScript("--remote", "--print-mode-flag")).trim()).toBe("--remote");
    const source = await readFile(SCRIPT, "utf8");
    expect(source).toContain(
      'ask_fresh CONFIRMED_CLOUDFLARE_ACCOUNT_ID "Type the intended Cloudflare Account ID:"',
    );
    expect(source).toContain('export CLOUDFLARE_ACCOUNT_ID="$CONFIRMED_CLOUDFLARE_ACCOUNT_ID"');
  });

  test("quotes login email and immutable User ID as exact SQLite literals", async () => {
    const locate = await runScript("--print-locate-sql", "operator'o@example.com");
    const recovery = await runScript("--print-recovery-sql", TARGET_ID);

    expect(locate).toContain("lower(email) = lower('operator''o@example.com')");
    expect(recovery).toContain("id = 'target''account'");
    expect(recovery).toContain("user_id = 'target''account'");
    expect(recovery.includes(`user_id = '${TARGET_ID}'`)).toBe(false);
  });

  test("rolls back a failed local D1 batch before applying repeatable recovery", async () => {
    let failed = false;
    try {
      await database.batch([
        database.prepare("UPDATE user SET two_factor_enabled = 0 WHERE id = ?").bind(TARGET_ID),
        database.prepare("INSERT INTO user (id) VALUES (?)").bind(TARGET_ID),
      ]);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
    expect(
      await database
        .prepare("SELECT two_factor_enabled FROM user WHERE id = ?")
        .bind(TARGET_ID)
        .first<number>("two_factor_enabled"),
    ).toBe(1);
  });

  test("removes only selected recovery state and is safely repeatable", async () => {
    const impact = await runScript("--print-impact-sql", TARGET_ID);
    expect(await database.prepare(impact).first()).toEqual({
      two_factor_records: 1,
      pending_challenges: 1,
      challenge_attempts: 1,
      trusted_devices: 1,
      sessions: 1,
      active_sessions: 1,
      oauth_refresh_tokens: 1,
      oauth_access_tokens: 1,
    });

    const recovery = await runScript("--print-recovery-sql", TARGET_ID);
    for (const credential of [
      "target-secret",
      "target-backup-codes",
      "target-password-hash",
      "target-session-token",
      "target-oauth-refresh",
      "target-oauth-access",
      "target-provider-refresh",
      "target-provider-access",
    ]) {
      expect(recovery.includes(credential)).toBe(false);
    }
    const statements = recovery
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => database.prepare(statement));

    await database.batch(statements);
    await database.batch(statements);

    expect(
      await database
        .prepare("SELECT two_factor_enabled FROM user WHERE id = ?")
        .bind(TARGET_ID)
        .first<number>("two_factor_enabled"),
    ).toBe(0);
    expect(await count("two_factor", "user_id = ?", TARGET_ID)).toBe(0);
    expect(await count("verification", "value = ?", TARGET_ID)).toBe(0);
    expect(await count("verification", "identifier LIKE '2fa-attempts-%'")).toBe(1);
    expect(await count("session", "user_id = ?", TARGET_ID)).toBe(0);
    expect(await count("oauth_refresh_token", "user_id = ?", TARGET_ID)).toBe(0);
    expect(await count("oauth_access_token", "user_id = ?", TARGET_ID)).toBe(0);
    const verification = await runScript("--print-verify-sql", TARGET_ID);
    expect(await database.prepare(verification).first()).toEqual({
      account_records: 1,
      two_factor_enabled: 0,
      two_factor_records: 0,
      pending_challenges: 0,
      challenge_attempts: 0,
      trusted_devices: 0,
      sessions: 0,
      oauth_refresh_tokens: 0,
      oauth_access_tokens: 0,
    });

    expect(
      await database
        .prepare("SELECT role FROM user WHERE id = ?")
        .bind(TARGET_ID)
        .first<string>("role"),
    ).toBe("user, admin");
    expect(await count("account", "user_id = ?", TARGET_ID)).toBe(2);
    expect(await count("oauth_client", "user_id = ?", TARGET_ID)).toBe(1);
    expect(await count("oauth_consent", "user_id = ?", TARGET_ID)).toBe(1);
    expect(await count("oauth_client_audit", "owner_user_id = ?", TARGET_ID)).toBe(1);
    expect(await count("security_activity", "target_user_id = ?", TARGET_ID)).toBe(1);
    expect(
      await database
        .prepare("SELECT password FROM account WHERE id = 'target-credential'")
        .first<string>("password"),
    ).toBe("target-password-hash");
    expect(
      await database
        .prepare("SELECT access_token, refresh_token FROM account WHERE id = 'target-github'")
        .first(),
    ).toEqual({
      access_token: "target-provider-access",
      refresh_token: "target-provider-refresh",
    });

    expect(await count("two_factor", "user_id = ?", UNRELATED_ID)).toBe(1);
    expect(await count("verification", "value = ?", UNRELATED_ID)).toBe(2);
    expect(await count("session", "user_id = ?", UNRELATED_ID)).toBe(1);
    expect(await count("oauth_refresh_token", "user_id = ?", UNRELATED_ID)).toBe(1);
    expect(await count("oauth_access_token", "user_id = ?", UNRELATED_ID)).toBe(1);
  });
});
