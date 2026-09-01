import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import { getAdminDashboard } from "./admin-dashboard";

const NOW = Date.UTC(2030, 4, 20, 12);
const SEVEN_DAYS = 7 * 86_400_000;

let miniflare: Miniflare;
let database: D1Database;

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2025-09-02",
      compatibilityFlags: ["nodejs_compat"],
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: "admin-dashboard-test" },
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

  await database.batch([
    database
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at, role, banned, ban_expires) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)",
      )
      .bind(
        "admin-active",
        "Active Administrator",
        "admin@example.com",
        NOW - 86_400_000,
        NOW,
        "user, admin",
        1,
        NOW + 1,
      ),
    database
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at, role, banned, ban_expires) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)",
      )
      .bind(
        "standard-permanent",
        "Permanent Standard",
        "permanent@example.com",
        NOW - SEVEN_DAYS,
        NOW,
        "user",
        1,
        null,
      ),
    database
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at, role, banned, ban_expires) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)",
      )
      .bind(
        "standard-expired",
        "Expired Standard",
        "expired@example.com",
        NOW - SEVEN_DAYS - 1,
        NOW,
        "user",
        1,
        NOW,
      ),
    database
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at, role, banned) VALUES (?, ?, ?, 1, ?, ?, ?, 0)",
      )
      .bind("future-standard", "Future Standard", "future@example.com", NOW + 1, NOW + 1, "user"),
  ]);

  await database.batch(
    [
      ["session-active-admin", NOW + 1, "token-active-admin", "admin-active"],
      ["session-active-standard", NOW + 60_000, "token-active-standard", "standard-permanent"],
      ["session-boundary", NOW, "token-boundary", "standard-expired"],
      ["session-expired", NOW - 1, "token-expired", "standard-expired"],
    ].map(([id, expiresAt, token, userId]) =>
      database
        .prepare(
          "INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(id, expiresAt, token, NOW - 1_000, NOW - 500, userId),
    ),
  );

  await database.batch(
    Array.from({ length: 7 }, (_, index) =>
      database
        .prepare(
          `INSERT INTO security_activity
            (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, target_email, action, details, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          `dashboard-activity-${index}`,
          "admin-active",
          "Administrator Snapshot",
          "admin-snapshot@example.com",
          "standard-permanent",
          "Target Snapshot",
          "target-snapshot@example.com",
          index % 2 === 0 ? "ban" : "unban",
          index % 2 === 0
            ? JSON.stringify({
                reason: "Suspicious activity",
                duration: "permanent",
                expiresAt: null,
                token: "must-not-project",
              })
            : JSON.stringify({ ipAddress: "192.0.2.4" }),
          index < 2 ? NOW : NOW - index,
        ),
    ),
  );
});

afterAll(async () => {
  await miniflare.dispose();
});

describe("Admin Dashboard projection", () => {
  test("summarizes the whole Identity Domain at exact expiry and seven-day boundaries", async () => {
    const dashboard = await getAdminDashboard(database, NOW);

    expect(dashboard.metrics).toEqual({
      totalAccounts: 4,
      currentBans: 2,
      activeSessions: 2,
      recentAccounts: 2,
    });
    expect(
      await database
        .prepare("SELECT banned FROM user WHERE id = 'standard-expired'")
        .first<number>("banned"),
    ).toBe(1);
  });

  test("returns a bounded deterministic and credential-free recent activity preview", async () => {
    const dashboard = await getAdminDashboard(database, NOW);

    expect(dashboard.recentActivity.length).toBe(5);
    expect(dashboard.recentActivity.map((item) => item.activityId)).toEqual([
      "dashboard-activity-1",
      "dashboard-activity-0",
      "dashboard-activity-2",
      "dashboard-activity-3",
      "dashboard-activity-4",
    ]);
    expect(dashboard.recentActivity[0]).toEqual({
      activityId: "dashboard-activity-1",
      actorAccountId: "admin-active",
      actorName: "Administrator Snapshot",
      actorEmail: "admin-snapshot@example.com",
      targetAccountId: "standard-permanent",
      targetName: "Target Snapshot",
      targetEmail: "target-snapshot@example.com",
      action: "unban",
      details: {},
      createdAt: NOW,
    });
    for (const forbidden of ["token-active", "must-not-project", "192.0.2.4", "password"])
      expect(JSON.stringify(dashboard).includes(forbidden)).toBe(false);
  });
});
