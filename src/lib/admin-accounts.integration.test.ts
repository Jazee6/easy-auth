import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import {
  getIdentityDomainAccount,
  getIdentityDomainAccountDetail,
  listIdentityDomainAccounts,
  normalizeAccountListSearch,
} from "./admin-accounts";

const NOW = 2_000_000_000_000;

let miniflare: Miniflare;
let database: D1Database;

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2025-09-02",
      compatibilityFlags: ["nodejs_compat"],
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: "admin-accounts-test" },
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

  const accounts = [
    [
      "admin-a",
      "Alice Admin",
      "Alice@Example.com",
      1,
      "https://example.com/alice.png",
      NOW - 100,
      NOW - 90,
      "user, admin",
      0,
      null,
      null,
    ],
    [
      "active-b",
      "Bob Active",
      "bob@example.com",
      0,
      null,
      NOW - 200,
      NOW - 190,
      "user",
      1,
      "Suspicious activity",
      NOW + 10_000,
    ],
    [
      "expired-c",
      "Charlie Expired",
      "charlie@example.com",
      1,
      null,
      NOW - 300,
      NOW - 290,
      "user",
      1,
      "Policy violation",
      NOW - 10_000,
    ],
    [
      "standard-d",
      "Dana Standard",
      "dana@example.com",
      1,
      null,
      NOW - 400,
      NOW - 390,
      null,
      0,
      null,
      null,
    ],
    ["tie-a", "Zeta Tie", "zeta-a@example.com", 1, null, NOW - 50, NOW - 40, "user", 0, null, null],
    ["tie-b", "Zeta Tie", "zeta-b@example.com", 1, null, NOW - 50, NOW - 40, "user", 0, null, null],
    ...Array.from({ length: 22 }, (_, index) => [
      `filler-${index.toString().padStart(2, "0")}`,
      `Filler ${index.toString().padStart(2, "0")}`,
      `filler-${index.toString().padStart(2, "0")}@example.com`,
      index % 2,
      null,
      NOW - 1_000 - index,
      NOW - 900 - index,
      "user",
      0,
      null,
      null,
    ]),
  ];

  await database.batch(
    accounts.map((account) =>
      database
        .prepare(
          "INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at, role, banned, ban_reason, ban_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(...account),
    ),
  );
});

afterAll(async () => {
  await miniflare.dispose();
});

function query(input: Record<string, unknown> = {}) {
  return listIdentityDomainAccounts(database, normalizeAccountListSearch(input), NOW);
}

