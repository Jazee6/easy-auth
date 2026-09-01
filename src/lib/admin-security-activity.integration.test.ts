import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import {
  listAccountSecurityActivity,
  listGlobalSecurityActivity,
  normalizeSecurityActivitySearch,
} from "./admin-security";

const DAY = 86_400_000;
const JANUARY_10 = Date.UTC(2030, 0, 10);

let miniflare: Miniflare;
let database: D1Database;

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2025-09-02",
      compatibilityFlags: ["nodejs_compat"],
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: "admin-security-activity-test" },
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

  const rows = Array.from({ length: 24 }, (_, index) => {
    const action = ["ban", "unban", "revoke-session", "revoke-all-sessions"][index % 4];
    const details =
      action === "ban"
        ? JSON.stringify({
            reason: index === 0 ? "Suspicious activity" : "Policy violation",
            duration: "24-hours",
            expiresAt: JANUARY_10 + DAY,
            token: "must-not-project",
          })
        : action === "revoke-session"
          ? JSON.stringify({ sessionId: `safe-session-${index}`, ipAddress: "192.0.2.1" })
          : action === "revoke-all-sessions"
            ? JSON.stringify({ scope: "all", userAgent: "secret-agent" })
            : JSON.stringify({ password: "must-not-project" });
    return database
      .prepare(
        `INSERT INTO security_activity
          (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, target_email, action, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `activity-${index.toString().padStart(2, "0")}`,
        index % 2 === 0 ? "actor-a" : "actor-b",
        index % 2 === 0 ? "Alice Operator" : "Béatrice Operator",
        index % 2 === 0 ? "ALICE@EXAMPLE.COM" : "beatrice@example.com",
        index % 3 === 0 ? "target-a" : "target-b",
        index % 3 === 0 ? "Charlie Account" : "Dana Account",
        index % 3 === 0 ? "charlie@example.com" : "DANA@EXAMPLE.COM",
        action,
        details,
        index < 3 ? JANUARY_10 : JANUARY_10 - index * 1_000,
      );
  });
  await database.batch(rows);
});

afterAll(async () => {
  await miniflare.dispose();
});

function query(input: Record<string, unknown> = {}) {
  return listGlobalSecurityActivity(database, normalizeSecurityActivitySearch(input));
}

describe("global Security activity projection", () => {
  test("normalizes URL state and fixed pagination defaults", () => {
    expect(normalizeSecurityActivitySearch({})).toEqual({ q: "", page: 1 });
    expect(
      normalizeSecurityActivitySearch({
        q: "  Alice  ",
        action: "ban",
        start: "2030-01-12",
        end: "2030-01-10",
        page: 2,
      }),
    ).toEqual({
      q: "Alice",
      action: "ban",
      start: "2030-01-10",
      end: "2030-01-12",
      page: 2,
    });
    expect(normalizeSecurityActivitySearch({ action: "delete", page: -4 })).toEqual({
      q: "",
      page: 1,
    });
    let invalidDateError: unknown;
    try {
      normalizeSecurityActivitySearch({ start: "not-a-date" });
    } catch (error) {
      invalidDateError = error;
    }
    expect(String(invalidDateError)).toContain("Invalid Security activity start date");
  });

  test("pages newest-first with a deterministic ID tie-breaker and safe snapshots", async () => {
    const first = await query();
    const second = await query({ page: 2 });

    expect({
      total: first.total,
      page: first.page,
      pageSize: first.pageSize,
      totalPages: first.totalPages,
    }).toEqual({ total: 24, page: 1, pageSize: 20, totalPages: 2 });
    expect(first.activity.slice(0, 3).map((item) => item.activityId)).toEqual([
      "activity-02",
      "activity-01",
      "activity-00",
    ]);
    expect(second.activity.length).toBe(4);
    expect(first.activity[0]).toEqual({
      activityId: "activity-02",
      actorAccountId: "actor-a",
      actorName: "Alice Operator",
      actorEmail: "ALICE@EXAMPLE.COM",
      targetAccountId: "target-b",
      targetName: "Dana Account",
      targetEmail: "DANA@EXAMPLE.COM",
      action: "revoke-session",
      details: { sessionId: "safe-session-2" },
      createdAt: JANUARY_10,
    });
    for (const forbidden of ["must-not-project", "192.0.2.1", "secret-agent", "password", "token"])
      expect(JSON.stringify(first).includes(forbidden)).toBe(false);
  });

  test("combines action and case-insensitive actor-or-target snapshot search", async () => {
    const actor = await query({ q: "alice operator", action: "ban" });
    const targetEmail = await query({ q: "dana@example.com", action: "unban" });
    const literalWildcard = await query({ q: "%" });

    expect(actor.total).toBe(6);
    expect(actor.activity.every((item) => item.action === "ban")).toBe(true);
    expect(targetEmail.total).toBe(4);
    expect(targetEmail.activity.every((item) => item.targetName === "Dana Account")).toBe(true);
    expect(literalWildcard.total).toBe(0);
  });

  test("includes both boundary dates and normalizes reversed ranges", async () => {
    const bothDates = await query({ start: "2030-01-09", end: "2030-01-10" });
    const sameDay = await query({ start: "2030-01-10", end: "2030-01-10" });
    const reversed = await query({ start: "2030-01-11", end: "2030-01-10" });
    const after = await query({ start: "2030-01-11" });

    expect(bothDates.total).toBe(24);
    expect(sameDay.total).toBe(3);
    expect(reversed.total).toBe(3);
    expect(after.total).toBe(0);
  });

  test("retains immutable snapshots after live Account changes and matches per-Account isolation", async () => {
    await database
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('target-a', 'Live Name', 'live@example.com', 1, ?, ?)",
      )
      .bind(JANUARY_10, JANUARY_10)
      .run();
    await database
      .prepare(
        "UPDATE user SET name = 'Renamed Live Account', email = 'renamed@example.com' WHERE id = 'target-a'",
      )
      .run();
    await database.prepare("DELETE FROM user WHERE id = 'target-a'").run();

    const result = await query({ q: "Charlie Account" });
    const perAccount = await listAccountSecurityActivity(database, "target-a");
    expect(result.total).toBe(8);
    expect(result.activity.every((item) => item.targetAccountId === "target-a")).toBe(true);
    expect(result.activity.every((item) => item.targetName === "Charlie Account")).toBe(true);
    expect(result.activity.map((item) => item.activityId)).toEqual(
      perAccount.map((item) => item.activityId),
    );
  });
});
