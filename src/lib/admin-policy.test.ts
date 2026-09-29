import { describe, expect, test } from "bun:test";
import { admin } from "better-auth/plugins";

import {
  assertAdministratorRouteAccess,
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

  test("matches only the direct Admin Plugin namespace", () => {
    expect(isDirectAdminPluginPath("/admin/list-users")).toBe(true);
    expect(isDirectAdminPluginPath("/admin/revoke-user-sessions")).toBe(true);
    expect(isAllowedDirectAdminPluginPath("/admin/ban-user")).toBe(true);
    expect(isAllowedDirectAdminPluginPath("/admin/unban-user")).toBe(true);
    expect(isAllowedDirectAdminPluginPath("/admin/revoke-user-session")).toBe(true);
    expect(isAllowedDirectAdminPluginPath("/admin/revoke-user-sessions")).toBe(true);
    expect(isAllowedDirectAdminPluginPath("/admin/list-user-sessions")).toBe(false);
    expect(isDirectAdminPluginPath("/oauth2/get-clients")).toBe(false);
    expect(isDirectAdminPluginPath("/admin/create-oauth-client")).toBe(false);
    expect(isDirectAdminPluginPath(undefined)).toBe(false);
  });

  test("classifies every endpoint the installed Admin Plugin exposes", () => {
    const paths = Object.values(admin().endpoints).map((endpoint) => endpoint.path);
    expect(paths).toContain("/admin/ban-user");
    expect(paths.filter((path) => !isDirectAdminPluginPath(path))).toEqual([]);
  });
});
