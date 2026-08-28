import { describe, expect, test } from "bun:test";

import {
  clientRegistrationSchema,
  getBannedUserId,
  getOAuthContinuationPayload,
  getOAuthManagementActionError,
  getPendingOAuthVerificationUrl,
  hasAdministratorRole,
  isDirectOAuthManagementPath,
  oauthClientCreatePayload,
  oauthSecurityEventPolicy,
  redactAuditSummary,
  scopeDescriptions,
  translateOAuthManagementError,
  validateOAuthRedirectUris,
} from "./oauth-policy";
import * as v from "valibot";

describe("OAuth management policy", () => {
  test("recognizes only the administrator role", () => {
    expect(hasAdministratorRole("admin")).toBe(true);
    expect(hasAdministratorRole("user,admin")).toBe(true);
    expect(hasAdministratorRole("user")).toBe(false);
    expect(hasAdministratorRole(undefined)).toBe(false);
  });

  test("allows the three supported client combinations", () => {
    for (const input of [
      { name: "Web confidential", applicationType: "web", authentication: "confidential" },
      { name: "Web public", applicationType: "web", authentication: "public" },
      { name: "Native public", applicationType: "native", authentication: "public" },
    ] as const) {
      expect(
        v.safeParse(clientRegistrationSchema, {
          ...input,
          redirectUris: "https://client.example/callback",
        }).success,
      ).toBe(true);
    }
  });

  test("rejects Native confidential clients", () => {
    expect(
      v.safeParse(clientRegistrationSchema, {
        name: "Native secret",
        applicationType: "native",
        authentication: "confidential",
        redirectUris: "com.example.app:/callback",
      }).success,
    ).toBe(false);
  });

  test("builds a fixed least-privilege registration payload", () => {
    expect(
      oauthClientCreatePayload({
        name: " Example App ",
        applicationType: "web",
        authentication: "confidential",
        redirectUris: "https://client.example/callback\nhttps://client.example/second",
      }),
    ).toEqual({
      client_name: "Example App",
      application_type: "web",
      redirect_uris: ["https://client.example/callback", "https://client.example/second"],
      token_endpoint_auth_method: "client_secret_basic",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "openid profile email offline_access",
      require_pkce: true,
      client_secret_expires_at: 0,
      client_credentials_scopes: [],
      skip_consent: false,
      enable_end_session: false,
      subject_type: "public",
    });
  });

  test("audit summaries never retain credential values", () => {
    const redacted = redactAuditSummary({
      changed: ["name", "client_secret", "access_token", "refresh_token"],
      client_secret: "ea_cs_secret",
    });
    expect(redacted).toContain("name");
    expect(redacted.includes("secret")).toBe(false);
    expect(redacted.includes("token")).toBe(false);
  });

  test("keeps consent distinct from sessions and forced token invalidation", () => {
    expect(oauthSecurityEventPolicy.signOut).toEqual({ revokeTokens: false, deleteConsent: false });
    expect(oauthSecurityEventPolicy.passwordReset).toEqual({
      revokeTokens: false,
      deleteConsent: false,
    });
    expect(oauthSecurityEventPolicy.ban).toEqual({ revokeTokens: true, deleteConsent: false });
    expect(oauthSecurityEventPolicy.applicationAuthorizationRevocation).toEqual({
      revokeTokens: true,
      deleteConsent: true,
    });
  });

  test("blocks direct client mutation and non-atomic consent deletion paths", () => {
    for (const path of [
      "/oauth2/create-client",
      "/oauth2/update-client",
      "/oauth2/client/rotate-secret",
      "/oauth2/delete-client",
      "/oauth2/delete-consent",
      "/oauth2/update-consent",
    ]) {
      expect(isDirectOAuthManagementPath(path)).toBe(true);
    }
    expect(isDirectOAuthManagementPath("/oauth2/get-clients")).toBe(false);
  });

  test("uses the provider post-login continuation mode by default", () => {
    expect(getOAuthContinuationPayload()).toEqual({ postLogin: true });
    expect(getOAuthContinuationPayload({ created: true })).toEqual({ created: true });
  });

  test("preserves the signed authorization query through email verification", () => {
    const result = getPendingOAuthVerificationUrl(
      "?client_id=client-1&state=state-1&sig=signed&ba_param=client_id",
      " User@Example.com ",
    );
    expect(result).toBe(
      "/verify-email?client_id=client-1&state=state-1&sig=signed&ba_param=client_id&email=user%40example.com",
    );
    expect(getPendingOAuthVerificationUrl("?client_id=client-1", "user@example.com")).toBeNull();
  });

  test("recognizes every supported administrator ban path", () => {
    expect(getBannedUserId("/admin/ban-user", { userId: "user-1" })).toBe("user-1");
    expect(
      getBannedUserId("/admin/update-user", {
        userId: "user-2",
        data: { banned: true },
      }),
    ).toBe("user-2");
    expect(
      getBannedUserId("/admin/update-user", {
        userId: "user-2",
        data: { banned: false },
      }),
    ).toBeNull();
  });

  test("validates redirect URI policy before atomic client updates", () => {
    expect(validateOAuthRedirectUris(["https://client.example/callback"], "web")).toBeNull();
    for (const unsafeWebRedirect of [
      "http://127.0.0.1:4000/callback",
      "https://127.0.0.2/callback",
      "https://[0:0:0:0:0:0:0:1]/callback",
      "https://localhost./callback",
    ]) {
      expect(validateOAuthRedirectUris([unsafeWebRedirect], "web")).toBe(
        "Web clients require HTTPS redirect URIs on non-loopback hosts.",
      );
    }
    expect(validateOAuthRedirectUris(["http://127.0.0.1:4000/callback"], "native")).toBeNull();
    expect(validateOAuthRedirectUris(["http://127.0.0.2:4000/callback"], "native")).toBe(
      "Native HTTP redirects must use an exact loopback host.",
    );
  });

  test("maps provider failures to stable management guidance", () => {
    expect(
      translateOAuthManagementError({
        message: "web clients require https redirect URIs on non-loopback hosts",
      }),
    ).toBe("Web clients require HTTPS redirect URIs on non-loopback hosts.");
    expect(translateOAuthManagementError(new Error("raw framework details"))).toBe(
      "Unable to save the OAuth client. Check the application type and exact redirect URIs.",
    );
    expect(getOAuthManagementActionError("status", new Error("raw database details"))).toBe(
      "Unable to change the client status. Try again.",
    );
    expect(getOAuthManagementActionError("rotate", new Error("raw framework details"))).toBe(
      "Unable to rotate the client secret. Try again.",
    );
    expect(getOAuthManagementActionError("delete", new Error("raw provider details"))).toBe(
      "Unable to delete the OAuth client. Try again.",
    );
  });

  test("all supported scopes have account-facing descriptions", () => {
    expect(Object.keys(scopeDescriptions)).toEqual([
      "openid",
      "profile",
      "email",
      "offline_access",
    ]);
  });
});
