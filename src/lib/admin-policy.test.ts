import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { admin } from "better-auth/plugins";

import { administratorExpression } from "./admin-accounts";

import {
  assertAdministratorRouteAccess,
  hasAdministratorRole,
  isAdministratorAccessError,
  isAllowedDirectAdminPluginPath,
  isDirectAdminPluginPath,
} from "./admin-policy";

describe("Administrator boundary policy", () => {
  test("allows Administrator route access and rejects authenticated Standard Accounts explicitly", () => {
    assertAdministratorRouteAccess("admin");
    assertAdministratorRouteAccess("user, admin");

    for (const role of ["user", undefined]) {
      try {
        assertAdministratorRouteAccess(role);
        throw new Error("Expected Administrator route access to be rejected");
      } catch (error) {
        expect(isAdministratorAccessError(error)).toBe(true);
      }
    }
  });

  test("parses roles exactly like the SQL administrator expression", () => {
    const sqlite = new Database(":memory:");
    const cases: Array<[string, boolean]> = [
      ["admin", true],
      [" admin", true],
      ["user, admin", true],
      ["user,admin", true],
      ["ad min", true],
      ["\tadmin", false],
      ["administrator", false],
      ["user", false],
      ["", false],
    ];
    for (const [role, expected] of cases) {
      const row = sqlite
        .query<{ match: number }, [string]>(
          `SELECT (${administratorExpression}) AS match FROM (SELECT ? AS role)`,
        )
        .get(role);
      const sqlMatch = row?.match === 1;
      expect({ role, js: hasAdministratorRole(role), sql: sqlMatch }).toEqual({
        role,
        js: expected,
        sql: expected,
      });
    }
  });

  test("matches only the direct Admin Plugin namespace", () => {
    expect(isDirectAdminPluginPath("/admin/list-users")).toBe(true);
    expect(isDirectAdminPluginPath("/admin/revoke-user-sessions")).toBe(true);
    expect(isAllowedDirectAdminPluginPath("/admin/ban-user")).toBe(true);
    expect(isAllowedDirectAdminPluginPath("/admin/unban-user")).toBe(true);
    expect(isAllowedDirectAdminPluginPath("/admin/revoke-user-session")).toBe(true);
    expect(isAllowedDirectAdminPluginPath("/admin/revoke-user-sessions")).toBe(true);
    expect(isAllowedDirectAdminPluginPath("/admin/list-user-sessions")).toBe(false);
    expect(isDirectAdminPluginPath("/oauth2/get-clients")).toBe(false);
    expect(isDirectAdminPluginPath("/admin/future-endpoint")).toBe(true);
    expect(isAllowedDirectAdminPluginPath("/admin/future-endpoint")).toBe(false);
    expect(isDirectAdminPluginPath("/admin/oauth2/create-client")).toBe(false);
    expect(isDirectAdminPluginPath(undefined)).toBe(false);
  });

  test("classifies every endpoint the installed Admin Plugin exposes", () => {
    const paths = Object.values(admin().endpoints).map((endpoint) => endpoint.path);
    expect(paths).toContain("/admin/ban-user");
    expect(paths.filter((path) => !isDirectAdminPluginPath(path))).toEqual([]);
  });
});
