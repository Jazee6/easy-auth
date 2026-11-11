import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import { purgeExpiredAuthData, RATE_LIMIT_ROW_RETENTION_MS } from "./maintenance";

let miniflare: Miniflare;
let database: D1Database;

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2025-09-02",
      compatibilityFlags: ["nodejs_compat"],
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: "easy-auth-maintenance-test" },
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
});

afterAll(async () => {
  await miniflare.dispose();
});

async function ids(table: string): Promise<string[]> {
  const { results } = await database
    .prepare(`SELECT id FROM ${table} ORDER BY id`)
    .all<{ id: string }>();
  return results.map((row) => row.id);
}

describe("Expired auth data purge", () => {
  test("deletes only expired Sessions, verifications and stale rate-limit rows", async () => {
    const now = Date.UTC(2030, 0, 1);
    await database.batch([
      database
        .prepare(
          "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('u1', 'U', 'u@example.com', 1, ?, ?)",
        )
        .bind(now, now),
      ...[
        ["session-expired", now - 1],
        ["session-live", now + 60_000],
      ].map(([id, expiresAt]) =>
        database
          .prepare(
            "INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, 'u1')",
          )
          .bind(id, expiresAt, `token-${id}`, now, now),
      ),
      ...[
        ["verification-expired", now - 1],
        ["verification-live", now + 60_000],
      ].map(([id, expiresAt]) =>
        database
          .prepare(
            "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, 'v', ?, ?, ?)",
          )
          .bind(id, `identifier-${id}`, expiresAt, now, now),
      ),
      ...[
        ["rate-limit-stale", now - RATE_LIMIT_ROW_RETENTION_MS - 1],
        ["rate-limit-recent", now - 60_000],
      ].map(([id, lastRequest]) =>
        database
          .prepare("INSERT INTO rate_limit (id, key, count, last_request) VALUES (?, ?, 1, ?)")
          .bind(id, `key-${id}`, lastRequest),
      ),
    ]);

    expect(await purgeExpiredAuthData(database, now)).toEqual({
      sessions: 1,
      verifications: 1,
      rateLimits: 1,
    });
    expect(await ids("session")).toEqual(["session-live"]);
    expect(await ids("verification")).toEqual(["verification-live"]);
    expect(await ids("rate_limit")).toEqual(["rate-limit-recent"]);
  });
});