describe("Identity Domain Account projection", () => {
  test("pages all Standard and Administrator Accounts with a safe projection", async () => {
    const firstPage = await query();
    const secondPage = await query({ page: 2 });

    expect(firstPage.total).toBe(28);
    expect(firstPage.pageSize).toBe(20);
    expect(firstPage.page).toBe(1);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.accounts.length).toBe(20);
    expect(secondPage.accounts.length).toBe(8);
    expect(firstPage.accounts.slice(0, 2).map((account) => account.accountId)).toEqual([
      "tie-a",
      "tie-b",
    ]);
    expect(firstPage.accounts.some((account) => account.role === "administrator")).toBe(true);

    expect(firstPage.accounts.find((account) => account.accountId === "active-b")).toEqual({
      accountId: "active-b",
      name: "Bob Active",
      email: "bob@example.com",
      emailVerified: false,
      image: null,
      role: "standard",
      banState: "active",
      banReason: "Suspicious activity",
      banExpires: NOW + 10_000,
      createdAt: NOW - 200,
      updatedAt: NOW - 190,
    });
    const serialized = JSON.stringify(firstPage);
    for (const secretField of ["token", "password", "providerId", 'accountId":"credential']) {
      expect(serialized.includes(secretField)).toBe(false);
    }
  });

  test("searches name or email case-insensitively and combines role and Ban filters", async () => {
    const nameSearch = await query({ q: "  ALICE admin " });
    const emailSearch = await query({ q: "ALICE@EXAMPLE.COM" });
    const administrator = await query({ role: "administrator" });
    const expiredStandard = await query({ role: "standard", ban: "expired" });
    const literalWildcard = await query({ q: "%" });

    expect(nameSearch.accounts.map((account) => account.accountId)).toEqual(["admin-a"]);
    expect(emailSearch.accounts.map((account) => account.accountId)).toEqual(["admin-a"]);
    expect(administrator.accounts.map((account) => account.accountId)).toEqual(["admin-a"]);
    expect(expiredStandard.accounts.map((account) => account.accountId)).toEqual(["expired-c"]);
    expect(literalWildcard.total).toBe(0);
  });

  test("classifies effective Ban state without mutating expired rows", async () => {
    expect((await query({ ban: "active" })).accounts.map((account) => account.accountId)).toEqual([
      "active-b",
    ]);
    expect((await query({ ban: "expired" })).accounts.map((account) => account.accountId)).toEqual([
      "expired-c",
    ]);
    expect(
      await database
        .prepare("SELECT banned FROM user WHERE id = 'expired-c'")
        .first<number>("banned"),
    ).toBe(1);
  });

  test("projects safe Standard and Administrator Account details", async () => {
    const standard = await getIdentityDomainAccount(database, "active-b", NOW);
    const administrator = await getIdentityDomainAccount(database, "admin-a", NOW);

    expect(standard).toEqual({
      accountId: "active-b",
      name: "Bob Active",
      email: "bob@example.com",
      emailVerified: false,
      image: null,
      role: "standard",
      banState: "active",
      banReason: "Suspicious activity",
      banExpires: NOW + 10_000,
      createdAt: NOW - 200,
      updatedAt: NOW - 190,
    });
    expect(administrator?.role).toBe("administrator");
    expect(await getIdentityDomainAccount(database, "missing", NOW)).toBeNull();
    for (const secretField of ["token", "password", "providerId", "userAgent", "ipAddress"]) {
      expect(JSON.stringify({ standard, administrator }).includes(secretField)).toBe(false);
    }
  });

  test("projects authoritative Two-Factor state on detail but not list projections", async () => {
    const accountIds = ["admin-a", "active-b"];

    for (const accountId of accountIds) {
      for (const enabled of [false, true]) {
        await database
          .prepare("UPDATE user SET two_factor_enabled = ? WHERE id = ?")
          .bind(enabled ? 1 : 0, accountId)
          .run();
        expect(
          (await getIdentityDomainAccountDetail(database, accountId, NOW))?.twoFactorEnabled,
        ).toBe(enabled);
      }
    }

    expect(await getIdentityDomainAccountDetail(database, "missing", NOW)).toBeNull();
    const listProjection = await getIdentityDomainAccount(database, "admin-a", NOW);
    expect(listProjection && "twoFactorEnabled" in listProjection).toBe(false);

    const administrator = await getIdentityDomainAccountDetail(database, "admin-a", NOW);
    const standard = await getIdentityDomainAccountDetail(database, "active-b", NOW);
    const serialized = JSON.stringify({ administrator, standard });
    for (const sensitiveField of [
      "secret",
      "backupCodes",
      "failedVerificationCount",
      "lockedUntil",
      "trustedDevice",
      "token",
      "password",
    ]) {
      expect(serialized.includes(sensitiveField)).toBe(false);
    }
  });

  test("supports every stable sort mode and clamps out-of-range pages", async () => {
    const expectations = [
      [{ sort: "name", direction: "asc" }, "admin-a"],
      [{ sort: "name", direction: "desc" }, "tie-a"],
      [{ sort: "email", direction: "asc" }, "admin-a"],
      [{ sort: "email", direction: "desc" }, "tie-b"],
      [{ sort: "createdAt", direction: "asc" }, "filler-21"],
      [{ sort: "createdAt", direction: "desc" }, "tie-a"],
    ] as const;

    for (const [input, firstAccountId] of expectations) {
      expect((await query(input)).accounts[0]?.accountId).toBe(firstAccountId);
    }

    const outOfRange = await query({ page: 99 });
    expect(outOfRange.page).toBe(2);
    expect(outOfRange.accounts.length).toBe(8);
  });
});
